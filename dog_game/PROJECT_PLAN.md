# Dog project plan (current)

## Scope locked now

- We are shipping one playable online Dog experience where a full game can be completed end-to-end.
- Team model is the only strategic mode model going forward.
  - Free-for-all is represented as `teams` with four teams of one player each.
- Server remains authoritative for all gameplay state transitions.
- Supabase is the runtime backbone for function ingress, persistence, and realtime fan-out.

## Recently completed

- Create-room web UI no longer exposes `solo`; it now creates teams-only rooms for the current 4-player flow.
- Lobby now limits invite generation + start controls to host-visible actions.
- Dog pages now infer a default edge endpoint on production domains, avoiding manual endpoint setup for normal users.
- Legacy overlapping milestone docs were removed and consolidated.

## Current gaps

1. Realtime subscriptions are still missing in browser clients (polling is primary).
2. End-to-end staging evidence (4 players + reconnect + finish) is still missing in repo.
3. Backend contracts still include some legacy compatibility (`solo`) that should be fully retired.
4. Auth identity hardening and anti-abuse controls need final go-live verification.

## Definition of done for this phase

A release candidate is ready when all are true:

1. Every gameplay command is accepted via the deployed `dog-room` function path.
2. A 4-player game can be finished end-to-end with persisted game state in Supabase.
3. Realtime sync is primary path (polling only fallback).
4. Host-only controls are enforced in UX and command authorization.
5. Team-only mode is fully enforced across UI + backend.
6. No hidden local-only state is used as source of truth for game progression.
7. Documentation is consolidated and reflects the live architecture.
