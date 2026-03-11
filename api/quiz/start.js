const { runQuery } = require('../_lib/db');

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (error) {
      return {};
    }
  }
  return typeof body === 'object' ? body : {};
}

function mapQuestion(row, lang) {
  const prompt = lang === 'no'
    ? row.question_no || row.question_en || row.question || ''
    : row.question_en || row.question_no || row.question || '';

  return {
    id: row.id,
    category: row.category || 'General',
    prompt
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { mode = 'random10', count = 10, lang = 'en' } = parseBody(req.body);

    if (mode !== 'random10') {
      res.status(400).json({ error: 'Only random10 mode is enabled right now.' });
      return;
    }

    const limit = Math.max(1, Math.min(Number(count) || 10, 50));

    const query = await runQuery(
      `SELECT id, category, question_en, question_no, question
       FROM quiz_questions
       ORDER BY RANDOM()
       LIMIT $1`,
      [limit]
    );

    const questions = query.rows.map((row) => mapQuestion(row, lang));

    res.status(200).json({
      mode: 'random10',
      count: questions.length,
      questions
    });
  } catch (error) {
    console.error('[quiz/start] failed:', error?.message);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
};
