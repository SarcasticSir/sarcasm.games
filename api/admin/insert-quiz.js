const { requireSession } = require('../_lib/auth');
const { runQuery } = require('../_lib/db');
const { parseJsonBody } = require('../_lib/parse-body');

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeDifficulty(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) return null;
  return parsed;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const category = readString(entry.category);
  const questionEn = readString(entry.question_en);
  const questionNo = readString(entry.question_no);
  const answers = Array.isArray(entry.answers)
    ? entry.answers.map((value) => readString(value)).filter(Boolean)
    : [];
  const difficulty = normalizeDifficulty(entry.difficulty);

  if (!category || !questionEn || !questionNo || !answers.length || !difficulty) {
    return null;
  }

  return {
    category,
    question_en: questionEn,
    question_no: questionNo,
    answers,
    difficulty
  };
}

async function existsQuizQuestion(category, questionEn) {
  const result = await runQuery(
    `SELECT id
     FROM public.quiz_questions
     WHERE lower(trim(category)) = lower(trim($1))
       AND lower(trim(question_en)) = lower(trim($2))
     LIMIT 1`,
    [category, questionEn]
  );

  return Boolean(result.rows[0]);
}

async function insertQuizQuestion(entry) {
  await runQuery(
    `INSERT INTO public.quiz_questions (
      category,
      question_en,
      question_no,
      answers_en,
      answers_no,
      difficulty
    ) VALUES ($1, $2, $3, $4::text[], $5::text[], $6)`,
    [
      entry.category,
      entry.question_en,
      entry.question_no,
      entry.answers,
      entry.answers,
      entry.difficulty
    ]
  );
}

module.exports = async function handler(req, res) {
  try {
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

    const payload = parseJsonBody(req.body);
    const entries = Array.isArray(payload.entries) ? payload.entries : [];

    if (!entries.length) {
      res.status(400).json({ error: 'entries must contain at least one item' });
      return;
    }

    const normalizedEntries = entries.map(normalizeEntry);
    if (normalizedEntries.some((entry) => entry === null)) {
      res.status(400).json({ error: 'Each entry requires category, question_en, question_no, answers[] and difficulty (1-3)' });
      return;
    }

    const inserted = [];
    const duplicates = [];

    for (const entry of normalizedEntries) {
      const duplicate = await existsQuizQuestion(entry.category, entry.question_en);
      if (duplicate) {
        duplicates.push({ category: entry.category, question_en: entry.question_en });
        continue;
      }

      await insertQuizQuestion(entry);
      inserted.push({ category: entry.category, question_en: entry.question_en });
    }

    res.status(200).json({
      insertedCount: inserted.length,
      duplicateCount: duplicates.length,
      inserted,
      duplicates
    });
  } catch (error) {
    console.error('[admin/insert-quiz] failed:', error?.message);
    res.status(500).json({ error: 'Failed to insert quiz questions' });
  }
};
