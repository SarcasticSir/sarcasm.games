# Quiz API contract (current runtime behavior)

This document reflects the API behavior implemented in:

- `api/quiz/start.js`
- `api/quiz/quest.js`
- `api/quiz/answer.js`

## Shared rules

- `lang` supports `en` and `no`. Invalid/unknown values default to `en`.
- Invalid JSON body is treated as `{}` through the shared body parser.
- Quiz endpoints are rate limited per endpoint scope (`quiz:start`, `quiz:quest`, `quiz:answer`).
- Text-answer matching is delegated to `lib/server/quiz-answer-evaluator.js`.
- Multiple-choice correctness is evaluated via `quiz_question_options`.

## Question object shape (as returned by `/start` and `/quest` today)

```json
{
  "id": 123,
  "category": "General",
  "prompt": "Question text",
  "difficulty": 1,
  "question_type": "text | multiple_choice",
  "answers": ["base64-obfuscated-correct-answer-or-option-id"],
  "options": [
    {
      "option_id": 1001,
      "option_en": "Option label"
    }
  ]
}
```

Notes:

- `answers` are obfuscated with Base64 before being sent to the client.
- For `question_type = "text"`, `answers` is based on `answers_en`.
- For `question_type = "multiple_choice"`, `answers` contains obfuscated correct `option_id` values.
- `options` is only present for multiple-choice questions.

## `POST /api/quiz/start`

Used by batch modes (`random10`, `categories`).

### Request

```json
{
  "mode": "random10 | categories",
  "lang": "en | no",
  "count": 10,
  "categories": ["General", "History"],
  "difficulty": [1, 2, 3]
}
```

### Response (`mode=random10`)

```json
{
  "mode": "random10",
  "count": 10,
  "difficulty": [1, 2, 3],
  "questions": []
}
```

### Response (`mode=categories`)

```json
{
  "mode": "categories",
  "count": 12,
  "totalAvailable": 52,
  "selectedCategories": ["General", "History"],
  "categoryAllocation": {
    "General": 6,
    "History": 6
  },
  "difficulty": [1, 2],
  "questions": []
}
```

## `POST /api/quiz/quest`

Single-question flow used by quest page. The endpoint is action-based.

### Request (`action=overview`)

```json
{
  "action": "overview",
  "lang": "en | no",
  "guestProgressToken": "optional-token",
  "solvedQuestionIds": [1, 2],
  "solvedQuestionIdDeltas": [3]
}
```

### Response (`action=overview`)

```json
{
  "mode": "authenticated | guest",
  "categories": [
    {
      "name": "General",
      "total": 100,
      "solved": 10,
      "remaining": 90
    }
  ],
  "guestProgressToken": "optional-token-for-guests"
}
```

### Request (`action=next`)

```json
{
  "action": "next",
  "categories": ["General"],
  "lang": "en | no",
  "guestProgressToken": "optional-token",
  "solvedQuestionIds": [1, 2],
  "solvedQuestionIdDeltas": [3]
}
```

### Response (`action=next`)

```json
{
  "question": {},
  "guestProgressToken": "optional-token-for-guests"
}
```

### Request (`action=reset`)

```json
{
  "action": "reset",
  "category": "General"
}
```

### Response (`action=reset`)

```json
{
  "categories": []
}
```

## `POST /api/quiz/answer`

Validates one submitted answer.

### Request

```json
{
  "questionId": 123,
  "answer": "User answer or selected option_id",
  "lang": "en | no",
  "retryAvailable": true,
  "mode": "quest | random10 | categories",
  "persistProgress": true
}
```

### Response

```json
{
  "questionId": 123,
  "status": "correct | almost | wrong",
  "retryAvailable": true,
  "acceptedAnswer": null
}
```

`acceptedAnswer` is only populated when `status` is `wrong`.

## Error contract

Common endpoint errors:

- `400` invalid request body/required fields
- `401` unauthorized (quest reset without login)
- `403` forbidden (admin-only endpoints, outside quiz API scope)
- `404` missing question (`/api/quiz/answer`)
- `405` method not allowed
- `429` rate limited
- `500` unexpected server error
