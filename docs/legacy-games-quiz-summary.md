# Legacy summary: `games/quiz`

This document summarizes how the removed `games/quiz` module worked before decommissioning.

## What it was

`games/quiz` was an admin-only quiz page backed by API endpoints and database tables.
It supported:

- three quiz modes (`random10`, `categories`, `completionist`)
- bilingual question rendering (`English` and `Norsk`)
- per-user progress tracking
- category and global progress reset

## Frontend flow

The page had three views:

1. **Setup view**
   - choose mode
   - (for category/completionist) select categories and question count
2. **Question view**
   - free-text answer input
   - answer submit + optional next question button
3. **Result view**
   - summary of correct answers

## API endpoints used

- `GET /api/quiz/overview`
  - returned available categories and user progress
- `POST /api/quiz/start`
  - returned a question set based on selected mode
- `POST /api/quiz/answer`
  - evaluated answer correctness (including "almost" logic)
  - persisted correctness in user progress
- `POST /api/quiz/reset-category`
  - reset progress for one category
- `POST /api/quiz/reset-all`
  - reset all progress for current user

All endpoints required a valid session and admin role.

## Evaluation logic

Answers were evaluated using normalized comparison and fuzzy matching:

- exact match after normalization
- numeric tolerance thresholds
- Levenshtein distance for text answers
- "almost" status could grant one retry before final wrong result

## Persistence model

The module read questions from `quiz_questions` and wrote progress to `user_answers`.

- question fetching supported random and completionist filtering
- progress was stored with upsert semantics per `user_id + question_id`

## Why it was removed

The module was removed to prepare for a full quiz rework and simplify the current codebase.
