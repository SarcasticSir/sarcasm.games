# Supabase auth-only notes

This repo now uses Supabase Auth directly for user handling and no longer expects a `public.users` table.

## What changed in code

- Database access still uses `pg` for quiz data and operational tables.
- Authentication now uses Supabase Auth as the only source of truth for users.
- Session objects are derived directly from `auth.users` and user metadata.
- Quiz progress is stored in `public.user_answers.user_id` as a `uuid` that references `auth.users(id)`.
- Login now uses `email + password`.
- Registration uses Supabase Auth sign-up directly and stores optional profile-like values in metadata.
- Password reset now sends a Supabase reset email instead of updating a local profile row.

## Required environment variables on Vercel

Set these server-side environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (or `DATABASE_URL`)
- Optional:
  - `SUPABASE_PASSWORD_RESET_REDIRECT_TO`
  - `PUBLIC_SITE_URL`
  - `DB_POOL_MAX`
  - `DB_POOL_IDLE_TIMEOUT_MS`
  - `DB_POOL_CONNECTION_TIMEOUT_MS`

## Required SQL migration in Supabase

If your Supabase project is empty, run `docs/supabase-auth-only-schema.sql`.

If your project already has legacy app tables, make sure `public.user_answers.user_id` references `auth.users(id)` as `uuid`, then drop `public.users` when no runtime code depends on it anymore.
