import {
  createRoom,
  getPublicRoomView,
  handleRoomCommand
} from '../services/realtime-server/room-engine.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    gameMode: 'solo',
    teamCount: 4,
    playersPerTeam: 1,
    maxTurns: 24
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--teams') {
      parsed.gameMode = 'teams';
      continue;
    }

    if (arg === '--team-count') {
      parsed.teamCount = Number(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--players-per-team') {
      parsed.playersPerTeam = Number(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--max-turns') {
      parsed.maxTurns = Number(args[i + 1]);
      i += 1;
    }
  }

  return parsed;
}

function buildPlayerIds(totalPlayers) {
  return Array.from({ length: totalPlayers }, (_, index) => `P${index + 1}`);
}

function apply(state, command) {
  const result = handleRoomCommand(state, {
    ...command,
    expectedVersion: state.version
  });

  return result.state;
}

function firstLegalMoveForCurrentPlayer(state) {
  const playerId = state.match.turnOrder[state.match.turnIndex];
  const hand = state.match.handsByPlayerId[playerId] ?? [];

  for (const card of hand) {
    const result = handleRoomCommand(state, {
      type: 'request_legal_moves',
      playerId,
      card: card.rank,
      expectedVersion: state.version
    });

    if (result.response.moves.length > 0) {
      return {
        playerId,
        card: card.rank,
        move: result.response.moves[0]
      };
    }
  }

  return null;
}

function runExchangePhase(state) {
  if (state.match.phase !== 'exchange') {
    return state;
  }

  for (const playerId of state.match.turnOrder) {
    const card = state.match.handsByPlayerId[playerId]?.[0];
    state = apply(state, {
      type: 'exchange_card',
      playerId,
      cardId: card.id
    });
  }

  return state;
}

function runSmoke() {
  const options = parseArgs();
  const maxPlayers = options.teamCount * options.playersPerTeam;
  if (maxPlayers < 4 || maxPlayers > 8) {
    throw new Error('maxPlayers must be between 4 and 8');
  }

  let state = createRoom({
    roomId: 'SMOKE-ROOM',
    hostPlayerId: 'P1',
    gameMode: options.gameMode,
    teamCount: options.teamCount,
    playersPerTeam: options.playersPerTeam
  });

  const playerIds = buildPlayerIds(maxPlayers);

  for (const playerId of playerIds.slice(1)) {
    const seatNo = Number(playerId.slice(1));
    const teamNo = ((seatNo - 1) % options.teamCount) + 1;
    const slotInTeam = Math.floor((seatNo - 1) / options.teamCount) + 1;

    state = apply(state, {
      type: 'join_room',
      playerId,
      teamNo,
      slotInTeam
    });
  }

  for (const playerId of playerIds) {
    state = apply(state, {
      type: 'set_ready',
      playerId,
      isReady: true
    });
  }

  state = apply(state, {
    type: 'start_match',
    playerId: 'P1'
  });

  state = runExchangePhase(state);

  const turnLog = [];

  for (let turn = 1; turn <= options.maxTurns; turn += 1) {
    if (state.match.phase === 'exchange') {
      state = runExchangePhase(state);
    }

    const candidate = firstLegalMoveForCurrentPlayer(state);
    if (!candidate) {
      turnLog.push(`Turn ${turn}: no legal move for ${state.match.turnOrder[state.match.turnIndex]}`);
      break;
    }

    state = apply(state, {
      type: 'start_move_preview',
      playerId: candidate.playerId,
      card: candidate.card,
      move: candidate.move
    });

    const roundBefore = state.match.roundNumber;
    state = apply(state, {
      type: 'confirm_move',
      playerId: candidate.playerId
    });

    const roundAfter = state.match.roundNumber;
    const roundNote = roundAfter > roundBefore ? ` -> advanced to round ${roundAfter}` : '';
    turnLog.push(`Turn ${turn}: ${candidate.playerId} played ${candidate.card}${roundNote}`);
  }

  const view = getPublicRoomView(state);

  console.log('=== Room smoke test summary ===');
  console.log(`Mode: ${options.gameMode} (${options.teamCount} teams x ${options.playersPerTeam})`);
  console.log(`Room status: ${view.status}`);
  console.log(`Phase: ${view.match?.phase}`);
  console.log(`Round: ${view.match?.roundNumber}`);
  console.log(`Turn player: ${view.match?.turnPlayerId}`);
  console.log('Hand counts:', view.match?.handCountsByPlayerId);
  console.log('--- Turn log ---');
  for (const line of turnLog) {
    console.log(line);
  }
}

runSmoke();
