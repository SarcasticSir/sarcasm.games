const { requireSession } = require('../_lib/auth');
const { getUsersForAdminList } = require('../_lib/db');

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
    const users = await getUsersForAdminList();
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load users' });
  }
};
