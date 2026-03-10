const { runQuery } = require('../../api/_lib/db');

async function getFinishedLures(userId) {
  try {
    const result = await runQuery(
      `SELECT id, lure_type, placed_at, expires_at
       FROM user_lures
       WHERE user_id = $1
         AND expires_at <= NOW()
       ORDER BY expires_at ASC`,
      [userId]
    );

    return result.rows;
  } catch (_error) {
    return [];
  }
}

module.exports = {
  getFinishedLures
};
