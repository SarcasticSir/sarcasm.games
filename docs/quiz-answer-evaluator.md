# Quiz answer evaluator (shared rules)

This module is reused for text-answer evaluation in current quiz modes (`random10`, `categories`, `quest`).
Multiple-choice answer validation is handled separately in `api/quiz/answer.js`.

## File

- `lib/server/quiz-answer-evaluator.js`

## Behavior

- Normalizes free text (case-insensitive, strips apostrophes/punctuation, ignores extra spaces).
- Removes common helper words (English + Norwegian stop words).
- Uses Levenshtein-based fuzzy similarity for text answers.
- Supports strict numeric matching for numeric answers.
- Supports **almost** status for numeric answers when input is exact numeric format and within `10%`.
- Supports **almost** status when close, and allows one retry.

## Suggested API usage

1. First submit:
   - `retryAvailable = true`
   - If result is `almost`, return status to client and keep question open.
2. Second submit:
   - `retryAvailable = false`
   - If still not `correct`, mark as final `wrong`.

## Example

```js
const { evaluateAnswer } = require('../../lib/server/quiz-answer-evaluator');

const evaluation = evaluateAnswer({
  userAnswer: req.body.answer,
  acceptedAnswers: question.answers_en,
  retryAvailable: req.body.retryAvailable !== false
});
```
