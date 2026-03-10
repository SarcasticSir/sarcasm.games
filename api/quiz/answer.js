const { requireSession } = require('../_lib/auth');
const { getQuizQuestionById, upsertUserAnswer } = require('../_lib/db');

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (error) {
      return {};
    }
  }
  if (typeof body === 'object') return body;
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const { questionId, selectedAnswer, honeypot } = parseBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    const id = Number(questionId);
    const answer = String(selectedAnswer || '').trim();

    if (!Number.isInteger(id) || id <= 0 || answer.length < 1 || answer.length > 500) {
      res.status(400).json({ error: 'Invalid answer payload' });
      return;
    }

    const question = await getQuizQuestionById(id);
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    const isCorrect = String(question.correct_answer).trim().toLowerCase() === answer.toLowerCase();

    await upsertUserAnswer({
      userId: session.id,
      questionId: id,
      isCorrect
    });

    res.status(200).json({
      questionId: id,
      isCorrect,
      correctAnswer: question.correct_answer
    });
  } catch (error) {
    console.error('[quiz/answer] Failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Failed to submit answer' });
  }
};
