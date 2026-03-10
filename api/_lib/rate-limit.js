const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

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

function isRateLimited(req, scope = 'auth') {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${scope}:${ip}`;

  const bucket = requestBuckets.get(key) || [];
  const fresh = bucket.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (fresh.length >= MAX_REQUESTS_PER_WINDOW) {
    requestBuckets.set(key, fresh);
    return true;
  }

  fresh.push(now);
  requestBuckets.set(key, fresh);
  return false;
}

module.exports = {
  isRateLimited
};
