const { requireSession } = require('../_lib/auth');
const { getSupabaseAdminClient } = require('../_lib/supabase');

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapMember(user) {
  const email = readString(user?.email);
  const username = readString(user?.user_metadata?.username)
    || (email ? email.split('@')[0] : null)
    || 'user';

  return {
    id: user.id,
    username,
    email,
    country: readString(user?.user_metadata?.country) || 'unknown'
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const adminClient = getSupabaseAdminClient();
    const { data, error } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (error) {
      throw error;
    }

    const users = Array.isArray(data?.users) ? data.users.map(mapMember) : [];
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load users' });
  }
};
