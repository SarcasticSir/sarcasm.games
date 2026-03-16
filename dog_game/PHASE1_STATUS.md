# Phase 1 status: rules engine completion

This checklist tracks the Phase 1 objective: deterministic, server-safe game logic with practical edge-case coverage.

## Core logic status

- [x] Board indexing model with seat-aware start indexes
- [x] Explicit piece flags (`isInStart`, `isOnBoard`, `isInHome`, `isImmune`, `hasCompletedLap`)
- [x] Legal move generation is the primary source of truth
- [x] Card effects implemented (Ace, 2-10, 4 backward, 7 split, Jack swap, Queen, King, Joker)
- [x] Collision + knockback handling
- [x] Immunity constraints enforced in move generation and preview application
- [x] Exact home-lane entry and overshoot behavior
- [x] Must-play / no-legal-move hand evaluation

## Critical edge-case test status

- [x] Ace as 1 vs 11
- [x] Ace/King start exit when no piece can otherwise move
- [x] 4 backward crossing board boundaries
- [x] 7 split across multiple pieces
- [x] 7 split knocking allied pieces
- [x] 7 split with immune blocker present
- [x] Jack swap with enemy piece
- [x] Jack forbidden against immune piece
- [x] Joker mirrors all card types (deduplicated)
- [x] Exact `bo` entry
- [x] Overshoot `bo` and continue on track
- [x] Must-play when only one obscure legal move exists

## Deferred to later phases

- [ ] Preview-session lifecycle behavior (`start_move_preview` / `cancel_move_preview` / `confirm_move`) requires realtime room orchestration (Phase 3)
- [ ] Round-end flow when remaining players are blocked requires turn/round state machine at room level (Phase 3)
- [ ] Reconnect-in-the-middle scenarios require room snapshots and transport/session handling (Phase 3)

## Phase 1 completion definition

Phase 1 is considered complete for the current codebase when:

1. All rules-engine and deck/team unit tests pass.
2. Deterministic move generation and move preview behavior are validated by tests.
3. Remaining unchecked items are integration concerns owned by Phase 3 room service.
