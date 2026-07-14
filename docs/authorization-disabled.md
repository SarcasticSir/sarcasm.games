# Authorization temporarily disabled

## Why

Vercel Hobby rejected deployments because the repository had more than 12 active Serverless Function handlers under `api/`.

Authorization is not currently used by the public site, so the 10 handlers under `api/auth/` are being removed from the active deployment. This reduces the expected Vercel Function count from 20 to 10.

## Priority: quiz must continue working

The quiz API is deliberately not being rewritten or removed.

The following handlers remain active:

- `api/quiz/start.js`
- `api/quiz/answer.js`
- `api/quiz/overview.js`
- `api/quiz/quest.js`

Verified behavior:

- `quiz/start` is public and has no session requirement.
- `quiz/overview` is public and has no session requirement.
- `quiz/quest` supports a full guest flow with guest progress and local browser storage.
- `quiz/answer` evaluates answers without login. A session is only used for optional account-based progress persistence.
- Random 10 and Category Quiz use the public quiz handlers.
- Quiz Quest is intended to run in its existing guest mode while authorization is disabled.

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

`api/_lib/auth.js` is retained because some remaining admin/contact handlers still import the shared authorization helpers. Those endpoints are not being made public.

## Public limitations while disabled

- Login, registration, logout, account deletion and password reset are unavailable.
- Account-synced quiz progress is unavailable; guest/local progress remains.
- Contact/member/admin flows that require login may be unavailable.
- Admin API routes remain protected and are not converted to anonymous access.

## Rollback reference

The last commit before the authorization-disable work began was:

`a461f000169b152ea4d714342010e948e4d25f0a`

To restore the previous implementation, retrieve the removed `api/auth/` files and the previous frontend versions from that commit. Relevant frontend files include:

- `index.html`
- `dailyclick/index.html`
- `quiz-quest/index.html`
- login-dependent contact/member/admin pages

Restoring all 10 original auth handlers without route consolidation will likely exceed Vercel Hobby's 12-function limit again.
