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

  if (isRateLimited(req, 'auth:register')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  try {
    const { username, email, password, honeypot } = parseRequestBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email and password are required' });
      return;
    }

    const trimmedUsername = String(username).trim();
    const trimmedEmail = String(email).trim();
    const rawPassword = String(password);

    if (trimmedUsername.length < 3 || trimmedUsername.length > 40) {
      res.status(400).json({ error: 'Username must be 3-40 characters' });
      return;
    }

    if (trimmedEmail.length < 5 || trimmedEmail.length > 254) {
      res.status(400).json({ error: 'Invalid email length' });
      return;
    }

    if (rawPassword.length < 8 || rawPassword.length > 128) {
      res.status(400).json({ error: 'Password must be 8-128 characters' });
      return;
    }

    const bcrypt = require('bcryptjs');
    const { getUserByEmail, getUserByUsername, insertUser } = require('../_lib/db');

    const normalizedUsername = trimmedUsername.toLowerCase();
    const normalizedEmail = trimmedEmail.toLowerCase();

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

    const passwordHash = await bcrypt.hash(rawPassword, 12);
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
    console.error('[auth/register] Registration failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Registration failed' });
  }
};
