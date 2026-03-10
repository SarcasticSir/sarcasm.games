const { sql } = require('@vercel/postgres');

async function getUserByEmail(email) {
  const result = await sql`
    SELECT id, username, email, password_hash, role, country, created_at, updated_at
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;
  return result.rows[0] || null;
}

async function getUserByUsername(username) {
  const result = await sql`
    SELECT id, username, email, password_hash, role, country, created_at, updated_at
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `;
  return result.rows[0] || null;
}

async function insertUser({ username, email, passwordHash, role = 'user', country }) {
  const result = await sql`
    INSERT INTO users (username, email, password_hash, role, country)
    VALUES (${username}, ${email}, ${passwordHash}, ${role}, ${country})
    RETURNING id, username, email, role, country, created_at, updated_at
  `;
  return result.rows[0];
}

async function getUsersForAdminList() {
  const result = await sql`
    SELECT id, username, email, role, country, created_at, updated_at
    FROM users
    ORDER BY created_at DESC
  `;
  return result.rows;
}

module.exports = {
  getUserByEmail,
  getUserByUsername,
  insertUser,
  getUsersForAdminList
};
