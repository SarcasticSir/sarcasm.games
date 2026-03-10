const { isRateLimited } = require('./_lib/rate-limit');
const { requireSession } = require('./_lib/auth');
const { fetchCurrentWeather } = require('../lib/server/weather-service');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, 'garden:weather')) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const weather = await fetchCurrentWeather();
    res.status(200).json(weather);
  } catch (error) {
    console.error('[weather] Failed to fetch weather:', error.message);
    res.status(500).json({ error: 'Unable to fetch weather right now.' });
  }
};
