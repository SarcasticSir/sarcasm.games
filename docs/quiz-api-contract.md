# Quiz API contract (shared across modes)

This document defines a single request/response contract for all quiz modes:

- `random10`
- `categories`
- `quest`

The goal is consistent behavior for both logged-in users and guest users.

## Shared rules

- `lang` supports `en` and `no`.
- Invalid JSON body must be treated as `{}`.
- Rate-limited requests should return the same shaped error response for all quiz endpoints.
- Answer evaluation rules are shared through `lib/server/quiz-answer-evaluator.js`.

## `POST /api/quiz/start`

### Request

```json
{
  "mode": "random10 | categories",
  "lang": "en | no",
  "count": 10,
  "categories": ["General", "History"]
}
```

### Response (`mode=random10`)

```json
{
  "mode": "random10",
  "count": 10,
  "questions": [
    {
      "id": 123,
      "category": "General",
      "prompt": "Question text",
      "answers": ["Accepted answer"]
    }
  ]
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
  "questions": []
}
```

## `POST /api/quiz/quest`

### Request

```json
{
  "categories": ["General"],
  "lang": "en",
  "guestProgressToken": "optional-token",
  "solvedQuestionIds": [1, 2],
  "solvedQuestionIdDeltas": [3]
}
```

### Response

```json
{
  "guestProgressToken": "token-or-null",
  "overview": [
    {
      "name": "General",
      "total": 100,
      "solved": 10,
      "remaining": 90
    }
  ],
  "question": {
    "id": 22,
    "category": "General",
    "prompt": "Question",
    "answers": ["Accepted answer"]
  }
}
```

## `POST /api/quiz/answer`

### Request

```json
{
  "questionId": 123,
  "answer": "User answer",
  "lang": "en",
  "retryAvailable": true
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

`acceptedAnswer` must only be set when status is `wrong`.

## Error contract

Shared endpoint errors:

- `400` invalid request body/required fields
- `404` missing question (`/answer`)
- `405` method not allowed
- `429` rate limited
- `500` unexpected server error
