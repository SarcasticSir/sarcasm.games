# Dog live readiness status

## Current snapshot

### Green

- Rule engine, deck logic, room engine, and Supabase adapter tests pass locally.
- Command handling path includes both lobby and turn/gameplay intents.

### Yellow

- Browser clients still rely on polling as primary sync path.
- Dog pages still default to a hardcoded Supabase function endpoint.
- Lobby UX still needs strict host-only invite/start presentation.
- `solo`/`1v1v1v1` is still visible in room creation UX and must be removed.
- We still need one documented full remote smoke run (4 players + reconnect + finish).

## Go-live gate

Treat Dog as ready for live pilot only when all are complete:

1. 4 players can finish a full match in one continuous session.
2. Supabase persistence is authoritative for game state and version progression.
3. Realtime subscriptions are primary update path (polling fallback only).
4. Host-only actions are enforced in UI and backend.
5. Team-only mode model is live (`solo` removed).
6. Staging smoke evidence is documented.

## Source of truth for execution

Use `DELIVERY_RECOVERY_PLAN.md` as the active implementation plan.
