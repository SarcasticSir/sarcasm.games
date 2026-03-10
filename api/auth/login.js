const bcrypt = require('bcryptjs');
const { getUserByEmail } = require('../_lib/db');
const { setSessionCookie, signSessionToken } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await getUserByEmail(normalizedEmail);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password' });
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
    res.status(500).json({ error: 'Login failed' });
  }
};
