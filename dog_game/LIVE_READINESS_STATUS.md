# Dog live readiness status

This status reflects the latest local verification in this repository (`npm test` in `dog_game`).

## Current status snapshot

### Green (ready)

- Rules engine coverage is passing for core movement, collisions, immunity, Jack swap limits, Joker mirroring, 7-split behavior, must-play/no-legal-move checks, and home-lane exact-entry logic.
- Deck and round systems are passing for deck size by player count, deterministic shuffle behavior, draw/discard reshuffle, round hand-size cycle, and team card exchange validation.
- Realtime room engine flow is passing for deterministic join/seat/version checks, match start validation, exchange phase progression, authoritative legal-move preview/cancel/confirm flow, blocked-round advancement, and idempotency behavior.
- Supabase-facing adapter/handler tests are passing for create/join/ready/start command orchestration, reconnect attach snapshots, and edge handler command routing.

### Yellow (still needed before a true live test)

The code-level tests are healthy, but these items are still required to run a real multiplayer live session with external players:

1. **Deploy runtime endpoints**
   - Deploy `services/realtime-server/supabase-edge-handler.js` as an active Edge Function endpoint.
   - Confirm command routing from clients to this endpoint in the target environment.

2. **Wire realtime channel + persistence in Supabase project**
   - Ensure the target Supabase project has realtime channels enabled for room event fan-out.
   - Verify service-role and anon key usage is correctly split (server-authoritative commands vs client subscriptions).
   - Validate writes/reads against `rooms`, `room_members`, `matches`, `match_players`, and `game_events` under real auth identities.

3. **Client integration path**
   - Implement or finish a playable `/dog` client flow that sends intents (`join_room`, `set_ready`, `exchange_card`, `request_legal_moves`, `start_move_preview`, `cancel_move_preview`, `confirm_move`).
   - Ensure the client consumes room snapshots/events and renders legal-action UX clearly.

4. **Environment and secrets hardening**
   - Verify production/staging env vars for Supabase URL/keys and any signing secrets used for room access.
   - Add basic rate limiting and request validation at the command ingress point.

5. **End-to-end smoke pass with real users**
   - 4-player room create/join/start/turn/reconnect smoke test in deployed environment.
   - Confirm hidden-information boundaries (no opponent hand leakage) in real payloads.
   - Confirm reconnect mid-round restores consistent public/private snapshots.

## Suggested go-live gate for first external test

Treat the feature as "ready for live pilot" when all of the following are complete:

- Edge handler deployed and reachable.
- Supabase realtime + DB persistence verified in target project.
- Minimal playable client loop connected to intent/event API.
- One full 4-player smoke test run completed without desync.
- At least one reconnect scenario validated during active turn flow.
