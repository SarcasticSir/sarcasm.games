const { createPool } = require('@vercel/postgres');
const { nowInMs, createQueryMetric } = require('./observability');

const DB_POOL_KEY = Symbol.for('sarcasm.games.db.pool');
const DB_POOL_LOGGER_KEY = Symbol.for('sarcasm.games.db.poolLoggerAttached');

const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;

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

function getPoolConfig() {
  return {
    max: parsePositiveIntEnv('DB_POOL_MAX', DEFAULT_POOL_MAX, { min: 1, max: 50 }),
    idleTimeoutMillis: parsePositiveIntEnv('DB_POOL_IDLE_TIMEOUT_MS', DEFAULT_IDLE_TIMEOUT_MS, { min: 1_000, max: 300_000 }),
    connectionTimeoutMillis: parsePositiveIntEnv('DB_POOL_CONNECTION_TIMEOUT_MS', DEFAULT_CONNECTION_TIMEOUT_MS, { min: 100, max: 60_000 })
  };
}

function createSharedPool() {
  const poolConfig = getPoolConfig();
  const pool = createPool(poolConfig);

  pool.on('error', (error) => {
    console.error('[db] Unexpected pool error', serializeDbError(error));
  });

  pool[DB_POOL_LOGGER_KEY] = true;

  console.info('[db] Pool initialized', {
    max: poolConfig.max,
    idleTimeoutMillis: poolConfig.idleTimeoutMillis,
    connectionTimeoutMillis: poolConfig.connectionTimeoutMillis
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

async function getUserByEmail(email) {
  const result = await runQuery(
    `SELECT id, username, email, password_hash, role, country, created_at, updated_at
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function getUserByUsername(username) {
  const result = await runQuery(
    `SELECT id, username, email, password_hash, role, country, created_at, updated_at
     FROM users
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [username]
  );
  return result.rows[0] || null;
}

async function getUserById(id) {
  const result = await runQuery(
    `SELECT id, username, email, password_hash, role, country, created_at, updated_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function insertUser({ username, email, passwordHash, role = 'user', country }) {
  const result = await runQuery(
    `INSERT INTO users (username, email, password_hash, role, country)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, email, role, country, created_at, updated_at`,
    [username, email, passwordHash, role, country]
  );
  return result.rows[0];
}

async function updatePasswordByUserId(userId, passwordHash) {
  await runQuery(
    `UPDATE users
     SET password_hash = $1
     WHERE id = $2`,
    [passwordHash, userId]
  );
}

async function getUsersForAdminList() {
  const result = await runQuery(
    `SELECT id, username, email, role, country, created_at, updated_at
     FROM users
     ORDER BY created_at DESC`
  );
  return result.rows;
}


module.exports = {
  runQuery,
  getUserByEmail,
  getUserByUsername,
  getUserById,
  insertUser,
  updatePasswordByUserId,
  getUsersForAdminList
};
