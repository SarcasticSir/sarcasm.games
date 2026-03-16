# Live test guide (4 players)

This guide prepares an immediate live-room test using the current authoritative room engine over WebSocket.

## 1) Start live server

From `dog_game/`:

```bash
npm install
npm run start:live
```

Defaults:

- HTTP health endpoint: `http://localhost:8787`
- WebSocket endpoint: `ws://localhost:8787/ws`

Optional custom port:

```bash
PORT=8790 npm run start:live
```

## 2) Expose server to friends

Use your preferred tunnel/reverse proxy and share the public WebSocket URL.

Example with cloudflared (if installed):

```bash
cloudflared tunnel --url http://localhost:8787
```

Then friends connect to:

- `wss://<public-host>/ws`

## 3) Message protocol

Send JSON messages over WebSocket.

### Host creates room (solo 4-player)

```json
{
  "type": "create_room",
  "roomId": "DOG123",
  "playerId": "P1",
  "gameMode": "solo",
  "teamCount": 4,
  "playersPerTeam": 1
}
```

### Friends join room

```json
{
  "type": "join_room",
  "roomId": "DOG123",
  "playerId": "P2",
  "teamNo": 2,
  "slotInTeam": 1
}
```

(Repeat for `P3` with `teamNo:3`, and `P4` with `teamNo:4`.)

### Everyone sets ready

```json
{
  "type": "set_ready",
  "roomId": "DOG123",
  "playerId": "P1",
  "isReady": true
}
```

### Host starts match

```json
{
  "type": "start_match",
  "roomId": "DOG123",
  "playerId": "P1"
}
```

### Request legal moves for a card

```json
{
  "type": "request_legal_moves",
  "roomId": "DOG123",
  "playerId": "P1",
  "card": "ACE"
}
```

### Preview and confirm move

```json
{
  "type": "start_move_preview",
  "roomId": "DOG123",
  "playerId": "P1",
  "card": "ACE",
  "move": { "pieceId": "P1-1", "card": "ACE", "action": "EXIT_START", "from": null, "to": 0 }
}
```

```json
{
  "type": "confirm_move",
  "roomId": "DOG123",
  "playerId": "P1"
}
```

## 4) Reconnect flow

A reconnecting client can re-attach and get fresh room/private snapshot:

```json
{
  "type": "attach",
  "roomId": "DOG123",
  "playerId": "P2"
}
```

## 5) What to verify in first live test

- All 4 clients receive `room_snapshot` updates.
- Turn ownership is enforced (wrong player gets `command_error`).
- Moves require preview -> confirm.
- Hand info stays private (public snapshot exposes only counts).
- Reconnect with `attach` restores consistent private/public state.
