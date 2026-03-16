# Sprint 1 bootstrap checklist

This document turns `AGENTS.md` and `PROJECT_PLAN.md` into an immediate, execution-ready Sprint 1 plan.

## Sprint objective

Establish a deterministic, testable foundation for room contracts and core rules so future realtime/web work can safely build on top.

## Deliverables (must complete)

1. Monorepo package skeleton and TS project references
2. Initial shared contracts for room/config/member/commands/events
3. Backend command contracts for `create_room`, `join_room`, `set_ready`, `start_match`
4. Rules-engine base models for board/piece/card/legal-move API
5. Initial rule tests for Ace dual behavior, King start exit, 4 backward, immune blocker constraints
6. Persistence contract checks aligned with existing Supabase entities:
   - `rooms`
   - `room_members`
   - `matches`
   - `match_players`
   - `game_events`

## Recommended repository layout

```text
/apps
  /web
/packages
  /shared-types
  /game-rules
/services
  /realtime-server
  /db
```

## Work breakdown by stream

### Stream A — Workspace and tooling

- [ ] Add/confirm workspace config and package manager setup
- [ ] Add root `tsconfig.base.json`
- [ ] Add project references for all workspace packages
- [ ] Add scripts: `lint`, `typecheck`, `test`
- [ ] Add CI baseline to run lint + typecheck + tests

**Acceptance checks**

- [ ] All workspaces install and build
- [ ] `pnpm -r typecheck` (or equivalent) passes
- [ ] `packages/game-rules` has no framework/network/database imports

### Stream B — `packages/shared-types`

Define canonical contracts first so UI/backend/rules all share the same language.

- [ ] Room configuration types:
  - [ ] `gameMode`: `solo | teams`
  - [ ] `teamCount`
  - [ ] `playersPerTeam`
  - [ ] derived `maxPlayers`
- [ ] Room member types:
  - [ ] identity union (`userId` or `guestName`)
  - [ ] `seatNo`, `teamNo`, `slotInTeam`
  - [ ] `isReady`, `connected`
- [ ] Command types:
  - [ ] `create_room`
  - [ ] `join_room`
  - [ ] `set_ready`
  - [ ] `start_match`
- [ ] Event types:
  - [ ] minimum room lifecycle + ready + match-start events
- [ ] Versioning/idempotency envelope fields for commands

**Acceptance checks**

- [ ] Shared types compile in isolation
- [ ] No framework-specific dependencies
- [ ] Types enforce max 8 players and mode-aware configuration constraints

### Stream C — `packages/game-rules`

Implement deterministic models before advanced move resolution.

- [ ] Base constants and indexing model:
  - [ ] seat-aware corner ownership
  - [ ] 16 spaces between adjacent player entry points
- [ ] Piece state model with explicit flags:
  - [ ] `isInStart`
  - [ ] `isOnBoard`
  - [ ] `isInHome`
  - [ ] `isImmune`
  - [ ] `hasCompletedLap`
- [ ] Card model:
  - [ ] ranks including Joker wildcard intent mapping
- [ ] Legal move API contract:
  - [ ] deterministic input state + action context
  - [ ] deterministic list of legal options
- [ ] Minimal resolver support for:
  - [ ] Ace 1/11 + start exit
  - [ ] King 13 + start exit
  - [ ] 4 forward/backward
  - [ ] immune blocker restriction checks

**Acceptance checks**

- [ ] Same state + same command gives same output
- [ ] No UI/network/storage dependencies in package

### Stream D — `services/realtime-server`

Define backend-facing contracts even if transport implementation is partial.

- [ ] Command handlers (skeleton) for:
  - [ ] `create_room`
  - [ ] `join_room`
  - [ ] `set_ready`
  - [ ] `start_match`
- [ ] Validation rules:
  - [ ] room capacity
  - [ ] team/slot bounds
  - [ ] seat formula: `seatNo = (slotInTeam - 1) * teamCount + teamNo`
- [ ] Reject stale or duplicate commands via version/idempotency checks

**Acceptance checks**

- [ ] Invalid/stale requests return deterministic rejections
- [ ] Seating and team assignment are backend-authoritative

### Stream E — `services/db`

Use existing schema as baseline; do not redesign unless blocked.

- [ ] Add typed adapters/mappers for:
  - [ ] `rooms`
  - [ ] `room_members`
  - [ ] `matches`
  - [ ] `match_players`
  - [ ] `game_events`
- [ ] Add guard checks for schema assumption mismatches

**Acceptance checks**

- [ ] Contract tests (or assertions) confirm required fields are present
- [ ] Writes that represent authoritative game actions route through backend logic

## Required test suite for Sprint 1

- [ ] Ace dual behavior (1 vs 11)
- [ ] King start exit when normal move is blocked
- [ ] 4 backward behavior around board boundaries
- [ ] Immune blocker cannot be passed/landed/swapped/moved

## Suggested command checklist (local)

```bash
pnpm install
pnpm -r lint
pnpm -r typecheck
pnpm -r test
```

## Exit criteria

Sprint 1 is complete only when all are true:

- [ ] End-to-end unit tests run locally
- [ ] Deterministic state transition contract is established
- [ ] Rules package has no UI coupling
- [ ] Backend contracts align with current Supabase persistence model

## Open decisions (only if blocked)

If decisions are needed, ask only blocking questions and prefer binary choices.
