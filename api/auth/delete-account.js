const { isRateLimited } = require('../_lib/rate-limit');
const { requireSession, clearSessionCookie } = require('../_lib/auth');
const { getSupabaseAdminClient } = require('../_lib/supabase');

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

  if (await isRateLimited(req, 'auth:delete-account')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  const { honeypot } = parseRequestBody(req.body);
  if (honeypot && String(honeypot).trim()) {
    res.status(400).json({ error: 'Request rejected' });
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(session.id);
    if (error) {
      console.error('[auth/delete-account] Failed to delete user:', error.message);
      res.status(500).json({ error: 'Failed to delete account' });
      return;
    }

    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[auth/delete-account] Failed to delete account:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
