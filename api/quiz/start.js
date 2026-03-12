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

function normalizeAnswerValues(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((part) => normalizeAnswerValues(part));
  }

  return String(value)
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractAnswers(row, lang) {
  const preferred = lang === 'no'
    ? [row.answers_no, row.answers_en]
    : [row.answers_en, row.answers_no];

  const seen = new Set();
  return preferred
    .flatMap((value) => normalizeAnswerValues(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function mapQuestion(row, lang) {
  const prompt = lang === 'no'
    ? row.question_no || row.question_en || ''
    : row.question_en || row.question_no || '';

  return {
    id: row.id,
    category: row.category || 'General',
    prompt,
    answers: extractAnswers(row, lang)
  };
}

function parseCategoryList(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  return value
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { mode = 'random10', count = 10, lang = 'en', categories: rawCategories } = parseBody(req.body);
    const limit = Math.max(1, Math.min(Number(count) || 10, 50));

    let query;
    if (mode === 'random10') {
      query = await runQuery(
        `SELECT id, category, question_en, question_no, answers_en, answers_no
         FROM quiz_questions
         ORDER BY RANDOM()
         LIMIT $1`,
        [limit]
      );
    } else if (mode === 'categories') {
      const categories = parseCategoryList(rawCategories);
      if (!categories.length) {
        res.status(400).json({ error: 'At least one category must be selected.' });
        return;
      }

      query = await runQuery(
        `SELECT id, category, question_en, question_no, answers_en, answers_no
         FROM quiz_questions
         WHERE category = ANY($1::text[])
         ORDER BY RANDOM()
         LIMIT $2`,
        [categories, limit]
      );
    } else {
      res.status(400).json({ error: 'Unsupported quiz mode.' });
      return;
    }

    const questions = query.rows
      .map((row) => mapQuestion(row, lang))
      .filter((row) => row.prompt && row.answers.length);

    res.status(200).json({
      mode,
      count: questions.length,
      questions
    });
  } catch (error) {
    console.error('[quiz/start] failed:', error?.message);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
};
