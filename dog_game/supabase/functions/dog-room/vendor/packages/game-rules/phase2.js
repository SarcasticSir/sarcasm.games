/**
 * @param {import('../shared-types/index.js').PieceState[]} pieces
 * @param {string} playerId
 */
export function hasPlayerCompletedAllPiecesHome(pieces, playerId) {
  const owned = pieces.filter((piece) => piece.ownerId === playerId);
  if (owned.length === 0) {
    return false;
  }

  return owned.every((piece) => piece.isInHome === true);
}

/**
 * @param {{
 *  gameMode: 'solo'|'teams',
 *  pieces: import('../shared-types/index.js').PieceState[],
 *  playerId: string,
 *  teamByPlayerId?: Record<string, number>
 * }} params
 */
export function getControllableOwnersForTurn(params) {
  const { gameMode, pieces, playerId, teamByPlayerId = {} } = params;

  if (gameMode !== 'teams') {
    return [playerId];
  }

  const playerTeam = teamByPlayerId[playerId];
  if (playerTeam === undefined) {
    throw new Error(`Missing team mapping for player: ${playerId}`);
  }

  const ownComplete = hasPlayerCompletedAllPiecesHome(pieces, playerId);
  if (!ownComplete) {
    return [playerId];
  }

  return Object.keys(teamByPlayerId).filter(
    (candidatePlayerId) => candidatePlayerId !== playerId && teamByPlayerId[candidatePlayerId] === playerTeam
  );
}

/**
 * @param {{
 *  gameMode: 'solo'|'teams',
 *  pieces: import('../shared-types/index.js').PieceState[],
 *  playerIds: string[],
 *  teamByPlayerId?: Record<string, number>
 * }} params
 */
export function detectWinner(params) {
  const { gameMode, pieces, playerIds, teamByPlayerId = {} } = params;

  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    throw new Error('playerIds must include at least one player');
  }

  if (gameMode === 'solo') {
    for (const playerId of playerIds) {
      if (hasPlayerCompletedAllPiecesHome(pieces, playerId)) {
        return {
          winnerType: 'PLAYER',
          playerId
        };
      }
    }

    return null;
  }

  const teamNos = [...new Set(playerIds.map((playerId) => teamByPlayerId[playerId]))];
  for (const teamNo of teamNos) {
    if (teamNo === undefined) {
      throw new Error('Missing team mapping for one or more players');
    }

    const members = playerIds.filter((playerId) => teamByPlayerId[playerId] === teamNo);
    const allHome = members.every((playerId) => hasPlayerCompletedAllPiecesHome(pieces, playerId));

    if (allHome) {
      return {
        winnerType: 'TEAM',
        teamNo
      };
    }
  }

  return null;
}
