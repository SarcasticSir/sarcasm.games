const { requireSession } = require('../../_lib/auth');
const { runQuery } = require('../../_lib/db');

function parseId(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

module.exports = async function handler(req, res) {
  const id = parseId(req.query?.id);
  if (!id) {
    res.status(400).json({ error: 'Invalid message id' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const result = await runQuery(
        `SELECT id, created_at, user_id, name, email, message, status
         FROM public.contact_messages
         WHERE id = $1
         LIMIT 1`,
        [id]
      );

      if (!result.rows[0]) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      res.status(200).json({ message: result.rows[0] });
      return;
    }

    if (req.method === 'PATCH') {
      const updatedResult = await runQuery(
        `UPDATE public.contact_messages
         SET status = 'read'
         WHERE id = $1
           AND status = 'new'
         RETURNING id, status`,
        [id]
      );

      if (updatedResult.rows[0]) {
        res.status(200).json({ message: updatedResult.rows[0] });
        return;
      }

      const existingResult = await runQuery(
        `SELECT id, status
         FROM public.contact_messages
         WHERE id = $1
         LIMIT 1`,
        [id]
      );

      if (!existingResult.rows[0]) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      res.status(200).json({ message: existingResult.rows[0] });
      return;
    }

    if (req.method === 'DELETE') {
      const deleteResult = await runQuery(
        `DELETE FROM public.contact_messages
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (!deleteResult.rows[0]) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      res.status(200).json({ deleted: true, id });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[admin/contact-messages/:id] Failed:', error?.message);
    res.status(500).json({ error: 'Failed to process contact message' });
  }
};
