const { requireSession } = require('../_lib/auth');
const {
  getQuizCategories,
  getRandomQuizQuestions,
  getRandomQuizQuestionsByCategories,
  getCompletionistQuizQuestionsByCategories
} = require('../_lib/db');

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

function sanitizeQuestions(rows) {
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    questionNo: row.question_no,
    questionEn: row.question_en
  }));
}

async function getEvenlyDistributedQuestions({ categories, count, mode, userId }) {
  const uniqueCategories = [...new Set(categories.map((value) => String(value).trim()).filter(Boolean))];
  if (uniqueCategories.length === 0) {
    return [];
  }

  const base = Math.floor(count / uniqueCategories.length);
  let remaining = count % uniqueCategories.length;

  const selected = [];
  const usedIds = new Set();

  for (const category of uniqueCategories) {
    const target = base + (remaining > 0 ? 1 : 0);
    if (remaining > 0) remaining -= 1;
    if (target <= 0) continue;

    const rows = mode === 'completionist'
      ? await getCompletionistQuizQuestionsByCategories(userId, [category], target)
      : await getRandomQuizQuestionsByCategories([category], target);

    for (const row of rows) {
      if (usedIds.has(row.id)) continue;
      usedIds.add(row.id);
      selected.push(row);
    }
  }

  if (selected.length < count) {
    const fillRows = mode === 'completionist'
      ? await getCompletionistQuizQuestionsByCategories(userId, uniqueCategories, count * 2)
      : await getRandomQuizQuestionsByCategories(uniqueCategories, count * 2);

    for (const row of fillRows) {
      if (selected.length >= count) break;
      if (usedIds.has(row.id)) continue;
      usedIds.add(row.id);
      selected.push(row);
    }
  }

  return selected.slice(0, count);
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
    const { mode, count, categories, honeypot } = parseBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    const quizMode = String(mode || '').toLowerCase();
    if (!['random10', 'categories', 'completionist'].includes(quizMode)) {
      res.status(400).json({ error: 'Invalid mode' });
      return;
    }

    let rows = [];

    if (quizMode === 'random10') {
      rows = await getRandomQuizQuestions(10);
    } else {
      const parsedCount = Number(count);
      if (!Number.isFinite(parsedCount) || parsedCount < 1 || parsedCount > 400) {
        res.status(400).json({ error: 'Count must be between 1 and 400' });
        return;
      }
      const requestedCategories = Array.isArray(categories) ? categories : [];
      rows = await getEvenlyDistributedQuestions({
        categories: requestedCategories,
        count: parsedCount,
        mode: quizMode,
        userId: session.id
      });
    }

    const categoryIndex = await getQuizCategories();
    const totalAvailable = categoryIndex.reduce((sum, row) => sum + Number(row.total || 0), 0);

    res.status(200).json({
      mode: quizMode,
      requested: quizMode === 'random10' ? 10 : Number(count),
      totalAvailable,
      questionCount: rows.length,
      questions: sanitizeQuestions(rows)
    });
  } catch (error) {
    console.error('[quiz/start] Failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Failed to start quiz' });
  }
};
