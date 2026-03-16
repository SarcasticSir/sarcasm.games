import { createPieceInStart } from '../../packages/shared-types/index.js';
import {
  applyMovePreview,
  buildStartIndexes,
  evaluateHandPlayability,
  generateLegalMoves,
  TRACK_SPACES_BETWEEN_PLAYERS
} from '../../packages/game-rules/index.js';
import { detectWinner } from '../../packages/game-rules/phase2.js';
import {
  applyTeamCardExchange,
  createDeckState,
  dealRoundHands,
  discardCards
} from '../../packages/game-rules/deck.js';

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

function sortPlayersBySeat(players) {
  return [...players].sort((a, b) => a.seatNo - b.seatNo);
}

function assertMatchPhase(state, phase) {
  if (state.status !== 'active') {
    throw new Error('Match is not active');
  }

  if (state.match.phase !== phase) {
    throw new Error(`Match phase is ${state.match.phase}, expected ${phase}`);
  }
}

function assertActiveTurn(state, playerId) {
  assertMatchPhase(state, 'play');

  const activePlayerId = state.match.turnOrder[state.match.turnIndex];
  if (activePlayerId !== playerId) {
    throw new Error(`Not your turn: active player is ${activePlayerId}`);
  }
}

function findCardIndexByRank(hand, rank) {
  return hand.findIndex((card) => card.rank === rank);
}

function findCardById(hand, cardId) {
  return hand.find((card) => card.id === cardId);
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
  const ordered = sortPlayersBySeat(players);
  const playerIds = ordered.map((player) => player.playerId);

  return {
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * playerIds.length,
    startIndexes: buildStartIndexes(playerIds.length),
    pieces: buildInitialPieces(playerIds)
  };
}

function getTeamByPlayerId(players) {
  const map = {};

  for (const player of players) {
    map[player.playerId] = player.teamNo;
  }

  return map;
}

function buildRoundState(room, deckState, roundNumber) {
  const ordered = sortPlayersBySeat(room.players);
  const turnOrder = ordered.map((player) => player.playerId);
  const dealt = dealRoundHands(deckState, turnOrder, roundNumber, 100 + roundNumber);

  return {
    turnOrder,
    turnIndex: 0,
    roundNumber,
    handsByPlayerId: dealt.hands,
    deckState: dealt.deckState,
    blockedPlayerIds: [],
    pendingPreview: null,
    pendingExchangeByPlayerId: {},
    phase: room.config.gameMode === 'teams' ? 'exchange' : 'play'
  };
}

function createMatch(room) {
  const ordered = sortPlayersBySeat(room.players);
  const playerIds = ordered.map((player) => player.playerId);

  const deckState = createDeckState(playerIds.length, 1);
  const roundState = buildRoundState(room, deckState, 1);

  return {
    ...roundState,
    gameState: buildGameStateFromPlayers(ordered),
    winner: null
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

function hasAnyLegalMoveForPlayer(match, playerId) {
  const hand = (match.handsByPlayerId[playerId] ?? []).map((card) => card.rank);
  return evaluateHandPlayability(match.gameState, playerId, hand).hasAnyLegalMove;
}

function allHandsEmpty(match) {
  return Object.values(match.handsByPlayerId).every((hand) => hand.length === 0);
}

function startNextRound(state) {
  const nextRoundNumber = state.match.roundNumber + 1;
  const nextRound = buildRoundState(state, state.match.deckState, nextRoundNumber);

  return {
    ...state,
    match: {
      ...state.match,
      ...nextRound
    }
  };
}

function advanceToNextPlayableTurn(match) {
  const blocked = new Set(match.blockedPlayerIds);
  let turnIndex = match.turnIndex;

  for (let i = 0; i < match.turnOrder.length; i += 1) {
    const playerId = match.turnOrder[turnIndex];

    if (blocked.has(playerId)) {
      turnIndex = (turnIndex + 1) % match.turnOrder.length;
      continue;
    }

    const canAct = hasAnyLegalMoveForPlayer({ ...match, turnIndex }, playerId);
    if (canAct) {
      return {
        turnIndex,
        blockedPlayerIds: [...blocked],
        allBlocked: false
      };
    }

    blocked.add(playerId);
    turnIndex = (turnIndex + 1) % match.turnOrder.length;
  }

  return {
    turnIndex,
    blockedPlayerIds: [...blocked],
    allBlocked: true
  };
}

function buildExchangeActions(room, pendingExchangeByPlayerId) {
  const playersByTeam = new Map();

  for (const player of sortPlayersBySeat(room.players)) {
    if (!playersByTeam.has(player.teamNo)) {
      playersByTeam.set(player.teamNo, []);
    }

    playersByTeam.get(player.teamNo).push(player);
  }

  const exchanges = [];
  for (const teamPlayers of playersByTeam.values()) {
    for (let i = 0; i < teamPlayers.length; i += 1) {
      const from = teamPlayers[i];
      const to = teamPlayers[(i + 1) % teamPlayers.length];
      exchanges.push({
        fromPlayerId: from.playerId,
        toPlayerId: to.playerId,
        cardId: pendingExchangeByPlayerId[from.playerId]
      });
    }
  }

  return exchanges;
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
      phase: match.phase,
      activePlayerId: match.turnOrder[match.turnIndex],
      version: nextState.version
    }
  };
}

function handleExchangeCard(state, command) {
  const { playerId, cardId } = command;
  assertMatchPhase(state, 'exchange');

  if (!state.match.turnOrder.includes(playerId)) {
    throw new Error('Player is not part of active match');
  }

  const hand = state.match.handsByPlayerId[playerId] ?? [];
  if (!findCardById(hand, cardId)) {
    throw new Error(`Card ${cardId} not in hand`);
  }

  const pendingExchangeByPlayerId = {
    ...state.match.pendingExchangeByPlayerId,
    [playerId]: cardId
  };

  const playerCount = state.match.turnOrder.length;
  const hasAllSelections = Object.keys(pendingExchangeByPlayerId).length === playerCount;

  if (!hasAllSelections) {
    const nextState = withVersionBump({
      ...state,
      match: {
        ...state.match,
        pendingExchangeByPlayerId
      }
    });

    return {
      state: nextState,
      response: {
        ok: true,
        exchangeCompleted: false,
        waitingFor: playerCount - Object.keys(pendingExchangeByPlayerId).length,
        version: nextState.version
      }
    };
  }

  const teamByPlayerId = getTeamByPlayerId(state.players);
  const exchanges = buildExchangeActions(state, pendingExchangeByPlayerId);
  const exchangedHands = applyTeamCardExchange(state.match.handsByPlayerId, teamByPlayerId, exchanges);

  const nextState = withVersionBump({
    ...state,
    match: {
      ...state.match,
      handsByPlayerId: exchangedHands,
      pendingExchangeByPlayerId: {},
      phase: 'play'
    }
  });

  return {
    state: nextState,
    response: {
      ok: true,
      exchangeCompleted: true,
      phase: 'play',
      activePlayerId: nextState.match.turnOrder[nextState.match.turnIndex],
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

  const deckState = discardCards(state.match.deckState, [usedCard]);
  const movedGameState = pending.previewState;
  const teamByPlayerId = getTeamByPlayerId(state.players);
  const winner = detectWinner({
    gameMode: state.config.gameMode,
    pieces: movedGameState.pieces,
    playerIds: state.match.turnOrder,
    teamByPlayerId
  });

  if (winner) {
    const nextState = withVersionBump({
      ...state,
      status: 'finished',
      match: {
        ...state.match,
        gameState: movedGameState,
        pendingPreview: null,
        handsByPlayerId,
        deckState,
        phase: 'finished',
        winner
      }
    });

    return {
      state: nextState,
      response: {
        ok: true,
        confirmed: true,
        gameFinished: true,
        winner,
        version: nextState.version
      }
    };
  }

  let nextState = withVersionBump({
    ...state,
    match: {
      ...state.match,
      gameState: movedGameState,
      pendingPreview: null,
      handsByPlayerId,
      deckState,
      turnIndex: (state.match.turnIndex + 1) % state.match.turnOrder.length
    }
  });

  if (allHandsEmpty(nextState.match)) {
    nextState = withVersionBump(startNextRound(nextState));
    return {
      state: nextState,
      response: {
        ok: true,
        confirmed: true,
        roundAdvanced: true,
        phase: nextState.match.phase,
        version: nextState.version
      }
    };
  }

  const turnResolution = advanceToNextPlayableTurn(nextState.match);
  if (turnResolution.allBlocked) {
    nextState = withVersionBump(startNextRound(nextState));
    return {
      state: nextState,
      response: {
        ok: true,
        confirmed: true,
        roundAdvanced: true,
        phase: nextState.match.phase,
        version: nextState.version
      }
    };
  }

  nextState = withVersionBump({
    ...nextState,
    match: {
      ...nextState.match,
      turnIndex: turnResolution.turnIndex,
      blockedPlayerIds: turnResolution.blockedPlayerIds
    }
  });

  return {
    state: nextState,
    response: {
      ok: true,
      confirmed: true,
      nextPlayerId: nextState.match.turnOrder[nextState.match.turnIndex],
      blockedPlayerIds: nextState.match.blockedPlayerIds,
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
      case 'exchange_card':
        return handleExchangeCard(state, command);
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
  assertMatchPhase(state, 'play');

  const playerId = state.match.turnOrder[state.match.turnIndex];
  const hand = state.match.handsByPlayerId[playerId].map((card) => card.rank);
  return evaluateHandPlayability(state.match.gameState, playerId, hand);
}

export function getPublicRoomView(state) {
  return {
    roomId: state.roomId,
    status: state.status,
    version: state.version,
    config: clone(state.config),
    players: sortPlayersBySeat(state.players).map((player) => ({
      playerId: player.playerId,
      teamNo: player.teamNo,
      slotInTeam: player.slotInTeam,
      seatNo: player.seatNo,
      ready: player.ready,
      connected: player.connected
    })),
    match: state.match
      ? {
          phase: state.match.phase,
          roundNumber: state.match.roundNumber,
          turnPlayerId: state.match.turnOrder[state.match.turnIndex],
          blockedPlayerIds: [...state.match.blockedPlayerIds],
          handCountsByPlayerId: Object.fromEntries(
            Object.entries(state.match.handsByPlayerId).map(([playerId, hand]) => [playerId, hand.length])
          ),
          winner: state.match.winner ?? null
        }
      : null
  };
}

export function getPlayerPrivateView(state, playerId) {
  const publicView = getPublicRoomView(state);
  const myHand = state.match?.handsByPlayerId[playerId] ?? [];

  return {
    ...publicView,
    private: {
      playerId,
      hand: clone(myHand),
      pendingPreview: state.match?.pendingPreview?.playerId === playerId ? clone(state.match.pendingPreview) : null,
      pendingExchangeSubmitted: Boolean(state.match?.pendingExchangeByPlayerId?.[playerId])
    }
  };
}
