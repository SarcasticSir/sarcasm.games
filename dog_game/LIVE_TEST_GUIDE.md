# Live test guide (AGENTS-aligned)

This guide follows the project AGENTS direction:

- realtime coordination via a dedicated realtime layer,
- Supabase for auth + persistence,
- optional fast MVP path with Supabase Realtime + Edge Functions / RPC move validation.

## Recommended test path now

For the fastest live test with 4 players:

1. Use **Supabase Realtime channel** for room presence + state updates.
2. Keep **server-authoritative move validation** in backend functions (RPC / Edge Function).
3. Persist room/match events to existing tables (`rooms`, `room_members`, `matches`, `match_players`, `game_events`).

This matches the AGENTS alternative MVP path while preserving authoritative rules.

## Minimal live test checklist (4 players)

- [ ] Host creates room (mode config + capacity).
- [ ] 3 friends join by room code.
- [ ] Seat assignment follows formula `seat_no = (slot_in_team - 1) * team_count + team_no`.
- [ ] All players set ready.
- [ ] Host starts match.
- [ ] For each move:
  - client sends intent,
  - backend validates via room engine,
  - backend publishes resulting room snapshot/event via Supabase Realtime.
- [ ] Reconnect one client and confirm private/public view consistency.

## Event flow shape

Use intent messages from client -> backend, for example:

- `create_room`
- `join_room`
- `set_ready`
- `exchange_card`
- `request_legal_moves`
- `start_move_preview`
- `cancel_move_preview`
- `confirm_move`

Publish events to clients through Supabase Realtime, for example:

- `room_snapshot`
- `phase_changed`
- `turn_changed`
- `legal_moves`
- `move_preview`
- `card_played`

## Important constraints

- Never trust client legal-move calculations.
- Never expose opponent hand contents in public payloads.
- Keep idempotency and version checks in backend command handling.
- Persist an append-only event stream for replay/debugging.

## Deployment note

This repository now does **not** include a dedicated local WebSocket server script.
Use your Supabase project + backend function runtime for live test orchestration.
