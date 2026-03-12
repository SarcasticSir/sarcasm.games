const { SignJWT, jwtVerify } = require('jose');
const { getUserById } = require('./db');

const COOKIE_NAME = 'sg_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getJwtSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('Missing AUTH_SECRET (or NEXTAUTH_SECRET) environment variable.');
  }
  return new TextEncoder().encode(secret);
}

async function signSessionToken(payload) {
  const secret = getJwtSecret();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

async function verifySessionToken(token) {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);
  return payload;
}

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

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  const cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? 'Secure' : null
  ]
    .filter(Boolean)
    .join('; ');
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  const cookie = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : null
  ]
    .filter(Boolean)
    .join('; ');
  res.setHeader('Set-Cookie', cookie);
}

async function requireSession(req, res) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: 'Not authenticated' });
      return null;
    }

    const payload = await verifySessionToken(token);
    const userId = Number(payload.id || payload.sub);
    if (!Number.isInteger(userId)) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'Invalid session' });
      return null;
    }

    const user = await getUserById(userId);
    if (!user) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'Invalid session' });
      return null;
    }

    return {
      ...payload,
      id: user.id,
      sub: String(user.id),
      username: user.username,
      email: user.email,
      role: user.role,
      country: user.country || 'unknown'
    };
  } catch (error) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Invalid session' });
    return null;
  }
}

module.exports = {
  COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  requireSession
};
