import test from 'node:test';
import assert from 'node:assert/strict';

import { createPieceInStart } from '../packages/shared-types/index.js';
import {
  applyMovePreview,
  buildStartIndexes,
  generateJackSwapOptions,
  generateLegalMoves,
  evaluateHandPlayability,
  TRACK_SPACES_BETWEEN_PLAYERS
} from '../packages/game-rules/index.js';

function buildState({ trackLength = 64, startIndexes, pieces, homeLanes, homeEntryIndexes }) {
  return {
    trackLength,
    startIndexes,
    pieces,
    homeLanes,
    homeEntryIndexes
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

test('Ace can still exit start when normal on-board Ace moves are blocked by immune piece', () => {
  const startIndexes = buildStartIndexes(4);

  const blockedMover = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 2
  };

  const startPiece = createPieceInStart('P1-B', 'P1');

  const immuneBlocker = {
    ...createPieceInStart('P2-A', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 3,
    isImmune: true
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [blockedMover, startPiece, immuneBlocker]
  });

  const moves = generateLegalMoves(state, 'P1', 'ACE');

  assert.equal(
    moves.some((move) => move.action === 'MOVE' && move.pieceId === 'P1-A'),
    false,
    'On-board ACE moves should be blocked by immune piece'
  );
  assert.equal(
    moves.some((move) => move.action === 'EXIT_START' && move.pieceId === 'P1-B' && move.to === startIndexes.P1),
    true,
    'ACE exit-from-start option should remain legal'
  );
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

test('Joker mirrors legal moves from other card types', () => {
  const startIndexes = buildStartIndexes(4);

  const myOnBoard = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 5,
    isImmune: false
  };

  const myInStart = createPieceInStart('P1-B', 'P1');

  const enemyOnBoard = {
    ...createPieceInStart('P2-A', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 9,
    isImmune: false
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [myOnBoard, myInStart, enemyOnBoard]
  });

  const jokerMoves = generateLegalMoves(state, 'P1', 'JOKER');

  assert.equal(
    jokerMoves.some((move) => move.action === 'EXIT_START' && move.pieceId === 'P1-B' && move.to === startIndexes.P1),
    true,
    'Joker should include start-exit moves from Ace/King behavior'
  );

  assert.equal(
    jokerMoves.some((move) => move.action === 'MOVE' && move.pieceId === 'P1-A' && move.steps === 13),
    true,
    'Joker should include king-like 13-step movement'
  );

  assert.equal(
    jokerMoves.some((move) => move.action === 'SWAP' && move.pieceId === 'P1-A' && move.swapTargetPieceId === 'P2-A'),
    true,
    'Joker should include Jack-like swap options'
  );
});


test('Joker equals deduplicated union of all non-Joker legal moves', () => {
  const startIndexes = buildStartIndexes(4);

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [
      {
        ...createPieceInStart('P1-A', 'P1'),
        isInStart: false,
        isOnBoard: true,
        position: 5,
        isImmune: false
      },
      createPieceInStart('P1-B', 'P1'),
      {
        ...createPieceInStart('P2-A', 'P2'),
        isInStart: false,
        isOnBoard: true,
        position: 7,
        isImmune: true
      },
      {
        ...createPieceInStart('P2-B', 'P2'),
        isInStart: false,
        isOnBoard: true,
        position: 9,
        isImmune: false
      }
    ]
  });

  const nonJokerCards = ['ACE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'JACK', 'QUEEN', 'KING'];

  const expected = new Map();
  for (const card of nonJokerCards) {
    for (const move of generateLegalMoves(state, 'P1', card)) {
      const jokerMove = { ...move, card: 'JOKER' };
      const key = [
        jokerMove.action,
        jokerMove.pieceId,
        jokerMove.from,
        jokerMove.to,
        jokerMove.steps,
        jokerMove.swapTargetPieceId
      ].join('|');
      expected.set(key, jokerMove);
    }
  }

  const actual = generateLegalMoves(state, 'P1', 'JOKER');
  const actualKeys = new Set(
    actual.map((move) => [move.action, move.pieceId, move.from, move.to, move.steps, move.swapTargetPieceId].join('|'))
  );

  assert.equal(actual.length, actualKeys.size, 'Joker result should not contain duplicate move entries');
  assert.deepEqual([...actualKeys].sort(), [...expected.keys()].sort());
});


test('Must-play is true when at least one card in hand has legal moves', () => {
  const startIndexes = buildStartIndexes(4);
  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [createPieceInStart('P1-A', 'P1')]
  });

  const hand = ['SEVEN', 'JACK', 'KING'];
  const result = evaluateHandPlayability(state, 'P1', hand);

  assert.equal(result.hasAnyLegalMove, true);
  assert.equal(result.perCardMoves.SEVEN.length, 0);
  assert.equal(result.perCardMoves.JACK.length, 0);
  assert.equal(result.perCardMoves.KING.length, 1);
  assert.equal(result.perCardMoves.KING[0].action, 'EXIT_START');
});

test('No-legal-move is true when all cards in hand are blocked', () => {
  const startIndexes = buildStartIndexes(4);

  const myStartPiece = createPieceInStart('P1-A', 'P1');
  const enemyImmuneAtStart = {
    ...createPieceInStart('P2-A', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: startIndexes.P1,
    isImmune: true
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [myStartPiece, enemyImmuneAtStart]
  });

  const hand = ['ACE', 'KING', 'JACK'];
  const result = evaluateHandPlayability(state, 'P1', hand);

  assert.equal(result.hasAnyLegalMove, false);
  assert.equal(result.perCardMoves.ACE.length, 0);
  assert.equal(result.perCardMoves.KING.length, 0);
  assert.equal(result.perCardMoves.JACK.length, 0);
});

test('Landing on another piece sends that piece back to start', () => {
  const startIndexes = buildStartIndexes(4);

  const mover = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 5
  };

  const occupant = {
    ...createPieceInStart('P2-A', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 9
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [mover, occupant]
  });

  const move = generateLegalMoves(state, 'P1', 'FOUR').find((option) => option.steps === 4);
  assert.ok(move, 'Expected a legal +4 move from 5 to 9');

  const next = applyMovePreview(state, move);
  const movedPiece = next.pieces.find((piece) => piece.id === 'P1-A');
  const knockedPiece = next.pieces.find((piece) => piece.id === 'P2-A');

  assert.equal(movedPiece.position, 9);
  assert.equal(movedPiece.isOnBoard, true);

  assert.equal(knockedPiece.position, null);
  assert.equal(knockedPiece.isInStart, true);
  assert.equal(knockedPiece.isOnBoard, false);
  assert.equal(knockedPiece.isImmune, false);
});

test('Exiting start can knock a non-immune occupant back to start', () => {
  const startIndexes = buildStartIndexes(4);

  const myStartPiece = createPieceInStart('P1-A', 'P1');

  const occupantOnStartSquare = {
    ...createPieceInStart('P2-A', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: startIndexes.P1,
    isImmune: false
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [myStartPiece, occupantOnStartSquare]
  });

  const exitMove = generateLegalMoves(state, 'P1', 'ACE').find((move) => move.action === 'EXIT_START');
  assert.ok(exitMove, 'Expected exit-start move with ACE');

  const next = applyMovePreview(state, exitMove);
  const myPiece = next.pieces.find((piece) => piece.id === 'P1-A');
  const knockedPiece = next.pieces.find((piece) => piece.id === 'P2-A');

  assert.equal(myPiece.position, startIndexes.P1);
  assert.equal(myPiece.isInStart, false);
  assert.equal(myPiece.isOnBoard, true);
  assert.equal(myPiece.isImmune, true);

  assert.equal(knockedPiece.position, null);
  assert.equal(knockedPiece.isInStart, true);
  assert.equal(knockedPiece.isOnBoard, false);
});


test('applyMovePreview rejects landing on immune piece', () => {
  const startIndexes = buildStartIndexes(4);

  const mover = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 5
  };

  const immuneOccupant = {
    ...createPieceInStart('P2-A', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 9,
    isImmune: true
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [mover, immuneOccupant]
  });

  assert.throws(
    () =>
      applyMovePreview(state, {
        pieceId: 'P1-A',
        card: 'FOUR',
        action: 'MOVE',
        from: 5,
        to: 9,
        steps: 4
      }),
    /Cannot knock immune piece/
  );
});

test('applyMovePreview rejects swap when source or target is immune', () => {
  const startIndexes = buildStartIndexes(4);

  const myImmune = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    isImmune: true,
    position: 3
  };

  const enemy = {
    ...createPieceInStart('P2-A', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 11
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [myImmune, enemy]
  });

  assert.throws(
    () =>
      applyMovePreview(state, {
        pieceId: 'P1-A',
        card: 'JACK',
        action: 'SWAP',
        from: 3,
        to: 11,
        swapTargetPieceId: 'P2-A'
      }),
    /Cannot swap immune piece/
  );
});

test('applyMovePreview rejects swap when target is not on board', () => {
  const startIndexes = buildStartIndexes(4);

  const mine = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 3
  };

  const enemyInStart = createPieceInStart('P2-A', 'P2');

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [mine, enemyInStart]
  });

  assert.throws(
    () =>
      applyMovePreview(state, {
        pieceId: 'P1-A',
        card: 'JACK',
        action: 'SWAP',
        from: 3,
        to: null,
        swapTargetPieceId: 'P2-A'
      }),
    /Cannot swap target piece that is not on board/
  );
});

test('Piece can enter home lane only after completed lap and with exact count', () => {
  const startIndexes = buildStartIndexes(4);

  const p1 = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    hasCompletedLap: true,
    position: 63
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    homeLanes: { P1: [0, 1, 2, 3] },
    homeEntryIndexes: { P1: 63 },
    pieces: [p1]
  });

  const moveOne = generateLegalMoves(state, 'P1', 'ACE').find((move) => move.steps === 1);
  assert.ok(moveOne);
  assert.equal(moveOne.toHomeIndex, 0);
  assert.equal(moveOne.to, null);

  const inHome = applyMovePreview(state, moveOne).pieces.find((piece) => piece.id === 'P1-A');
  assert.equal(inHome.isInHome, true);
  assert.equal(inHome.isOnBoard, false);
  assert.equal(inHome.homeIndex, 0);
});

test('Overshoot of home lane continues on track instead of entering home', () => {
  const startIndexes = buildStartIndexes(4);

  const p1 = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    hasCompletedLap: true,
    position: 63
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    homeLanes: { P1: [0, 1, 2, 3] },
    homeEntryIndexes: { P1: 63 },
    pieces: [p1]
  });

  const moveKing = generateLegalMoves(state, 'P1', 'KING')[0];
  assert.ok(moveKing);
  assert.equal(moveKing.toHomeIndex, null);
  assert.equal(moveKing.to, 12);
});

test('Seven split can distribute steps across multiple pieces', () => {
  const startIndexes = buildStartIndexes(4);

  const p1a = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 0
  };

  const p1b = {
    ...createPieceInStart('P1-B', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 10
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [p1a, p1b]
  });

  const sevenMoves = generateLegalMoves(state, 'P1', 'SEVEN');
  const hasSplit = sevenMoves.some((move) => move.action === 'SEVEN_SPLIT' && move.segments.length > 1);

  assert.equal(hasSplit, true);
});

test('Seven split knocks passed pieces (including allied pieces) back to start', () => {
  const startIndexes = buildStartIndexes(4);

  const mover = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 0
  };

  const allied = {
    ...createPieceInStart('P1-B', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 2
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [mover, allied]
  });

  const segment = {
    pieceId: 'P1-A',
    card: 'SEVEN',
    action: 'MOVE',
    from: 0,
    to: 4,
    steps: 4
  };

  const after = applyMovePreview(state, segment);
  const alliedAfter = after.pieces.find((piece) => piece.id === 'P1-B');
  assert.equal(alliedAfter.isInStart, true);
  assert.equal(alliedAfter.isOnBoard, false);
  assert.equal(alliedAfter.position, null);
});

test('Seven split has no legal routes when immune blocker is on every first step', () => {
  const startIndexes = buildStartIndexes(4);

  const p1a = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 0
  };

  const p1b = {
    ...createPieceInStart('P1-B', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 10
  };

  const immuneAheadA = {
    ...createPieceInStart('P2-A', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 1,
    isImmune: true
  };

  const immuneAheadB = {
    ...createPieceInStart('P2-B', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 11,
    isImmune: true
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [p1a, p1b, immuneAheadA, immuneAheadB]
  });

  const sevenMoves = generateLegalMoves(state, 'P1', 'SEVEN');
  assert.equal(sevenMoves.length, 0);
});

test('Must-play remains true when hand has exactly one obscure legal move', () => {
  const startIndexes = buildStartIndexes(4);

  const myOnBoard = {
    ...createPieceInStart('P1-A', 'P1'),
    isInStart: false,
    isOnBoard: true,
    position: 1
  };

  const enemyImmuneForwardOne = {
    ...createPieceInStart('P2-A', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 2,
    isImmune: true
  };

  const enemyImmuneForwardEleven = {
    ...createPieceInStart('P2-B', 'P2'),
    isInStart: false,
    isOnBoard: true,
    position: 12,
    isImmune: true
  };

  const state = buildState({
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * 4,
    startIndexes,
    pieces: [myOnBoard, enemyImmuneForwardOne, enemyImmuneForwardEleven]
  });

  const hand = ['ACE', 'KING', 'FOUR'];
  const result = evaluateHandPlayability(state, 'P1', hand);

  assert.equal(result.hasAnyLegalMove, true);
  assert.equal(result.perCardMoves.ACE.length, 0);
  assert.equal(result.perCardMoves.KING.length, 0);
  assert.equal(result.perCardMoves.FOUR.some((move) => move.steps === -4), true);
  assert.equal(result.perCardMoves.FOUR.some((move) => move.steps === 4), false);
});
