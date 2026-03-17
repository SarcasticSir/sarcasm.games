-- Run this once in Supabase SQL editor before deploying dog-room edge function.

create table if not exists public.dog_room_states (
  room_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.dog_room_states enable row level security;

-- Edge function writes with service role key, so no public policies are needed.
-- Optional cleanup index for ordering by most recently changed rooms.
create index if not exists dog_room_states_updated_at_idx
  on public.dog_room_states (updated_at desc);
