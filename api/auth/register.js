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

  if (await isRateLimited(req, 'auth:register')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  try {
    const { username, email, password, honeypot } = parseRequestBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    const trimmedEmail = String(email).trim();
    const rawPassword = String(password);

    if (trimmedUsername && (trimmedUsername.length < 3 || trimmedUsername.length > 40)) {
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

    const { setAuthCookies, mapAuthUser } = require('../_lib/auth');
    const { getSupabaseAnonClient, getSupabaseAdminClient } = require('../_lib/supabase');

    const normalizedUsername = trimmedUsername ? trimmedUsername.toLowerCase() : null;
    const normalizedEmail = trimmedEmail.toLowerCase();

    const countryHeader = req.headers['x-vercel-ip-country'];
    const country = typeof countryHeader === 'string' && countryHeader.trim() ? countryHeader.trim() : 'unknown';

    const adminClient = getSupabaseAdminClient();
    const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: rawPassword,
      email_confirm: true,
      app_metadata: {
        role: 'user'
      },
      user_metadata: {
        ...(normalizedUsername ? { username: normalizedUsername } : {}),
        country
      }
    });

    if (createUserError || !createdUserData?.user?.id) {
      const status = createUserError?.status === 422 ? 409 : 500;
      res.status(status).json({ error: createUserError?.message || 'Failed to create account' });
      return;
    }

    const supabase = getSupabaseAnonClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: rawPassword
    });

    if (signInError || !signInData?.session) {
      res.status(201).json({
        user: mapAuthUser(createdUserData.user)
      });
      return;
    }

    setAuthCookies(res, signInData.session);

    res.status(201).json({
      user: mapAuthUser(signInData.user || createdUserData.user)
    });
  } catch (error) {
    console.error('[auth/register] Registration failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Registration failed' });
  }
};
