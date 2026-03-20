# Supabase auth + profiles notes

This repo now uses Supabase Auth for passwords and sessions, and `public.profiles` for app-specific user data.

## Recommended model

- `auth.users` stores email, password, confirmation state, and recovery links.
- `public.profiles` stores:
  - `auth_user_id`
  - `username`
  - `username_normalized`
  - `email`
  - `email_normalized`
  - `role`
  - `country`
- `public.user_answers.user_id` references `auth.users(id)` as `uuid`.
- Login uses `username + password`.
- Email is used for confirmation and password reset.
- Country is captured from the incoming edge IP header during registration and stored in `public.profiles.country`.

## What changed in code

- Session objects now merge Supabase Auth users with the matching `public.profiles` row, and they re-sync the profile from Auth on session fetch/login so `public.profiles` stays updated.
- Registration creates the Supabase Auth account first, then inserts a `public.profiles` row with default role `user`.
- Login resolves the supplied username through `public.profiles`, then signs in through Supabase Auth with the matching email.
- Admin-only checks use `profiles.role`.
- Password reset still uses Supabase recovery emails and `/reset-password/`, and the reset page syncs the resulting session back to the server so cookies/profile stay aligned.
- The front page now supports resending confirmation emails when a user has not confirmed yet.

## Required environment variables on Vercel

Set these server-side environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (or `DATABASE_URL`)
- Optional:
  - `SUPABASE_PASSWORD_RESET_REDIRECT_TO` (recommended: `https://sarcasm.games/reset-password/`)
  - `SUPABASE_EMAIL_CONFIRM_REDIRECT_TO` (recommended: `https://sarcasm.games/api/auth/confirm`)
  - `PUBLIC_SITE_URL`
  - `DB_POOL_MAX`
  - `DB_POOL_IDLE_TIMEOUT_MS`
  - `DB_POOL_CONNECTION_TIMEOUT_MS`

## Required SQL migration in Supabase

If your project is empty, run `docs/supabase-auth-only-schema.sql`.

## Recommended Supabase Auth settings

In the Supabase dashboard, enable these:

1. **Confirm email**
2. **Secure email change** if you plan to support changing emails later
3. **OTP / email link expiry = 3600 seconds** if you want confirmation links to expire after 60 minutes

If you previously experimented with old auth triggers, remove legacy `on_auth_user_created` / `handle_new_user` hooks before using this setup.
