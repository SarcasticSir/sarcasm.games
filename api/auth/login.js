const bcrypt = require('bcryptjs');
const { getUserByUsername } = require('../_lib/db');
const { setSessionCookie, signSessionToken } = require('../_lib/auth');

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

  try {
    if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
      console.error('[auth/login] Missing AUTH_SECRET or NEXTAUTH_SECRET environment variable.');
      res.status(500).json({ error: 'Server auth secret is not configured.' });
      return;
    }

    const { username, password } = parseRequestBody(req.body);
    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const user = await getUserByUsername(normalizedUsername);
    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const passwordOk = await bcrypt.compare(String(password), user.password_hash);
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
