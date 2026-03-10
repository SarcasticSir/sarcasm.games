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

function normalizeAnswer(input) {
  const fillers = new Set(['the', 'a', 'an']);
  return String(input || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((part) => part && !fillers.has(part))
    .join(' ');
}

function isNumericValue(value) {
  return /^-?\d+(?:[.,]\d+)?$/.test(String(value).trim());
}

function toNumber(value) {
  return Number(String(value).replace(',', '.'));
}

function levenshtein(a, b) {
  const s = String(a);
  const t = String(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const rows = s.length + 1;
  const cols = t.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function evaluateAgainstExpected(inputRaw, expectedRaw) {
  const input = normalizeAnswer(inputRaw);
  const expected = normalizeAnswer(expectedRaw);

  if (!input || !expected) return 'wrong';
  if (input === expected) return 'correct';

  if (isNumericValue(input) && isNumericValue(expected)) {
    const inputNumber = toNumber(input);
    const expectedNumber = toNumber(expected);
    if (!Number.isFinite(inputNumber) || !Number.isFinite(expectedNumber)) return 'wrong';

    const baseline = Math.max(Math.abs(expectedNumber), 1);
    const relativeDiff = Math.abs(inputNumber - expectedNumber) / baseline;

    if (relativeDiff <= 0.10) return 'correct';
    if (relativeDiff <= 0.15) return 'almost';
    return 'wrong';
  }

  const dist = levenshtein(input, expected);
  const strictLimit = Math.max(1, Math.floor(expected.length * 0.18));
  const almostLimit = strictLimit + 1;

  if (dist <= strictLimit) return 'correct';
  if (dist <= almostLimit) return 'almost';
  return 'wrong';
}

function pickAnswersForLanguage(question, language) {
  if (language === 'no') {
    return Array.isArray(question.answers_no) ? question.answers_no : [];
  }
  return Array.isArray(question.answers_en) ? question.answers_en : [];
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
    const { questionId, selectedAnswer, language, retryUsed, honeypot } = parseBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    const id = Number(questionId);
    const answer = String(selectedAnswer || '').trim();
    const lang = String(language || 'en').toLowerCase() === 'no' ? 'no' : 'en';

    if (!Number.isInteger(id) || id <= 0 || answer.length < 1 || answer.length > 500) {
      res.status(400).json({ error: 'Invalid answer payload' });
      return;
    }

    const question = await getQuizQuestionById(id);
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    const expectedAnswers = pickAnswersForLanguage(question, lang);
    if (expectedAnswers.length === 0) {
      res.status(500).json({ error: 'Question answers are not configured for selected language' });
      return;
    }

    let result = 'wrong';
    let acceptedAnswer = expectedAnswers[0];

    for (const expected of expectedAnswers) {
      const check = evaluateAgainstExpected(answer, expected);
      if (check === 'correct') {
        result = 'correct';
        acceptedAnswer = expected;
        break;
      }
      if (check === 'almost' && result !== 'correct') {
        result = 'almost';
        acceptedAnswer = expected;
      }
    }

    if (result === 'correct') {
      await upsertUserAnswer({
        userId: session.id,
        questionId: id,
        isCorrect: true
      });

      res.status(200).json({
        questionId: id,
        status: 'correct',
        isCorrect: true,
        matchedAnswer: acceptedAnswer
      });
      return;
    }

    if (result === 'almost' && !retryUsed) {
      res.status(200).json({
        questionId: id,
        status: 'almost',
        isCorrect: false,
        matchedAnswer: acceptedAnswer
      });
      return;
    }

    await upsertUserAnswer({
      userId: session.id,
      questionId: id,
      isCorrect: false
    });

    res.status(200).json({
      questionId: id,
      status: 'wrong',
      isCorrect: false,
      correctAnswer: expectedAnswers[0]
    });
  } catch (error) {
    console.error('[quiz/answer] Failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Failed to submit answer' });
  }
};
