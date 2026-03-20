const { isRateLimited } = require('../_lib/rate-limit');
const { getSessionFromCookies, clearSessionCookie, requireSession, setAuthCookies, mapAuthUser } = require('../_lib/auth');
const { upsertProfileFromAuthUser } = require('../_lib/db');
const { getSupabaseAdminClient, getSupabaseAnonClient } = require('../_lib/supabase');

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

function serializeSession(session) {
  return session
    ? {
      id: session.id,
      username: session.username,
      email: session.email,
      role: session.role,
      country: session.country
    }
    : null;
}

async function handleGetSession(req, res) {
  if (await isRateLimited(req, 'auth:session')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  let session = null;
  try {
    session = await getSessionFromCookies(req, res, { allowRefresh: true });
  } catch (error) {
    clearSessionCookie(res);
  }

  res.status(200).json({ user: serializeSession(session) });
}

async function handleLogout(req, res, body) {
  if (await isRateLimited(req, 'auth:logout')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  if (body.honeypot && String(body.honeypot).trim()) {
    res.status(400).json({ error: 'Request rejected' });
    return;
  }

  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

async function handleDeleteAccount(req, res, body) {
  if (await isRateLimited(req, 'auth:delete-account')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  if (body.honeypot && String(body.honeypot).trim()) {
    res.status(400).json({ error: 'Request rejected' });
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(session.id);
    if (error) {
      console.error('[auth/session] Failed to delete user:', error.message);
      res.status(500).json({ error: 'Failed to delete account' });
      return;
    }

    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[auth/session] Failed to delete account:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Failed to delete account' });
  }
}

async function handleSyncSession(req, res, body) {
  const { accessToken, refreshToken } = body;

  if (!accessToken || !refreshToken) {
    res.status(400).json({ error: 'accessToken and refreshToken are required' });
    return;
  }

  try {
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
    console.error('[auth/session] Failed to sync session:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Could not sync session' });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    await handleGetSession(req, res);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = parseRequestBody(req.body);
  const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';

  if (action === 'logout') {
    await handleLogout(req, res, body);
    return;
  }

  if (action === 'delete-account') {
    await handleDeleteAccount(req, res, body);
    return;
  }

  if (action === 'sync') {
    await handleSyncSession(req, res, body);
    return;
  }

  res.status(400).json({ error: 'Invalid session action' });
};
