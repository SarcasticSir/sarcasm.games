const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'from',
  'with', 'without', 'is', 'are', 'was', 'were',
  'en', 'et', 'ei', 'den', 'det', 'de', 'og', 'eller', 'av', 'til', 'på', 'med', 'uten',
  'som', 'er', 'var'
]);

const DEFAULT_CONFIG = {
  exactSimilarityThreshold: 0.88,
  almostSimilarityThreshold: 0.74,
  yearTolerancePercent: 0.1,
  yearAlmostMultiplier: 1.5
};

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(' ')
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));
}

function compactText(text) {
  return tokenize(text).join(' ');
}

function levenshteinDistance(a, b) {
  const left = String(a || '');
  const right = String(b || '');

  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + substitutionCost
      );
    }
  }

  return matrix[left.length][right.length];
}

function similarityScore(a, b) {
  const left = compactText(a);
  const right = compactText(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;

  const distance = levenshteinDistance(left, right);
  const maxLength = Math.max(left.length, right.length);
  return 1 - distance / maxLength;
}

function extractYear(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(/\b\d{3,4}\b/);
  if (!match) return null;
  return Number.parseInt(match[0], 10);
}

function evaluateYearAnswer(userAnswer, expectedAnswer, config) {
  const userYear = extractYear(userAnswer);
  const expectedYear = extractYear(expectedAnswer);
  if (userYear === null || expectedYear === null) return null;

  const tolerance = Math.max(1, Math.round(Math.abs(expectedYear) * config.yearTolerancePercent));
  const diff = Math.abs(userYear - expectedYear);

  if (diff <= tolerance) {
    return { status: 'correct', reason: 'year_within_tolerance', score: 1, diff, tolerance };
  }

  if (diff <= Math.round(tolerance * config.yearAlmostMultiplier)) {
    return { status: 'almost', reason: 'year_near_tolerance', score: 0.5, diff, tolerance };
  }

  return { status: 'wrong', reason: 'year_outside_tolerance', score: 0, diff, tolerance };
}

function evaluateAgainstExpected(userAnswer, expectedAnswer, config) {
  const yearResult = evaluateYearAnswer(userAnswer, expectedAnswer, config);
  if (yearResult && (yearResult.status === 'correct' || yearResult.status === 'almost')) {
    return yearResult;
  }

  const similarity = similarityScore(userAnswer, expectedAnswer);

  if (similarity >= config.exactSimilarityThreshold) {
    return { status: 'correct', reason: 'fuzzy_match', score: similarity };
  }

  if (similarity >= config.almostSimilarityThreshold) {
    return { status: 'almost', reason: 'fuzzy_near_match', score: similarity };
  }

  return { status: 'wrong', reason: 'no_match', score: similarity };
}

function evaluateAnswer({ userAnswer, acceptedAnswers, retryAvailable = true, config = {} }) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const answers = Array.isArray(acceptedAnswers) ? acceptedAnswers.filter(Boolean) : [acceptedAnswers].filter(Boolean);

  if (!answers.length) {
    return {
      status: 'wrong',
      score: 0,
      reason: 'no_accepted_answers',
      retryAvailable: false
    };
  }

  let best = { status: 'wrong', score: 0, reason: 'no_match' };

  for (const expected of answers) {
    const result = evaluateAgainstExpected(userAnswer, expected, mergedConfig);
    if (result.status === 'correct') {
      return {
        status: 'correct',
        score: 1,
        reason: result.reason,
        matchedAnswer: expected,
        retryAvailable: false
      };
    }

    if (result.status === 'almost' && best.status !== 'almost') {
      best = { ...result, matchedAnswer: expected };
      continue;
    }

    if (result.score > best.score) {
      best = { ...result, matchedAnswer: expected };
    }
  }

  if (best.status === 'almost' && retryAvailable) {
    return {
      status: 'almost',
      score: 0,
      reason: best.reason,
      matchedAnswer: best.matchedAnswer,
      retryAvailable: true
    };
  }

  return {
    status: 'wrong',
    score: 0,
    reason: best.reason,
    matchedAnswer: best.matchedAnswer,
    retryAvailable: false
  };
}

module.exports = {
  STOP_WORDS,
  DEFAULT_CONFIG,
  normalizeText,
  tokenize,
  compactText,
  levenshteinDistance,
  similarityScore,
  extractYear,
  evaluateYearAnswer,
  evaluateAnswer
};
