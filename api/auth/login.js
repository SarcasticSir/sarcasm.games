const { isRateLimited } = require('../_lib/rate-limit');

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

  if (isRateLimited(req, 'auth:login')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  try {
    const { username, password, honeypot } = parseRequestBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
      console.error('[auth/login] Missing AUTH_SECRET or NEXTAUTH_SECRET environment variable.');
      res.status(500).json({ error: 'Server auth secret is not configured.' });
      return;
    }

    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    const trimmedUsername = String(username).trim();
    const rawPassword = String(password);

    if (trimmedUsername.length < 3 || trimmedUsername.length > 40) {
      res.status(400).json({ error: 'Invalid username length' });
      return;
    }

    if (rawPassword.length < 1 || rawPassword.length > 128) {
      res.status(400).json({ error: 'Invalid password length' });
      return;
    }

    const bcrypt = require('bcryptjs');
    const { getUserByUsername } = require('../_lib/db');
    const { setSessionCookie, signSessionToken } = require('../_lib/auth');

    const normalizedUsername = trimmedUsername.toLowerCase();
    const user = await getUserByUsername(normalizedUsername);
    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const passwordOk = await bcrypt.compare(rawPassword, user.password_hash);
    if (!passwordOk) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = await signSessionToken({
      sub: String(user.id),
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      country: user.country || 'unknown'
    });

    setSessionCookie(res, token);

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        country: user.country || 'unknown'
      }
    });
  } catch (error) {
    console.error('[auth/login] Login failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Login failed' });
  }
};
