# Dog live readiness status

## Current snapshot

### Green

- Rule engine, deck logic, room engine, and Supabase adapter tests are green locally.
- Command handling path includes lobby + turn/gameplay intents.
- Dog web UI now defaults endpoint automatically on production hosts (`sarcasm.games`, `www.sarcasm.games`).
- Lobby UI now enforces host-only visibility for invite links and start controls.
- Create-room UI is teams-only for the current flow (4 teams x 1 player).

### Yellow

- Browser clients still rely on polling as primary sync path.
- We still need one documented full remote smoke run (4 players + reconnect + finish).
- Team-only mode is enforced in UI, but backend still keeps legacy `solo` compatibility paths.

## Go-live gate

Treat Dog as ready for live pilot only when all are complete:

1. 4 players can finish a full match in one continuous session.
2. Supabase persistence is authoritative for game state and version progression.
3. Realtime subscriptions are primary update path (polling fallback only).
4. Host-only actions are enforced in UI and backend.
5. Team-only mode model is fully enforced end-to-end (not only UI).
6. Staging smoke evidence is documented.

## Source of truth for execution

- Active implementation plan: `DELIVERY_RECOVERY_PLAN.md`
- Next-chat handover prompt: `NEXT_CHAT_PROMPT.md`
