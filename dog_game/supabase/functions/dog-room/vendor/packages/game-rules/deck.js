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
 * @param {string[]} playerIds
 * @param {number} roundNumber
 * @param {number} reshuffleSeed
 */
export function dealRoundHands(deckState, playerIds, roundNumber, reshuffleSeed = 1) {
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    throw new Error('playerIds must contain at least one player');
  }

  const handSize = getHandSizeForRound(roundNumber);
  const hands = {};

  let nextDeckState = {
    drawPile: [...deckState.drawPile],
    discardPile: [...deckState.discardPile]
  };

  for (const playerId of playerIds) {
    const { drawn, deckState: updatedDeckState } = drawCards(nextDeckState, handSize, reshuffleSeed);
    hands[playerId] = drawn;
    nextDeckState = updatedDeckState;
  }

  return {
    handSize,
    hands,
    deckState: nextDeckState
  };
}


/**
 * @typedef {Object} TeamExchangeAction
 * @property {string} fromPlayerId
 * @property {string} toPlayerId
 * @property {string} cardId
 */

/**
 * @param {Record<string, DeckCard[]>} hands
 * @param {Record<string, number>} teamByPlayerId
 * @param {TeamExchangeAction[]} exchanges
 */
export function applyTeamCardExchange(hands, teamByPlayerId, exchanges) {
  if (!Array.isArray(exchanges) || exchanges.length === 0) {
    throw new Error('exchanges must include one action per team player');
  }

  const players = Object.keys(teamByPlayerId);
  if (players.length === 0) {
    throw new Error('teamByPlayerId must include at least one player');
  }

  const outgoingByPlayer = new Map();
  const incomingCountByPlayer = new Map(players.map((playerId) => [playerId, 0]));

  for (const action of exchanges) {
    const { fromPlayerId, toPlayerId, cardId } = action;

    if (!(fromPlayerId in teamByPlayerId) || !(toPlayerId in teamByPlayerId)) {
      throw new Error('Exchange action references unknown player');
    }

    if (fromPlayerId === toPlayerId) {
      throw new Error('Player cannot exchange a card with themselves');
    }

    if (teamByPlayerId[fromPlayerId] !== teamByPlayerId[toPlayerId]) {
      throw new Error('Exchange can only happen between teammates');
    }

    if (outgoingByPlayer.has(fromPlayerId)) {
      throw new Error('Each player must send exactly one card');
    }

    const senderHand = hands[fromPlayerId] ?? [];
    const selectedCard = senderHand.find((card) => card.id === cardId);
    if (!selectedCard) {
      throw new Error(`Player ${fromPlayerId} does not have selected card ${cardId}`);
    }

    outgoingByPlayer.set(fromPlayerId, {
      ...action,
      card: selectedCard
    });

    incomingCountByPlayer.set(toPlayerId, (incomingCountByPlayer.get(toPlayerId) ?? 0) + 1);
  }

  if (outgoingByPlayer.size !== players.length) {
    throw new Error('Each player must submit exactly one exchange action');
  }

  for (const playerId of players) {
    if ((incomingCountByPlayer.get(playerId) ?? 0) !== 1) {
      throw new Error('Each player must receive exactly one exchanged card');
    }
  }

  const nextHands = {};
  for (const playerId of Object.keys(hands)) {
    nextHands[playerId] = [...hands[playerId]];
  }

  for (const playerId of players) {
    const action = outgoingByPlayer.get(playerId);
    nextHands[playerId] = (nextHands[playerId] ?? []).filter((card) => card.id !== action.cardId);
  }

  for (const playerId of players) {
    const action = outgoingByPlayer.get(playerId);
    nextHands[action.toPlayerId].push(action.card);
  }

  return nextHands;
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
