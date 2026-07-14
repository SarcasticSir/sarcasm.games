# Authorization temporarily disabled

Date: 2026-07-14

## Why

Vercel Hobby rejected deployments because the repository had more than 12 active Serverless Function handlers under `api/`.

Authorization is not currently used by the public site, so the 10 handlers under `api/auth/` were removed from the active deployment. This reduces the expected Vercel Function count from 20 to 10.

## Priority: quiz must continue working

The quiz API was deliberately not rewritten or removed.

The following handlers remain active:

- `api/quiz/start.js`
- `api/quiz/answer.js`
- `api/quiz/overview.js`
- `api/quiz/quest.js`

Verified design and behavior:

- `quiz/start` is public and has no session requirement.
- `quiz/overview` is public and has no session requirement.
- `quiz/quest` supports a full guest flow with guest progress tokens and local browser storage.
- `quiz/answer` evaluates answers without login. A session is only used for optional account-based progress persistence.
- Random 10 and Category Quiz use the public quiz handlers.
- Quiz Quest runs in its existing guest mode while authorization is disabled.
- Quiz Quest no longer performs the obsolete `/api/auth/session` request before starting.

## Authorization handlers removed

- `api/auth/login.js`
- `api/auth/logout.js`
- `api/auth/register.js`
- `api/auth/confirm.js`
- `api/auth/resend-confirmation.js`
- `api/auth/session.js`
- `api/auth/sync-session.js`
- `api/auth/public-config.js`
- `api/auth/delete-account.js`
- `api/auth/self-reset.js`

`api/_lib/auth.js` is retained because some remaining admin/contact handlers still import the shared authorization helpers. Files under `api/_lib/` are shared code and are not separate Vercel Functions.

## Frontend changes

- The public home page runs as guest and no longer performs session, login or logout requests.
- Login and account controls are hidden from the public home page.
- Quiz Quest enters guest mode directly.
- Daily Click no longer checks `/api/auth/session`; its developer controls remain hidden.
- Admin endpoints were not made public.

## Public limitations while disabled

- Login, registration, logout, account deletion and password reset are unavailable.
- Account-synced quiz progress is unavailable; guest/local progress remains.
- Contact/member/admin flows that require login may be unavailable.
- The contact submission API still requires an authenticated user and has not been converted to anonymous submission.
- Admin API routes remain protected and are not converted to anonymous access.

## Backup and rollback

A permanent backup branch was created from the final commit before authorization was disabled:

`backup/auth-before-disable-2026-07-14`

The branch points to:

`a461f000169b152ea4d714342010e948e4d25f0a`

That branch contains the full authorization implementation, all ten original `api/auth/` handlers and the previous frontend behavior.

### Full rollback

Restore or reset from the backup branch/commit if the complete previous system is needed.

### Partial restoration

For a safer future restoration:

1. Copy the required handlers from `backup/auth-before-disable-2026-07-14`.
2. Restore the auth-related initialization and controls in `index.html`.
3. Restore the session lookup in `quiz-quest/index.html` only if account-based quiz progress is needed.
4. Restore the admin visibility check in `dailyclick/index.html` only if those development controls should return.
5. Consolidate auth routes before deploying them again, otherwise the Vercel function limit will be exceeded again.

## Deployment verification checklist

After deployment, verify:

- `/quiz-quest/` loads the category overview.
- A guest can select categories and start a quiz.
- Questions load through `/api/quiz/quest`.
- Answers can be submitted and a next question can be loaded.
- Guest progress survives a page refresh.
- Random 10 and Category Quiz still start and accept answers.
- `/hodepinekalender/` loads as a static page.
- Vercel reports no more than 12 deployed functions.
