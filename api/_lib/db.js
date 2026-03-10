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

async function getQuizCategories() {
  const result = await runQuery(
    `SELECT category, COUNT(*)::int AS total
     FROM quiz_questions
     GROUP BY category
     ORDER BY category ASC`
  );
  return result.rows;
}

async function getQuizCategoryProgress(userId) {
  const result = await runQuery(
    `SELECT q.category,
            COUNT(q.id)::int AS total,
            COALESCE(SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END), 0)::int AS correct
     FROM quiz_questions q
     LEFT JOIN user_answers ua
       ON ua.question_id = q.id
      AND ua.user_id = $1
     GROUP BY q.category
     ORDER BY q.category ASC`,
    [userId]
  );
  return result.rows;
}

async function getRandomQuizQuestions(limit) {
  const result = await runQuery(
    `SELECT id, category, question_text, correct_answer, wrong_answers, difficulty
     FROM quiz_questions
     ORDER BY RANDOM()
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function getRandomQuizQuestionsByCategories(categories, limit) {
  const result = await runQuery(
    `SELECT id, category, question_text, correct_answer, wrong_answers, difficulty
     FROM quiz_questions
     WHERE category = ANY($1)
     ORDER BY RANDOM()
     LIMIT $2`,
    [categories, limit]
  );
  return result.rows;
}

async function getCompletionistQuizQuestionsByCategories(userId, categories, limit) {
  const result = await runQuery(
    `SELECT q.id, q.category, q.question_text, q.correct_answer, q.wrong_answers, q.difficulty
     FROM quiz_questions q
     WHERE q.category = ANY($2)
       AND NOT EXISTS (
         SELECT 1
         FROM user_answers ua
         WHERE ua.user_id = $1
           AND ua.question_id = q.id
           AND ua.is_correct = TRUE
       )
     ORDER BY RANDOM()
     LIMIT $3`,
    [userId, categories, limit]
  );
  return result.rows;
}

async function getQuizQuestionById(questionId) {
  const result = await runQuery(
    `SELECT id, category, question_text, correct_answer
     FROM quiz_questions
     WHERE id = $1
     LIMIT 1`,
    [questionId]
  );
  return result.rows[0] || null;
}

async function upsertUserAnswer({ userId, questionId, isCorrect }) {
  await runQuery(
    `INSERT INTO user_answers (user_id, question_id, is_correct)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, question_id)
     DO UPDATE SET is_correct = EXCLUDED.is_correct`,
    [userId, questionId, isCorrect]
  );
}

async function resetUserProgressByCategory(userId, category) {
  await runQuery(
    `DELETE FROM user_answers ua
     USING quiz_questions qq
     WHERE ua.question_id = qq.id
       AND ua.user_id = $1
       AND qq.category = $2`,
    [userId, category]
  );
}

async function resetAllUserProgress(userId) {
  await runQuery(
    `DELETE FROM user_answers
     WHERE user_id = $1`,
    [userId]
  );
}

module.exports = {
  getUserByEmail,
  getUserByUsername,
  insertUser,
  updatePasswordByUserId,
  getUsersForAdminList,
  getQuizCategories,
  getQuizCategoryProgress,
  getRandomQuizQuestions,
  getRandomQuizQuestionsByCategories,
  getCompletionistQuizQuestionsByCategories,
  getQuizQuestionById,
  upsertUserAnswer,
  resetUserProgressByCategory,
  resetAllUserProgress
};
