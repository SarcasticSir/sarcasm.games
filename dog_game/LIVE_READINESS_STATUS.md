# Dog live readiness status

This status reflects a fresh repository audit of the Dog stack (`dog/` UI + `dog_game/` backend code and tests).

## Current status snapshot

### Green (implemented and locally verified)

- Core rules engine is covered by passing tests for movement, collisions, immunity, Jack limits, Joker mirroring, 7-split behavior, must-play/no-legal-move checks, and home-lane exact-entry behavior.
- Deck and round logic is covered by passing tests for deck size by player count, deterministic shuffle, draw/discard reshuffle, hand-size cycle, and team exchange validation.
- Authoritative room engine flow is covered by passing tests for join/seat/version checks, match start validation, exchange phase progression, preview/cancel/confirm turn flow, blocked-round advancement, idempotency behavior, winner detection, and public/private view projection.
- Supabase adapter + HTTP edge handler modules in `services/realtime-server` are covered by tests for command routing and CORS handling.

### Yellow (gaps before true live production play)

1. **Runtime mismatch between deployed function and room engine capabilities**
   - The browser UI sends gameplay commands such as `request_legal_moves`, `start_move_preview`, `confirm_move`, and `cancel_move_preview`.
   - The standalone deployed function entrypoint (`supabase/functions/dog-room/index.ts`) currently rejects all of these as unsupported.
   - Result: a lobby can start, but a full playable match cannot run through this entrypoint unless the function is rewired to use `services/realtime-server/room-engine.js` / `supabase-room-service.js`.

2. **Realtime transport not wired in client yet (polling fallback only)**
   - Lobby/game UI currently refreshes by polling every 3 seconds.
   - There is no Supabase Realtime channel subscription path in the current `dog/lobby` client.
   - Result: delayed updates and weaker desync resilience compared to intended live behavior.

3. **Identity/auth hardening not implemented at command ingress**
   - Client-side identity is plain `playerId` text input with no auth token flow in the Dog pages.
   - The edge deployment note uses `--no-verify-jwt`, and command validation currently only checks payload shape.
   - Result: room actions are easy to spoof without additional auth and identity verification.

4. **Rate limiting + anti-abuse controls not present in Dog command path**
   - No request throttling or abuse protection is implemented in `supabase/functions/dog-room/index.ts` or `services/realtime-server/supabase-edge-handler.js`.
   - Result: production room endpoints are exposed to spam/flood risks.

5. **Environment portability and release safety gaps**
   - Dog web pages use a hardcoded Supabase function URL.
   - This blocks clean staging/production switching and increases risk of shipping with wrong endpoint.

6. **Missing real multi-user smoke evidence in repo**
   - Automated tests are green, but there is no checked-in evidence of a full 4-player remote smoke run (including reconnect during active turn) against deployed infrastructure.

## Go-live gate recommendation

Treat Dog as "ready for live pilot" only when all are complete:

- Deployed Dog function supports full gameplay command set (not lobby-only subset).
- Client receives room updates via Realtime subscriptions (polling can remain as fallback only).
- Auth identity is enforced at command ingress (JWT/session mapping to `playerId`).
- Basic rate limiting and abuse controls are active.
- Endpoint/config management is environment-driven (no hardcoded production URL in static pages).
- One full 4-player staging run (create/join/start/play-to-winner) plus at least one reconnect scenario is validated without desync.
