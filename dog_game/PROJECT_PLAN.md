# Dog project plan (current)

## Scope locked now

- We are shipping one playable online Dog experience where a full game can be completed end-to-end.
- Team model is the only strategic mode model going forward.
  - `solo` / `1v1v1v1` is considered deprecated and should be removed from UI and command contracts.
  - If needed, free-for-all is represented as `teams` with four teams of one player each.
- Server remains authoritative for all gameplay state transitions.
- Supabase is the runtime backbone for function ingress, persistence, and realtime fan-out.

## Current reality (from repo audit)

- Rules engine + deck + room engine tests are present and passing locally.
- Browser UI still uses polling every 3 seconds as primary sync path.
- Dog pages still include a hardcoded default function URL.
- Room creation UI still exposes `solo` as an option.
- Several old milestone markdown files overlap and are outdated.

## Definition of done for this phase

A release candidate is ready when all are true:

1. Every gameplay command is accepted via the deployed `dog-room` function path.
2. A 4-player game can be finished end-to-end with persisted game state in Supabase.
3. Realtime sync is primary path (polling only fallback).
4. Host-only controls are enforced in UX (invite/start).
5. Joiners only pick name + seat (unless host assigns seats).
6. No hidden local-only state is used as source of truth for game progression.
7. Documentation is consolidated and reflects the live architecture.
