const { runQuery } = require('../_lib/db');
const { getSessionFromCookies } = require('../_lib/auth');
const { evaluateAnswer } = require('../../lib/server/quiz-answer-evaluator');
const { isRateLimited } = require('../_lib/rate-limit');
const { sendQuizRateLimited } = require('../_lib/quiz-rate-limit-response');
const { createEndpointMetric } = require('../_lib/observability');
const { parseJsonBody } = require('../_lib/parse-body');

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

function extractAcceptedAnswers(row) {
  const candidates = [row.answers_en];
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
  const flushEndpointMetric = createEndpointMetric(req, res, 'quiz/answer');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    flushEndpointMetric();
    return;
  }

  if (await isRateLimited(req, 'quiz:answer')) {
    sendQuizRateLimited(res);
    flushEndpointMetric();
    return;
  }

  try {
    const body = parseJsonBody(req.body);
    const { questionId: rawQuestionId, answer: rawAnswer = '' } = body;
    const questionId = Number(rawQuestionId);
    const answer = String(rawAnswer).trim();

    if (!Number.isInteger(questionId) || !answer) {
      res.status(400).json({ error: 'questionId and answer are required' });
      return;
    }

    const questionResult = await runQuery(
      `SELECT id, answers_en
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

    const acceptedAnswers = extractAcceptedAnswers(question);
    const evaluation = evaluateAnswer({
      userAnswer: answer,
      acceptedAnswers,
      retryAvailable: body.retryAvailable !== false
    });

    const session = await getSessionFromCookies(req, res, { allowRefresh: true });

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
  } finally {
    flushEndpointMetric();
  }
};
