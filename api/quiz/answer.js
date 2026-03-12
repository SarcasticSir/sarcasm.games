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

function extractAcceptedAnswers(row) {
  const candidates = [
    row.answer_en,
    row.answer_no,
    row.answer,
    row.correct_answer,
    row.correct_answer_en,
    row.correct_answer_no
  ];

  return candidates
    .filter(Boolean)
    .flatMap((value) => String(value).split('|').map((part) => part.trim()).filter(Boolean));
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
    const questionId = Number(body.questionId);
    const answer = String(body.answer || '').trim();

    if (!Number.isInteger(questionId) || !answer) {
      res.status(400).json({ error: 'questionId and answer are required' });
      return;
    }

    const questionResult = await runQuery(
      `SELECT id, answer_en, answer_no, answer, correct_answer, correct_answer_en, correct_answer_no
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
