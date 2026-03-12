const { runQuery } = require('../_lib/db');
const { parseCookies, verifySessionToken, COOKIE_NAME } = require('../_lib/auth');
const { evaluateAnswer } = require('../../lib/server/quiz-answer-evaluator');

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

function extractAcceptedAnswers(row, lang) {
  const candidates = lang === 'no'
    ? [row.answers_no, row.answers_en]
    : [row.answers_en, row.answers_no];
  const seen = new Set();

  return candidates
    .flatMap((value) => normalizeAnswerValues(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function persistProgress(userId, questionId, isCorrect) {
  try {
    await runQuery(
      `INSERT INTO user_answers (user_id, question_id, is_correct)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, question_id)
       DO UPDATE SET is_correct = user_answers.is_correct OR EXCLUDED.is_correct`,
      [userId, questionId, isCorrect]
    );
  } catch (error) {
    console.warn('[quiz/answer] progress persistence skipped:', error?.message);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = parseBody(req.body);
    const { questionId: rawQuestionId, answer: rawAnswer = '', lang = 'en' } = body;
    const questionId = Number(rawQuestionId);
    const answer = String(rawAnswer).trim();

    if (!Number.isInteger(questionId) || !answer) {
      res.status(400).json({ error: 'questionId and answer are required' });
      return;
    }

    const questionResult = await runQuery(
      `SELECT id, answers_en, answers_no
       FROM quiz_questions
       WHERE id = $1
       LIMIT 1`,
      [questionId]
    );

    const question = questionResult.rows[0];
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    const acceptedAnswers = extractAcceptedAnswers(question, lang);
    const evaluation = evaluateAnswer({
      userAnswer: answer,
      acceptedAnswers,
      retryAvailable: body.retryAvailable !== false
    });

    let session = null;
    try {
      const cookies = parseCookies(req);
      if (cookies[COOKIE_NAME]) {
        session = await verifySessionToken(cookies[COOKIE_NAME]);
      }
    } catch (error) {
      session = null;
    }

    if (session && session.id && (evaluation.status === 'correct' || evaluation.status === 'wrong')) {
      await persistProgress(session.id, questionId, evaluation.status === 'correct');
    }

    res.status(200).json({
      questionId,
      status: evaluation.status,
      retryAvailable: evaluation.retryAvailable,
      acceptedAnswer: evaluation.status === 'wrong'
        ? (evaluation.matchedAnswer || acceptedAnswers[0] || null)
        : null
    });
  } catch (error) {
    console.error('[quiz/answer] failed:', error?.message);
    res.status(500).json({ error: 'Failed to evaluate answer' });
  }
};
