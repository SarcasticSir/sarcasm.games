const { isRateLimited } = require('../_lib/rate-limit');
const { clearSessionCookie } = require('../_lib/auth');

function parseRequestBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (error) {
      return {};
    }
  }
  if (typeof body === 'object') return body;
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (await isRateLimited(req, 'auth:logout')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  const { honeypot } = parseRequestBody(req.body);

  if (honeypot && String(honeypot).trim()) {
    res.status(400).json({ error: 'Request rejected' });
    return;
  }

  clearSessionCookie(res);
  res.status(200).json({ ok: true });
};
