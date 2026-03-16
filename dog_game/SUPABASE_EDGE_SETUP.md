# Dog live setup with Supabase Edge Functions (step-by-step)

This is a practical checklist for getting `/dog` live testing working over network.

## 0) Values confirmed

- Supabase URL: `https://hmwzdnebhqavatuxmtki.supabase.co`
- Function name: `dog-room`
- Frontend origins:
  - `https://sarcasm.games`
  - `https://www.sarcasm.games`
- Tables in use:
  - `rooms`
  - `room_members`
  - `matches`
  - `match_players`
  - `game_events`

## 1) What must exist in Supabase dashboard

1. Auth is enabled (already done).
2. Tables exist (already confirmed).
3. Realtime is enabled for event fan-out strategy you choose.
4. Service role key stays server-side only (never in browser code).

## 2) Create the edge function in Supabase project

Run from your local machine (where Supabase CLI is installed):

```bash
supabase login
supabase link --project-ref hmwzdnebhqavatuxmtki
supabase functions new dog-room
```

Then put your handler implementation into:

- `supabase/functions/dog-room/index.ts`

(Use repo modules as source-of-truth for command handling:
`dog_game/services/realtime-server/supabase-edge-handler.js` and
`dog_game/services/realtime-server/supabase-room-service.js`.)

## 3) Set function secrets

Set secrets for the linked Supabase project:

```bash
supabase secrets set \
  SUPABASE_URL=https://hmwzdnebhqavatuxmtki.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY="<paste_service_role_key_here>" \
  ALLOWED_ORIGINS="https://sarcasm.games,https://www.sarcasm.games"
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is backend-only.
- Do not place service role key in `/dog` frontend page.

## 4) Deploy function

Deploy with JWT verification disabled for this endpoint so browser preflight
(`OPTIONS`) is not rejected before your handler returns CORS headers:

```bash
supabase functions deploy dog-room --no-verify-jwt
```

Alternative (persistent config): add this to `supabase/config.toml` before deploy:

```toml
[functions.dog-room]
verify_jwt = false
```

Expected endpoint:

```text
https://hmwzdnebhqavatuxmtki.supabase.co/functions/v1/dog-room
```

## 5) Smoke test endpoint quickly


Preflight check (must return `HTTP/2 204` or another 2xx):

```bash
curl -i -X OPTIONS \
  "https://hmwzdnebhqavatuxmtki.supabase.co/functions/v1/dog-room" \
  -H "Origin: https://www.sarcasm.games" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,apikey,authorization"
```

Then verify POST also includes CORS headers:

```bash
curl -i -X POST \
  "https://hmwzdnebhqavatuxmtki.supabase.co/functions/v1/dog-room" \
  -H "Origin: https://www.sarcasm.games" \
  -H "Content-Type: application/json" \
  -d '{"type":"attach","roomId":"DOG001","playerId":"P1"}'
```

Create room:

```bash
curl -i -X POST \
  "https://hmwzdnebhqavatuxmtki.supabase.co/functions/v1/dog-room" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"create_room",
    "roomId":"DOG001",
    "playerId":"P1",
    "gameMode":"solo",
    "teamCount":4,
    "playersPerTeam":1,
    "idempotencyKey":"P1-create-DOG001"
  }'
```

Join with one player:

```bash
curl -i -X POST \
  "https://hmwzdnebhqavatuxmtki.supabase.co/functions/v1/dog-room" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"join_room",
    "roomId":"DOG001",
    "playerId":"P2",
    "teamNo":2,
    "slotInTeam":1,
    "idempotencyKey":"P2-join-DOG001"
  }'
```

## 6) Use `/dog` in browser

1. Open `https://sarcasm.games/dog/`
2. Confirm endpoint is set to:
   - `https://hmwzdnebhqavatuxmtki.supabase.co/functions/v1/dog-room`
3. Host clicks:
   - `Create room`
   - `Generate 3 invite links`
4. Friends open links and click:
   - `Join room`
   - `Set ready`
5. Host clicks:
   - `Start match`

## 7) If something fails

Check these first:

1. Endpoint preflight (`OPTIONS`) returns HTTP 2xx (if not, redeploy with `--no-verify-jwt`).
2. CORS origin list includes exact frontend origin.
3. Function is deployed to the same Supabase project ref.
4. Function has service role secret configured.
5. Endpoint URL in `/dog` is exactly `/functions/v1/dog-room`.
6. Command payload includes required `type` field.
