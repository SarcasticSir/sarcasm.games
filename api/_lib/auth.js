const { getSupabaseAnonClient } = require('./supabase');
const { getProfileByAuthUserId, upsertProfileFromAuthUser } = require('./db');

const ACCESS_COOKIE_NAME = 'sg_sb_access_token';
const REFRESH_COOKIE_NAME = 'sg_sb_refresh_token';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function parseCookies(req) {
  const rawCookie = req.headers.cookie || '';
  const cookies = {};
  rawCookie.split(';').forEach((entry) => {
    const [name, ...rest] = entry.trim().split('=');
    if (!name) return;
    cookies[name] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function createCookie(name, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production';
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : null
  ]
    .filter(Boolean)
    .join('; ');
}

function setAuthCookies(res, session) {
  res.setHeader('Set-Cookie', [
    createCookie(ACCESS_COOKIE_NAME, session.access_token, session.expires_in || COOKIE_MAX_AGE_SECONDS),
    createCookie(REFRESH_COOKIE_NAME, session.refresh_token, COOKIE_MAX_AGE_SECONDS)
  ]);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    createCookie(ACCESS_COOKIE_NAME, '', 0),
    createCookie(REFRESH_COOKIE_NAME, '', 0)
  ]);
}

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getMetadataString(source, key) {
  if (!source || typeof source !== 'object') return null;
  return readString(source[key]);
}

function deriveUsername(authUser, profile) {
  const profileUsername = readString(profile?.username);
  if (profileUsername) return profileUsername;

  const explicitUsername = getMetadataString(authUser?.user_metadata, 'username');
  if (explicitUsername) return explicitUsername;

  const email = readString(authUser?.email);
  if (!email) return 'user';

  const localPart = email.split('@')[0];
  return localPart || 'user';
}

function mapAuthUser(authUser, { accessToken = null, includeAccessToken = false, profile = null } = {}) {
  if (!authUser?.id) return null;

  const email = readString(profile?.email) || readString(authUser.email);
  const role = readString(profile?.role)
    || getMetadataString(authUser.app_metadata, 'role')
    || 'user';
  const country = readString(profile?.country)
    || getMetadataString(authUser.user_metadata, 'country')
    || 'unknown';

  const mapped = {
    id: authUser.id,
    authUserId: authUser.id,
    username: deriveUsername(authUser, profile),
    email,
    role,
    country
  };

  if (includeAccessToken) {
    mapped.accessToken = accessToken;
  }

  return mapped;
}

async function getSessionFromCookies(req, res, { allowRefresh = true } = {}) {
  const cookies = parseCookies(req);
  const accessToken = cookies[ACCESS_COOKIE_NAME];
  const refreshToken = cookies[REFRESH_COOKIE_NAME];

  if (!accessToken && !refreshToken) {
    return null;
  }

  const supabase = getSupabaseAnonClient();
  let authUser = null;
  let activeAccessToken = accessToken || null;

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data?.user) {
      authUser = data.user;
    }
  }

  if (!authUser && allowRefresh && refreshToken) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data?.session?.access_token && data?.user) {
      setAuthCookies(res, data.session);
      authUser = data.user;
      activeAccessToken = data.session.access_token;
    }
  }

  if (!authUser) {
    return null;
  }

  let profile = null;
  try {
    profile = await getProfileByAuthUserId(authUser.id);
    if (!profile) {
      profile = await upsertProfileFromAuthUser(authUser);
    }
  } catch (error) {
    console.warn('[auth] Failed to load profile for session:', error?.message);
  }

  return mapAuthUser(authUser, {
    accessToken: activeAccessToken,
    includeAccessToken: true,
    profile
  });
}

async function requireSession(req, res) {
  try {
    const session = await getSessionFromCookies(req, res);
    if (session) return session;

    clearSessionCookie(res);
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  } catch (error) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Invalid session' });
    return null;
  }
}

module.exports = {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  parseCookies,
  setAuthCookies,
  clearSessionCookie,
  getSessionFromCookies,
  requireSession,
  mapAuthUser
};
