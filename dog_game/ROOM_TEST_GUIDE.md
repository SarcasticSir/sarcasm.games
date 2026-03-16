# Room test guide (local smoke)

This guide gives you a practical way to run an end-to-end local room-flow test with the current authoritative room engine.

## Quick start

From `dog_game/`:

```bash
npm test
npm run smoke:room
```

The smoke command runs a deterministic simulation that:

1. creates a room,
2. joins all players,
3. marks all players ready,
4. starts the match,
5. completes exchange phase when in team mode,
6. repeatedly picks legal moves and confirms them.

It then prints a summary of phase/round/current turn and a turn log.

## Supported smoke options

```bash
npm run smoke:room -- --max-turns 40
npm run smoke:room -- --teams --team-count 2 --players-per-team 2 --max-turns 30
```

### Flags

- `--teams` enables team mode.
- `--team-count <n>` number of teams.
- `--players-per-team <n>` number of players per team.
- `--max-turns <n>` max turn iterations before summary.

Total players must remain between 4 and 8.

## Suggested manual verification checklist

- Room reaches `active` status.
- Team mode enters exchange phase before play.
- Turns advance only after `confirm_move`.
- Round advances when everyone is blocked or hands are depleted.
- Public summary does not expose opponents' private hands (only counts).

## Current scope

This is a local deterministic harness for server-room logic.
It is not yet a networked multiplayer UI test.
