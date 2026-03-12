const QUIZ_LANGUAGE_KEY = 'quizLanguage';
const DEFAULT_QUIZ_LANGUAGE = 'en';
const SUPPORTED_QUIZ_LANGUAGES = new Set(['en', 'no']);

function normalizeQuizLanguage(lang) {
  if (typeof lang !== 'string') {
    return DEFAULT_QUIZ_LANGUAGE;
  }

  const normalized = lang.trim().toLowerCase();
  return SUPPORTED_QUIZ_LANGUAGES.has(normalized)
    ? normalized
    : DEFAULT_QUIZ_LANGUAGE;
}

export function getQuizLanguage() {
  return normalizeQuizLanguage(localStorage.getItem(QUIZ_LANGUAGE_KEY));
}

export function setQuizLanguage(lang) {
  const normalized = normalizeQuizLanguage(lang);
  localStorage.setItem(QUIZ_LANGUAGE_KEY, normalized);
  return normalized;
}
