import test from 'node:test';
import assert from 'node:assert/strict';

import { createPieceInStart } from '../packages/shared-types/index.js';
import {
  detectWinner,
  getControllableOwnersForTurn,
  hasPlayerCompletedAllPiecesHome
} from '../packages/game-rules/phase2.js';

function buildPlayerPieces(playerId, homeCount) {
  const pieces = [];

  for (let i = 0; i < 4; i += 1) {
    const piece = createPieceInStart(`${playerId}-${i + 1}`, playerId);
    if (i < homeCount) {
      piece.isInStart = false;
      piece.isOnBoard = false;
      piece.isInHome = true;
      piece.homeIndex = i;
    }

    pieces.push(piece);
  }

  return pieces;
}

test('hasPlayerCompletedAllPiecesHome returns true only when all player pieces are home', () => {
  const pieces = [...buildPlayerPieces('P1', 4), ...buildPlayerPieces('P2', 1)];

  assert.equal(hasPlayerCompletedAllPiecesHome(pieces, 'P1'), true);
  assert.equal(hasPlayerCompletedAllPiecesHome(pieces, 'P2'), false);
  assert.equal(hasPlayerCompletedAllPiecesHome(pieces, 'UNKNOWN'), false);
});

test('getControllableOwnersForTurn keeps own pieces until player has all pieces home', () => {
  const pieces = [...buildPlayerPieces('P1', 3), ...buildPlayerPieces('P3', 1)];

  const controllable = getControllableOwnersForTurn({
    gameMode: 'teams',
    pieces,
    playerId: 'P1',
    teamByPlayerId: { P1: 1, P2: 2, P3: 1, P4: 2 }
  });

  assert.deepEqual(controllable, ['P1']);
});

test('getControllableOwnersForTurn switches to teammate pieces after all own pieces are home', () => {
  const pieces = [...buildPlayerPieces('P1', 4), ...buildPlayerPieces('P3', 2)];

  const controllable = getControllableOwnersForTurn({
    gameMode: 'teams',
    pieces,
    playerId: 'P1',
    teamByPlayerId: { P1: 1, P2: 2, P3: 1, P4: 2 }
  });

  assert.deepEqual(controllable, ['P3']);
});

test('detectWinner returns player winner in solo mode', () => {
  const pieces = [...buildPlayerPieces('P1', 4), ...buildPlayerPieces('P2', 3)];

  const winner = detectWinner({
    gameMode: 'solo',
    pieces,
    playerIds: ['P1', 'P2', 'P3', 'P4']
  });

  assert.deepEqual(winner, {
    winnerType: 'PLAYER',
    playerId: 'P1'
  });
});

test('detectWinner returns team winner in teams mode only when all team members are complete', () => {
  const teamByPlayerId = { P1: 1, P2: 2, P3: 1, P4: 2 };

  const noWinnerYet = detectWinner({
    gameMode: 'teams',
    pieces: [
      ...buildPlayerPieces('P1', 4),
      ...buildPlayerPieces('P3', 3),
      ...buildPlayerPieces('P2', 1),
      ...buildPlayerPieces('P4', 1)
    ],
    playerIds: ['P1', 'P2', 'P3', 'P4'],
    teamByPlayerId
  });

  assert.equal(noWinnerYet, null);

  const winner = detectWinner({
    gameMode: 'teams',
    pieces: [
      ...buildPlayerPieces('P1', 4),
      ...buildPlayerPieces('P3', 4),
      ...buildPlayerPieces('P2', 2),
      ...buildPlayerPieces('P4', 2)
    ],
    playerIds: ['P1', 'P2', 'P3', 'P4'],
    teamByPlayerId
  });

  assert.deepEqual(winner, {
    winnerType: 'TEAM',
    teamNo: 1
  });
});
