# Project execution plan

## Confirmed decisions

These decisions come from the latest product-owner input and are now treated as project defaults:

1. **Frontend/product entrypoint**
   - Long-term user-facing entrypoint: `https://sarcasm.games/dog/`
   - This route will eventually handle room creation, invite/join flow, and lobby entry

2. **Stack**
   - Next.js + TypeScript frontend
   - Cloudflare Workers + Durable Objects for authoritative real-time rooms
   - Supabase Auth + Supabase Postgres for identity and persistence
   - Vercel for frontend deployment

3. **Mode strategy**
   - Build for both free-for-all and team modes from the start
   - No 2-team hardcoding
   - Team logic must be generalized and scalable

4. **Supported room configurations**
   - Free-for-all:
     - 1v1v1v1
   - Team modes:
     - 2v2
     - 3v3
     - 4v4
     - 2v2v2
     - 2v2v2v2
   - Maximum total players: 8
   - No spectators

5. **Auth scope in v1**
   - Email/password is already enabled in Supabase
   - Magic link may be added later if desired, but is not required to unblock current implementation

6. **Persistence baseline**
   - Supabase schema foundation is already established for:
     - profiles
     - rooms
     - room_members
     - matches
     - match_players
     - game_events
   - Agents should build against the current schema rather than redesigning room persistence from scratch

7. **UI priority**
   - Functional clarity first
   - Reliable room/game flow before visual polish

## Team workflow model (agent-led implementation)

- Agent owns architecture, code, tests, refactors, and technical sequencing.
- Product owner answers focused product decisions when needed.
- Work proceeds in small milestones with clear acceptance criteria.
- Every milestone ends with:
  - implementation summary,
  - validation status,
  - at most 1-3 concrete decision questions.

## Completed pre-implementation foundation

The following persistence/auth baseline is already in place and should be treated as done enough to begin application/backend work:

- Supabase project created and connected via Vercel
- Environment variables configured
- Supabase Auth enabled with email/password
- `profiles` table created
- automatic profile creation trigger implemented
- room persistence model established
- lobby membership model established
- seating/team model established
- match persistence model established
- append-only event log table established

Current persistence entities available:

- `profiles`
- `rooms`
- `room_members`
- `matches`
- `match_players`
- `game_events`

Coding agents should begin from this existing foundation, not recreate the initial schema unless a real blocker is found.

## Implementation phases

## Phase 0 - Repository foundation

Goal: create a maintainable monorepo skeleton aligned with architecture boundaries.

Deliverables:

- Monorepo layout:
  - `apps/web`
  - `packages/shared-types`
  - `packages/game-rules`
  - `services/realtime-server`
  - `services/db`
- Tooling baseline:
  - TypeScript configs
  - lint/format scripts
  - test runner setup
- CI basics:
  - lint
  - typecheck
  - unit tests for rules packages

Acceptance criteria:

- All workspaces build and typecheck.
- `game-rules` has no framework/network/database coupling.

## Phase 1 - Deterministic rules engine (highest priority)

Goal: complete correct, deterministic, server-safe game logic before advanced UI.

Core implementation:

- Board indexing model with per-seat corner ownership.
- Piece state model with explicit booleans:
  - `isInStart`
  - `isOnBoard`
  - `isInHome`
  - `isImmune`
  - `hasCompletedLap`
- Legal move generation as primary source of truth.
- Card effects:
  - Ace (1/11/exit)
  - 2-10 standard movement
  - 4 forward/backward
  - 7 split (multi-step sequence)
  - Jack swap (immune restrictions)
  - Queen (12)
  - King (13/exit)
  - Joker as wildcard behavior
- Collision + knockback handling.
- Immunity constraints (cannot pass/land/swap/move immune piece).
- Exact home entry and overshoot loop behavior.
- Must-play and no-legal-move rules.

Acceptance criteria:

- Deterministic outcomes for same state + command.
- Exhaustive unit tests for listed critical edge cases.

## Phase 2 - Round/deck/team systems

Goal: complete full game-cycle mechanics across modes.

Implementation:

- Deck composition:
  - 4 players => 2 decks (108 cards)
  - >4 players => 3 decks (162 cards)
- Draw/discard/reshuffle flow with deterministic shuffle strategy.
- Hand-size cycle: 6, 5, 4, 3, 2, repeat.
- Team exchange phase with hidden receive until both locked.
- Team continuation rule (support-play after own 4 pieces home).
- Mode-aware win detection:
  - FFA: player-complete
  - Team: team-complete

Acceptance criteria:

- Full round transitions work across FFA and team modes.
- Hidden information boundaries preserved in state projections.

## Phase 3 - Authoritative realtime room service

Goal: ensure anti-desync, reconnect-safe multiplayer orchestration on top of the already-established Supabase persistence model.

Implementation:

- One Durable Object per active game room
- Intent-based command handling:
  - `create_room`
  - `join_room`
  - `set_ready`
  - `exchange_card`
  - `select_card`
  - `request_legal_moves`
  - `start_move_preview`
  - `cancel_move_preview`
  - `confirm_move`
  - `resume_seven_split`
- Backend-authoritative seat/team assignment based on room configuration
- Version/concurrency checks (room/turn version)
- Idempotency keys for duplicate command protection
- Event log stream for replay/audit
- Reconnect handling with identity revalidation
- Distinct payload projections:
  - public room view
  - player-private view

Acceptance criteria:

- Server rejects stale/invalid commands deterministically
- Room join/seat assignment respects:
  - room capacity
  - team_count
  - players_per_team
  - seat order formula
- Reconnect returns consistent authoritative state

## Phase 4 - MVP web client (desktop + mobile)

Goal: playable, clear, touch-friendly product with confirm/cancel flow.

Implementation:

- Lobby flow:
  - room creation/join
  - seat and ready state
- Core game UI:
  - board rendering
  - hand rendering (private only)
  - active turn + phase indicators
- Move UX:
  - card select -> legal options -> preview -> confirm/cancel
  - clear legal/blocked/invalid visual states
- Mobile-first behavior:
  - large touch targets
  - no hover-only critical interactions
  - responsive panels/drawers on narrow widths

Acceptance criteria:

- Full turn can be played on mobile without zooming.
- Preview cancel does not mutate authoritative state.

## Phase 5 - Auth and persistence hardening

Goal: complete production-safe integration on top of the existing Supabase baseline.

Implementation:

- finalize auth UX in web app
- profile/session handling for reconnect continuity
- persist finished matches cleanly
- persist key audit events
- add invite/join flow persistence if needed
- add social/persistence expansions only after room/game flow is stable

Acceptance criteria:

- users can register/login successfully
- room/game flow uses the established Supabase schema correctly
- match completion and key audit events are persisted

## Phase 6 - Hardening and post-MVP

Goal: improve reliability and maintainability before feature expansion.

Implementation:

- Reconnect stress tests.
- Anti-cheat-oriented validation checks.
- Replay/debug utilities.
- Candidate next features:
  - spectators, only if explicitly approved later
  - rematch
  - host migration
  - short-window resume

## Definition of done per milestone

A milestone is done only if:

- code is merged with tests,
- deterministic behavior is validated,
- no hidden-information leak is introduced,
- desktop + mobile interaction path is validated when UI is affected,
- implementation notes include any unresolved tradeoffs.

## Decision protocol (how questions are asked)

To keep coding velocity high:

- Questions are bundled and binary/multiple-choice whenever possible.
- Agent asks only blocking questions.
- Non-blocking decisions are implemented with a safe default and documented.

## Immediate next sprint (Sprint 1)

Scope:

1. Set up monorepo packages and TypeScript project references
2. Implement initial `shared-types` contracts for:
   - room configuration
   - room members
   - seating/team assignment
   - commands
   - events
3. Lock in backend contracts for:
   - `create_room`
   - `join_room`
   - `set_ready`
   - `start_match`
4. Implement rules-engine base models for board, pieces, cards, and legal move API
5. Add first test suite covering:
   - Ace dual behavior
   - King start exit
   - 4 backward
   - immune blocker constraints
6. Ensure persistence assumptions match the confirmed Supabase schema:
   - `rooms`
   - `room_members`
   - `matches`
   - `match_players`
   - `game_events`

Exit criteria:

- end-to-end unit tests run locally
- deterministic state transition contract established
- no UI coupling in rules package
- backend contracts align with the confirmed Supabase persistence model
