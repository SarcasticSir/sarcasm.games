# Next round milestone: playable 4-player live game

This milestone defines the minimum deliverables needed so a host can:

1. create a room for four players,
2. share an invite URL to three friends,
3. start a match,
4. play the match to completion.

## Definition of done

A milestone pass requires all items below in one deployed environment (staging is fine):

- Host can create a 4-player room and receives a room code.
- Host sees a copy/shareable invite URL in the client.
- Three remote players can open the invite URL, authenticate, and join successfully.
- All four players can mark ready.
- Host can start match when room is full + all ready.
- Turn flow runs with authoritative command handling until a winner is detected.
- At least one reconnect is tested during an active turn without desync.
- Opponent card privacy is validated in network payloads.

## Scope for the next coding round

### A) Invite URL and room entry UX

- Add a minimal playable `/dog` UI route with:
  - `Create 4-player room` action,
  - visible room code,
  - `Copy invite URL` action,
  - room lobby roster/ready state.
- Invite URL format should include room identity (`roomId` or `roomCode`) and open directly into join flow.
- Join flow should validate room existence and return a user-safe error message when invalid/expired.

### B) Command plumbing to authoritative backend

- Wire client intents to Edge handler command endpoint:
  - `create_room`
  - `join_room`
  - `set_ready`
  - `start_match`
  - `request_legal_moves`
  - `start_move_preview`
  - `cancel_move_preview`
  - `confirm_move`
- Ensure each write intent includes idempotency key + expected room/match version where applicable.

### C) Realtime subscriptions and rendering

- Subscribe clients to room events over Supabase Realtime.
- Apply incoming snapshots/events to UI state.
- Render these minimum panels:
  - room/lobby status,
  - current turn + active player,
  - local hand,
  - legal move options + confirm/cancel controls,
  - winner/end-state banner.

### D) Match completion flow

- Detect and render winner from authoritative events.
- Disable move actions after terminal state.
- Keep final board state visible for all players.

### E) Hardening needed for first live pilot

- Validate environment variables for Supabase URL/keys and handler config.
- Add request validation + basic rate-limiting at command ingress.
- Confirm public/private payload projection in realtime events (no opponent hand leaks).

## Test checklist required in same PR/round

- Unit/integration tests continue passing (`npm test` in `dog_game`).
- New integration test for invite URL parse + join flow happy path.
- New integration test for full 4-player lobby lifecycle:
  - create, join x3, ready x4, start.
- New integration test for playing to terminal winner in room engine path.
- Manual staging smoke run with 4 real browsers/users.

## Suggested implementation order

1. `/dog` minimal lobby UI (create/join/ready/start only).
2. Realtime subscription + lobby synchronization.
3. Turn UI for request_legal_moves + preview/confirm cycle.
4. Winner/end-state rendering.
5. Reconnect and privacy validation.

## Out of scope for this milestone

- Spectators
- Advanced animations
- Social/friends features
- Match history UI polish

## Exit criteria for "ready to test a full round"

Declare ready only when all are true:

- 4-player create/join/start works from invite URL in staging.
- Full round can be completed with legal move flow (preview/confirm) and winner broadcast.
- Reconnect once during active turn is successful.
- No hidden-information leakage observed in payload inspection.
