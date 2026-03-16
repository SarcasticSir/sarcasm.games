/**
 * @typedef {'ACE'|'TWO'|'THREE'|'FOUR'|'FIVE'|'SIX'|'SEVEN'|'EIGHT'|'NINE'|'TEN'|'JACK'|'QUEEN'|'KING'|'JOKER'} CardRank
 */

/**
 * @typedef {Object} PieceState
 * @property {string} id
 * @property {string} ownerId
 * @property {number|null} position
 * @property {boolean} isInStart
 * @property {boolean} isOnBoard
 * @property {boolean} isInHome
 * @property {boolean} isImmune
 * @property {boolean} hasCompletedLap
 */

/**
 * @typedef {Object} GameState
 * @property {number} trackLength
 * @property {Record<string, number>} startIndexes
 * @property {PieceState[]} pieces
 */

/**
 * @typedef {Object} MoveOption
 * @property {string} pieceId
 * @property {CardRank} card
 * @property {'MOVE'|'EXIT_START'|'SWAP'} action
 * @property {number|null} from
 * @property {number|null} to
 * @property {number=} steps
 * @property {string=} swapTargetPieceId
 */

export const CARD_RANKS = Object.freeze([
  'ACE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
  'TEN',
  'JACK',
  'QUEEN',
  'KING',
  'JOKER'
]);

/**
 * @param {string} id
 * @param {string} ownerId
 * @returns {PieceState}
 */
export function createPieceInStart(id, ownerId) {
  return {
    id,
    ownerId,
    position: null,
    isInStart: true,
    isOnBoard: false,
    isInHome: false,
    isImmune: false,
    hasCompletedLap: false
  };
}
