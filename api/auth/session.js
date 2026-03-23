const { isRateLimited } = require('../_lib/rate-limit');
const { getSessionFromCookies, clearSessionCookie } = require('../_lib/auth');

function serializeSession(session) {
  return session
    ? {
        id: session.id,
        username: session.username,
        email: session.email,
        role: session.role,
        country: session.country
      }
    : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (await isRateLimited(req, 'auth:session')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  try {
    const session = await getSessionFromCookies(req, res, { allowRefresh: true });

    if (!session) {
      res.status(200).json({ user: null });
      return;
    }

    res.status(200).json({
      user: serializeSession(session)
    });
  } catch (error) {
    console.error('[auth/session] Failed to load session:', {
      message: error?.message,
      stack: error?.stack
    });

    clearSessionCookie(res);
    res.status(200).json({ user: null });
  }
};
