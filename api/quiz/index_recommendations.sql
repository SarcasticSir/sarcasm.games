-- Recommended indexes for quiz question selection endpoints.
-- These support category filtering, deterministic id scan/order, and user answer exclusion joins.

CREATE INDEX IF NOT EXISTS idx_quiz_questions_category_id
  ON quiz_questions (category, id);

CREATE INDEX IF NOT EXISTS idx_user_answers_user_question_correct
  ON user_answers (user_id, question_id, is_correct);

CREATE INDEX IF NOT EXISTS idx_user_answers_question_user
  ON user_answers (question_id, user_id);
