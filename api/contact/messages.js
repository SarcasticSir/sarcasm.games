const { requireSession } = require('../_lib/auth');
const { runQuery } = require('../_lib/db');
const { parseJsonBody } = require('../_lib/parse-body');
const { isRateLimited } = require('../_lib/rate-limit');

const NAME_MAX = 10;
const EMAIL_MAX = 50;
const MESSAGE_MAX = 100;

function normalizeWhitespace(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function normalizeField(value, maxLength) {
  const normalized = normalizeWhitespace(value);
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > EMAIL_MAX) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  if (await isRateLimited(req, 'contact:create')) {
    res.status(429).json({
      error: 'Too many contact messages. Please wait a bit before trying again.',
      code: 'RATE_LIMITED'
    });
    return;
  }

  const body = parseJsonBody(req.body);
  const name = normalizeField(body?.name, NAME_MAX);
  const email = normalizeField(body?.email, EMAIL_MAX)?.toLowerCase() || null;
  const message = normalizeField(body?.message, MESSAGE_MAX);

  if (!name) {
    res.status(400).json({ error: 'Name is required and must be 10 characters or fewer.' });
    return;
  }

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: 'Email is required and must be valid, up to 50 characters.' });
    return;
  }

  if (!message) {
    res.status(400).json({ error: 'Message is required and must be 100 characters or fewer.' });
    return;
  }

  try {
    await runQuery(
      `INSERT INTO public.contact_messages (user_id, name, email, message)
       VALUES ($1, $2, $3, $4)`,
      [session.id, name, email, message]
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('[contact/messages] Failed to create message:', error?.message);
    res.status(500).json({ error: 'Failed to submit message' });
  }
};
