-- Recommended indexes for quiz hot paths.
-- Apply in staging first, then validate with EXPLAIN (ANALYZE, BUFFERS).

CREATE INDEX IF NOT EXISTS idx_quiz_questions_category_id
  ON quiz_questions (category, id);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_id_category
  ON quiz_questions (id, category);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_category_not_empty
  ON quiz_questions (category)
  WHERE category IS NOT NULL AND TRIM(category) <> '';

CREATE INDEX IF NOT EXISTS idx_user_answers_user_question_correct
  ON user_answers (user_id, question_id, is_correct);

CREATE INDEX IF NOT EXISTS idx_user_answers_question_user
  ON user_answers (question_id, user_id);
