const { requireSession } = require('../_lib/auth');
const { getProfileByAuthUserId } = require('../_lib/db');
const { getSupabaseAdminClient } = require('../_lib/supabase');

function parseRequestBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body;
  return {};
}

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { userId } = parseRequestBody(req.body);
  const targetUserId = readString(userId);
  if (!targetUserId) {
    res.status(400).json({ error: 'Invalid user id', code: 'INVALID_USER_ID' });
    return;
  }

  if (targetUserId === session.id) {
    res.status(403).json({ error: 'Cannot delete your own account', code: 'CANNOT_DELETE_SELF' });
    return;
  }

  try {
    const targetProfile = await getProfileByAuthUserId(targetUserId);
    if (!targetProfile) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }

    if (readString(targetProfile.role) === 'admin') {
      res.status(403).json({ error: 'Cannot delete admin user', code: 'CANNOT_DELETE_ADMIN' });
      return;
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (error) {
      console.error('[admin/delete-user] Failed to delete user', {
        targetUserId,
        error: error.message
      });
      res.status(500).json({ error: 'Failed to delete user', code: 'DELETE_FAILED' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[admin/delete-user] Failed to process delete', {
      targetUserId,
      error: error?.message
    });
    res.status(500).json({ error: 'Failed to delete user', code: 'DELETE_FAILED' });
  }
};
