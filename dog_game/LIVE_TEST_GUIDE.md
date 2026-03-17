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

## Validate while testing

- No opponent hand data in public payloads.
- Command retries do not duplicate actions (idempotency).
- State version increases monotonically.
- Reconnect restores both public snapshot and private hand view.

## Pass/fail rule

Test is pass only if one full game completes without manual state edits or server restarts.

## Operational references

- Current status: `LIVE_READINESS_STATUS.md`
- Active execution plan: `DELIVERY_RECOVERY_PLAN.md`
- Supabase setup: `SUPABASE_EDGE_SETUP.md`
