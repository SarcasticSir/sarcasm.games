# Supabase migration notes

This repo already talks directly to Postgres with the `pg` driver, so Vercel can continue to host the API routes while Supabase provides both Postgres and Auth.

## What changed in code

- Database access still uses `pg`, now expecting a Supabase Postgres connection string (`SUPABASE_DB_URL` or `DATABASE_URL`).
- Authentication now uses Supabase Auth instead of local password hashes + custom JWT signing.
- Server routes store Supabase access/refresh tokens in HTTP-only cookies.
- App profile data still lives in the `public.users` table and is linked to Supabase Auth via `users.auth_user_id`.
- Quiz progress continues to use the internal numeric `users.id`, so existing `user_answers.user_id` references do not need to change.

## Required environment variables on Vercel

Set these server-side environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (or `DATABASE_URL`)
- Optional pool tuning:
  - `DB_POOL_MAX`
  - `DB_POOL_IDLE_TIMEOUT_MS`
  - `DB_POOL_CONNECTION_TIMEOUT_MS`

You can also expose these client-compatible names if you want consistency with Supabase defaults:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Required SQL migration in Supabase

Run this in Supabase SQL editor before deploying:

```sql
alter table public.users
  add column if not exists auth_user_id uuid unique;

alter table public.users
  drop column if exists password_hash;

create unique index if not exists users_auth_user_id_idx
  on public.users (auth_user_id);

create unique index if not exists users_username_lower_idx
  on public.users ((lower(username)));

create unique index if not exists users_email_lower_idx
  on public.users ((lower(email)));
```

## Migration strategy for existing users

Existing local users from the old password-hash setup are **not automatically migrated** by this patch.

For each existing account, you should either:

1. create a matching Supabase Auth user and copy the returned `auth.users.id` into `public.users.auth_user_id`, or
2. ask users to re-register if the old accounts are disposable.

If you want a full one-time migration, use the Supabase Admin API or dashboard to create auth users, then backfill `public.users.auth_user_id`.

## Notes

- Registration now creates the Supabase Auth user first, then inserts the linked app profile row.
- Login still accepts `username + password` in the UI, but server-side it resolves the username to the stored email before calling Supabase Auth.
- Self-service password reset now updates the linked Supabase Auth user password instead of touching a local password hash.
