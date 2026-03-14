const { runQuery } = require('./db');

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 5;

const SCOPE_LIMITS = {
  auth: {
    windowMs: DEFAULT_WINDOW_MS,
    maxRequests: DEFAULT_MAX_REQUESTS_PER_WINDOW
  },
  'quiz:start': {
    windowMs: 60 * 1000,
    maxRequests: 60,
    burstWindowMs: 10 * 1000,
    burstMaxRequests: 12
  },
  'quiz:quest': {
    windowMs: 60 * 1000,
    maxRequests: 120,
    burstWindowMs: 10 * 1000,
    burstMaxRequests: 24
  },
  'quiz:answer': {
    windowMs: 60 * 1000,
    maxRequests: 180,
    burstWindowMs: 10 * 1000,
    burstMaxRequests: 36
  }
};

const localFallbackBuckets = new Map();
let hasAttemptedSchemaInit = false;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return 'unknown-ip';
}

function getScopeConfig(scope) {
  return SCOPE_LIMITS[scope] || SCOPE_LIMITS.auth;
}

async function ensureRateLimitSchema() {
  if (hasAttemptedSchemaInit) return;
  hasAttemptedSchemaInit = true;

  await runQuery(
    `CREATE TABLE IF NOT EXISTS quiz_rate_limits (
      scope TEXT NOT NULL,
      client_ip TEXT NOT NULL,
      window_bucket BIGINT NOT NULL,
      window_count INTEGER NOT NULL,
      burst_bucket BIGINT,
      burst_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (scope, client_ip)
    )`
  );

  await runQuery(
    `CREATE INDEX IF NOT EXISTS quiz_rate_limits_updated_at_idx
     ON quiz_rate_limits (updated_at)`
  );
}

async function isRateLimitedInSharedStore(req, scope) {
  await ensureRateLimitSchema();

  const now = Date.now();
  const ip = getClientIp(req);
  const config = getScopeConfig(scope);

  const windowBucket = Math.floor(now / config.windowMs);
  const burstBucket = (config.burstWindowMs && config.burstMaxRequests)
    ? Math.floor(now / config.burstWindowMs)
    : null;

  const result = await runQuery(
    `INSERT INTO quiz_rate_limits (
       scope, client_ip, window_bucket, window_count, burst_bucket, burst_count, updated_at
     )
     VALUES ($1, $2, $3, 1, $4, CASE WHEN $4 IS NULL THEN 0 ELSE 1 END, NOW())
     ON CONFLICT (scope, client_ip)
     DO UPDATE SET
       window_bucket = CASE
         WHEN quiz_rate_limits.window_bucket = EXCLUDED.window_bucket
         THEN quiz_rate_limits.window_bucket
         ELSE EXCLUDED.window_bucket
       END,
       window_count = CASE
         WHEN quiz_rate_limits.window_bucket = EXCLUDED.window_bucket
         THEN quiz_rate_limits.window_count + 1
         ELSE 1
       END,
       burst_bucket = CASE
         WHEN EXCLUDED.burst_bucket IS NULL THEN NULL
         WHEN quiz_rate_limits.burst_bucket = EXCLUDED.burst_bucket THEN quiz_rate_limits.burst_bucket
         ELSE EXCLUDED.burst_bucket
       END,
       burst_count = CASE
         WHEN EXCLUDED.burst_bucket IS NULL THEN 0
         WHEN quiz_rate_limits.burst_bucket = EXCLUDED.burst_bucket THEN quiz_rate_limits.burst_count + 1
         ELSE 1
       END,
       updated_at = NOW()
     RETURNING window_count, burst_count`,
    [scope, ip, windowBucket, burstBucket]
  );

  const row = result.rows[0] || {};
  const windowCount = Number(row.window_count) || 0;
  const burstCount = Number(row.burst_count) || 0;

  if (windowCount > config.maxRequests) {
    return true;
  }

  if (config.burstMaxRequests && burstCount > config.burstMaxRequests) {
    return true;
  }

  return false;
}

function isRateLimitedInMemory(req, scope = 'auth') {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${scope}:${ip}`;
  const config = getScopeConfig(scope);

  const bucket = localFallbackBuckets.get(key) || { windowTimestamps: [], burstTimestamps: [] };

  const freshWindow = bucket.windowTimestamps.filter((timestamp) => now - timestamp < config.windowMs);
  if (freshWindow.length >= config.maxRequests) {
    localFallbackBuckets.set(key, {
      windowTimestamps: freshWindow,
      burstTimestamps: bucket.burstTimestamps
    });
    return true;
  }

  let freshBurst = bucket.burstTimestamps;
  if (config.burstWindowMs && config.burstMaxRequests) {
    freshBurst = bucket.burstTimestamps.filter((timestamp) => now - timestamp < config.burstWindowMs);
    if (freshBurst.length >= config.burstMaxRequests) {
      localFallbackBuckets.set(key, {
        windowTimestamps: freshWindow,
        burstTimestamps: freshBurst
      });
      return true;
    }

    freshBurst.push(now);
  }

  freshWindow.push(now);
  localFallbackBuckets.set(key, {
    windowTimestamps: freshWindow,
    burstTimestamps: freshBurst
  });

  return false;
}

async function isRateLimited(req, scope = 'auth') {
  try {
    return await isRateLimitedInSharedStore(req, scope);
  } catch (error) {
    console.warn('[rate-limit] Shared store unavailable, using in-memory fallback:', error?.message);
    return isRateLimitedInMemory(req, scope);
  }
}

module.exports = {
  isRateLimited
};
