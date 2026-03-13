const { runQuery } = require('../_lib/db');
const { parseCookies, verifySessionToken, COOKIE_NAME } = require('../_lib/auth');

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

function parseSolvedQuestionIds(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0)
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
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

async function tryGetSession(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    return await verifySessionToken(token);
  } catch (error) {
    return null;
  }
}

function normalizeAnswerValues(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((part) => normalizeAnswerValues(part));
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

function isQuestionValid(question) {
  return Boolean(question && question.prompt && Array.isArray(question.answers) && question.answers.length);
}

async function pickRandomQuestion({ categories, userId, solvedQuestionIds }) {
  if (userId) {
    const countResult = await runQuery(
      `SELECT COUNT(*)::int AS total
       FROM quiz_questions q
       WHERE q.category = ANY($1)
         AND NOT EXISTS (
           SELECT 1
           FROM user_answers ua
           WHERE ua.user_id = $2
             AND ua.question_id = q.id
             AND ua.is_correct = TRUE
         )`,
      [categories, userId]
    );

    const total = Number(countResult.rows[0]?.total) || 0;
    if (total < 1) return null;

    const offset = Math.floor(Math.random() * total);
    const query = await runQuery(
      `SELECT q.id, q.category, q.question_en, q.question_no, q.answers_en, q.answers_no
       FROM quiz_questions q
       WHERE q.category = ANY($1)
         AND NOT EXISTS (
           SELECT 1
           FROM user_answers ua
           WHERE ua.user_id = $2
             AND ua.question_id = q.id
             AND ua.is_correct = TRUE
         )
       ORDER BY q.id ASC
       LIMIT 1 OFFSET $3`,
      [categories, userId, offset]
    );

    return query.rows[0] || null;
  }

  const excludedIds = solvedQuestionIds.length ? solvedQuestionIds : [0];
  const countResult = await runQuery(
    `SELECT COUNT(*)::int AS total
     FROM quiz_questions q
     WHERE q.category = ANY($1)
       AND NOT (q.id = ANY($2::int[]))`,
    [categories, excludedIds]
  );

  const total = Number(countResult.rows[0]?.total) || 0;
  if (total < 1) return null;

  const offset = Math.floor(Math.random() * total);
  const query = await runQuery(
    `SELECT q.id, q.category, q.question_en, q.question_no, q.answers_en, q.answers_no
     FROM quiz_questions q
     WHERE q.category = ANY($1)
       AND NOT (q.id = ANY($2::int[]))
     ORDER BY q.id ASC
     LIMIT 1 OFFSET $3`,
    [categories, excludedIds, offset]
  );

  return query.rows[0] || null;
}

async function getOverview({ userId, solvedQuestionIds }) {
  if (userId) {
    const result = await runQuery(
      `SELECT
         q.category,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE ua.is_correct = TRUE)::int AS solved
       FROM quiz_questions q
       LEFT JOIN user_answers ua
         ON ua.question_id = q.id
        AND ua.user_id = $1
       WHERE q.category IS NOT NULL
         AND TRIM(q.category) <> ''
       GROUP BY q.category
       ORDER BY q.category ASC`,
      [userId]
    );

    return result.rows.map((row) => {
      const total = Number(row.total) || 0;
      const solved = Number(row.solved) || 0;
      return {
        name: row.category,
        total,
        solved,
        remaining: Math.max(0, total - solved)
      };
    });
  }

  const ids = solvedQuestionIds.length ? solvedQuestionIds : [0];
  const result = await runQuery(
    `SELECT
       q.category,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE q.id = ANY($1::int[]))::int AS solved
     FROM quiz_questions q
     WHERE q.category IS NOT NULL
       AND TRIM(q.category) <> ''
     GROUP BY q.category
     ORDER BY q.category ASC`,
    [ids]
  );

  return result.rows.map((row) => {
    const total = Number(row.total) || 0;
    const solved = Number(row.solved) || 0;
    return {
      name: row.category,
      total,
      solved,
      remaining: Math.max(0, total - solved)
    };
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = parseBody(req.body);
    const action = String(body.action || '').trim().toLowerCase();
    const lang = body.lang === 'no' ? 'no' : 'en';
    const session = await tryGetSession(req);
    const userId = session && Number.isInteger(Number(session.id)) ? Number(session.id) : null;
    const solvedQuestionIds = parseSolvedQuestionIds(body.solvedQuestionIds);

    if (action === 'overview') {
      const categories = await getOverview({ userId, solvedQuestionIds });
      res.status(200).json({
        mode: userId ? 'authenticated' : 'guest',
        categories
      });
      return;
    }

    if (action === 'next') {
      const categories = parseCategoryList(body.categories);
      if (!categories.length) {
        res.status(400).json({ error: 'categories must be a non-empty array' });
        return;
      }

      const candidate = await pickRandomQuestion({ categories, userId, solvedQuestionIds });
      const question = candidate ? mapQuestion(candidate, lang) : null;

      if (!isQuestionValid(question)) {
        res.status(200).json({ question: null });
        return;
      }

      res.status(200).json({ question });
      return;
    }

    if (action === 'reset') {
      if (!userId) {
        res.status(401).json({ error: 'Reset requires login' });
        return;
      }

      const category = String(body.category || '').trim();
      if (!category) {
        res.status(400).json({ error: 'category is required' });
        return;
      }

      await runQuery(
        `DELETE FROM user_answers ua
         USING quiz_questions q
         WHERE ua.question_id = q.id
           AND ua.user_id = $1
           AND q.category = $2`,
        [userId, category]
      );

      const categories = await getOverview({ userId, solvedQuestionIds: [] });
      res.status(200).json({ categories });
      return;
    }

    res.status(400).json({ error: 'Unsupported action' });
  } catch (error) {
    console.error('[quiz/quest] failed:', error?.message);
    res.status(500).json({ error: 'Failed to process quiz quest request' });
  }
};
