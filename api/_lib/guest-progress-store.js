const { runQuery } = require('./db');

const DEFAULT_TTL_SECONDS = 60 * 60 * 12;
let hasAttemptedSchemaInit = false;

async function ensureGuestProgressSchema() {
  if (hasAttemptedSchemaInit) return;
  hasAttemptedSchemaInit = true;

  await runQuery(
    `CREATE TABLE IF NOT EXISTS quiz_guest_progress (
      token TEXT PRIMARY KEY,
      solved_question_ids INTEGER[] NOT NULL DEFAULT '{}',
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );

  await runQuery(
    `CREATE INDEX IF NOT EXISTS quiz_guest_progress_expires_at_idx
     ON quiz_guest_progress (expires_at)`
  );
}

function normalizeSolvedQuestionIds(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();

  return values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

async function pruneExpiredGuestProgress() {
  await ensureGuestProgressSchema();
  await runQuery('DELETE FROM quiz_guest_progress WHERE expires_at <= NOW()');
}

async function getGuestProgress(token) {
  await ensureGuestProgressSchema();

  const result = await runQuery(
    `SELECT token, solved_question_ids
     FROM quiz_guest_progress
     WHERE token = $1
       AND expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    token: row.token,
    solvedQuestionIds: normalizeSolvedQuestionIds(row.solved_question_ids)
  };
}

async function saveGuestProgress(token, solvedQuestionIds, ttlSeconds = DEFAULT_TTL_SECONDS) {
  await ensureGuestProgressSchema();

  const normalizedIds = normalizeSolvedQuestionIds(solvedQuestionIds);
  const safeTtlSeconds = Number.isInteger(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS;

  await runQuery(
    `INSERT INTO quiz_guest_progress (token, solved_question_ids, expires_at, updated_at)
     VALUES ($1, $2::int[], NOW() + ($3::text || ' seconds')::interval, NOW())
     ON CONFLICT (token)
     DO UPDATE SET
       solved_question_ids = EXCLUDED.solved_question_ids,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [token, normalizedIds, safeTtlSeconds]
  );
}

module.exports = {
  getGuestProgress,
  saveGuestProgress,
  pruneExpiredGuestProgress,
  normalizeSolvedQuestionIds
};
