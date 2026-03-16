import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRoom,
  evaluateCurrentTurnPlayability,
  getPlayerPrivateView,
  getPublicRoomView,
  handleRoomCommand
} from '../services/realtime-server/room-engine.js';

function bootstrapFourPlayerLobby({ gameMode = 'solo', teamCount = 4, playersPerTeam = 1 } = {}) {
  let state = createRoom({
    roomId: 'ROOM1',
    hostPlayerId: 'P1',
    gameMode,
    teamCount,
    playersPerTeam
  });

  const joinPlan = [
    { playerId: 'P2', teamNo: 2, slotInTeam: 1 },
    { playerId: 'P3', teamNo: 3, slotInTeam: 1 },
    { playerId: 'P4', teamNo: 4, slotInTeam: 1 }
  ];

  for (const join of joinPlan) {
    state = handleRoomCommand(state, {
      type: 'join_room',
      ...join,
      expectedVersion: state.version
    }).state;
  }

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

function bootstrapFourPlayerTeamsLobby() {
  let state = createRoom({
    roomId: 'ROOM_TEAM',
    hostPlayerId: 'P1',
    gameMode: 'teams',
    teamCount: 2,
    playersPerTeam: 2
  });

  const joinPlan = [
    { playerId: 'P2', teamNo: 2, slotInTeam: 1 },
    { playerId: 'P3', teamNo: 1, slotInTeam: 2 },
    { playerId: 'P4', teamNo: 2, slotInTeam: 2 }
  ];

  for (const join of joinPlan) {
    state = handleRoomCommand(state, {
      type: 'join_room',
      ...join,
      expectedVersion: state.version
    }).state;
  }

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
  assert.equal(state.match.phase, 'play');
  assert.deepEqual(state.match.turnOrder, ['P1', 'P2', 'P3', 'P4']);
  assert.equal(state.match.handsByPlayerId.P1.length, 6);
});

test('teams match starts in exchange phase and completes once everyone submits a card', () => {
  let state = bootstrapFourPlayerTeamsLobby();
  state = handleRoomCommand(state, {
    type: 'start_match',
    playerId: 'P1',
    expectedVersion: state.version
  }).state;

  assert.equal(state.match.phase, 'exchange');

  for (const playerId of ['P1', 'P2', 'P3']) {
    const hand = state.match.handsByPlayerId[playerId];
    const response = handleRoomCommand(state, {
      type: 'exchange_card',
      playerId,
      cardId: hand[0].id,
      expectedVersion: state.version
    });

    state = response.state;
    assert.equal(response.response.exchangeCompleted, false);
  }

  const p4CardId = state.match.handsByPlayerId.P4[0].id;
  const completed = handleRoomCommand(state, {
    type: 'exchange_card',
    playerId: 'P4',
    cardId: p4CardId,
    expectedVersion: state.version
  });

  state = completed.state;
  assert.equal(completed.response.exchangeCompleted, true);
  assert.equal(state.match.phase, 'play');
  assert.equal(state.match.handsByPlayerId.P1.length, 6);
  assert.equal(state.match.handsByPlayerId.P2.length, 6);
  assert.equal(state.match.handsByPlayerId.P3.length, 6);
  assert.equal(state.match.handsByPlayerId.P4.length, 6);
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
  assert.notEqual(state.match.turnOrder[state.match.turnIndex], activePlayerId);
  assert.equal(state.match.turnOrder.includes(state.match.turnOrder[state.match.turnIndex]), true);
});

test('confirm_move advances to next round when all players are blocked', () => {
  let state = bootstrapFourPlayerLobby();
  state = handleRoomCommand(state, {
    type: 'start_match',
    playerId: 'P1',
    expectedVersion: state.version
  }).state;

  // Force hands + board into a state where only P1 can act once, then everyone is blocked.
  state.match.handsByPlayerId = {
    P1: [
      { id: 'P1-ACE', rank: 'ACE', suit: 'SPADES' },
      { id: 'P1-BLK', rank: 'JACK', suit: 'HEARTS' }
    ],
    P2: [{ id: 'P2-BLK', rank: 'JACK', suit: 'HEARTS' }],
    P3: [{ id: 'P3-BLK', rank: 'JACK', suit: 'HEARTS' }],
    P4: [{ id: 'P4-BLK', rank: 'JACK', suit: 'HEARTS' }]
  };

  const legal = handleRoomCommand(state, {
    type: 'request_legal_moves',
    playerId: 'P1',
    card: 'ACE',
    expectedVersion: state.version
  });

  const move = legal.response.moves.find((candidate) => candidate.action === 'EXIT_START');
  assert.ok(move);

  state = handleRoomCommand(state, {
    type: 'start_move_preview',
    playerId: 'P1',
    card: 'ACE',
    move,
    expectedVersion: state.version
  }).state;

  const confirmed = handleRoomCommand(state, {
    type: 'confirm_move',
    playerId: 'P1',
    expectedVersion: state.version
  });

  state = confirmed.state;
  assert.equal(confirmed.response.roundAdvanced, true);
  assert.equal(state.match.roundNumber, 2);
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

test('public/private projections hide opponent hands and keep own hand visible', () => {
  let state = bootstrapFourPlayerLobby();
  state = handleRoomCommand(state, {
    type: 'start_match',
    playerId: 'P1',
    expectedVersion: state.version
  }).state;

  const publicView = getPublicRoomView(state);
  const privateView = getPlayerPrivateView(state, 'P1');

  assert.equal(publicView.match.handCountsByPlayerId.P1, 6);
  assert.equal(privateView.private.hand.length, 6);
  assert.equal('handsByPlayerId' in publicView.match, false);
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
