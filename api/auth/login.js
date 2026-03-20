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
    const { email, password, honeypot } = parseRequestBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const trimmedEmail = String(email).trim();
    const rawPassword = String(password);

    if (trimmedEmail.length < 5 || trimmedEmail.length > 254) {
      res.status(400).json({ error: 'Invalid email length' });
      return;
    }

    if (rawPassword.length < 1 || rawPassword.length > 128) {
      res.status(400).json({ error: 'Invalid password length' });
      return;
    }

    const { setAuthCookies, mapAuthUser } = require('../_lib/auth');
    const { getSupabaseAnonClient } = require('../_lib/supabase');
    const normalizedEmail = trimmedEmail.toLowerCase();

    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: rawPassword
    });

    if (error || !data?.session || !data?.user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    setAuthCookies(res, data.session);

    res.status(200).json({
      user: mapAuthUser(data.user)
    });
  } catch (error) {
    console.error('[auth/login] Login failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Login failed' });
  }
};
