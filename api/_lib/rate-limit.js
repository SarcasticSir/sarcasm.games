const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 5;

// Recommended starting thresholds (tune from production telemetry):
// - auth: strict to slow down brute-force attempts.
// - quiz:*: higher sustained rates than auth, plus short burst caps to dampen spikes.
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

const requestBuckets = new Map();

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

function isRateLimited(req, scope = 'auth') {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${scope}:${ip}`;
  const config = getScopeConfig(scope);

  const bucket = requestBuckets.get(key) || { windowTimestamps: [], burstTimestamps: [] };

  const freshWindow = bucket.windowTimestamps.filter((timestamp) => now - timestamp < config.windowMs);
  if (freshWindow.length >= config.maxRequests) {
    requestBuckets.set(key, {
      windowTimestamps: freshWindow,
      burstTimestamps: bucket.burstTimestamps
    });
    return true;
  }

  let freshBurst = bucket.burstTimestamps;
  if (config.burstWindowMs && config.burstMaxRequests) {
    freshBurst = bucket.burstTimestamps.filter((timestamp) => now - timestamp < config.burstWindowMs);
    if (freshBurst.length >= config.burstMaxRequests) {
      requestBuckets.set(key, {
        windowTimestamps: freshWindow,
        burstTimestamps: freshBurst
      });
      return true;
    }

    freshBurst.push(now);
  }

  freshWindow.push(now);
  requestBuckets.set(key, {
    windowTimestamps: freshWindow,
    burstTimestamps: freshBurst
  });

  return false;
}

module.exports = {
  isRateLimited
};
