const { requireSession } = require('../_lib/auth');
const { runTransaction } = require('../_lib/db');
const { parseJsonBody } = require('../_lib/parse-body');

const QUESTION_TYPES = new Set(['text', 'multiple_choice']);
const OPTION_COUNT = 4;

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeFactKey(value) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || null;
}

function normalizeDifficulty(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return null;
  return parsed;
}

function normalizeAnswers(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  return value
    .map((answer) => readString(answer))
    .filter(Boolean)
    .filter((answer) => {
      const key = answer.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeOptions(value) {
  if (!Array.isArray(value) || value.length !== OPTION_COUNT) {
    return { error: 'Multiple choice questions require exactly four options.' };
  }

  const options = value.map((option) => ({
    option_en: readString(option?.option_en),
    is_correct: option?.is_correct === true
  }));

  if (options.some((option) => !option.option_en)) {
    return { error: 'All four multiple choice options must contain text.' };
  }

  const normalizedOptionTexts = options.map((option) => option.option_en.toLowerCase());
  if (new Set(normalizedOptionTexts).size !== options.length) {
    return { error: 'Multiple choice options must be unique (case-insensitive).' };
  }

  const correctCount = options.filter((option) => option.is_correct).length;
  if (correctCount !== 1) {
    return { error: 'Multiple choice questions require exactly one correct option.' };
  }

  return { value: options };
}

function normalizeEntry(entry, index) {
  const entryLabel = `Entry ${index + 1}`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { error: `${entryLabel} must be an object.` };
  }

  const category = readString(entry.category);
  const factKey = normalizeFactKey(entry.fact_key);
  const questionType = readString(entry.question_type);
  const questionEn = readString(entry.question_en);
  const questionNo = readString(entry.question_no);
  const difficulty = normalizeDifficulty(entry.difficulty);

  if (!category) return { error: `${entryLabel} requires category.` };
  if (!factKey) return { error: `${entryLabel} requires a non-empty fact_key.` };
  if (!QUESTION_TYPES.has(questionType)) {
    return { error: `${entryLabel} question_type must be "text" or "multiple_choice".` };
  }
  if (!questionEn) return { error: `${entryLabel} requires question_en.` };
  if (!questionNo) return { error: `${entryLabel} requires question_no.` };
  if (!difficulty) return { error: `${entryLabel} difficulty must be an integer from 1 to 5.` };

  const baseEntry = {
    category,
    fact_key: factKey,
    question_type: questionType,
    question_en: questionEn,
    question_no: questionNo,
    difficulty
  };

  if (questionType === 'text') {
    const answers = normalizeAnswers(entry.answers);
    if (!answers.length) {
      return { error: `${entryLabel} text questions require at least one accepted answer.` };
    }
    return { value: { ...baseEntry, answers, options: [] } };
  }

  const optionsResult = normalizeOptions(entry.options);
  if (optionsResult.error) {
    return { error: `${entryLabel}: ${optionsResult.error}` };
  }

  return { value: { ...baseEntry, answers: [], options: optionsResult.value } };
}

async function insertQuizQuestion(entry) {
  return runTransaction(async (client) => {
    const duplicateResult = await client.query(
      `SELECT id
       FROM public.quiz_questions
       WHERE lower(trim(question_en)) = lower(trim($1))
       LIMIT 1`,
      [entry.question_en]
    );

    if (duplicateResult.rows[0]) return { duplicate: true };

    const questionResult = await client.query(
      `INSERT INTO public.quiz_questions (
        category,
        fact_key,
        question_en,
        question_no,
        answers_en,
        difficulty,
        question_type,
        verified
      ) VALUES ($1, $2, $3, $4, $5::text[], $6, $7, false)
      RETURNING id`,
      [
        entry.category,
        entry.fact_key,
        entry.question_en,
        entry.question_no,
        entry.answers,
        entry.difficulty,
        entry.question_type
      ]
    );

    const questionId = questionResult.rows[0].id;

    if (entry.question_type === 'multiple_choice') {
      for (const option of entry.options) {
        await client.query(
          `INSERT INTO public.quiz_question_options (
            question_id,
            option_en,
            option_no,
            is_correct
          ) VALUES ($1, $2, NULL, $3)`,
          [questionId, option.option_en, option.is_correct]
        );
      }
    }

    return { duplicate: false, id: questionId };
  });
}

function isDuplicateQuestionError(error) {
  if (error?.code !== '23505') return false;

  const constraint = String(error.constraint || '').toLowerCase();
  const detail = String(error.detail || '').toLowerCase();
  return constraint.includes('question_en') || detail.includes('(question_en)');
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

    const normalizedResults = entries.map(normalizeEntry);
    const invalidEntry = normalizedResults.find((result) => result.error);
    if (invalidEntry) {
      res.status(400).json({ error: invalidEntry.error });
      return;
    }

    const normalizedEntries = normalizedResults.map((result) => result.value);
    const inserted = [];
    const duplicates = [];

    for (const entry of normalizedEntries) {
      try {
        const result = await insertQuizQuestion(entry);
        if (result.duplicate) {
          duplicates.push({ category: entry.category, question_en: entry.question_en });
          continue;
        }

        inserted.push({
          id: result.id,
          category: entry.category,
          fact_key: entry.fact_key,
          question_type: entry.question_type,
          question_en: entry.question_en,
          verified: false
        });
      } catch (error) {
        if (isDuplicateQuestionError(error)) {
          duplicates.push({ category: entry.category, question_en: entry.question_en });
          continue;
        }
        throw error;
      }
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
