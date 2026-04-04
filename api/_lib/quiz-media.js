const QUIZ_MEDIA_BUCKET = 'quiz-media';

function getSupabaseBaseUrl() {
  const value = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return value.trim().replace(/\/+$/, '');
}

function encodeStoragePath(path) {
  return String(path)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeStoragePath(path) {
  return String(path || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
}

function toQuizMediaUrl(path) {
  if (!path || typeof path !== 'string') return null;
  const normalizedPath = normalizeStoragePath(path);
  if (!normalizedPath) return null;

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  const baseUrl = getSupabaseBaseUrl();
  if (!baseUrl) return null;

  return `${baseUrl}/storage/v1/object/public/${QUIZ_MEDIA_BUCKET}/${encodeStoragePath(normalizedPath)}`;
}

module.exports = {
  toQuizMediaUrl
};
