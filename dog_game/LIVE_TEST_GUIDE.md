# Live test guide

## Purpose

This runbook is for validating that Dog is playable end-to-end in live Supabase infrastructure.

## Before you start

- Confirm the deployed `dog-room` function endpoint.
- Confirm Supabase secrets are set (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`).
- Confirm `dog_room_states` table exists.

## Mandatory smoke test (4 players)

1. Host creates room.
2. Three players join via invite/room code.
3. All players ready up.
4. Host starts match.
5. Play until winner is reached.
6. Force one reconnect during active turn.
7. Validate all clients converge to same winner and version.

## Mandatory realtime smoke (2 browser clients)

1. Open two browser tabs against `/dog/lobby/?room=<ROOM>&player=<NAME>`.
2. In tab A, join seat + set ready.
3. In tab B, join same room and confirm seat/ready updates appear almost immediately (without waiting ~3s polling tick).
4. In tab A (as host), start match.
5. Confirm tab B enters match state near-realtime.
6. Temporarily disconnect/reconnect network in one tab and verify updates resume via realtime or polling fallback.

> Note: On production domains, realtime should be auto-configured for players (no extra query parameters).

## Validate while testing

- No opponent hand data in public payloads.
- Command retries do not duplicate actions (idempotency).
- State version increases monotonically.
- Reconnect restores both public snapshot and private hand view.
- Realtime updates are primary sync path when subscription is healthy; polling should still recover after realtime interruptions.

## Pass/fail rule

Test is pass only if one full game completes without manual state edits or server restarts.

## Operational references

- Current status: `LIVE_READINESS_STATUS.md`
- Active execution plan: `DELIVERY_RECOVERY_PLAN.md`
- Supabase setup: `SUPABASE_EDGE_SETUP.md`
