import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDeckCards,
  createDeckState,
  discardCards,
  drawCards,
  getDeckCountForPlayers,
  getHandSizeForRound,
  shuffleDeterministic
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
