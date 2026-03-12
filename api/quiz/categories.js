const { runQuery } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const query = await runQuery(
      `SELECT category, COUNT(*)::int AS question_count
       FROM quiz_questions
       WHERE category IS NOT NULL AND TRIM(category) <> ''
       GROUP BY category
       ORDER BY category ASC`
    );

    const categories = query.rows
      .map((row) => ({
        name: row.category,
        count: Number(row.question_count) || 0
      }))
      .filter((category) => category.count > 0);

    res.status(200).json({ categories });
  } catch (error) {
    console.error('[quiz/categories] failed:', error?.message);
    res.status(500).json({ error: 'Failed to load categories' });
  }
};
