const { Pool } = require('pg');
const { nowInMs, createQueryMetric } = require('./observability');

const DB_POOL_KEY = Symbol.for('sarcasm.games.db.pool');
const DB_POOL_LOGGER_KEY = Symbol.for('sarcasm.games.db.poolLoggerAttached');

const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;

function isTruthy(value) {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parsePositiveIntEnv(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const rawValue = process.env[name];
  if (rawValue == null || rawValue === '') return fallback;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
}

function serializeDbError(error) {
  return {
    message: error?.message || 'Unknown database error',
    code: error?.code || 'UNKNOWN'
  };
}

function getConnectionString() {
  const candidates = [
    process.env.SUPABASE_DB_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL
  ];

  const connectionString = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  if (!connectionString) {
    throw new Error('Missing Postgres connection string. Set SUPABASE_DB_URL or DATABASE_URL.');
  }

  return connectionString;
}

function shouldUseSsl(connectionString) {
  if (isTruthy(process.env.DB_SSL)) return true;
  if (process.env.DB_SSL === 'disable') return false;

  try {
    const parsed = new URL(connectionString);
    return parsed.hostname.endsWith('.supabase.co') || parsed.searchParams.get('sslmode') === 'require';
  } catch {
    return false;
  }
}

function getPoolConfig() {
  const connectionString = getConnectionString();
  const sslEnabled = shouldUseSsl(connectionString);

  return {
    connectionString,
    max: parsePositiveIntEnv('DB_POOL_MAX', DEFAULT_POOL_MAX, { min: 1, max: 50 }),
    idleTimeoutMillis: parsePositiveIntEnv('DB_POOL_IDLE_TIMEOUT_MS', DEFAULT_IDLE_TIMEOUT_MS, { min: 1_000, max: 300_000 }),
    connectionTimeoutMillis: parsePositiveIntEnv('DB_POOL_CONNECTION_TIMEOUT_MS', DEFAULT_CONNECTION_TIMEOUT_MS, { min: 100, max: 60_000 }),
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  };
}

function createSharedPool() {
  const poolConfig = getPoolConfig();
  const pool = new Pool(poolConfig);

  pool.on('error', (error) => {
    console.error('[db] Unexpected pool error', serializeDbError(error));
  });

  pool[DB_POOL_LOGGER_KEY] = true;

  console.info('[db] Pool initialized', {
    max: poolConfig.max,
    idleTimeoutMillis: poolConfig.idleTimeoutMillis,
    connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
    sslEnabled: Boolean(poolConfig.ssl)
  });

  return pool;
}

function getPool() {
  if (!globalThis[DB_POOL_KEY]) {
    globalThis[DB_POOL_KEY] = createSharedPool();
    return globalThis[DB_POOL_KEY];
  }

  const pool = globalThis[DB_POOL_KEY];

  if (!pool[DB_POOL_LOGGER_KEY] && typeof pool.on === 'function') {
    pool.on('error', (error) => {
      console.error('[db] Unexpected pool error', serializeDbError(error));
    });
    pool[DB_POOL_LOGGER_KEY] = true;
  }

  return pool;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeUsername(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeCountry(value) {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toUpperCase();
  if (!normalized) return 'unknown';
  return normalized.slice(0, 8);
}

async function runQuery(text, params = []) {
  const pool = getPool();
  const startedAtMs = nowInMs();
  const flushQueryMetric = createQueryMetric(text, startedAtMs);

  try {
    const result = await pool.query(text, params);
    flushQueryMetric({ rowCount: result?.rowCount || 0 });
    return result;
  } catch (error) {
    flushQueryMetric({ error });
    console.error('[db] Query failed', serializeDbError(error));
    throw error;
  }
}

async function getProfileByAuthUserId(authUserId) {
  if (!authUserId) return null;

  const result = await runQuery(
    `SELECT auth_user_id, username, username_normalized, email, email_normalized, role, country, created_at, updated_at
     FROM public.profiles
     WHERE auth_user_id = $1
     LIMIT 1`,
    [authUserId]
  );

  return result.rows[0] || null;
}

async function getProfileByIdentifier(identifier) {
  const normalizedIdentifier = normalizeUsername(identifier);
  if (!normalizedIdentifier) return null;

  const result = await runQuery(
    `SELECT auth_user_id, username, username_normalized, email, email_normalized, role, country, created_at, updated_at
     FROM public.profiles
     WHERE username_normalized = $1 OR email_normalized = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );

  return result.rows[0] || null;
}

async function findConflictingProfile({ username, email }) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedUsername && !normalizedEmail) return null;

  const clauses = [];
  const params = [];

  if (normalizedUsername) {
    params.push(normalizedUsername);
    clauses.push(`username_normalized = $${params.length}`);
  }

  if (normalizedEmail) {
    params.push(normalizedEmail);
    clauses.push(`email_normalized = $${params.length}`);
  }

  const result = await runQuery(
    `SELECT auth_user_id, username, username_normalized, email, email_normalized, role, country
     FROM public.profiles
     WHERE ${clauses.join(' OR ')}
     LIMIT 1`,
    params
  );

  return result.rows[0] || null;
}

async function insertProfile({ authUserId, username, email, role = 'user', country = 'unknown' }) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);

  if (!authUserId || !normalizedUsername || !normalizedEmail) {
    throw new Error('Missing required profile fields');
  }

  const result = await runQuery(
    `INSERT INTO public.profiles (
       auth_user_id,
       username,
       username_normalized,
       email,
       email_normalized,
       role,
       country
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING auth_user_id, username, username_normalized, email, email_normalized, role, country, created_at, updated_at`,
    [authUserId, String(username).trim(), normalizedUsername, normalizedEmail, normalizedEmail, role, normalizeCountry(country)]
  );

  return result.rows[0] || null;
}

async function listProfiles() {
  const result = await runQuery(
    `SELECT auth_user_id, username, email, role, country, created_at
     FROM public.profiles
     ORDER BY created_at ASC, username_normalized ASC`
  );

  return result.rows;
}

module.exports = {
  runQuery,
  normalizeEmail,
  normalizeUsername,
  normalizeCountry,
  getProfileByAuthUserId,
  getProfileByIdentifier,
  findConflictingProfile,
  insertProfile,
  listProfiles
};
