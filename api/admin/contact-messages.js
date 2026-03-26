const { requireSession } = require('../_lib/auth');
const { runQuery } = require('../_lib/db');

function mapRow(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    name: row.name,
    email: row.email,
    message: row.message,
    status: row.status,
    user_id: row.user_id
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
    const result = await runQuery(
      `SELECT id, created_at, user_id, name, email, message, status
       FROM public.contact_messages
       ORDER BY created_at DESC
       LIMIT 200`
    );

    res.status(200).json({ messages: result.rows.map(mapRow) });
  } catch (error) {
    console.error('[admin/contact-messages] Failed to fetch messages:', error?.message);
    res.status(500).json({ error: 'Failed to fetch contact messages' });
  }
};
