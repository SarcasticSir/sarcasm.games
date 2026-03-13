const QUIZ_RATE_LIMIT_ERROR = {
  code: 'RATE_LIMITED',
  message: 'Too many quiz requests. Please wait a moment and try again.'
};

function sendQuizRateLimited(res) {
  res.setHeader('Retry-After', '10');
  res.status(429).json({ error: QUIZ_RATE_LIMIT_ERROR });
}

module.exports = {
  sendQuizRateLimited
};
