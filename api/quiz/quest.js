const crypto = require('crypto');
const { runQuery } = require('../_lib/db');
const { parseCookies, verifySessionToken, COOKIE_NAME } = require('../_lib/auth');
const { isRateLimited } = require('../_lib/rate-limit');
const { sendQuizRateLimited } = require('../_lib/quiz-rate-limit-response');
const { createEndpointMetric } = require('../_lib/observability');
const {
  getGuestProgress,
  saveGuestProgress,
  pruneExpiredGuestProgress,
  normalizeSolvedQuestionIds
} = require('../_lib/guest-progress-store');

const GUEST_PROGRESS_TTL_SECONDS = 60 * 60 * 12;

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


function randomIndex(max) {
  return Math.floor(Math.random() * max);
}

async function getNextQuestionBounds({ userId, categories, solvedQuestionIds }) {
  if (userId) {
    const result = await runQuery(
      `SELECT MIN(q.id)::int AS min_id, MAX(q.id)::int AS max_id
       FROM quiz_questions q
       LEFT JOIN user_answers ua
         ON ua.question_id = q.id
        AND ua.user_id = $2
       WHERE q.category = ANY($1)
         AND COALESCE(ua.is_correct, FALSE) = FALSE`,
      [categories, userId]
    );

    const row = result.rows[0] || {};
    return {
      minId: Number(row.min_id) || null,
      maxId: Number(row.max_id) || null
    };
  }

  const excludedIds = solvedQuestionIds.length ? solvedQuestionIds : [0];
  const result = await runQuery(
    `SELECT MIN(q.id)::int AS min_id, MAX(q.id)::int AS max_id
     FROM quiz_questions q
     WHERE q.category = ANY($1)
       AND NOT (q.id = ANY($2::int[]))`,
    [categories, excludedIds]
  );

  const row = result.rows[0] || {};
  return {
    minId: Number(row.min_id) || null,
    maxId: Number(row.max_id) || null
  };
}

async function getNextQuestionCandidateFromPivot({ userId, categories, solvedQuestionIds, pivotId }) {
  if (userId) {
    const result = await runQuery(
      `WITH preferred AS (
         SELECT q.id, q.category, q.question_en, q.question_no, q.answers_en, q.answers_no
         FROM quiz_questions q
         LEFT JOIN user_answers ua
           ON ua.question_id = q.id
          AND ua.user_id = $2
         WHERE q.category = ANY($1)
           AND COALESCE(ua.is_correct, FALSE) = FALSE
           AND q.id >= $3
         ORDER BY q.id ASC
         LIMIT 1
       ), fallback AS (
         SELECT q.id, q.category, q.question_en, q.question_no, q.answers_en, q.answers_no
         FROM quiz_questions q
         LEFT JOIN user_answers ua
           ON ua.question_id = q.id
          AND ua.user_id = $2
         WHERE q.category = ANY($1)
           AND COALESCE(ua.is_correct, FALSE) = FALSE
           AND q.id < $3
         ORDER BY q.id ASC
         LIMIT 1
       )
       SELECT * FROM preferred
       UNION ALL
       SELECT * FROM fallback
       LIMIT 1`,
      [categories, userId, pivotId]
    );

    return result.rows[0] || null;
  }

  const excludedIds = solvedQuestionIds.length ? solvedQuestionIds : [0];
  const result = await runQuery(
    `WITH preferred AS (
       SELECT q.id, q.category, q.question_en, q.question_no, q.answers_en, q.answers_no
       FROM quiz_questions q
       WHERE q.category = ANY($1)
         AND NOT (q.id = ANY($2::int[]))
         AND q.id >= $3
       ORDER BY q.id ASC
       LIMIT 1
     ), fallback AS (
       SELECT q.id, q.category, q.question_en, q.question_no, q.answers_en, q.answers_no
       FROM quiz_questions q
       WHERE q.category = ANY($1)
         AND NOT (q.id = ANY($2::int[]))
         AND q.id < $3
       ORDER BY q.id ASC
       LIMIT 1
     )
     SELECT * FROM preferred
     UNION ALL
     SELECT * FROM fallback
     LIMIT 1`,
    [categories, excludedIds, pivotId]
  );

  return result.rows[0] || null;
}

function createGuestProgressToken() {
  return crypto.randomBytes(18).toString('base64url');
}

async function loadGuestProgress(body) {
  await pruneExpiredGuestProgress();

  const legacySolvedIds = normalizeSolvedQuestionIds(body.solvedQuestionIds);
  const solvedDeltas = normalizeSolvedQuestionIds(body.solvedQuestionIdDeltas);
  const requestedToken = typeof body.guestProgressToken === 'string' ? body.guestProgressToken.trim() : '';

  let token = null;
  let solvedSet = new Set();

  if (requestedToken) {
    const existing = await getGuestProgress(requestedToken);
    if (existing) {
      token = existing.token;
      solvedSet = new Set(existing.solvedQuestionIds);
    }
  }

  for (const id of legacySolvedIds) solvedSet.add(id);
  for (const id of solvedDeltas) solvedSet.add(id);

  const shouldIssueToken = Boolean(requestedToken || legacySolvedIds.length || solvedDeltas.length);

  if (!token && shouldIssueToken) {
    token = createGuestProgressToken();
  }

  if (token) {
    await saveGuestProgress(token, [...solvedSet], GUEST_PROGRESS_TTL_SECONDS);
  }

  return {
    token,
    solvedQuestionIds: [...solvedSet]
  };
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
  const flushEndpointMetric = createEndpointMetric(req, res, 'quiz/quest');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    flushEndpointMetric();
    return;
  }

  if (await isRateLimited(req, 'quiz:quest')) {
    sendQuizRateLimited(res);
    flushEndpointMetric();
    return;
  }

  try {
    const body = parseBody(req.body);
    const action = String(body.action || '').trim().toLowerCase();
    const lang = body.lang === 'no' ? 'no' : 'en';
    const session = await tryGetSession(req);
    const userId = session && Number.isInteger(Number(session.id)) ? Number(session.id) : null;
    const guestProgress = userId ? { token: null, solvedQuestionIds: [] } : await loadGuestProgress(body);

    if (action === 'overview') {
      const categories = await getOverview({ userId, solvedQuestionIds: guestProgress.solvedQuestionIds });
      res.status(200).json({
        mode: userId ? 'authenticated' : 'guest',
        categories,
        ...(guestProgress.token ? { guestProgressToken: guestProgress.token } : {})
      });
      return;
    }

    if (action === 'next') {
      const categories = parseCategoryList(body.categories);
      if (!categories.length) {
        res.status(400).json({ error: 'categories must be a non-empty array' });
        return;
      }

      const bounds = await getNextQuestionBounds({
        userId,
        categories,
        solvedQuestionIds: guestProgress.solvedQuestionIds
      });

      if (!Number.isInteger(bounds.minId) || !Number.isInteger(bounds.maxId) || bounds.minId > bounds.maxId) {
        res.status(200).json({
          question: null,
          ...(guestProgress.token ? { guestProgressToken: guestProgress.token } : {})
        });
        return;
      }

      const span = bounds.maxId - bounds.minId + 1;
      const maxAttempts = Math.min(5, Math.max(1, span));
      let question = null;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const pivotId = bounds.minId + randomIndex(span);
        const row = await getNextQuestionCandidateFromPivot({
          userId,
          categories,
          solvedQuestionIds: guestProgress.solvedQuestionIds,
          pivotId
        });

        if (!row) continue;
        const mapped = mapQuestion(row, lang);
        if (!isQuestionValid(mapped)) continue;
        question = mapped;
        break;
      }

      if (!question) {
        res.status(200).json({
          question: null,
          ...(guestProgress.token ? { guestProgressToken: guestProgress.token } : {})
        });
        return;
      }

      res.status(200).json({
        question,
        ...(guestProgress.token ? { guestProgressToken: guestProgress.token } : {})
      });
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
  } finally {
    flushEndpointMetric();
  }
};
