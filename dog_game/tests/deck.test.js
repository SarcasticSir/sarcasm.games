import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDeckCards,
  createDeckState,
  discardCards,
  drawCards,
  getDeckCountForPlayers,
  getHandSizeForRound,
  shuffleDeterministic,
  dealRoundHands,
  applyTeamCardExchange
} from '../packages/game-rules/deck.js';

test('Deck count follows player-count rules (4 => 2 decks, >4 => 3 decks)', () => {
  assert.equal(getDeckCountForPlayers(4), 2);
  assert.equal(getDeckCountForPlayers(5), 3);
  assert.equal(getDeckCountForPlayers(8), 3);
});

test('Deck card totals include jokers: 2 decks = 108, 3 decks = 162', () => {
  assert.equal(buildDeckCards(2).length, 108);
  assert.equal(buildDeckCards(3).length, 162);
});

test('Hand-size cycle repeats 6,5,4,3,2', () => {
  const rounds = Array.from({ length: 10 }, (_, index) => index + 1);
  const handSizes = rounds.map((round) => getHandSizeForRound(round));

  assert.deepEqual(handSizes, [6, 5, 4, 3, 2, 6, 5, 4, 3, 2]);
});

test('Deterministic shuffle returns same order for same seed', () => {
  const cards = buildDeckCards(2);
  const shuffledA = shuffleDeterministic(cards, 123);
  const shuffledB = shuffleDeterministic(cards, 123);
  const shuffledC = shuffleDeterministic(cards, 456);

  assert.deepEqual(
    shuffledA.map((card) => card.id),
    shuffledB.map((card) => card.id)
  );

  assert.notDeepEqual(
    shuffledA.map((card) => card.id),
    shuffledC.map((card) => card.id)
  );
});

test('Draw reshuffles discard pile when draw pile is empty', () => {
  const deckState = createDeckState(4, 999);

  const { drawn: firstDraw, deckState: afterFirstDraw } = drawCards(deckState, 6, 77);
  const afterDiscard = discardCards(afterFirstDraw, firstDraw);

  const forcedEmptyDraw = {
    drawPile: [],
    discardPile: [...afterDiscard.discardPile]
  };

  const { drawn, deckState: afterReshuffleDraw } = drawCards(forcedEmptyDraw, 3, 77);

  assert.equal(drawn.length, 3);
  assert.equal(afterReshuffleDraw.discardPile.length, 0);
  assert.equal(afterReshuffleDraw.drawPile.length, forcedEmptyDraw.discardPile.length - 3);
});


test('dealRoundHands deals current round hand-size to every player', () => {
  const playerIds = ['P1', 'P2', 'P3', 'P4'];
  const initial = createDeckState(4, 42);

  const { handSize, hands, deckState } = dealRoundHands(initial, playerIds, 1, 77);

  assert.equal(handSize, 6);
  assert.deepEqual(Object.keys(hands), playerIds);
  assert.equal(hands.P1.length, 6);
  assert.equal(hands.P2.length, 6);
  assert.equal(hands.P3.length, 6);
  assert.equal(hands.P4.length, 6);

  assert.equal(deckState.drawPile.length, initial.drawPile.length - 24);
});

test('dealRoundHands follows hand-size cycle across rounds', () => {
  const playerIds = ['P1', 'P2', 'P3', 'P4'];
  const initial = createDeckState(4, 99);

  const round2 = dealRoundHands(initial, playerIds, 2, 10);
  const round5 = dealRoundHands(initial, playerIds, 5, 10);
  const round6 = dealRoundHands(initial, playerIds, 6, 10);

  assert.equal(round2.handSize, 5);
  assert.equal(round5.handSize, 2);
  assert.equal(round6.handSize, 6);

  assert.equal(round2.hands.P1.length, 5);
  assert.equal(round5.hands.P1.length, 2);
  assert.equal(round6.hands.P1.length, 6);
});


test('applyTeamCardExchange swaps one card per player within each team', () => {
  const hands = {
    P1: [{ id: 'c1', rank: 'ACE', suit: 'SPADES' }],
    P2: [{ id: 'c2', rank: 'KING', suit: 'HEARTS' }],
    P3: [{ id: 'c3', rank: 'QUEEN', suit: 'CLUBS' }],
    P4: [{ id: 'c4', rank: 'JOKER', suit: null }]
  };

  const teamByPlayerId = { P1: 1, P2: 2, P3: 1, P4: 2 };

  const exchanged = applyTeamCardExchange(hands, teamByPlayerId, [
    { fromPlayerId: 'P1', toPlayerId: 'P3', cardId: 'c1' },
    { fromPlayerId: 'P3', toPlayerId: 'P1', cardId: 'c3' },
    { fromPlayerId: 'P2', toPlayerId: 'P4', cardId: 'c2' },
    { fromPlayerId: 'P4', toPlayerId: 'P2', cardId: 'c4' }
  ]);

  assert.equal(exchanged.P1[0].id, 'c3');
  assert.equal(exchanged.P2[0].id, 'c4');
  assert.equal(exchanged.P3[0].id, 'c1');
  assert.equal(exchanged.P4[0].id, 'c2');

  assert.equal(hands.P1[0].id, 'c1');
});

test('applyTeamCardExchange rejects cross-team exchanges', () => {
  const hands = {
    P1: [{ id: 'c1', rank: 'ACE', suit: 'SPADES' }],
    P2: [{ id: 'c2', rank: 'KING', suit: 'HEARTS' }]
  };

  const teamByPlayerId = { P1: 1, P2: 2 };

  assert.throws(() =>
    applyTeamCardExchange(hands, teamByPlayerId, [
      { fromPlayerId: 'P1', toPlayerId: 'P2', cardId: 'c1' },
      { fromPlayerId: 'P2', toPlayerId: 'P1', cardId: 'c2' }
    ])
  );
});

test('applyTeamCardExchange requires exactly one incoming card per player', () => {
  const hands = {
    P1: [{ id: 'c1', rank: 'ACE', suit: 'SPADES' }],
    P3: [{ id: 'c3', rank: 'QUEEN', suit: 'CLUBS' }]
  };

  const teamByPlayerId = { P1: 1, P3: 1 };

  assert.throws(() =>
    applyTeamCardExchange(hands, teamByPlayerId, [
      { fromPlayerId: 'P1', toPlayerId: 'P3', cardId: 'c1' },
      { fromPlayerId: 'P3', toPlayerId: 'P3', cardId: 'c3' }
    ])
  );
});
