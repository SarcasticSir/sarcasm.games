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

  if (await isRateLimited(req, 'auth:self-reset')) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    return;
  }

  try {
    const { email, honeypot, captchaId, captchaAnswer } = parseRequestBody(req.body);

    if (honeypot && String(honeypot).trim()) {
      res.status(400).json({ error: 'Request rejected' });
      return;
    }

    if (!email || !captchaId || !captchaAnswer) {
      res.status(400).json({ error: 'email and captcha are required' });
      return;
    }

    const trimmedEmail = String(email).trim();
    const normalizedCaptchaAnswer = String(captchaAnswer).trim().toLowerCase();

    if (trimmedEmail.length < 5 || trimmedEmail.length > 254) {
      res.status(400).json({ error: 'Invalid email length' });
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

    const { getSupabaseAnonClient } = require('../_lib/supabase');
    const normalizedEmail = trimmedEmail.toLowerCase();

    const redirectTo = process.env.SUPABASE_PASSWORD_RESET_REDIRECT_TO || process.env.PUBLIC_SITE_URL;
    const supabase = getSupabaseAnonClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, redirectTo
      ? { redirectTo }
      : undefined);

    if (error) {
      console.error('[auth/self-reset] Supabase reset failed:', error.message);
      res.status(500).json({ error: 'Self reset failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[auth/self-reset] Reset failed:', {
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Self reset failed' });
  }
};
