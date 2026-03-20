const { setAuthCookies } = require('../_lib/auth');
const { upsertProfileFromAuthUser } = require('../_lib/db');
const { getSupabaseAnonClient } = require('../_lib/supabase');

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getQueryParams(req) {
  const baseUrl = `https://${req.headers.host || 'sarcasm.games'}`;
  const parsedUrl = new URL(req.url, baseUrl);
  return parsedUrl.searchParams;
}

function redirectHome(res, { error = null } = {}) {
  const location = error ? `/?auth_error=${encodeURIComponent(error)}` : '/';
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const params = getQueryParams(req);
    const code = readString(params.get('code'));
    const tokenHash = readString(params.get('token_hash'));
    const type = readString(params.get('type'));
    const accessToken = readString(params.get('access_token'));
    const refreshToken = readString(params.get('refresh_token'));

    const supabase = getSupabaseAnonClient();
    let data = null;
    let error = null;

    if (code) {
      ({ data, error } = await supabase.auth.exchangeCodeForSession(code));
    } else if (tokenHash && type) {
      ({ data, error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash
      }));
    } else if (accessToken && refreshToken) {
      ({ data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }));
    } else {
      redirectHome(res, { error: 'missing_confirmation_token' });
      return;
    }

    if (error || !data?.session || !data?.user) {
      console.error('[auth/confirm] Confirmation failed:', error?.message || 'Missing session after confirmation');
      redirectHome(res, { error: 'confirmation_failed' });
      return;
    }

    await upsertProfileFromAuthUser(data.user);
    setAuthCookies(res, data.session);
    redirectHome(res);
  } catch (error) {
    console.error('[auth/confirm] Confirmation failed:', {
      message: error?.message,
      stack: error?.stack
    });
    redirectHome(res, { error: 'confirmation_failed' });
  }
};
