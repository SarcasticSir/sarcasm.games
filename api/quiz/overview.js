const { runQuery } = require('../_lib/db');

function mapCategory(row) {
  return {
    name: row.category,
    questionCount: Number(row.question_count) || 0
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const query = await runQuery(
      `SELECT category, COUNT(*)::int AS question_count
       FROM quiz_questions
       GROUP BY category
       ORDER BY category ASC`
    );

    const categories = query.rows
      .map((row) => mapCategory(row))
      .filter((row) => row.name && row.questionCount > 0);

    const totalQuestions = categories
      .reduce((sum, category) => sum + category.questionCount, 0);

    res.status(200).json({
      categories,
      totalQuestions
    });
  } catch (error) {
    console.error('[quiz/overview] failed:', error?.message);
    res.status(500).json({ error: 'Failed to fetch quiz overview' });
  }
};
