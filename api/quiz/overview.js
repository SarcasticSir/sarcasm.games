const { requireSession } = require('../_lib/auth');
const { getQuizCategories, getQuizCategoryProgress } = require('../_lib/db');

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
    const categories = await getQuizCategories();
    const progress = await getQuizCategoryProgress(session.id);

    res.status(200).json({
      categories,
      progress
    });
  } catch (error) {
    console.error('[quiz/overview] Failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Failed to load quiz overview' });
  }
};
