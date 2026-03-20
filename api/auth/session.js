const { isRateLimited } = require('../_lib/rate-limit');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (await isRateLimited(req, 'auth:session')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  const { getSessionFromCookies, clearSessionCookie } = require('../_lib/auth');

  let session = null;
  try {
    session = await getSessionFromCookies(req, res, { allowRefresh: true });
  } catch (error) {
    clearSessionCookie(res);
  }

  if (!session) {
    res.status(200).json({ user: null });
    return;
  }

  res.status(200).json({
    user: {
      id: session.id,
      username: session.username,
      email: session.email,
      role: session.role,
      country: session.country
    }
  });
};
