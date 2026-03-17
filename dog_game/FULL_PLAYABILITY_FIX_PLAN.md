# Dog game full playability fix plan

This plan closes the remaining gaps so players can complete a full match from room creation to winner announcement with reconnect safety and privacy guarantees.

## Outcome target

A host can create a room, share invites, all players can join/ready/start, play through all turns using legal move UX (including preview/confirm for complex cards), and finish with an authoritative winner event.


## Execution priority (logic first, performance later)

From now until first fully playable milestone, all work should prioritize **complete gameplay logic** and authoritative flow correctness before optimization work.

### Priority order

1. Complete and validate all card + movement rules through authoritative APIs and tests.
2. Ensure full match progression works end-to-end (lobby -> exchange -> turns -> winner).
3. Close reconnect and hidden-information correctness gaps.
4. Improve UX clarity for legal actions and confirmation flow.
5. Defer performance tuning (render perf, payload trimming, micro-optimizations) until after playable exit criteria are met.

### Explicitly deferred until after playable

- animation/frame-rate tuning
- network payload micro-optimizations
- caching and query-level optimizations
- non-blocking visual polish not required for rule clarity

## Current blocking gaps

1. Lobby UI lacks ready toggling (`set_ready`) despite backend requiring all players ready before `start_match`.
2. Turn UI is not wired to authoritative move intents (`request_legal_moves`, `start_move_preview`, `cancel_move_preview`, `confirm_move`).
3. Team exchange phase UX is incomplete for mandatory exchange flow.
4. Client uses polling; no Supabase Realtime subscription path.
5. Runtime hardening gaps (auth boundaries, idempotency/version usage consistency, ingress rate limiting).
6. End-to-end live smoke flow not fully validated in staging with 4+ players and reconnect.

## Phase 1 — Lobby completion (P0)

### Scope

- Add ready/unready controls per local player in `/dog/lobby`.
- Show ready state in seat roster.
- Keep host start button disabled until room full + all players ready.
- Ensure invite links are shown/copyable for all open seats.

### Required backend/contract behavior

- Every write command from client includes:
  - `idempotencyKey`
  - `expectedVersion` (where command contract supports it)
- Surface user-safe validation errors for full room, taken seat, invalid room.

### Acceptance checks

- 4 users can join deterministic seats and toggle ready state.
- Host can start only when all ready.
- Duplicate submissions (double-click) do not mutate state twice.

## Phase 2 — Authoritative turn loop wiring (P0)

### Scope

- Wire card action panel to:
  - `request_legal_moves`
  - `start_move_preview`
  - `cancel_move_preview`
  - `confirm_move`
- Render legal move choices from server response only.
- Disable illegal controls when no legal move for selected card.
- Add explicit feedback states:
  - loading
  - illegal action reason
  - preview pending
  - confirmed move and turn advanced

### Card-specific UX requirements

- Ace: expose `1` vs `11` and start-exit options where legal.
- 4: expose forward/backward options.
- 7: multi-step split flow with visible cumulative steps and confirm/cancel at sequence level.
- Jack: source + target selection from server legal targets only.
- Joker: first choose represented card type, then legal action.

### Acceptance checks

- Full turn execution succeeds using only server-authoritative legal moves.
- Preview cancellation always restores pre-preview state.
- Must-play rule is respected from server-provided legal moves.

## Phase 3 — Team exchange + phase transitions (P0 for team modes)

### Scope

- Add dedicated exchange phase panel when `match.phase === 'exchange'`.
- Each teammate must select and submit exactly one card.
- Hide received card content until all required exchanges are completed.
- Transition UI from `exchange` to `play` on authoritative snapshot/event.

### Acceptance checks

- Team match cannot start play until exchange is complete for all required players.
- Receive-visibility rule is enforced (no early reveal).

## Phase 4 — Realtime synchronization (P0)

### Scope

- Replace/augment 3-second polling with Supabase Realtime subscriptions:
  - room-level public snapshot/event channel
  - player-private channel for private hand/preview data
- Keep attach/reconnect bootstrap (`attach`) for cold start and recovery.
- Add optimistic UI only for button disabled/loading states, never for game state mutation.

### Reliability requirements

- Sequence/ordering safe reducer on client for incoming events.
- Ignore stale snapshots by version.
- Resubscribe and re-attach on transient disconnect.

### Acceptance checks

- Multi-client state stays in sync during rapid turns.
- Reconnect during active turn restores correct public + private views.

## Phase 5 — Match completion UX (P0)

### Scope

- Render authoritative winner banner from match terminal state.
- Freeze action controls after terminal state.
- Keep final board and event summary visible.
- Provide “new room/rematch” action (MVP: new room route).

### Acceptance checks

- Winner appears consistently across all clients.
- No post-finish moves can be submitted.

## Phase 6 — Security and production hardening (P0)

### Scope

- Ensure command ingress validates payload shape and allowed command types.
- Enforce auth identity mapping for room membership actions.
- Add rate limiting per user/session/IP at edge ingress.
- Keep hidden-info projection rules strict in public payloads.
- Verify environment variable and key separation (anon vs service role).

### Acceptance checks

- Opponent hands never leak in public snapshots/events.
- Replay/idempotency logs support dispute/debug workflows.

## Phase 7 — Test plan to gate release (P0)

### Automated

- Keep all existing `dog_game` tests green.
- Add integration tests for:
  - 4-player lifecycle: create/join/ready/start
  - Full match to winner through room-engine path
  - Team exchange visibility and completion rules
  - Reconnect attach during active turn
  - Duplicate command idempotency under rapid retries

### Manual staging smoke

Run with 4 real browsers/users:

1. Create room, share invite links, join all seats.
2. Ready all players, start match.
3. Play through full round flow including:
   - Ace dual-choice
   - 4 backward
   - 7 split preview+confirm
   - Jack swap restrictions
4. Force one client reconnect during active turn.
5. Finish match and verify winner parity across all clients.
6. Inspect payloads for hidden-info leaks.

## Suggested delivery as PR sequence

1. **PR-1:** Lobby ready flow + robust start gating.
2. **PR-2:** Turn action wiring (`request_legal_moves` + preview/confirm).
3. **PR-3:** Exchange phase UI and transitions.
4. **PR-4:** Supabase Realtime subscriptions + reconnect resilience.
5. **PR-5:** Winner/terminal UX + hardening + staging smoke evidence.

## Exit criteria (definition of playable)

Declare “playable end-to-end” only when all are true:

- 4-player room can be created, joined via invite, readied, and started.
- Full match can be completed via authoritative legal-move loop.
- Team exchange flow works with correct visibility timing.
- At least one reconnect during active turn succeeds without desync.
- Winner is consistent on all clients and post-finish actions are blocked.
- Hidden information is preserved in all observed payloads.


## Post-playable performance phase (only after exit criteria)

Once all playable exit criteria pass in staging, start a dedicated performance phase with measurable budgets (turn latency, render frame time, payload size) and regression checks.
