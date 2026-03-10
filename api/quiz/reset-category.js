const { requireSession } = require('../_lib/auth');
const { resetUserProgressByCategory } = require('../_lib/db');

function parseBody(body) {
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

  const session = await requireSession(req, res);
  if (!session) return;

  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const { category, honeypot } = parseBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    const value = String(category || '').trim();
    if (!value || value.length > 120) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }

    await resetUserProgressByCategory(session.id, value);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[quiz/reset-category] Failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Failed to reset category progress' });
  }
};
