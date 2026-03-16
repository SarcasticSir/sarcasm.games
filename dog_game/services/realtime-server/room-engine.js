import { createPieceInStart } from '../../packages/shared-types/index.js';
import { applyMovePreview, buildStartIndexes, evaluateHandPlayability, generateLegalMoves, TRACK_SPACES_BETWEEN_PLAYERS } from '../../packages/game-rules/index.js';
import { createDeckState, dealRoundHands, discardCards } from '../../packages/game-rules/deck.js';

function clone(value) {
  return structuredClone(value);
}

function deriveMaxPlayers(config) {
  return config.teamCount * config.playersPerTeam;
}

function assertVersion(state, expectedVersion) {
  if (expectedVersion === undefined) {
    return;
  }

  if (state.version !== expectedVersion) {
    throw new Error(`Version mismatch: expected ${expectedVersion}, actual ${state.version}`);
  }
}

function withVersionBump(state) {
  return {
    ...state,
    version: state.version + 1
  };
}

function ensureUniqueSeat(players, seatNo) {
  if (players.some((player) => player.seatNo === seatNo)) {
    throw new Error(`Seat ${seatNo} is already occupied`);
  }
}

function seatFromTeamSlot(teamNo, slotInTeam, teamCount) {
  return (slotInTeam - 1) * teamCount + teamNo;
}

function assertActiveTurn(state, playerId) {
  if (state.status !== 'active') {
    throw new Error('Match is not active');
  }

  const activePlayerId = state.match.turnOrder[state.match.turnIndex];
  if (activePlayerId !== playerId) {
    throw new Error(`Not your turn: active player is ${activePlayerId}`);
  }
}

function findCardIndexByRank(hand, rank) {
  return hand.findIndex((card) => card.rank === rank);
}

function buildInitialPieces(playerIds) {
  const pieces = [];

  for (const playerId of playerIds) {
    for (let i = 1; i <= 4; i += 1) {
      pieces.push(createPieceInStart(`${playerId}-${i}`, playerId));
    }
  }

  return pieces;
}

function buildGameStateFromPlayers(players) {
  const ordered = [...players].sort((a, b) => a.seatNo - b.seatNo);
  const playerIds = ordered.map((player) => player.playerId);

  return {
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * playerIds.length,
    startIndexes: buildStartIndexes(playerIds.length),
    pieces: buildInitialPieces(playerIds)
  };
}

function createMatch(room) {
  const ordered = [...room.players].sort((a, b) => a.seatNo - b.seatNo);
  const playerIds = ordered.map((player) => player.playerId);

  const deckState = createDeckState(playerIds.length, 1);
  const dealt = dealRoundHands(deckState, playerIds, 1, 101);

  return {
    turnOrder: playerIds,
    turnIndex: 0,
    roundNumber: 1,
    handsByPlayerId: dealt.hands,
    deckState: dealt.deckState,
    discardPile: [],
    gameState: buildGameStateFromPlayers(ordered),
    pendingPreview: null
  };
}

function withIdempotency(state, idempotencyKey, executor) {
  if (!idempotencyKey) {
    return executor();
  }

  if (state.idempotency[idempotencyKey]) {
    return {
      state,
      response: clone(state.idempotency[idempotencyKey])
    };
  }

  const result = executor();
  const nextState = {
    ...result.state,
    idempotency: {
      ...result.state.idempotency,
      [idempotencyKey]: clone(result.response)
    }
  };

  return {
    state: nextState,
    response: result.response
  };
}

export function createRoom(command) {
  const {
    roomId,
    hostPlayerId,
    gameMode = 'solo',
    teamCount = 4,
    playersPerTeam = 1,
    idempotencyKey
  } = command;

  const config = { gameMode, teamCount, playersPerTeam };
  const maxPlayers = deriveMaxPlayers(config);

  if (maxPlayers < 4 || maxPlayers > 8) {
    throw new Error('Room size must be between 4 and 8 players');
  }

  const host = {
    playerId: hostPlayerId,
    teamNo: 1,
    slotInTeam: 1,
    seatNo: seatFromTeamSlot(1, 1, teamCount),
    ready: false,
    connected: true
  };

  const state = {
    roomId,
    config,
    maxPlayers,
    status: 'lobby',
    version: 1,
    players: [host],
    match: null,
    idempotency: {},
    hostPlayerId
  };

  if (idempotencyKey) {
    state.idempotency[idempotencyKey] = { ok: true, roomId, version: state.version };
  }

  return state;
}

function handleJoinRoom(state, command) {
  const { playerId, teamNo, slotInTeam } = command;

  if (state.status !== 'lobby') {
    throw new Error('Cannot join after match start');
  }

  if (state.players.some((player) => player.playerId === playerId)) {
    return {
      state,
      response: { ok: true, joined: false, reason: 'already_joined', version: state.version }
    };
  }

  if (state.players.length >= state.maxPlayers) {
    throw new Error('Room is full');
  }

  if (teamNo < 1 || teamNo > state.config.teamCount) {
    throw new Error('teamNo out of bounds');
  }

  if (slotInTeam < 1 || slotInTeam > state.config.playersPerTeam) {
    throw new Error('slotInTeam out of bounds');
  }

  if (state.players.some((player) => player.teamNo === teamNo && player.slotInTeam === slotInTeam)) {
    throw new Error('Team slot already occupied');
  }

  const seatNo = seatFromTeamSlot(teamNo, slotInTeam, state.config.teamCount);
  ensureUniqueSeat(state.players, seatNo);

  const nextState = withVersionBump({
    ...state,
    players: [
      ...state.players,
      {
        playerId,
        teamNo,
        slotInTeam,
        seatNo,
        ready: false,
        connected: true
      }
    ]
  });

  return {
    state: nextState,
    response: { ok: true, joined: true, seatNo, version: nextState.version }
  };
}

function handleSetReady(state, command) {
  const { playerId, isReady } = command;

  if (state.status !== 'lobby') {
    throw new Error('Cannot set ready after match start');
  }

  const playerIndex = state.players.findIndex((player) => player.playerId === playerId);
  if (playerIndex < 0) {
    throw new Error('Player not in room');
  }

  const players = [...state.players];
  players[playerIndex] = {
    ...players[playerIndex],
    ready: Boolean(isReady)
  };

  const nextState = withVersionBump({ ...state, players });
  return {
    state: nextState,
    response: { ok: true, version: nextState.version }
  };
}

function handleStartMatch(state, command) {
  const { playerId } = command;

  if (state.status !== 'lobby') {
    throw new Error('Match already started');
  }

  if (state.hostPlayerId !== playerId) {
    throw new Error('Only host can start match');
  }

  if (state.players.length !== state.maxPlayers) {
    throw new Error('Room is not full');
  }

  if (state.players.some((player) => player.ready !== true)) {
    throw new Error('All players must be ready');
  }

  const match = createMatch(state);
  const nextState = withVersionBump({
    ...state,
    status: 'active',
    match
  });

  return {
    state: nextState,
    response: {
      ok: true,
      started: true,
      activePlayerId: match.turnOrder[0],
      version: nextState.version
    }
  };
}

function handleRequestLegalMoves(state, command) {
  const { playerId, card } = command;
  assertActiveTurn(state, playerId);

  const hand = state.match.handsByPlayerId[playerId] ?? [];
  if (findCardIndexByRank(hand, card) < 0) {
    throw new Error(`Card ${card} not in hand`);
  }

  const moves = generateLegalMoves(state.match.gameState, playerId, card);
  return {
    state,
    response: { ok: true, moves, card, version: state.version }
  };
}

function normalizeMove(move) {
  return JSON.stringify(move);
}

function handleStartMovePreview(state, command) {
  const { playerId, card, move } = command;
  assertActiveTurn(state, playerId);

  const hand = state.match.handsByPlayerId[playerId] ?? [];
  if (findCardIndexByRank(hand, card) < 0) {
    throw new Error(`Card ${card} not in hand`);
  }

  const legalMoves = generateLegalMoves(state.match.gameState, playerId, card);
  const desired = normalizeMove(move);
  const legal = legalMoves.find((candidate) => normalizeMove(candidate) === desired);
  if (!legal) {
    throw new Error('Illegal move preview request');
  }

  const previewState = applyMovePreview(state.match.gameState, legal);
  const nextState = withVersionBump({
    ...state,
    match: {
      ...state.match,
      pendingPreview: {
        playerId,
        card,
        move: legal,
        previewState
      }
    }
  });

  return {
    state: nextState,
    response: {
      ok: true,
      preview: nextState.match.pendingPreview,
      version: nextState.version
    }
  };
}

function handleCancelMovePreview(state, command) {
  const { playerId } = command;
  assertActiveTurn(state, playerId);

  if (!state.match.pendingPreview || state.match.pendingPreview.playerId !== playerId) {
    throw new Error('No pending preview for player');
  }

  const nextState = withVersionBump({
    ...state,
    match: {
      ...state.match,
      pendingPreview: null
    }
  });

  return {
    state: nextState,
    response: { ok: true, cancelled: true, version: nextState.version }
  };
}

function handleConfirmMove(state, command) {
  const { playerId } = command;
  assertActiveTurn(state, playerId);

  const pending = state.match.pendingPreview;
  if (!pending || pending.playerId !== playerId) {
    throw new Error('No pending preview to confirm');
  }

  const hand = [...(state.match.handsByPlayerId[playerId] ?? [])];
  const cardIndex = findCardIndexByRank(hand, pending.card);
  if (cardIndex < 0) {
    throw new Error(`Card ${pending.card} missing at confirm time`);
  }

  const [usedCard] = hand.splice(cardIndex, 1);
  const handsByPlayerId = {
    ...state.match.handsByPlayerId,
    [playerId]: hand
  };

  const discarded = discardCards(state.match.deckState, [usedCard]);
  const turnIndex = (state.match.turnIndex + 1) % state.match.turnOrder.length;

  const nextState = withVersionBump({
    ...state,
    match: {
      ...state.match,
      gameState: pending.previewState,
      pendingPreview: null,
      handsByPlayerId,
      deckState: discarded,
      turnIndex
    }
  });

  return {
    state: nextState,
    response: {
      ok: true,
      confirmed: true,
      nextPlayerId: nextState.match.turnOrder[nextState.match.turnIndex],
      version: nextState.version
    }
  };
}

export function handleRoomCommand(state, command) {
  assertVersion(state, command.expectedVersion);

  return withIdempotency(state, command.idempotencyKey, () => {
    switch (command.type) {
      case 'join_room':
        return handleJoinRoom(state, command);
      case 'set_ready':
        return handleSetReady(state, command);
      case 'start_match':
        return handleStartMatch(state, command);
      case 'request_legal_moves':
        return handleRequestLegalMoves(state, command);
      case 'start_move_preview':
        return handleStartMovePreview(state, command);
      case 'cancel_move_preview':
        return handleCancelMovePreview(state, command);
      case 'confirm_move':
        return handleConfirmMove(state, command);
      default:
        throw new Error(`Unknown command: ${command.type}`);
    }
  });
}

export function evaluateCurrentTurnPlayability(state) {
  if (state.status !== 'active') {
    throw new Error('Match is not active');
  }

  const playerId = state.match.turnOrder[state.match.turnIndex];
  const hand = state.match.handsByPlayerId[playerId].map((card) => card.rank);
  return evaluateHandPlayability(state.match.gameState, playerId, hand);
}
