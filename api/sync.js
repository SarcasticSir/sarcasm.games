const { isRateLimited } = require('./_lib/rate-limit');
const { requireSession } = require('./_lib/auth');
const { syncGarden } = require('../lib/server/garden-sync-service');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, 'garden:sync')) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const payload = await syncGarden(session.id);
    res.status(200).json(payload);
  } catch (error) {
    console.error('[sync] Failed to sync garden:', error.message);
    res.status(500).json({ error: 'Unable to sync garden right now.' });
  }
};
