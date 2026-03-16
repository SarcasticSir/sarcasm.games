import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, evaluateCurrentTurnPlayability, handleRoomCommand } from '../services/realtime-server/room-engine.js';

function bootstrapFourPlayerLobby() {
  let state = createRoom({
    roomId: 'ROOM1',
    hostPlayerId: 'P1',
    gameMode: 'solo',
    teamCount: 4,
    playersPerTeam: 1
  });

  state = handleRoomCommand(state, {
    type: 'join_room',
    playerId: 'P2',
    teamNo: 2,
    slotInTeam: 1,
    expectedVersion: state.version
  }).state;

  state = handleRoomCommand(state, {
    type: 'join_room',
    playerId: 'P3',
    teamNo: 3,
    slotInTeam: 1,
    expectedVersion: state.version
  }).state;

  state = handleRoomCommand(state, {
    type: 'join_room',
    playerId: 'P4',
    teamNo: 4,
    slotInTeam: 1,
    expectedVersion: state.version
  }).state;

  for (const playerId of ['P1', 'P2', 'P3', 'P4']) {
    state = handleRoomCommand(state, {
      type: 'set_ready',
      playerId,
      isReady: true,
      expectedVersion: state.version
    }).state;
  }

  return state;
}

test('join_room enforces deterministic seat formula and version checks', () => {
  let state = createRoom({
    roomId: 'ROOM2',
    hostPlayerId: 'P1',
    gameMode: 'teams',
    teamCount: 2,
    playersPerTeam: 2
  });

  const join = handleRoomCommand(state, {
    type: 'join_room',
    playerId: 'P2',
    teamNo: 2,
    slotInTeam: 1,
    expectedVersion: state.version
  });

  state = join.state;
  assert.equal(join.response.seatNo, 2);

  assert.throws(
    () =>
      handleRoomCommand(state, {
        type: 'join_room',
        playerId: 'P3',
        teamNo: 1,
        slotInTeam: 2,
        expectedVersion: state.version - 1
      }),
    /Version mismatch/
  );
});

test('start_match requires full ready lobby and produces deterministic first turn', () => {
  let state = bootstrapFourPlayerLobby();

  const start = handleRoomCommand(state, {
    type: 'start_match',
    playerId: 'P1',
    expectedVersion: state.version
  });

  state = start.state;

  assert.equal(start.response.started, true);
  assert.equal(state.status, 'active');
  assert.deepEqual(state.match.turnOrder, ['P1', 'P2', 'P3', 'P4']);
  assert.equal(state.match.handsByPlayerId.P1.length, 6);
});

test('request_legal_moves + preview/cancel/confirm follows authoritative turn flow', () => {
  let state = bootstrapFourPlayerLobby();
  state = handleRoomCommand(state, {
    type: 'start_match',
    playerId: 'P1',
    expectedVersion: state.version
  }).state;

  const activePlayerId = state.match.turnOrder[state.match.turnIndex];
  const handRanks = state.match.handsByPlayerId[activePlayerId].map((card) => card.rank);

  let card = null;
  let legal = null;
  for (const candidateCard of handRanks) {
    const attempt = handleRoomCommand(state, {
      type: 'request_legal_moves',
      playerId: activePlayerId,
      card: candidateCard,
      expectedVersion: state.version
    });

    if (attempt.response.moves.length > 0) {
      card = candidateCard;
      legal = attempt;
      break;
    }
  }

  assert.ok(legal, 'Expected at least one legal move in active player hand');

  const move = legal.response.moves[0];
  assert.ok(move, 'Expected at least one legal move to preview');

  const preview = handleRoomCommand(state, {
    type: 'start_move_preview',
    playerId: activePlayerId,
    card,
    move,
    expectedVersion: state.version
  });

  state = preview.state;
  assert.equal(state.match.pendingPreview.playerId, activePlayerId);

  const cancel = handleRoomCommand(state, {
    type: 'cancel_move_preview',
    playerId: activePlayerId,
    expectedVersion: state.version
  });

  state = cancel.state;
  assert.equal(state.match.pendingPreview, null);

  state = handleRoomCommand(state, {
    type: 'start_move_preview',
    playerId: activePlayerId,
    card,
    move,
    expectedVersion: state.version
  }).state;

  const beforeConfirmCards = state.match.handsByPlayerId[activePlayerId].length;

  const confirm = handleRoomCommand(state, {
    type: 'confirm_move',
    playerId: activePlayerId,
    expectedVersion: state.version
  });

  state = confirm.state;

  assert.equal(state.match.handsByPlayerId[activePlayerId].length, beforeConfirmCards - 1);
  assert.equal(state.match.turnOrder[state.match.turnIndex], 'P2');
});

test('idempotency key returns stable response for duplicate command submissions', () => {
  let state = createRoom({
    roomId: 'ROOM3',
    hostPlayerId: 'P1',
    gameMode: 'solo',
    teamCount: 4,
    playersPerTeam: 1
  });

  const first = handleRoomCommand(state, {
    type: 'join_room',
    playerId: 'P2',
    teamNo: 2,
    slotInTeam: 1,
    idempotencyKey: 'join-P2',
    expectedVersion: state.version
  });

  state = first.state;

  const second = handleRoomCommand(state, {
    type: 'join_room',
    playerId: 'P2',
    teamNo: 2,
    slotInTeam: 1,
    idempotencyKey: 'join-P2',
    expectedVersion: state.version
  });

  assert.deepEqual(second.response, first.response);
  assert.equal(second.state.version, state.version);
  assert.equal(second.state.players.length, state.players.length);
});

test('evaluateCurrentTurnPlayability reflects must-play / no-legal-move output shape', () => {
  let state = bootstrapFourPlayerLobby();
  state = handleRoomCommand(state, {
    type: 'start_match',
    playerId: 'P1',
    expectedVersion: state.version
  }).state;

  const summary = evaluateCurrentTurnPlayability(state);
  assert.equal(typeof summary.hasAnyLegalMove, 'boolean');
  assert.equal(typeof summary.perCardMoves, 'object');
});
