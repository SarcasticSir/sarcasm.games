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

  occupant.position = null;
  occupant.isInStart = true;
  occupant.isOnBoard = false;
  occupant.isInHome = false;
  occupant.isImmune = false;
  occupant.hasCompletedLap = false;
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
 * @param {string} playerId
 * @param {import('../shared-types/index.js').CardRank} card
 * @returns {import('../shared-types/index.js').MoveOption[]}
 */
export function generateLegalMoves(state, playerId, card) {
  if (!CARD_RANKS.includes(card)) {
    throw new Error(`Unknown card: ${card}`);
  }

  if (card === 'JOKER') {
    return generateJokerOptions(state, playerId);
  }

  const options = [];
  const ownPieces = state.pieces.filter((piece) => piece.ownerId === playerId);

  for (const piece of ownPieces) {
    if (piece.isInHome) {
      continue;
    }

    if (piece.isInStart) {
      if (canExitStart(card)) {
        const startSquare = state.startIndexes[playerId];
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

    if (!piece.isOnBoard || piece.position === null) {
      continue;
    }

    for (const steps of getStepValues(card)) {
      if (steps === 0) {
        continue;
      }

      if (isPathBlockedByImmune(state, piece.position, steps, piece.id)) {
        continue;
      }

      const destination = wrap(piece.position + steps, state.trackLength);
      const occupant = pieceAtSquare(state, destination, piece.id);

      if (occupant?.isImmune) {
        continue;
      }

      options.push({
        pieceId: piece.id,
        card,
        action: 'MOVE',
        from: piece.position,
        to: destination,
        steps
      });
    }
  }

  if (card === 'JACK') {
    return generateJackSwapOptions(state, playerId);
  }

  return options.sort((a, b) => {
    if (a.pieceId !== b.pieceId) {
      return a.pieceId.localeCompare(b.pieceId);
    }

    return (a.steps ?? 0) - (b.steps ?? 0);
  });
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} playerId
 * @returns {import('../shared-types/index.js').MoveOption[]}
 */
export function generateJokerOptions(state, playerId) {
  const mirroredCards = CARD_RANKS.filter((rank) => rank !== 'JOKER');
  const uniqueMoves = new Map();

  for (const mirroredCard of mirroredCards) {
    const moves = generateLegalMoves(state, playerId, mirroredCard);

    for (const move of moves) {
      const jokerMove = {
        ...move,
        card: 'JOKER'
      };

      const key = [jokerMove.action, jokerMove.pieceId, jokerMove.from, jokerMove.to, jokerMove.steps, jokerMove.swapTargetPieceId].join('|');
      uniqueMoves.set(key, jokerMove);
    }
  }

  return [...uniqueMoves.values()].sort((a, b) => {
    if (a.action !== b.action) {
      return a.action.localeCompare(b.action);
    }

    if (a.pieceId !== b.pieceId) {
      return a.pieceId.localeCompare(b.pieceId);
    }

    if ((a.steps ?? 0) !== (b.steps ?? 0)) {
      return (a.steps ?? 0) - (b.steps ?? 0);
    }

    return (a.swapTargetPieceId ?? '').localeCompare(b.swapTargetPieceId ?? '');
  });
}

/**
 * @param {import('../shared-types/index.js').GameState} state
 * @param {string} playerId
 * @returns {import('../shared-types/index.js').MoveOption[]}
 */
export function generateJackSwapOptions(state, playerId) {
  const ownOnBoard = state.pieces.filter(
    (piece) => piece.ownerId === playerId && piece.isOnBoard && piece.position !== null && !piece.isImmune
  );

  const targets = state.pieces.filter(
    (piece) => piece.ownerId !== playerId && piece.isOnBoard && piece.position !== null && !piece.isImmune
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
export function evaluateHandPlayability(state, playerId, hand) {
  const perCardMoves = {};
  let hasAnyLegalMove = false;

  for (const card of hand) {
    const moves = generateLegalMoves(state, playerId, card);
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

  if (move.action === 'EXIT_START') {
    sendOccupantToStartIfPresent(nextState, move.to, movingPiece.id);

    movingPiece.isInStart = false;
    movingPiece.isOnBoard = true;
    movingPiece.position = move.to;
    movingPiece.isImmune = true;
    return nextState;
  }

  if (move.action === 'MOVE') {
    sendOccupantToStartIfPresent(nextState, move.to, movingPiece.id);

    movingPiece.position = move.to;
    movingPiece.isImmune = false;
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

    const from = movingPiece.position;
    movingPiece.position = targetPiece.position;
    targetPiece.position = from;

    return nextState;
  }

  throw new Error(`Unsupported action: ${move.action}`);
}
