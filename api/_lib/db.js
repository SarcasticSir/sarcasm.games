const { createClient } = require('@vercel/postgres');

async function runQuery(text, params = []) {
  const client = createClient();
  await client.connect();
  try {
    return await client.query(text, params);
  } finally {
    await client.end();
  }
}

async function getUserByEmail(email) {
  const result = await runQuery(
    `SELECT id, username, email, password_hash, role, country, created_at, updated_at
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function getUserByUsername(username) {
  const result = await runQuery(
    `SELECT id, username, email, password_hash, role, country, created_at, updated_at
     FROM users
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [username]
  );
  return result.rows[0] || null;
}

async function insertUser({ username, email, passwordHash, role = 'user', country }) {
  const result = await runQuery(
    `INSERT INTO users (username, email, password_hash, role, country)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, email, role, country, created_at, updated_at`,
    [username, email, passwordHash, role, country]
  );
  return result.rows[0];
}

async function updatePasswordByUserId(userId, passwordHash) {
  await runQuery(
    `UPDATE users
     SET password_hash = $1
     WHERE id = $2`,
    [passwordHash, userId]
  );
}

async function getUsersForAdminList() {
  const result = await runQuery(
    `SELECT id, username, email, role, country, created_at, updated_at
     FROM users
     ORDER BY created_at DESC`
  );
  return result.rows;
}


module.exports = {
  runQuery,
  getUserByEmail,
  getUserByUsername,
  insertUser,
  updatePasswordByUserId,
  getUsersForAdminList
};
