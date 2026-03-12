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
    const {
      mode = 'random10',
      categories,
      count = 10,
      lang = 'en'
    } = parseBody(req.body);

    if (mode === 'categories') {
      if (!Array.isArray(categories) || !categories.length) {
        res.status(400).json({ error: 'categories must be a non-empty array of strings.' });
        return;
      }

      const selectedCategories = categories
        .map((category) => (typeof category === 'string' ? category.trim() : ''))
        .filter(Boolean);

      if (!selectedCategories.length || selectedCategories.length !== categories.length) {
        res.status(400).json({ error: 'categories must be a non-empty array of strings.' });
        return;
      }

      const uniqueCategories = [...new Set(selectedCategories)];

      const countResult = await runQuery(
        `SELECT COUNT(*)::int AS total
         FROM quiz_questions
         WHERE category = ANY($1)`,
        [uniqueCategories]
      );

      const totalAvailable = Number(countResult.rows[0]?.total || 0);

      if (totalAvailable < 1) {
        res.status(400).json({ error: 'No questions available for selected categories.' });
        return;
      }

      const requestedCount = Number(count);
      if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > totalAvailable) {
        res.status(400).json({ error: `count must be an integer between 1 and ${totalAvailable}.` });
        return;
      }

      const query = await runQuery(
        `SELECT id, category, question_en, question_no, answers_en, answers_no
         FROM quiz_questions
         WHERE category = ANY($1)
         ORDER BY RANDOM()
         LIMIT $2`,
        [uniqueCategories, requestedCount]
      );

      const questions = query.rows
        .map((row) => mapQuestion(row, lang))
        .filter((row) => row.prompt && row.answers.length);

      res.status(200).json({
        mode: 'categories',
        count: requestedCount,
        totalAvailable,
        selectedCategories: uniqueCategories,
        questions
      });
      return;
    }

    if (mode !== 'random10') {
      res.status(400).json({ error: 'Only random10 and categories modes are supported.' });
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
