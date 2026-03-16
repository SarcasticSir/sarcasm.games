import test from 'node:test';
import assert from 'node:assert/strict';

import { createPieceInStart } from '../packages/shared-types/index.js';
import {
  applyMovePreview,
  buildStartIndexes,
  generateJackSwapOptions,
  generateLegalMoves,
  TRACK_SPACES_BETWEEN_PLAYERS
} from '../packages/game-rules/index.js';

function buildState({ trackLength = 64, startIndexes, pieces }) {
  return {
    trackLength,
    startIndexes,
    pieces
  };
}

test('Ace offers both 1 and 11 forward moves', () => {
  const startIndexes = buildStartIndexes(4);
  const piece = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 0
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [piece]
  });

  const moves = generateLegalMoves(state, 'P1', 'ACE');
  assert.equal(moves.length, 2);
  assert.deepEqual(
    moves.map((move) => move.steps),
    [1, 11]
  );
  assert.deepEqual(
    moves.map((move) => move.to),
    [1, 11]
  );
});

test('King can exit start when piece is in start', () => {
  const startIndexes = buildStartIndexes(4);
  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [createPieceInStart('P1-A', 'P1')]
  });

  const moves = generateLegalMoves(state, 'P1', 'KING');
  assert.equal(moves.length, 1);
  assert.equal(moves[0].action, 'EXIT_START');
  assert.equal(moves[0].to, startIndexes.P1);

  const previewState = applyMovePreview(state, moves[0]);
  const movedPiece = previewState.pieces[0];
  assert.equal(movedPiece.isOnBoard, true);
  assert.equal(movedPiece.isInStart, false);
  assert.equal(movedPiece.isImmune, true);
});

test('4 backward wraps around board boundaries', () => {
  const startIndexes = buildStartIndexes(4);
  const piece = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 1
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [piece]
  });

  const moves = generateLegalMoves(state, 'P1', 'FOUR');
  const backwardMove = moves.find((move) => move.steps === -4);

  assert.ok(backwardMove);
  assert.equal(backwardMove.to, 61);
});

test('Immune blocker cannot be passed, landed on, or swapped by Jack', () => {
  const startIndexes = buildStartIndexes(4);

  const myMover = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 1
  };

  const enemyImmune = {
    ...createPieceInStart('P2-A', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 3,
    isImmune: true
  };

  const enemyNormal = {
    ...createPieceInStart('P2-B', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 8,
    isImmune: false
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [myMover, enemyImmune, enemyNormal]
  });

  const fourMoves = generateLegalMoves(state, 'P1', 'FOUR');
  assert.equal(
    fourMoves.some((move) => move.steps === 4),
    false,
    'Forward 4 should be blocked because path crosses immune piece'
  );

  const jackSwaps = generateJackSwapOptions(state, 'P1');
  assert.equal(
    jackSwaps.some((move) => move.swapTargetPieceId === 'P2-A'),
    false,
    'Immune piece must not be a Jack target'
  );
  assert.equal(
    jackSwaps.some((move) => move.swapTargetPieceId === 'P2-B'),
    true,
    'Non-immune in-play piece should remain a valid Jack target'
  );
});
