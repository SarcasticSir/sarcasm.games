const { setAuthCookies, mapAuthUser } = require('../_lib/auth');
const { upsertProfileFromAuthUser } = require('../_lib/db');
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { accessToken, refreshToken } = parseRequestBody(req.body);

    if (!accessToken || !refreshToken) {
      res.status(400).json({ error: 'accessToken and refreshToken are required' });
      return;
    }

    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase.auth.setSession({
      access_token: String(accessToken),
      refresh_token: String(refreshToken)
    });

    if (error || !data?.session || !data?.user) {
      res.status(401).json({ error: 'Invalid session payload' });
      return;
    }

    const profile = await upsertProfileFromAuthUser(data.user);
    setAuthCookies(res, data.session);

    res.status(200).json({
      user: mapAuthUser(data.user, { profile })
    });
  } catch (error) {
    console.error('[auth/sync-session] Failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Could not sync session' });
  }
};
