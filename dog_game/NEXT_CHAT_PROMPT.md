# Prompt for next chat

Du fortsetter på `sarcasm.games`-repoet, med fokus på `dog/` og `dog_game/`.

## Context

- UI changes are already merged for:
  - teams-only create-room flow,
  - host-only visible invite/start controls,
  - auto endpoint resolution on production domains.
- Remaining highest-priority gap is realtime synchronization in browser clients.

## Goal for this session

Implement **Supabase Realtime as primary sync path** in `dog/lobby/index.html`, with polling as fallback.

## Requirements

1. Keep existing command flow untouched (`attach`, `join_room`, `set_ready`, `start_match`, `request_legal_moves`, preview/confirm commands).
2. Add realtime subscription for room-level updates.
3. Apply incoming updates only when version is newer/equal than current local snapshot.
4. Keep 3-second polling fallback, but avoid unnecessary attach calls when realtime is healthy.
5. Handle reconnect/resubscribe safely.
6. Do not leak private hand info in public update handling.

## Validation required

- `npm test` in `dog_game` must pass.
- Manual smoke in browser:
  1. Open two clients in same room.
  2. Join/ready/start in one client.
  3. Confirm second client updates near-realtime without waiting for poll tick.

## Files likely involved

- `dog/lobby/index.html`
- (if needed) `dog_game/LIVE_TEST_GUIDE.md` for updated run instructions

## Constraints

- Speak Norwegian in user communication.
- Keep code in English.
- Server remains authoritative.
- Polling remains as fallback only.
