const { isRateLimited } = require('../_lib/rate-limit');
const { findConflictingProfile, insertProfile, normalizeCountry, normalizeEmail, normalizeUsername } = require('../_lib/db');
const { mapAuthUser } = require('../_lib/auth');
const { getSupabaseAnonClient, getSupabaseAdminClient } = require('../_lib/supabase');

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

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

function getCountryFromRequest(req) {
  const candidates = [
    req.headers['x-vercel-ip-country'],
    req.headers['cf-ipcountry'],
    req.headers['x-country-code']
  ];

  const firstMatch = candidates.find((value) => typeof value === 'string' && value.trim());
  return normalizeCountry(firstMatch || 'unknown');
}

function getEmailConfirmRedirectTo() {
  if (process.env.SUPABASE_EMAIL_CONFIRM_REDIRECT_TO) {
    return process.env.SUPABASE_EMAIL_CONFIRM_REDIRECT_TO;
  }

  const siteUrl = process.env.PUBLIC_SITE_URL;
  if (!siteUrl) return undefined;

  return `${siteUrl.replace(/\/$/, '')}/api/auth/confirm`;
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

    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email and password are required' });
      return;
    }

    const displayUsername = String(username).trim();
    const normalizedUsername = normalizeUsername(displayUsername);
    const normalizedEmail = normalizeEmail(String(email));
    const rawPassword = String(password);

    if (!normalizedUsername || displayUsername.length < 3 || displayUsername.length > 40) {
      res.status(400).json({ error: 'Username must be 3-40 characters' });
      return;
    }

    if (!USERNAME_PATTERN.test(displayUsername)) {
      res.status(400).json({ error: 'Username may only contain letters, numbers, underscore and hyphen' });
      return;
    }

    if (!normalizedEmail || normalizedEmail.length < 5 || normalizedEmail.length > 254) {
      res.status(400).json({ error: 'Invalid email length' });
      return;
    }

    if (rawPassword.length < 8 || rawPassword.length > 128) {
      res.status(400).json({ error: 'Password must be 8-128 characters' });
      return;
    }

    const conflict = await findConflictingProfile({ username: normalizedUsername, email: normalizedEmail });
    if (conflict?.username_normalized === normalizedUsername) {
      res.status(409).json({ error: 'Username is already in use' });
      return;
    }

    if (conflict?.email_normalized === normalizedEmail) {
      res.status(409).json({ error: 'Email is already in use' });
      return;
    }

    const supabase = getSupabaseAnonClient();
    const emailRedirectTo = getEmailConfirmRedirectTo();
    const country = getCountryFromRequest(req);
    const signUpOptions = {
      data: {
        username: displayUsername,
        country
      },
      ...(emailRedirectTo ? { emailRedirectTo } : {})
    };
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: rawPassword,
      options: signUpOptions
    });

    if (signUpError || !signUpData?.user?.id) {
      const status = signUpError?.status === 422 ? 409 : 500;
      res.status(status).json({ error: signUpError?.message || 'Failed to create account' });
      return;
    }

    let profile = null;

    try {
      profile = await insertProfile({
        authUserId: signUpData.user.id,
        username: displayUsername,
        email: normalizedEmail,
        role: 'user',
        country
      });
    } catch (profileError) {
      try {
        const adminClient = getSupabaseAdminClient();
        await adminClient.auth.admin.deleteUser(signUpData.user.id);
      } catch (rollbackError) {
        console.error('[auth/register] Failed to rollback auth user after profile insert error:', rollbackError?.message);
      }
      throw profileError;
    }

    res.status(201).json({
      user: mapAuthUser(signUpData.user, { profile }),
      requiresEmailConfirmation: !signUpData.session,
      message: 'Account created. Confirm your email before logging in.'
    });
  } catch (error) {
    console.error('[auth/register] Registration failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: error?.message || 'Registration failed' });
  }
};
