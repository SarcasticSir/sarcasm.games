function nowInMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

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

function createEndpointMetric(req, res, endpoint) {
  const startedAtMs = nowInMs();
  let flushed = false;

  return function flushEndpointMetric(error = null) {
    if (flushed) return;
    flushed = true;

    const durationMs = Math.max(0, nowInMs() - startedAtMs);
    const payload = {
      metric: 'endpoint_latency',
      endpoint,
      method: req.method,
      statusCode: Number(res.statusCode) || 0,
      durationMs: Number(durationMs.toFixed(2)),
      isError: Boolean(error),
      clientIp: getClientIp(req),
      instance: process.env.VERCEL_REGION || process.env.NODE_ENV || 'unknown'
    };

    if (error && error.message) {
      payload.errorMessage = error.message;
    }

    console.info('[metrics]', payload);
  };
}

function summarizeQuery(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function createQueryMetric(queryText, startedAtMs) {
  let flushed = false;

  return function flushQueryMetric({ error = null, rowCount = 0 } = {}) {
    if (flushed) return;
    flushed = true;

    const durationMs = Math.max(0, nowInMs() - startedAtMs);

    console.info('[metrics]', {
      metric: 'db_query',
      query: summarizeQuery(queryText),
      durationMs: Number(durationMs.toFixed(2)),
      rowCount: Number(rowCount) || 0,
      isError: Boolean(error)
    });
  };
}

module.exports = {
  nowInMs,
  createEndpointMetric,
  createQueryMetric
};
