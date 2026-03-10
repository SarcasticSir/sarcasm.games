const bcrypt = require('bcryptjs');
const { getUserByUsername, updatePasswordByUserId } = require('../_lib/db');

const CAPTCHA_QUESTIONS = {
  site_first_word: {
    question: 'Hva er det første ordet i navnet på denne nettsiden?',
    answer: 'sarcasm'
  },
  bil_reverse: {
    question: 'Skriv ordet BIL baklengs',
    answer: 'lib'
  },
  color_sky: {
    question: 'Hvilken farge har himmelen på en klar dag?',
    answer: 'blå'
  },
  two_plus_three: {
    question: 'Hva er 2 + 3?',
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

    const captcha = CAPTCHA_QUESTIONS[captchaId];
    if (!captcha) {
      res.status(400).json({ error: 'Invalid captcha challenge' });
      return;
    }

    const normalizedCaptchaAnswer = String(captchaAnswer).trim().toLowerCase();
    const expectedAnswer = String(captcha.answer).trim().toLowerCase();
    if (normalizedCaptchaAnswer !== expectedAnswer) {
      res.status(400).json({ error: 'Invalid captcha answer' });
      return;
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await getUserByUsername(normalizedUsername);
    if (!user || String(user.email).toLowerCase() !== normalizedEmail) {
      res.status(400).json({ error: 'Invalid reset information' });
      return;
    }

    if (user.role === 'admin') {
      res.status(403).json({ error: 'Admin password reset is blocked in self-service flow' });
      return;
    }

    if (String(newPassword).length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 12);
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
