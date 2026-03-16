const SUITS = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
const BASE_RANKS = ['ACE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'JACK', 'QUEEN', 'KING'];

/**
 * @typedef {Object} DeckCard
 * @property {string} id
 * @property {import('../shared-types/index.js').CardRank} rank
 * @property {string|null} suit
 */

/**
 * @typedef {Object} DeckState
 * @property {DeckCard[]} drawPile
 * @property {DeckCard[]} discardPile
 */

/**
 * @param {number} seed
 */
function createSeededRng(seed) {
  let state = seed >>> 0;

  return function nextRandom() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * @param {number} playerCount
 */
export function getDeckCountForPlayers(playerCount) {
  if (playerCount < 4) {
    throw new Error('Dog game requires at least 4 players');
  }

  return playerCount === 4 ? 2 : 3;
}

/**
 * @param {number} deckCount
 */
export function buildDeckCards(deckCount) {
  const cards = [];

  for (let deckNo = 1; deckNo <= deckCount; deckNo += 1) {
    for (const suit of SUITS) {
      for (const rank of BASE_RANKS) {
        cards.push({
          id: `D${deckNo}-${suit}-${rank}`,
          rank,
          suit
        });
      }
    }

    cards.push({ id: `D${deckNo}-JOKER-1`, rank: 'JOKER', suit: null });
    cards.push({ id: `D${deckNo}-JOKER-2`, rank: 'JOKER', suit: null });
  }

  return cards;
}

/**
 * @template T
 * @param {T[]} cards
 * @param {number} seed
 * @returns {T[]}
 */
export function shuffleDeterministic(cards, seed) {
  const output = [...cards];
  const random = createSeededRng(seed);

  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = output[i];
    output[i] = output[j];
    output[j] = tmp;
  }

  return output;
}

/**
 * @param {number} playerCount
 * @param {number} seed
 * @returns {DeckState}
 */
export function createDeckState(playerCount, seed = 1) {
  const deckCount = getDeckCountForPlayers(playerCount);
  const cards = buildDeckCards(deckCount);

  return {
    drawPile: shuffleDeterministic(cards, seed),
    discardPile: []
  };
}

/**
 * @param {number} roundNumber
 */
export function getHandSizeForRound(roundNumber) {
  if (roundNumber < 1) {
    throw new Error('roundNumber must be >= 1');
  }

  const cycle = [6, 5, 4, 3, 2];
  return cycle[(roundNumber - 1) % cycle.length];
}

/**
 * @param {DeckState} deckState
 * @param {number} count
 * @param {number} reshuffleSeed
 */
export function drawCards(deckState, count, reshuffleSeed = 1) {
  if (count < 0) {
    throw new Error('count must be >= 0');
  }

  const nextState = {
    drawPile: [...deckState.drawPile],
    discardPile: [...deckState.discardPile]
  };

  const drawn = [];

  while (drawn.length < count) {
    if (nextState.drawPile.length === 0) {
      if (nextState.discardPile.length === 0) {
        throw new Error('Cannot draw cards: both draw pile and discard pile are empty');
      }

      nextState.drawPile = shuffleDeterministic(nextState.discardPile, reshuffleSeed);
      nextState.discardPile = [];
    }

    const card = nextState.drawPile.shift();
    drawn.push(card);
  }

  return {
    drawn,
    deckState: nextState
  };
}

/**
 * @param {DeckState} deckState
 * @param {DeckCard[]} cards
 */
export function discardCards(deckState, cards) {
  return {
    drawPile: [...deckState.drawPile],
    discardPile: [...deckState.discardPile, ...cards]
  };
}
