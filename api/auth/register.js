const bcrypt = require('bcryptjs');
const { getUserByEmail, getUserByUsername, insertUser } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email and password are required' });
      return;
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const normalizedEmail = String(email).trim().toLowerCase();

    if (normalizedUsername.length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 characters' });
      return;
    }

    if (String(password).length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const existingByEmail = await getUserByEmail(normalizedEmail);
    if (existingByEmail) {
      res.status(409).json({ error: 'Email is already registered' });
      return;
    }

    const existingByUsername = await getUserByUsername(normalizedUsername);
    if (existingByUsername) {
      res.status(409).json({ error: 'Username is already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const countryHeader = req.headers['x-vercel-ip-country'];
    const country = typeof countryHeader === 'string' && countryHeader.trim() ? countryHeader.trim() : 'unknown';

    const user = await insertUser({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role: 'user',
      country
    });

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        country: user.country
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
};
