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

  if (await isRateLimited(req, 'auth:login')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  try {
    const { username, password, honeypot } = parseRequestBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
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

    const { getUserByUsername } = require('../_lib/db');
    const { setAuthCookies } = require('../_lib/auth');
    const { getSupabaseAnonClient } = require('../_lib/supabase');

    const normalizedUsername = trimmedUsername.toLowerCase();
    const profile = await getUserByUsername(normalizedUsername);
    if (!profile?.email) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: rawPassword
    });

    if (error || !data?.session || !data?.user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    setAuthCookies(res, data.session);

    res.status(200).json({
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        role: profile.role,
        country: profile.country || 'unknown'
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
