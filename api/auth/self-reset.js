const { isRateLimited } = require('../_lib/rate-limit');

const CAPTCHA_QUESTIONS = {
  site_first_word: {
    answer: 'sarcasm'
  },
  bil_reverse: {
    answer: 'lib'
  },
  color_sky: {
    answer: 'blå'
  },
  two_plus_three: {
    answer: '5'
  }
};

function parseRequestBody(body) {
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, 'auth:self-reset')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  try {
    const { username, email, newPassword, honeypot, captchaId, captchaAnswer } = parseRequestBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    if (!username || !email || !newPassword || !captchaId || !captchaAnswer) {
      res.status(400).json({ error: 'username, email, newPassword and captcha are required' });
      return;
    }

    const trimmedUsername = String(username).trim();
    const trimmedEmail = String(email).trim();
    const rawPassword = String(newPassword);
    const normalizedCaptchaAnswer = String(captchaAnswer).trim().toLowerCase();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 40) {
      res.status(400).json({ error: 'Invalid username length' });
      return;
    }

    if (trimmedEmail.length < 5 || trimmedEmail.length > 254) {
      res.status(400).json({ error: 'Invalid email length' });
      return;
    }

    if (rawPassword.length < 8 || rawPassword.length > 128) {
      res.status(400).json({ error: 'Password must be 8-128 characters' });
      return;
    }

    const captcha = CAPTCHA_QUESTIONS[captchaId];
    if (!captcha) {
      res.status(400).json({ error: 'Invalid captcha challenge' });
      return;
    }

    if (normalizedCaptchaAnswer !== String(captcha.answer).toLowerCase()) {
      res.status(400).json({ error: 'Invalid captcha answer' });
      return;
    }

    const bcrypt = require('bcryptjs');
    const { getUserByUsername, updatePasswordByUserId } = require('../_lib/db');

    const normalizedUsername = trimmedUsername.toLowerCase();
    const normalizedEmail = trimmedEmail.toLowerCase();

    const user = await getUserByUsername(normalizedUsername);
    if (!user || String(user.email).toLowerCase() !== normalizedEmail) {
      res.status(400).json({ error: 'Invalid reset information' });
      return;
    }

    if (user.role === 'admin') {
      res.status(403).json({ error: 'Admin password reset is blocked in self-service flow' });
      return;
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);
    await updatePasswordByUserId(user.id, passwordHash);

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[auth/self-reset] Reset failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Self reset failed' });
  }
};
