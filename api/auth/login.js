const { isRateLimited } = require('../_lib/rate-limit');
const { getProfileByIdentifier, normalizeUsername, upsertProfileFromAuthUser } = require('../_lib/db');
const { setAuthCookies, mapAuthUser } = require('../_lib/auth');
const { getSupabaseAnonClient } = require('../_lib/supabase');

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

function isEmailConfirmationError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return message.includes('email not confirmed')
    || message.includes('not confirmed')
    || message.includes('email confirmation')
    || code === 'email_not_confirmed';
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

    const normalizedIdentifier = normalizeUsername(String(username));
    const rawPassword = String(password);

    if (!normalizedIdentifier || normalizedIdentifier.length < 3 || normalizedIdentifier.length > 254) {
      res.status(400).json({ error: 'Invalid username length' });
      return;
    }

    if (rawPassword.length < 1 || rawPassword.length > 128) {
      res.status(400).json({ error: 'Invalid password length' });
      return;
    }

    const profile = await getProfileByIdentifier(normalizedIdentifier);
    if (!profile?.email) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: rawPassword
    });

    if (error) {
      if (isEmailConfirmationError(error)) {
        res.status(403).json({
          error: 'You must confirm your email before logging in. Check spam if you did not receive the email, or resend it.',
          requiresEmailConfirmation: true
        });
        return;
      }

      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    if (!data?.session || !data?.user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    if (!data.user.email_confirmed_at) {
      res.status(403).json({
        error: 'You must confirm your email before logging in. Check spam if you did not receive the email, or resend it.',
        requiresEmailConfirmation: true
      });
      return;
    }

    const syncedProfile = await upsertProfileFromAuthUser(data.user) || profile;

    setAuthCookies(res, data.session);

    res.status(200).json({
      user: mapAuthUser(data.user, { profile: syncedProfile })
    });
  } catch (error) {
    console.error('[auth/login] Login failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Login failed' });
  }
};
