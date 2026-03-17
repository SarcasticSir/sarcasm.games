import { CARD_RANKS } from '../shared-types/index.js';

export const TRACK_SPACES_BETWEEN_PLAYERS = 16;

/**
 * @param {number} value
 * @param {number} trackLength
 */
function wrap(value, trackLength) {
  return ((value % trackLength) + trackLength) % trackLength;
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} playerId
 */
function getHomeLane(state, playerId) {
  return state.homeLanes?.[playerId] ?? [];
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} playerId
 */
function getHomeEntrySquare(state, playerId) {
  if (state.homeEntryIndexes?.[playerId] !== undefined) {
    return state.homeEntryIndexes[playerId];
  }

  const start = state.startIndexes[playerId];
  if (start === undefined) {
    return undefined;
  }

  return wrap(start - 1, state.trackLength);
}

/**
 * @param {import('../shared-types/index.js').CardRank} card
 */
export function getStepValues(card) {
  switch (card) {
    case 'ACE':
      return [1, 11];
    case 'FOUR':
      return [4, -4];
    case 'KING':
      return [13];
    case 'SEVEN':
      return [7];
    case 'TWO':
      return [2];
    case 'THREE':
      return [3];
    case 'FIVE':
      return [5];
    case 'SIX':
      return [6];
    case 'EIGHT':
      return [8];
    case 'NINE':
      return [9];
    case 'TEN':
      return [10];
    case 'QUEEN':
      return [12];
    default:
      return [];
  }
}

/**
 * @param {import('../shared-types/index.js').CardRank} card
 */
export function canExitStart(card) {
  return card === 'ACE' || card === 'KING';
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} pieceId
 * @returns {import('../shared-types/index.js').PieceState | undefined}
 */
function findPiece(state, pieceId) {
  return state.pieces.find((piece) => piece.id === pieceId);
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {number} square
 * @param {string=} skipPieceId
 */
function pieceAtSquare(state, square, skipPieceId) {
  return state.pieces.find((piece) => piece.id !== skipPieceId && piece.isOnBoard && piece.position === square);
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} ownerId
 * @param {number} homeIndex
 * @param {string=} skipPieceId
 */
function pieceAtHomeIndex(state, ownerId, homeIndex, skipPieceId) {
  return state.pieces.find(
    (piece) => piece.id !== skipPieceId && piece.ownerId === ownerId && piece.isInHome && piece.homeIndex === homeIndex
  );
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {number|null} square
 * @param {string} movingPieceId
 */
function sendOccupantToStartIfPresent(state, square, movingPieceId) {
  if (square === null || square === undefined) {
    return;
  }

  const occupant = pieceAtSquare(state, square, movingPieceId);
  if (!occupant) {
    return;
  }

  if (occupant.isImmune) {
    throw new Error(`Cannot knock immune piece: ${occupant.id}`);
  }

  occupant.position = null;
  occupant.isInStart = true;
  occupant.isOnBoard = false;
  occupant.isInHome = false;
  occupant.homeIndex = null;
  occupant.isImmune = false;
  occupant.hasCompletedLap = false;
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {number} from
 * @param {number} steps
 * @param {string} movingPieceId
 */
function isPathBlockedByImmune(state, from, steps, movingPieceId) {
  const distance = Math.abs(steps);
  const direction = Math.sign(steps);

  for (let offset = 1; offset <= distance; offset += 1) {
    const square = wrap(from + direction * offset, state.trackLength);
    const occupant = pieceAtSquare(state, square, movingPieceId);

    if (occupant?.isImmune) {
      return true;
    }
  }

  return false;
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {import('../shared-types/index.js').PieceState} piece
 * @param {number} steps
 */
function resolveForwardMove(state, piece, steps) {
  const startSquare = state.startIndexes[piece.ownerId];
  const homeLane = getHomeLane(state, piece.ownerId);
  const homeEntrySquare = getHomeEntrySquare(state, piece.ownerId);

  if (piece.isInHome) {
    const targetHomeIndex = (piece.homeIndex ?? 0) + steps;
    if (targetHomeIndex >= homeLane.length) {
      return null;
    }

    if (pieceAtHomeIndex(state, piece.ownerId, targetHomeIndex, piece.id)) {
      return null;
    }

    return {
      to: null,
      toHomeIndex: targetHomeIndex,
      hasCompletedLap: piece.hasCompletedLap
    };
  }

  if (!piece.isOnBoard || piece.position === null) {
    return null;
  }

  let currentPosition = piece.position;
  let hasCompletedLap = piece.hasCompletedLap;

  for (let step = 1; step <= steps; step += 1) {
    if (hasCompletedLap && homeLane.length > 0 && currentPosition === homeEntrySquare) {
      const targetHomeIndex = steps - step;
      if (targetHomeIndex >= homeLane.length) {
        // Overshoot home lane: continue around board.
        break;
      }

      if (pieceAtHomeIndex(state, piece.ownerId, targetHomeIndex, piece.id)) {
        return null;
      }

      return {
        to: null,
        toHomeIndex: targetHomeIndex,
        hasCompletedLap
      };
    }

    currentPosition = wrap(currentPosition + 1, state.trackLength);

    if (currentPosition === startSquare && !piece.isInStart) {
      hasCompletedLap = true;
    }

    const occupant = pieceAtSquare(state, currentPosition, piece.id);
    if (occupant?.isImmune) {
      return null;
    }
  }

  return {
    to: wrap(piece.position + steps, state.trackLength),
    toHomeIndex: null,
    hasCompletedLap
  };
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {import('../shared-types/index.js').PieceState} piece
 * @param {number} steps
 */
function resolveStandardMove(state, piece, steps) {
  if (steps > 0) {
    return resolveForwardMove(state, piece, steps);
  }

  if (piece.isInHome) {
    return null;
  }

  if (!piece.isOnBoard || piece.position === null) {
    return null;
  }

  if (isPathBlockedByImmune(state, piece.position, steps, piece.id)) {
    return null;
  }

  const destination = wrap(piece.position + steps, state.trackLength);
  const occupant = pieceAtSquare(state, destination, piece.id);
  if (occupant?.isImmune) {
    return null;
  }

  return {
    to: destination,
    toHomeIndex: null,
    hasCompletedLap: piece.hasCompletedLap
  };
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {import('../shared-types/index.js').PieceState} piece
 * @param {number} steps
 */
function stepSevenSegment(state, piece, steps) {
  if (steps <= 0) {
    return null;
  }

  if (!piece.isOnBoard || piece.position === null || piece.isInHome) {
    return null;
  }

  const startSquare = state.startIndexes[piece.ownerId];
  const homeLane = getHomeLane(state, piece.ownerId);
  const homeEntrySquare = getHomeEntrySquare(state, piece.ownerId);

  let currentPosition = piece.position;
  let hasCompletedLap = piece.hasCompletedLap;

  for (let step = 1; step <= steps; step += 1) {
    if (hasCompletedLap && homeLane.length > 0 && currentPosition === homeEntrySquare) {
      const targetHomeIndex = steps - step;
      if (targetHomeIndex >= homeLane.length) {
        break;
      }

      if (pieceAtHomeIndex(state, piece.ownerId, targetHomeIndex, piece.id)) {
        return null;
      }

      return {
        pieceId: piece.id,
        card: 'SEVEN',
        action: 'MOVE',
        from: piece.position,
        to: null,
        toHomeIndex: targetHomeIndex,
        steps,
        hasCompletedLap
      };
    }

    currentPosition = wrap(currentPosition + 1, state.trackLength);
    if (currentPosition === startSquare && !piece.isInStart) {
      hasCompletedLap = true;
    }

    const occupant = pieceAtSquare(state, currentPosition, piece.id);
    if (occupant?.isImmune) {
      return null;
    }

  }

  return {
    pieceId: piece.id,
    card: 'SEVEN',
    action: 'MOVE',
    from: piece.position,
    to: currentPosition,
    toHomeIndex: null,
    steps,
    hasCompletedLap
  };
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {import('../shared-types/index.js').MoveOption[]} segments
 */
function applySegments(state, segments) {
  let next = {
    ...state,
    pieces: state.pieces.map((piece) => ({ ...piece }))
  };

  for (const segment of segments) {
    next = applyMovePreview(next, segment);
  }

  return next;
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} playerId
 */
export function generateSevenSplitMoves(state, playerId, controllableOwnerIds = [playerId]) {
  const controllable = new Set(controllableOwnerIds);
  const ownMovers = state.pieces.filter(
    (piece) => controllable.has(piece.ownerId) && piece.isOnBoard && piece.position !== null && !piece.isInHome
  );

  const results = [];
  const seen = new Set();

  /**
   * @param {import('../shared-types/index.js').GameState} currentState
   * @param {number} remaining
   * @param {import('../shared-types/index.js').MoveOption[]} segments
   */
  function walk(currentState, remaining, segments) {
    if (remaining === 0) {
      if (segments.length === 0) {
        return;
      }

      const key = segments
        .map((segment) => `${segment.pieceId}:${segment.from}->${segment.to ?? `H${segment.toHomeIndex}`}:${segment.steps}`)
        .join('|');

      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          pieceId: segments[0].pieceId,
          card: 'SEVEN',
          action: 'SEVEN_SPLIT',
          from: segments[0].from,
          to: segments[segments.length - 1].to,
          steps: 7,
          segments: segments.map((segment) => ({
            pieceId: segment.pieceId,
            from: segment.from,
            to: segment.to,
            toHomeIndex: segment.toHomeIndex,
            steps: segment.steps
          }))
        });
      }

      return;
    }

    const candidatePieces = currentState.pieces.filter(
      (piece) => controllable.has(piece.ownerId) && piece.isOnBoard && piece.position !== null && !piece.isInHome
    );

    for (const candidate of candidatePieces) {
      for (let spend = 1; spend <= remaining; spend += 1) {
        const move = stepSevenSegment(currentState, candidate, spend);
        if (!move) {
          continue;
        }

        const advancedState = applyMovePreview(currentState, move);
        walk(advancedState, remaining - spend, [...segments, move]);
      }
    }
  }

  if (ownMovers.length > 0) {
    walk(state, 7, []);
  }

  return results.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} playerId
 * @param {import('../shared-types/index.js').CardRank} card
 * @returns {import('../shared-types/index.js').MoveOption[]}
 */
export function generateLegalMoves(state, playerId, card, controllableOwnerIds = [playerId]) {
  if (!CARD_RANKS.includes(card)) {
    throw new Error(`Unknown card: ${card}`);
  }

  if (card === 'JOKER') {
    return generateJokerOptions(state, playerId, controllableOwnerIds);
  }

  if (card === 'SEVEN') {
    return generateSevenSplitMoves(state, playerId, controllableOwnerIds);
  }

  const options = [];
  const controllable = new Set(controllableOwnerIds);
  const ownPieces = state.pieces.filter((piece) => controllable.has(piece.ownerId));

  for (const piece of ownPieces) {
    if (piece.isInHome && !piece.isOnBoard) {
      continue;
    }

    if (piece.isInStart) {
      if (canExitStart(card)) {
        const startSquare = state.startIndexes[piece.ownerId];
        const occupant = pieceAtSquare(state, startSquare, piece.id);

        if (!occupant?.isImmune) {
          options.push({
            pieceId: piece.id,
            card,
            action: 'EXIT_START',
            from: null,
            to: startSquare
          });
        }
      }
      continue;
    }

    for (const steps of getStepValues(card)) {
      if (steps === 0) {
        continue;
      }

      const resolved = resolveStandardMove(state, piece, steps);
      if (!resolved) {
        continue;
      }

      options.push({
        pieceId: piece.id,
        card,
        action: 'MOVE',
        from: piece.isOnBoard ? piece.position : null,
        to: resolved.to,
        toHomeIndex: resolved.toHomeIndex,
        steps
      });
    }
  }

  if (card === 'JACK') {
    return generateJackSwapOptions(state, playerId, controllableOwnerIds);
  }

  return options.sort((a, b) => {
    if (a.pieceId !== b.pieceId) {
      return a.pieceId.localeCompare(b.pieceId);
    }

    if ((a.toHomeIndex ?? -1) !== (b.toHomeIndex ?? -1)) {
      return (a.toHomeIndex ?? -1) - (b.toHomeIndex ?? -1);
    }

    return (a.steps ?? 0) - (b.steps ?? 0);
  });
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} playerId
 * @returns {import('../shared-types/index.js').MoveOption[]}
 */
export function generateJokerOptions(state, playerId, controllableOwnerIds = [playerId]) {
  const mirroredCards = CARD_RANKS.filter((rank) => rank !== 'JOKER');
  const uniqueMoves = new Map();

  for (const mirroredCard of mirroredCards) {
    const moves = generateLegalMoves(state, playerId, mirroredCard, controllableOwnerIds);

    for (const move of moves) {
      const jokerMove = {
        ...move,
        card: 'JOKER'
      };

      const key = JSON.stringify(jokerMove);
      uniqueMoves.set(key, jokerMove);
    }
  }

  return [...uniqueMoves.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} playerId
 * @returns {import('../shared-types/index.js').MoveOption[]}
 */
export function generateJackSwapOptions(state, playerId, controllableOwnerIds = [playerId]) {
  const controllable = new Set(controllableOwnerIds);
  const ownOnBoard = state.pieces.filter(
    (piece) => controllable.has(piece.ownerId) && piece.isOnBoard && piece.position !== null && !piece.isImmune
  );

  const targets = state.pieces.filter(
    (piece) => !controllable.has(piece.ownerId) && piece.isOnBoard && piece.position !== null && !piece.isImmune
  );

  const options = [];

  for (const mine of ownOnBoard) {
    for (const target of targets) {
      options.push({
        pieceId: mine.id,
        card: 'JACK',
        action: 'SWAP',
        from: mine.position,
        to: target.position,
        swapTargetPieceId: target.id
      });
    }
  }

  return options.sort((a, b) => {
    if (a.pieceId !== b.pieceId) {
      return a.pieceId.localeCompare(b.pieceId);
    }

    return a.swapTargetPieceId.localeCompare(b.swapTargetPieceId);
  });
}

/**
 * @param {number} playerCount
 */
export function buildStartIndexes(playerCount) {
  const startIndexes = {};

  for (let seat = 0; seat < playerCount; seat += 1) {
    startIndexes[`P${seat + 1}`] = seat * TRACK_SPACES_BETWEEN_PLAYERS;
  }

  return startIndexes;
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} playerId
 * @param {import('../shared-types/index.js').CardRank[]} hand
 */
export function evaluateHandPlayability(state, playerId, hand, controllableOwnerIds = [playerId]) {
  const perCardMoves = {};
  let hasAnyLegalMove = false;

  for (const card of hand) {
    const moves = generateLegalMoves(state, playerId, card, controllableOwnerIds);
    perCardMoves[card] = moves;

    if (moves.length > 0) {
      hasAnyLegalMove = true;
    }
  }

  return {
    hasAnyLegalMove,
    perCardMoves
  };
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {import('../shared-types/index.js').MoveOption} move
 */
export function applyMovePreview(state, move) {
  const nextState = {
    ...state,
    pieces: state.pieces.map((piece) => ({ ...piece }))
  };

  const movingPiece = findPiece(nextState, move.pieceId);
  if (!movingPiece) {
    throw new Error(`Unknown piece: ${move.pieceId}`);
  }

  if (move.action === 'SEVEN_SPLIT') {
    if (!move.segments || !Array.isArray(move.segments) || move.segments.length === 0) {
      throw new Error('segments are required for SEVEN_SPLIT move');
    }

    let intermediateState = nextState;
    for (const segment of move.segments) {
      intermediateState = applyMovePreview(intermediateState, {
        ...segment,
        card: 'SEVEN',
        action: 'MOVE'
      });
    }

    return intermediateState;
  }

  if (move.action === 'EXIT_START') {
    sendOccupantToStartIfPresent(nextState, move.to, movingPiece.id);

    movingPiece.isInStart = false;
    movingPiece.isOnBoard = true;
    movingPiece.isInHome = false;
    movingPiece.homeIndex = null;
    movingPiece.position = move.to;
    movingPiece.isImmune = true;
    return nextState;
  }

  if (move.action === 'MOVE') {
    if (move.toHomeIndex !== null && move.toHomeIndex !== undefined) {
      movingPiece.position = null;
      movingPiece.isOnBoard = false;
      movingPiece.isInHome = true;
      movingPiece.homeIndex = move.toHomeIndex;
      movingPiece.isImmune = false;
      movingPiece.hasCompletedLap = true;
      return nextState;
    }

    if (move.card === 'SEVEN' && move.steps > 0 && move.from !== null && move.from !== undefined && move.to !== null) {
      for (let offset = 1; offset < move.steps; offset += 1) {
        const passSquare = wrap(move.from + offset, nextState.trackLength);
        sendOccupantToStartIfPresent(nextState, passSquare, movingPiece.id);
      }
    }

    sendOccupantToStartIfPresent(nextState, move.to, movingPiece.id);

    movingPiece.position = move.to;
    movingPiece.isOnBoard = true;
    movingPiece.isInHome = false;
    movingPiece.homeIndex = null;
    movingPiece.isImmune = false;

    const startSquare = nextState.startIndexes[movingPiece.ownerId];
    if (move.from !== null && move.from !== undefined && move.to !== null && move.to !== undefined && move.steps > 0) {
      const distanceToStart = wrap(startSquare - move.from, nextState.trackLength);
      if (distanceToStart > 0 && move.steps >= distanceToStart) {
        movingPiece.hasCompletedLap = true;
      }
    }

    return nextState;
  }

  if (move.action === 'SWAP') {
    if (!move.swapTargetPieceId) {
      throw new Error('swapTargetPieceId is required for SWAP move');
    }

    const targetPiece = findPiece(nextState, move.swapTargetPieceId);
    if (!targetPiece) {
      throw new Error(`Unknown target piece: ${move.swapTargetPieceId}`);
    }

    if (!movingPiece.isOnBoard || movingPiece.position === null) {
      throw new Error(`Cannot swap piece that is not on board: ${movingPiece.id}`);
    }

    if (!targetPiece.isOnBoard || targetPiece.position === null) {
      throw new Error(`Cannot swap target piece that is not on board: ${targetPiece.id}`);
    }

    if (movingPiece.isImmune || targetPiece.isImmune) {
      throw new Error('Cannot swap immune piece');
    }

    const from = movingPiece.position;
    movingPiece.position = targetPiece.position;
    targetPiece.position = from;

    return nextState;
  }

  throw new Error(`Unsupported action: ${move.action}`);
}
