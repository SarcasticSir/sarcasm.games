const { requireSession } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  res.status(200).json({
    user: {
      id: session.id,
      username: session.username,
      email: session.email,
      role: session.role,
      country: session.country
    }
  });
};
