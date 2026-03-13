const { runQuery } = require('../_lib/db');

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

function randomIndex(max) {
  return Math.floor(Math.random() * max);
}

function shuffleInPlace(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const targetIndex = randomIndex(index + 1);
    [values[index], values[targetIndex]] = [values[targetIndex], values[index]];
  }
  return values;
}

function sampleWithoutReplacement(values, count) {
  if (count <= 0 || !values.length) return [];
  if (count >= values.length) return [...values];

  const shuffled = [...values];
  shuffleInPlace(shuffled);
  return shuffled.slice(0, count);
}

function allocateQuestionsPerCategory(availableByCategory, requestedCount) {
  const categoriesWithQuestions = Object.entries(availableByCategory)
    .filter(([, available]) => Number(available) > 0)
    .map(([category]) => category);

  const allocation = Object.fromEntries(categoriesWithQuestions.map((category) => [category, 0]));
  let remaining = requestedCount;

  if (!categoriesWithQuestions.length || remaining < 1) {
    return allocation;
  }

  const categoriesToSeed = [...categoriesWithQuestions];

  while (remaining > 0 && categoriesToSeed.length) {
    const index = randomIndex(categoriesToSeed.length);
    const category = categoriesToSeed[index];
    allocation[category] += 1;
    remaining -= 1;

    if (allocation[category] >= Number(availableByCategory[category])) {
      categoriesToSeed.splice(index, 1);
    }
  }

  while (remaining > 0) {
    const categoriesWithCapacity = categoriesWithQuestions.filter(
      (category) => allocation[category] < Number(availableByCategory[category])
    );

    if (!categoriesWithCapacity.length) {
      break;
    }

    const category = categoriesWithCapacity[randomIndex(categoriesWithCapacity.length)];
    allocation[category] += 1;
    remaining -= 1;
  }

  return allocation;
}

function orderRowsByIdList(rows, orderedIds) {
  const indexById = new Map(orderedIds.map((id, index) => [Number(id), index]));
  return [...rows].sort((left, right) => {
    const leftRank = indexById.get(Number(left.id)) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = indexById.get(Number(right.id)) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const {
      mode = 'random10',
      categories,
      count = 10,
      lang = 'en'
    } = parseBody(req.body);

    if (mode === 'categories') {
      if (!Array.isArray(categories) || !categories.length) {
        res.status(400).json({ error: 'categories must be a non-empty array of strings.' });
        return;
      }

      const selectedCategories = categories
        .map((category) => (typeof category === 'string' ? category.trim() : ''))
        .filter(Boolean);

      if (!selectedCategories.length || selectedCategories.length !== categories.length) {
        res.status(400).json({ error: 'categories must be a non-empty array of strings.' });
        return;
      }

      const uniqueCategories = [...new Set(selectedCategories)];

      const availabilityResult = await runQuery(
        `SELECT category, COUNT(*)::int AS total
         FROM quiz_questions
         WHERE category = ANY($1)
         GROUP BY category`,
        [uniqueCategories]
      );

      const availableByCategory = Object.fromEntries(
        uniqueCategories.map((category) => [category, 0])
      );

      for (const row of availabilityResult.rows) {
        const category = String(row.category || '');
        if (!category) continue;
        availableByCategory[category] = Number(row.total) || 0;
      }

      const totalAvailable = Object.values(availableByCategory)
        .reduce((sum, value) => sum + Number(value || 0), 0);

      if (totalAvailable < 1) {
        res.status(400).json({ error: 'No questions available for selected categories.' });
        return;
      }

      const requestedCount = Number(count);
      if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > totalAvailable) {
        res.status(400).json({ error: `count must be an integer between 1 and ${totalAvailable}.` });
        return;
      }

      const categoryAllocation = allocateQuestionsPerCategory(availableByCategory, requestedCount);
      const candidateQuery = await runQuery(
        `SELECT id, category
         FROM quiz_questions
         WHERE category = ANY($1)
         ORDER BY category ASC, id ASC`,
        [uniqueCategories]
      );

      const idsByCategory = new Map(uniqueCategories.map((category) => [category, []]));
      for (const row of candidateQuery.rows) {
        const category = String(row.category || '');
        if (!idsByCategory.has(category)) continue;
        idsByCategory.get(category).push(Number(row.id));
      }

      const selectedIds = [];
      for (const category of uniqueCategories) {
        const targetCount = Number(categoryAllocation[category] || 0);
        if (targetCount < 1) continue;
        const candidates = idsByCategory.get(category) || [];
        selectedIds.push(...sampleWithoutReplacement(candidates, targetCount));
      }

      shuffleInPlace(selectedIds);

      const query = selectedIds.length
        ? await runQuery(
          `SELECT id, category, question_en, question_no, answers_en, answers_no
           FROM quiz_questions
           WHERE id = ANY($1::int[])`,
          [selectedIds]
        )
        : { rows: [] };

      const orderedRows = orderRowsByIdList(query.rows, selectedIds);
      const questions = orderedRows
        .map((row) => mapQuestion(row, lang))
        .filter((row) => row.prompt && row.answers.length);

      res.status(200).json({
        mode: 'categories',
        count: requestedCount,
        totalAvailable,
        selectedCategories: uniqueCategories,
        categoryAllocation,
        questions
      });
      return;
    }

    if (mode !== 'random10') {
      res.status(400).json({ error: 'Only random10 and categories modes are supported.' });
      return;
    }

    const candidates = await runQuery(
      `SELECT id
       FROM quiz_questions
       ORDER BY id ASC`
    );

    const selectedIds = sampleWithoutReplacement(
      candidates.rows.map((row) => Number(row.id)),
      10
    );

    const query = selectedIds.length
      ? await runQuery(
        `SELECT id, category, question_en, question_no, answers_en, answers_no
         FROM quiz_questions
         WHERE id = ANY($1::int[])`,
        [selectedIds]
      )
      : { rows: [] };

    const orderedRows = orderRowsByIdList(query.rows, selectedIds);
    const questions = orderedRows
      .map((row) => mapQuestion(row, lang))
      .filter((row) => row.prompt && row.answers.length);

    res.status(200).json({
      mode,
      count: questions.length,
      questions
    });
  } catch (error) {
    console.error('[quiz/start] failed:', error?.message);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
};
