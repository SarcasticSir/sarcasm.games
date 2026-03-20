const { isRateLimited } = require('../_lib/rate-limit');
const { getProfileByIdentifier, normalizeUsername } = require('../_lib/db');
const { getSupabaseAnonClient, getSupabaseAdminClient } = require('../_lib/supabase');

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

  if (await isRateLimited(req, 'auth:resend-confirmation')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  try {
    const { username, honeypot } = parseRequestBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    const identifier = normalizeUsername(String(username || ''));
    if (!identifier) {
      res.status(400).json({ error: 'username is required' });
      return;
    }

    const profile = await getProfileByIdentifier(identifier);
    if (!profile?.email || !profile?.auth_user_id) {
      res.status(200).json({ ok: true });
      return;
    }

    const adminClient = getSupabaseAdminClient();
    const { data: adminData, error: adminError } = await adminClient.auth.admin.getUserById(profile.auth_user_id);
    if (adminError) {
      throw adminError;
    }

    if (adminData?.user?.email_confirmed_at) {
      res.status(200).json({ ok: true, alreadyConfirmed: true });
      return;
    }

    const supabase = getSupabaseAnonClient();
    const emailRedirectTo = getEmailConfirmRedirectTo();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: profile.email,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {})
    });

    if (error) {
      throw error;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[auth/resend-confirmation] Failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Could not resend confirmation email' });
  }
};
