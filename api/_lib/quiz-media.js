const DEFAULT_QUIZ_MEDIA_BUCKET = (process.env.QUIZ_MEDIA_BUCKET || 'quiz-media').trim() || 'quiz-media';

function getSupabaseBaseUrl() {
  const explicitValue = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const explicitUrl = explicitValue.trim().replace(/\/+$/, '');
  if (explicitUrl) return explicitUrl;

  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();
  if (!dbUrl) return '';

  try {
    const parsed = new URL(dbUrl);
    const host = String(parsed.hostname || '').trim().toLowerCase();
    const match = host.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
    if (!match) return '';
    return `https://${match[1]}.supabase.co`;
  } catch (error) {
    return '';
  }
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

function resolveBucketAndPath(rawPath) {
  const normalizedPath = normalizeStoragePath(rawPath);
  if (!normalizedPath) return null;

  const storagePublicPattern = /^(?:storage\/v1\/)?object\/public\/([^/]+)\/(.+)$/i;
  const storagePublicMatch = normalizedPath.match(storagePublicPattern);
  if (storagePublicMatch) {
    return {
      bucket: storagePublicMatch[1],
      path: normalizeStoragePath(storagePublicMatch[2])
    };
  }

  if (normalizedPath.startsWith(`${DEFAULT_QUIZ_MEDIA_BUCKET}/`)) {
    return {
      bucket: DEFAULT_QUIZ_MEDIA_BUCKET,
      path: normalizeStoragePath(normalizedPath.slice(DEFAULT_QUIZ_MEDIA_BUCKET.length + 1))
    };
  }

  return {
    bucket: DEFAULT_QUIZ_MEDIA_BUCKET,
    path: normalizedPath
  };
}

function toQuizMediaUrl(path) {
  if (!path || typeof path !== 'string') return null;
  const rawPath = String(path).trim();
  if (!rawPath) return null;

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const normalizedPath = normalizeStoragePath(rawPath);
  if (!normalizedPath) return null;

  const resolved = resolveBucketAndPath(normalizedPath);
  if (!resolved || !resolved.bucket || !resolved.path) return null;

  const baseUrl = getSupabaseBaseUrl();
  if (!baseUrl) return null;

  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(resolved.bucket)}/${encodeStoragePath(resolved.path)}`;
}

module.exports = {
  toQuizMediaUrl
};
