// dog_game/supabase/functions/dog-room/vendor/packages/shared-types/index.js
var CARD_RANKS = Object.freeze([
  "ACE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "JACK",
  "QUEEN",
  "KING",
  "JOKER"
]);
function createPieceInStart(id, ownerId) {
  return {
    id,
    ownerId,
    position: null,
    isInStart: true,
    isOnBoard: false,
    isInHome: false,
    isImmune: false,
    hasCompletedLap: false,
    homeIndex: null
  };
}

// dog_game/supabase/functions/dog-room/vendor/packages/game-rules/index.js
var TRACK_SPACES_BETWEEN_PLAYERS = 16;
function wrap(value, trackLength) {
  return (value % trackLength + trackLength) % trackLength;
}
function getHomeLane(state, playerId) {
  return state.homeLanes?.[playerId] ?? [];
}
function getHomeEntrySquare(state, playerId) {
  if (state.homeEntryIndexes?.[playerId] !== void 0) {
    return state.homeEntryIndexes[playerId];
  }
  const start = state.startIndexes[playerId];
  if (start === void 0) {
    return void 0;
  }
  return wrap(start - 1, state.trackLength);
}
function getStepValues(card) {
  switch (card) {
    case "ACE":
      return [1, 11];
    case "FOUR":
      return [4, -4];
    case "KING":
      return [13];
    case "SEVEN":
      return [7];
    case "TWO":
      return [2];
    case "THREE":
      return [3];
    case "FIVE":
      return [5];
    case "SIX":
      return [6];
    case "EIGHT":
      return [8];
    case "NINE":
      return [9];
    case "TEN":
      return [10];
    case "QUEEN":
      return [12];
    default:
      return [];
  }
}
function canExitStart(card) {
  return card === "ACE" || card === "KING";
}
function findPiece(state, pieceId) {
  return state.pieces.find((piece) => piece.id === pieceId);
}
function pieceAtSquare(state, square, skipPieceId) {
  return state.pieces.find((piece) => piece.id !== skipPieceId && piece.isOnBoard && piece.position === square);
}
function pieceAtHomeIndex(state, ownerId, homeIndex, skipPieceId) {
  return state.pieces.find(
    (piece) => piece.id !== skipPieceId && piece.ownerId === ownerId && piece.isInHome && piece.homeIndex === homeIndex
  );
}
function sendOccupantToStartIfPresent(state, square, movingPieceId) {
  if (square === null || square === void 0) {
    return;
  }
  const occupant = pieceAtSquare(state, square, movingPieceId);
  if (!occupant) {
    return;
  }
  if (occupant.isImmune) {
    throw new Error(`Cannot knock immune piece: ${occupant.id}`);
  }
  occupant.position = null;
  occupant.isInStart = true;
  occupant.isOnBoard = false;
  occupant.isInHome = false;
  occupant.homeIndex = null;
  occupant.isImmune = false;
  occupant.hasCompletedLap = false;
}
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
function resolveForwardMove(state, piece, steps) {
  const startSquare = state.startIndexes[piece.ownerId];
  const homeLane = getHomeLane(state, piece.ownerId);
  const homeEntrySquare = getHomeEntrySquare(state, piece.ownerId);
  if (piece.isInHome) {
    const targetHomeIndex = (piece.homeIndex ?? 0) + steps;
    if (targetHomeIndex >= homeLane.length) {
      return null;
    }
    if (pieceAtHomeIndex(state, piece.ownerId, targetHomeIndex, piece.id)) {
      return null;
    }
    return {
      to: null,
      toHomeIndex: targetHomeIndex,
      hasCompletedLap: piece.hasCompletedLap
    };
  }
  if (!piece.isOnBoard || piece.position === null) {
    return null;
  }
  let currentPosition = piece.position;
  let hasCompletedLap = piece.hasCompletedLap;
  for (let step = 1; step <= steps; step += 1) {
    if (hasCompletedLap && homeLane.length > 0 && currentPosition === homeEntrySquare) {
      const targetHomeIndex = steps - step;
      if (targetHomeIndex >= homeLane.length) {
        break;
      }
      if (pieceAtHomeIndex(state, piece.ownerId, targetHomeIndex, piece.id)) {
        return null;
      }
      return {
        to: null,
        toHomeIndex: targetHomeIndex,
        hasCompletedLap
      };
    }
    currentPosition = wrap(currentPosition + 1, state.trackLength);
    if (currentPosition === startSquare && !piece.isInStart) {
      hasCompletedLap = true;
    }
    const occupant = pieceAtSquare(state, currentPosition, piece.id);
    if (occupant?.isImmune) {
      return null;
    }
  }
  return {
    to: wrap(piece.position + steps, state.trackLength),
    toHomeIndex: null,
    hasCompletedLap
  };
}
function resolveStandardMove(state, piece, steps) {
  if (steps > 0) {
    return resolveForwardMove(state, piece, steps);
  }
  if (piece.isInHome) {
    return null;
  }
  if (!piece.isOnBoard || piece.position === null) {
    return null;
  }
  if (isPathBlockedByImmune(state, piece.position, steps, piece.id)) {
    return null;
  }
  const destination = wrap(piece.position + steps, state.trackLength);
  const occupant = pieceAtSquare(state, destination, piece.id);
  if (occupant?.isImmune) {
    return null;
  }
  return {
    to: destination,
    toHomeIndex: null,
    hasCompletedLap: piece.hasCompletedLap
  };
}
function stepSevenSegment(state, piece, steps) {
  if (steps <= 0) {
    return null;
  }
  if (!piece.isOnBoard || piece.position === null || piece.isInHome) {
    return null;
  }
  const startSquare = state.startIndexes[piece.ownerId];
  const homeLane = getHomeLane(state, piece.ownerId);
  const homeEntrySquare = getHomeEntrySquare(state, piece.ownerId);
  let currentPosition = piece.position;
  let hasCompletedLap = piece.hasCompletedLap;
  for (let step = 1; step <= steps; step += 1) {
    if (hasCompletedLap && homeLane.length > 0 && currentPosition === homeEntrySquare) {
      const targetHomeIndex = steps - step;
      if (targetHomeIndex >= homeLane.length) {
        break;
      }
      if (pieceAtHomeIndex(state, piece.ownerId, targetHomeIndex, piece.id)) {
        return null;
      }
      return {
        pieceId: piece.id,
        card: "SEVEN",
        action: "MOVE",
        from: piece.position,
        to: null,
        toHomeIndex: targetHomeIndex,
        steps,
        hasCompletedLap
      };
    }
    currentPosition = wrap(currentPosition + 1, state.trackLength);
    if (currentPosition === startSquare && !piece.isInStart) {
      hasCompletedLap = true;
    }
    const occupant = pieceAtSquare(state, currentPosition, piece.id);
    if (occupant?.isImmune) {
      return null;
    }
  }
  return {
    pieceId: piece.id,
    card: "SEVEN",
    action: "MOVE",
    from: piece.position,
    to: currentPosition,
    toHomeIndex: null,
    steps,
    hasCompletedLap
  };
}
function generateSevenSplitMoves(state, playerId, controllableOwnerIds = [playerId]) {
  const controllable = new Set(controllableOwnerIds);
  const ownMovers = state.pieces.filter(
    (piece) => controllable.has(piece.ownerId) && piece.isOnBoard && piece.position !== null && !piece.isInHome
  );
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  function walk(currentState, remaining, segments) {
    if (remaining === 0) {
      if (segments.length === 0) {
        return;
      }
      const key = segments.map((segment) => `${segment.pieceId}:${segment.from}->${segment.to ?? `H${segment.toHomeIndex}`}:${segment.steps}`).join("|");
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          pieceId: segments[0].pieceId,
          card: "SEVEN",
          action: "SEVEN_SPLIT",
          from: segments[0].from,
          to: segments[segments.length - 1].to,
          steps: 7,
          segments: segments.map((segment) => ({
            pieceId: segment.pieceId,
            from: segment.from,
            to: segment.to,
            toHomeIndex: segment.toHomeIndex,
            steps: segment.steps
          }))
        });
      }
      return;
    }
    const candidatePieces = currentState.pieces.filter(
      (piece) => controllable.has(piece.ownerId) && piece.isOnBoard && piece.position !== null && !piece.isInHome
    );
    for (const candidate of candidatePieces) {
      for (let spend = 1; spend <= remaining; spend += 1) {
        const move = stepSevenSegment(currentState, candidate, spend);
        if (!move) {
          continue;
        }
        const advancedState = applyMovePreview(currentState, move);
        walk(advancedState, remaining - spend, [...segments, move]);
      }
    }
  }
  if (ownMovers.length > 0) {
    walk(state, 7, []);
  }
  return results.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function generateLegalMoves(state, playerId, card, controllableOwnerIds = [playerId]) {
  if (!CARD_RANKS.includes(card)) {
    throw new Error(`Unknown card: ${card}`);
  }
  if (card === "JOKER") {
    return generateJokerOptions(state, playerId, controllableOwnerIds);
  }
  if (card === "SEVEN") {
    return generateSevenSplitMoves(state, playerId, controllableOwnerIds);
  }
  const options = [];
  const controllable = new Set(controllableOwnerIds);
  const ownPieces = state.pieces.filter((piece) => controllable.has(piece.ownerId));
  for (const piece of ownPieces) {
    if (piece.isInHome && !piece.isOnBoard) {
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
            action: "EXIT_START",
            from: null,
            to: startSquare
          });
        }
      }
      continue;
    }
    for (const steps of getStepValues(card)) {
      if (steps === 0) {
        continue;
      }
      const resolved = resolveStandardMove(state, piece, steps);
      if (!resolved) {
        continue;
      }
      options.push({
        pieceId: piece.id,
        card,
        action: "MOVE",
        from: piece.isOnBoard ? piece.position : null,
        to: resolved.to,
        toHomeIndex: resolved.toHomeIndex,
        steps
      });
    }
  }
  if (card === "JACK") {
    return generateJackSwapOptions(state, playerId, controllableOwnerIds);
  }
  return options.sort((a, b) => {
    if (a.pieceId !== b.pieceId) {
      return a.pieceId.localeCompare(b.pieceId);
    }
    if ((a.toHomeIndex ?? -1) !== (b.toHomeIndex ?? -1)) {
      return (a.toHomeIndex ?? -1) - (b.toHomeIndex ?? -1);
    }
    return (a.steps ?? 0) - (b.steps ?? 0);
  });
}
function generateJokerOptions(state, playerId, controllableOwnerIds = [playerId]) {
  const mirroredCards = CARD_RANKS.filter((rank) => rank !== "JOKER");
  const uniqueMoves = /* @__PURE__ */ new Map();
  for (const mirroredCard of mirroredCards) {
    const moves = generateLegalMoves(state, playerId, mirroredCard, controllableOwnerIds);
    for (const move of moves) {
      const jokerMove = {
        ...move,
        card: "JOKER"
      };
      const key = JSON.stringify(jokerMove);
      uniqueMoves.set(key, jokerMove);
    }
  }
  return [...uniqueMoves.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function generateJackSwapOptions(state, playerId, controllableOwnerIds = [playerId]) {
  const controllable = new Set(controllableOwnerIds);
  const ownOnBoard = state.pieces.filter(
    (piece) => controllable.has(piece.ownerId) && piece.isOnBoard && piece.position !== null && !piece.isImmune
  );
  const targets = state.pieces.filter(
    (piece) => !controllable.has(piece.ownerId) && piece.isOnBoard && piece.position !== null && !piece.isImmune
  );
  const options = [];
  for (const mine of ownOnBoard) {
    for (const target of targets) {
      options.push({
        pieceId: mine.id,
        card: "JACK",
        action: "SWAP",
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
function buildStartIndexes(playerCount) {
  const startIndexes = {};
  for (let seat = 0; seat < playerCount; seat += 1) {
    startIndexes[`P${seat + 1}`] = seat * TRACK_SPACES_BETWEEN_PLAYERS;
  }
  return startIndexes;
}
function evaluateHandPlayability(state, playerId, hand, controllableOwnerIds = [playerId]) {
  const perCardMoves = {};
  let hasAnyLegalMove = false;
  for (const card of hand) {
    const moves = generateLegalMoves(state, playerId, card, controllableOwnerIds);
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
function applyMovePreview(state, move) {
  const nextState = {
    ...state,
    pieces: state.pieces.map((piece) => ({ ...piece }))
  };
  const movingPiece = findPiece(nextState, move.pieceId);
  if (!movingPiece) {
    throw new Error(`Unknown piece: ${move.pieceId}`);
  }
  if (move.action === "SEVEN_SPLIT") {
    if (!move.segments || !Array.isArray(move.segments) || move.segments.length === 0) {
      throw new Error("segments are required for SEVEN_SPLIT move");
    }
    let intermediateState = nextState;
    for (const segment of move.segments) {
      intermediateState = applyMovePreview(intermediateState, {
        ...segment,
        card: "SEVEN",
        action: "MOVE"
      });
    }
    return intermediateState;
  }
  if (move.action === "EXIT_START") {
    sendOccupantToStartIfPresent(nextState, move.to, movingPiece.id);
    movingPiece.isInStart = false;
    movingPiece.isOnBoard = true;
    movingPiece.isInHome = false;
    movingPiece.homeIndex = null;
    movingPiece.position = move.to;
    movingPiece.isImmune = true;
    return nextState;
  }
  if (move.action === "MOVE") {
    if (move.toHomeIndex !== null && move.toHomeIndex !== void 0) {
      movingPiece.position = null;
      movingPiece.isOnBoard = false;
      movingPiece.isInHome = true;
      movingPiece.homeIndex = move.toHomeIndex;
      movingPiece.isImmune = false;
      movingPiece.hasCompletedLap = true;
      return nextState;
    }
    if (move.card === "SEVEN" && move.steps > 0 && move.from !== null && move.from !== void 0 && move.to !== null) {
      for (let offset = 1; offset < move.steps; offset += 1) {
        const passSquare = wrap(move.from + offset, nextState.trackLength);
        sendOccupantToStartIfPresent(nextState, passSquare, movingPiece.id);
      }
    }
    sendOccupantToStartIfPresent(nextState, move.to, movingPiece.id);
    movingPiece.position = move.to;
    movingPiece.isOnBoard = true;
    movingPiece.isInHome = false;
    movingPiece.homeIndex = null;
    movingPiece.isImmune = false;
    const startSquare = nextState.startIndexes[movingPiece.ownerId];
    if (move.from !== null && move.from !== void 0 && move.to !== null && move.to !== void 0 && move.steps > 0) {
      const distanceToStart = wrap(startSquare - move.from, nextState.trackLength);
      if (distanceToStart > 0 && move.steps >= distanceToStart) {
        movingPiece.hasCompletedLap = true;
      }
    }
    return nextState;
  }
  if (move.action === "SWAP") {
    if (!move.swapTargetPieceId) {
      throw new Error("swapTargetPieceId is required for SWAP move");
    }
    const targetPiece = findPiece(nextState, move.swapTargetPieceId);
    if (!targetPiece) {
      throw new Error(`Unknown target piece: ${move.swapTargetPieceId}`);
    }
    if (!movingPiece.isOnBoard || movingPiece.position === null) {
      throw new Error(`Cannot swap piece that is not on board: ${movingPiece.id}`);
    }
    if (!targetPiece.isOnBoard || targetPiece.position === null) {
      throw new Error(`Cannot swap target piece that is not on board: ${targetPiece.id}`);
    }
    if (movingPiece.isImmune || targetPiece.isImmune) {
      throw new Error("Cannot swap immune piece");
    }
    const from = movingPiece.position;
    movingPiece.position = targetPiece.position;
    targetPiece.position = from;
    return nextState;
  }
  throw new Error(`Unsupported action: ${move.action}`);
}

// dog_game/supabase/functions/dog-room/vendor/packages/game-rules/phase2.js
function hasPlayerCompletedAllPiecesHome(pieces, playerId) {
  const owned = pieces.filter((piece) => piece.ownerId === playerId);
  if (owned.length === 0) {
    return false;
  }
  return owned.every((piece) => piece.isInHome === true);
}
function getControllableOwnersForTurn(params) {
  const { gameMode, pieces, playerId, teamByPlayerId = {} } = params;
  if (gameMode !== "teams") {
    return [playerId];
  }
  const playerTeam = teamByPlayerId[playerId];
  if (playerTeam === void 0) {
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
function detectWinner(params) {
  const { gameMode, pieces, playerIds, teamByPlayerId = {} } = params;
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    throw new Error("playerIds must include at least one player");
  }
  if (gameMode === "solo") {
    for (const playerId of playerIds) {
      if (hasPlayerCompletedAllPiecesHome(pieces, playerId)) {
        return {
          winnerType: "PLAYER",
          playerId
        };
      }
    }
    return null;
  }
  const teamNos = [...new Set(playerIds.map((playerId) => teamByPlayerId[playerId]))];
  for (const teamNo of teamNos) {
    if (teamNo === void 0) {
      throw new Error("Missing team mapping for one or more players");
    }
    const members = playerIds.filter((playerId) => teamByPlayerId[playerId] === teamNo);
    const allHome = members.every((playerId) => hasPlayerCompletedAllPiecesHome(pieces, playerId));
    if (allHome) {
      return {
        winnerType: "TEAM",
        teamNo
      };
    }
  }
  return null;
}

// dog_game/supabase/functions/dog-room/vendor/packages/game-rules/deck.js
var SUITS = ["SPADES", "HEARTS", "DIAMONDS", "CLUBS"];
var BASE_RANKS = ["ACE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "JACK", "QUEEN", "KING"];
function createSeededRng(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = state * 1664525 + 1013904223 >>> 0;
    return state / 4294967296;
  };
}
function getDeckCountForPlayers(playerCount) {
  if (playerCount < 4) {
    throw new Error("Dog game requires at least 4 players");
  }
  return playerCount === 4 ? 2 : 3;
}
function buildDeckCards(deckCount) {
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
    cards.push({ id: `D${deckNo}-JOKER-1`, rank: "JOKER", suit: null });
    cards.push({ id: `D${deckNo}-JOKER-2`, rank: "JOKER", suit: null });
  }
  return cards;
}
function shuffleDeterministic(cards, seed) {
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
function createDeckState(playerCount, seed = 1) {
  const deckCount = getDeckCountForPlayers(playerCount);
  const cards = buildDeckCards(deckCount);
  return {
    drawPile: shuffleDeterministic(cards, seed),
    discardPile: []
  };
}
function getHandSizeForRound(roundNumber) {
  if (roundNumber < 1) {
    throw new Error("roundNumber must be >= 1");
  }
  const cycle = [6, 5, 4, 3, 2];
  return cycle[(roundNumber - 1) % cycle.length];
}
function dealRoundHands(deckState, playerIds, roundNumber, reshuffleSeed = 1) {
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    throw new Error("playerIds must contain at least one player");
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
function applyTeamCardExchange(hands, teamByPlayerId, exchanges) {
  if (!Array.isArray(exchanges) || exchanges.length === 0) {
    throw new Error("exchanges must include one action per team player");
  }
  const players = Object.keys(teamByPlayerId);
  if (players.length === 0) {
    throw new Error("teamByPlayerId must include at least one player");
  }
  const outgoingByPlayer = /* @__PURE__ */ new Map();
  const incomingCountByPlayer = new Map(players.map((playerId) => [playerId, 0]));
  for (const action of exchanges) {
    const { fromPlayerId, toPlayerId, cardId } = action;
    if (!(fromPlayerId in teamByPlayerId) || !(toPlayerId in teamByPlayerId)) {
      throw new Error("Exchange action references unknown player");
    }
    if (fromPlayerId === toPlayerId) {
      throw new Error("Player cannot exchange a card with themselves");
    }
    if (teamByPlayerId[fromPlayerId] !== teamByPlayerId[toPlayerId]) {
      throw new Error("Exchange can only happen between teammates");
    }
    if (outgoingByPlayer.has(fromPlayerId)) {
      throw new Error("Each player must send exactly one card");
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
    throw new Error("Each player must submit exactly one exchange action");
  }
  for (const playerId of players) {
    if ((incomingCountByPlayer.get(playerId) ?? 0) !== 1) {
      throw new Error("Each player must receive exactly one exchanged card");
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
function drawCards(deckState, count, reshuffleSeed = 1) {
  if (count < 0) {
    throw new Error("count must be >= 0");
  }
  const nextState = {
    drawPile: [...deckState.drawPile],
    discardPile: [...deckState.discardPile]
  };
  const drawn = [];
  while (drawn.length < count) {
    if (nextState.drawPile.length === 0) {
      if (nextState.discardPile.length === 0) {
        throw new Error("Cannot draw cards: both draw pile and discard pile are empty");
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
function discardCards(deckState, cards) {
  return {
    drawPile: [...deckState.drawPile],
    discardPile: [...deckState.discardPile, ...cards]
  };
}

// dog_game/supabase/functions/dog-room/vendor/services/realtime-server/room-engine.js
function clone(value) {
  return structuredClone(value);
}
function deriveMaxPlayers(config) {
  return config.teamCount * config.playersPerTeam;
}
function assertVersion(state, expectedVersion) {
  if (expectedVersion === void 0) {
    return;
  }
  if (state.version !== expectedVersion) {
    throw new Error(`Version mismatch: expected ${expectedVersion}, actual ${state.version}`);
  }
}
function withVersionBump(state) {
  return {
    ...state,
    version: state.version + 1
  };
}
function ensureUniqueSeat(players, seatNo) {
  if (players.some((player) => player.seatNo === seatNo)) {
    throw new Error(`Seat ${seatNo} is already occupied`);
  }
}
function seatFromTeamSlot(teamNo, slotInTeam, teamCount) {
  return (slotInTeam - 1) * teamCount + teamNo;
}
function sortPlayersBySeat(players) {
  return [...players].sort((a, b) => a.seatNo - b.seatNo);
}
function assertMatchPhase(state, phase) {
  if (state.status !== "active") {
    throw new Error("Match is not active");
  }
  if (state.match.phase !== phase) {
    throw new Error(`Match phase is ${state.match.phase}, expected ${phase}`);
  }
}
function assertActiveTurn(state, playerId) {
  assertMatchPhase(state, "play");
  const activePlayerId = state.match.turnOrder[state.match.turnIndex];
  if (activePlayerId !== playerId) {
    throw new Error(`Not your turn: active player is ${activePlayerId}`);
  }
}
function findCardIndexByRank(hand, rank) {
  return hand.findIndex((card) => card.rank === rank);
}
function findCardById(hand, cardId) {
  return hand.find((card) => card.id === cardId);
}
function buildInitialPieces(playerIds) {
  const pieces = [];
  for (const playerId of playerIds) {
    for (let i = 1; i <= 4; i += 1) {
      pieces.push(createPieceInStart(`${playerId}-${i}`, playerId));
    }
  }
  return pieces;
}
function buildGameStateFromPlayers(players) {
  const ordered = sortPlayersBySeat(players);
  const playerIds = ordered.map((player) => player.playerId);
  return {
    trackLength: TRACK_SPACES_BETWEEN_PLAYERS * playerIds.length,
    startIndexes: buildStartIndexes(playerIds.length),
    pieces: buildInitialPieces(playerIds)
  };
}
function getTeamByPlayerId(players) {
  const map = {};
  for (const player of players) {
    map[player.playerId] = player.teamNo;
  }
  return map;
}
function buildRoundState(room, deckState, roundNumber) {
  const ordered = sortPlayersBySeat(room.players);
  const turnOrder = ordered.map((player) => player.playerId);
  const dealt = dealRoundHands(deckState, turnOrder, roundNumber, 100 + roundNumber);
  return {
    turnOrder,
    turnIndex: 0,
    roundNumber,
    handsByPlayerId: dealt.hands,
    deckState: dealt.deckState,
    blockedPlayerIds: [],
    pendingPreview: null,
    pendingExchangeByPlayerId: {},
    phase: room.config.gameMode === "teams" ? "exchange" : "play"
  };
}
function createMatch(room) {
  const ordered = sortPlayersBySeat(room.players);
  const playerIds = ordered.map((player) => player.playerId);
  const deckState = createDeckState(playerIds.length, 1);
  const roundState = buildRoundState(room, deckState, 1);
  return {
    ...roundState,
    gameState: buildGameStateFromPlayers(ordered),
    winner: null
  };
}
function withIdempotency(state, idempotencyKey, executor) {
  if (!idempotencyKey) {
    return executor();
  }
  if (state.idempotency[idempotencyKey]) {
    return {
      state,
      response: clone(state.idempotency[idempotencyKey])
    };
  }
  const result = executor();
  const nextState = {
    ...result.state,
    idempotency: {
      ...result.state.idempotency,
      [idempotencyKey]: clone(result.response)
    }
  };
  return {
    state: nextState,
    response: result.response
  };
}
function hasAnyLegalMoveForPlayer(state, match, playerId) {
  const hand = (match.handsByPlayerId[playerId] ?? []).map((card) => card.rank);
  const controllableOwners = getControllableOwnersForTurn({
    gameMode: state.config.gameMode,
    pieces: match.gameState.pieces,
    playerId,
    teamByPlayerId: getTeamByPlayerId(state.players)
  });
  return evaluateHandPlayability(match.gameState, playerId, hand, controllableOwners).hasAnyLegalMove;
}
function allHandsEmpty(match) {
  return Object.values(match.handsByPlayerId).every((hand) => hand.length === 0);
}
function collectAllHandCards(handsByPlayerId) {
  return Object.values(handsByPlayerId).flatMap((hand) => hand ?? []);
}
function resolveTurnProgressAfterAction(state) {
  let nextState = state;
  if (allHandsEmpty(nextState.match)) {
    nextState = withVersionBump(startNextRound(nextState));
    return {
      state: nextState,
      response: {
        ok: true,
        roundAdvanced: true,
        phase: nextState.match.phase,
        version: nextState.version
      }
    };
  }
  const turnResolution = advanceToNextPlayableTurn(nextState, nextState.match);
  if (turnResolution.allBlocked) {
    nextState = withVersionBump(startNextRound(nextState));
    return {
      state: nextState,
      response: {
        ok: true,
        roundAdvanced: true,
        phase: nextState.match.phase,
        version: nextState.version
      }
    };
  }
  nextState = withVersionBump({
    ...nextState,
    match: {
      ...nextState.match,
      turnIndex: turnResolution.turnIndex,
      blockedPlayerIds: turnResolution.blockedPlayerIds
    }
  });
  return {
    state: nextState,
    response: {
      ok: true,
      nextPlayerId: nextState.match.turnOrder[nextState.match.turnIndex],
      blockedPlayerIds: nextState.match.blockedPlayerIds,
      version: nextState.version
    }
  };
}
function startNextRound(state) {
  const nextRoundNumber = state.match.roundNumber + 1;
  const carryOverCards = collectAllHandCards(state.match.handsByPlayerId);
  const deckStateWithCarryOver = carryOverCards.length ? discardCards(state.match.deckState, carryOverCards) : state.match.deckState;
  const nextRound = buildRoundState(state, deckStateWithCarryOver, nextRoundNumber);
  return {
    ...state,
    match: {
      ...state.match,
      ...nextRound
    }
  };
}
function advanceToNextPlayableTurn(state, match) {
  const blocked = new Set(match.blockedPlayerIds);
  let turnIndex = match.turnIndex;
  for (let i = 0; i < match.turnOrder.length; i += 1) {
    const playerId = match.turnOrder[turnIndex];
    if (blocked.has(playerId)) {
      turnIndex = (turnIndex + 1) % match.turnOrder.length;
      continue;
    }
    const canAct = hasAnyLegalMoveForPlayer(state, { ...match, turnIndex }, playerId);
    if (canAct) {
      return {
        turnIndex,
        blockedPlayerIds: [...blocked],
        allBlocked: false
      };
    }
    blocked.add(playerId);
    turnIndex = (turnIndex + 1) % match.turnOrder.length;
  }
  return {
    turnIndex,
    blockedPlayerIds: [...blocked],
    allBlocked: true
  };
}
function buildExchangeActions(room, pendingExchangeByPlayerId) {
  const playersByTeam = /* @__PURE__ */ new Map();
  for (const player of sortPlayersBySeat(room.players)) {
    if (!playersByTeam.has(player.teamNo)) {
      playersByTeam.set(player.teamNo, []);
    }
    playersByTeam.get(player.teamNo).push(player);
  }
  const exchanges = [];
  for (const teamPlayers of playersByTeam.values()) {
    for (let i = 0; i < teamPlayers.length; i += 1) {
      const from = teamPlayers[i];
      const to = teamPlayers[(i + 1) % teamPlayers.length];
      exchanges.push({
        fromPlayerId: from.playerId,
        toPlayerId: to.playerId,
        cardId: pendingExchangeByPlayerId[from.playerId]
      });
    }
  }
  return exchanges;
}
function createRoom(command) {
  const {
    roomId,
    hostPlayerId,
    gameMode = "solo",
    teamCount = 4,
    playersPerTeam = 1,
    idempotencyKey
  } = command;
  const config = { gameMode, teamCount, playersPerTeam };
  const maxPlayers = deriveMaxPlayers(config);
  if (maxPlayers < 4 || maxPlayers > 8) {
    throw new Error("Room size must be between 4 and 8 players");
  }
  const host = {
    playerId: hostPlayerId,
    teamNo: 1,
    slotInTeam: 1,
    seatNo: seatFromTeamSlot(1, 1, teamCount),
    ready: false,
    connected: true
  };
  const state = {
    roomId,
    config,
    maxPlayers,
    status: "lobby",
    version: 1,
    players: [host],
    match: null,
    idempotency: {},
    hostPlayerId
  };
  if (idempotencyKey) {
    state.idempotency[idempotencyKey] = { ok: true, roomId, version: state.version };
  }
  return state;
}
function handleJoinRoom(state, command) {
  const { playerId, teamNo, slotInTeam } = command;
  if (state.status !== "lobby") {
    throw new Error("Cannot join after match start");
  }
  if (state.players.some((player) => player.playerId === playerId)) {
    return {
      state,
      response: { ok: true, joined: false, reason: "already_joined", version: state.version }
    };
  }
  if (state.players.length >= state.maxPlayers) {
    throw new Error("Room is full");
  }
  if (teamNo < 1 || teamNo > state.config.teamCount) {
    throw new Error("teamNo out of bounds");
  }
  if (slotInTeam < 1 || slotInTeam > state.config.playersPerTeam) {
    throw new Error("slotInTeam out of bounds");
  }
  if (state.players.some((player) => player.teamNo === teamNo && player.slotInTeam === slotInTeam)) {
    throw new Error("Team slot already occupied");
  }
  const seatNo = seatFromTeamSlot(teamNo, slotInTeam, state.config.teamCount);
  ensureUniqueSeat(state.players, seatNo);
  const nextState = withVersionBump({
    ...state,
    players: [
      ...state.players,
      {
        playerId,
        teamNo,
        slotInTeam,
        seatNo,
        ready: false,
        connected: true
      }
    ]
  });
  return {
    state: nextState,
    response: { ok: true, joined: true, seatNo, version: nextState.version }
  };
}
function handleSetReady(state, command) {
  const { playerId, isReady } = command;
  if (state.status !== "lobby") {
    throw new Error("Cannot set ready after match start");
  }
  const playerIndex = state.players.findIndex((player) => player.playerId === playerId);
  if (playerIndex < 0) {
    throw new Error("Player not in room");
  }
  const players = [...state.players];
  players[playerIndex] = {
    ...players[playerIndex],
    ready: Boolean(isReady)
  };
  const nextState = withVersionBump({ ...state, players });
  return {
    state: nextState,
    response: { ok: true, version: nextState.version }
  };
}
function handleStartMatch(state, command) {
  const { playerId } = command;
  if (state.status !== "lobby") {
    throw new Error("Match already started");
  }
  if (state.hostPlayerId !== playerId) {
    throw new Error("Only host can start match");
  }
  if (state.players.length !== state.maxPlayers) {
    throw new Error("Room is not full");
  }
  if (state.players.some((player) => player.ready !== true)) {
    throw new Error("All players must be ready");
  }
  const match = createMatch(state);
  const nextState = withVersionBump({
    ...state,
    status: "active",
    match
  });
  return {
    state: nextState,
    response: {
      ok: true,
      started: true,
      phase: match.phase,
      activePlayerId: match.turnOrder[match.turnIndex],
      version: nextState.version
    }
  };
}
function handleExchangeCard(state, command) {
  const { playerId, cardId } = command;
  assertMatchPhase(state, "exchange");
  if (!state.match.turnOrder.includes(playerId)) {
    throw new Error("Player is not part of active match");
  }
  const hand = state.match.handsByPlayerId[playerId] ?? [];
  if (!findCardById(hand, cardId)) {
    throw new Error(`Card ${cardId} not in hand`);
  }
  const pendingExchangeByPlayerId = {
    ...state.match.pendingExchangeByPlayerId,
    [playerId]: cardId
  };
  const playerCount = state.match.turnOrder.length;
  const hasAllSelections = Object.keys(pendingExchangeByPlayerId).length === playerCount;
  if (!hasAllSelections) {
    const nextState2 = withVersionBump({
      ...state,
      match: {
        ...state.match,
        pendingExchangeByPlayerId
      }
    });
    return {
      state: nextState2,
      response: {
        ok: true,
        exchangeCompleted: false,
        waitingFor: playerCount - Object.keys(pendingExchangeByPlayerId).length,
        version: nextState2.version
      }
    };
  }
  const teamByPlayerId = getTeamByPlayerId(state.players);
  const exchanges = buildExchangeActions(state, pendingExchangeByPlayerId);
  const exchangedHands = applyTeamCardExchange(state.match.handsByPlayerId, teamByPlayerId, exchanges);
  const nextState = withVersionBump({
    ...state,
    match: {
      ...state.match,
      handsByPlayerId: exchangedHands,
      pendingExchangeByPlayerId: {},
      phase: "play"
    }
  });
  return {
    state: nextState,
    response: {
      ok: true,
      exchangeCompleted: true,
      phase: "play",
      activePlayerId: nextState.match.turnOrder[nextState.match.turnIndex],
      version: nextState.version
    }
  };
}
function handleRequestLegalMoves(state, command) {
  const { playerId, card } = command;
  assertActiveTurn(state, playerId);
  const hand = state.match.handsByPlayerId[playerId] ?? [];
  if (findCardIndexByRank(hand, card) < 0) {
    throw new Error(`Card ${card} not in hand`);
  }
  const controllableOwners = getControllableOwnersForTurn({
    gameMode: state.config.gameMode,
    pieces: state.match.gameState.pieces,
    playerId,
    teamByPlayerId: getTeamByPlayerId(state.players)
  });
  const moves = generateLegalMoves(state.match.gameState, playerId, card, controllableOwners);
  return {
    state,
    response: { ok: true, moves, card, version: state.version }
  };
}
function normalizeMove(move) {
  return JSON.stringify(move);
}
function handleStartMovePreview(state, command) {
  const { playerId, card, move } = command;
  assertActiveTurn(state, playerId);
  const hand = state.match.handsByPlayerId[playerId] ?? [];
  if (findCardIndexByRank(hand, card) < 0) {
    throw new Error(`Card ${card} not in hand`);
  }
  const controllableOwners = getControllableOwnersForTurn({
    gameMode: state.config.gameMode,
    pieces: state.match.gameState.pieces,
    playerId,
    teamByPlayerId: getTeamByPlayerId(state.players)
  });
  const legalMoves = generateLegalMoves(state.match.gameState, playerId, card, controllableOwners);
  const desired = normalizeMove(move);
  const legal = legalMoves.find((candidate) => normalizeMove(candidate) === desired);
  if (!legal) {
    throw new Error("Illegal move preview request");
  }
  const previewState = applyMovePreview(state.match.gameState, legal);
  const nextState = withVersionBump({
    ...state,
    match: {
      ...state.match,
      pendingPreview: {
        playerId,
        card,
        move: legal,
        previewState
      }
    }
  });
  return {
    state: nextState,
    response: {
      ok: true,
      preview: nextState.match.pendingPreview,
      version: nextState.version
    }
  };
}
function handleCancelMovePreview(state, command) {
  const { playerId } = command;
  assertActiveTurn(state, playerId);
  if (!state.match.pendingPreview || state.match.pendingPreview.playerId !== playerId) {
    throw new Error("No pending preview for player");
  }
  const nextState = withVersionBump({
    ...state,
    match: {
      ...state.match,
      pendingPreview: null
    }
  });
  return {
    state: nextState,
    response: { ok: true, cancelled: true, version: nextState.version }
  };
}
function handleConfirmMove(state, command) {
  const { playerId } = command;
  assertActiveTurn(state, playerId);
  const pending = state.match.pendingPreview;
  if (!pending || pending.playerId !== playerId) {
    throw new Error("No pending preview to confirm");
  }
  const hand = [...state.match.handsByPlayerId[playerId] ?? []];
  const cardIndex = findCardIndexByRank(hand, pending.card);
  if (cardIndex < 0) {
    throw new Error(`Card ${pending.card} missing at confirm time`);
  }
  const [usedCard] = hand.splice(cardIndex, 1);
  const handsByPlayerId = {
    ...state.match.handsByPlayerId,
    [playerId]: hand
  };
  const deckState = discardCards(state.match.deckState, [usedCard]);
  const movedGameState = pending.previewState;
  const teamByPlayerId = getTeamByPlayerId(state.players);
  const winner = detectWinner({
    gameMode: state.config.gameMode,
    pieces: movedGameState.pieces,
    playerIds: state.match.turnOrder,
    teamByPlayerId
  });
  if (winner) {
    const nextState2 = withVersionBump({
      ...state,
      status: "finished",
      match: {
        ...state.match,
        gameState: movedGameState,
        pendingPreview: null,
        handsByPlayerId,
        deckState,
        phase: "finished",
        winner
      }
    });
    return {
      state: nextState2,
      response: {
        ok: true,
        confirmed: true,
        gameFinished: true,
        winner,
        version: nextState2.version
      }
    };
  }
  let nextState = withVersionBump({
    ...state,
    match: {
      ...state.match,
      gameState: movedGameState,
      pendingPreview: null,
      handsByPlayerId,
      deckState,
      turnIndex: (state.match.turnIndex + 1) % state.match.turnOrder.length
    }
  });
  const turnProgress = resolveTurnProgressAfterAction(nextState);
  return {
    state: turnProgress.state,
    response: {
      ...turnProgress.response,
      ok: true,
      confirmed: true
    }
  };
}
function handlePassTurnIfBlocked(state, command) {
  const { playerId } = command;
  assertActiveTurn(state, playerId);
  const canAct = hasAnyLegalMoveForPlayer(state, state.match, playerId);
  if (canAct) {
    throw new Error("Cannot pass turn while legal moves are available");
  }
  const blocked = new Set(state.match.blockedPlayerIds);
  blocked.add(playerId);
  const nextState = withVersionBump({
    ...state,
    match: {
      ...state.match,
      pendingPreview: null,
      turnIndex: (state.match.turnIndex + 1) % state.match.turnOrder.length,
      blockedPlayerIds: [...blocked]
    }
  });
  const turnProgress = resolveTurnProgressAfterAction(nextState);
  return {
    state: turnProgress.state,
    response: {
      ...turnProgress.response,
      ok: true,
      passed: true
    }
  };
}
function handleRoomCommand(state, command) {
  assertVersion(state, command.expectedVersion);
  return withIdempotency(state, command.idempotencyKey, () => {
    switch (command.type) {
      case "join_room":
        return handleJoinRoom(state, command);
      case "set_ready":
        return handleSetReady(state, command);
      case "start_match":
        return handleStartMatch(state, command);
      case "exchange_card":
        return handleExchangeCard(state, command);
      case "request_legal_moves":
        return handleRequestLegalMoves(state, command);
      case "start_move_preview":
        return handleStartMovePreview(state, command);
      case "cancel_move_preview":
        return handleCancelMovePreview(state, command);
      case "confirm_move":
        return handleConfirmMove(state, command);
      case "pass_turn_if_blocked":
        return handlePassTurnIfBlocked(state, command);
      default:
        throw new Error(`Unknown command: ${command.type}`);
    }
  });
}
function getPublicRoomView(state) {
  return {
    roomId: state.roomId,
    status: state.status,
    version: state.version,
    config: clone(state.config),
    players: sortPlayersBySeat(state.players).map((player) => ({
      playerId: player.playerId,
      teamNo: player.teamNo,
      slotInTeam: player.slotInTeam,
      seatNo: player.seatNo,
      ready: player.ready,
      connected: player.connected
    })),
    match: state.match ? {
      phase: state.match.phase,
      roundNumber: state.match.roundNumber,
      turnPlayerId: state.match.turnOrder[state.match.turnIndex],
      blockedPlayerIds: [...state.match.blockedPlayerIds],
      handCountsByPlayerId: Object.fromEntries(
        Object.entries(state.match.handsByPlayerId).map(([playerId, hand]) => [playerId, hand.length])
      ),
      winner: state.match.winner ?? null
    } : null
  };
}
function getPlayerPrivateView(state, playerId) {
  const publicView = getPublicRoomView(state);
  const myHand = state.match?.handsByPlayerId[playerId] ?? [];
  return {
    ...publicView,
    private: {
      playerId,
      hand: clone(myHand),
      pendingPreview: state.match?.pendingPreview?.playerId === playerId ? clone(state.match.pendingPreview) : null,
      pendingExchangeSubmitted: Boolean(state.match?.pendingExchangeByPlayerId?.[playerId])
    }
  };
}

// dog_game/supabase/functions/dog-room/vendor/services/realtime-server/invite-url.js
var ROOM_QUERY_KEY = "room";
function buildInviteUrl(params) {
  const { baseUrl, roomId } = params;
  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error("baseUrl is required");
  }
  if (!roomId || typeof roomId !== "string") {
    throw new Error("roomId is required");
  }
  const url = new URL("/dog", ensureTrailingSlash(baseUrl));
  url.searchParams.set(ROOM_QUERY_KEY, roomId);
  return url.toString();
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

// dog_game/supabase/functions/dog-room/vendor/services/realtime-server/supabase-room-service.js
function toEvent(type, roomId, payload) {
  return {
    type,
    roomId,
    payload,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function createSupabaseRoomService(deps) {
  const { store, publisher = {} } = deps;
  if (!store?.loadRoomState || !store?.saveRoomState) {
    throw new Error("store must provide loadRoomState and saveRoomState");
  }
  async function persistAndPublish(roomId, state, actorPlayerId, eventType, response) {
    await store.saveRoomState(roomId, state);
    if (store.appendGameEvent) {
      await store.appendGameEvent(
        toEvent(eventType, roomId, {
          actorPlayerId,
          response,
          version: state.version
        })
      );
    }
    if (publisher.publishRoomSnapshot) {
      await publisher.publishRoomSnapshot(roomId, getPublicRoomView(state));
    }
    if (actorPlayerId && publisher.publishPlayerSnapshot) {
      await publisher.publishPlayerSnapshot(roomId, actorPlayerId, getPlayerPrivateView(state, actorPlayerId));
    }
  }
  async function createRoomCommand(command) {
    const existing = await store.loadRoomState(command.roomId);
    if (existing) {
      throw new Error(`Room already exists: ${command.roomId}`);
    }
    const state = createRoom(command);
    await persistAndPublish(command.roomId, state, command.playerId ?? command.hostPlayerId, "room_created", {
      ok: true,
      roomId: command.roomId
    });
    const inviteUrl = command.clientBaseUrl ? buildInviteUrl({ baseUrl: command.clientBaseUrl, roomId: command.roomId }) : null;
    return {
      roomId: command.roomId,
      response: { ok: true, roomId: command.roomId, inviteUrl },
      public: getPublicRoomView(state),
      private: command.playerId ? getPlayerPrivateView(state, command.playerId).private : null
    };
  }
  async function processRoomCommand(command) {
    if (command.type === "create_room") {
      return createRoomCommand({
        roomId: command.roomId,
        hostPlayerId: command.playerId,
        playerId: command.playerId,
        gameMode: command.gameMode,
        teamCount: command.teamCount,
        playersPerTeam: command.playersPerTeam,
        idempotencyKey: command.idempotencyKey,
        clientBaseUrl: command.clientBaseUrl
      });
    }
    const state = await store.loadRoomState(command.roomId);
    if (!state) {
      throw new Error(`Unknown room: ${command.roomId}`);
    }
    const result = handleRoomCommand(state, {
      ...command,
      expectedVersion: state.version
    });
    const actorPlayerId = command.playerId ?? null;
    await persistAndPublish(command.roomId, result.state, actorPlayerId, command.type, result.response);
    return {
      roomId: command.roomId,
      response: result.response,
      public: getPublicRoomView(result.state),
      private: actorPlayerId ? getPlayerPrivateView(result.state, actorPlayerId).private : null
    };
  }
  async function attach(roomId, playerId) {
    const state = await store.loadRoomState(roomId);
    if (!state) {
      throw new Error(`Unknown room: ${roomId}`);
    }
    return {
      roomId,
      public: getPublicRoomView(state),
      private: playerId ? getPlayerPrivateView(state, playerId).private : null
    };
  }
  return {
    processRoomCommand,
    attach
  };
}

// dog_game/supabase/functions/dog-room/vendor/services/realtime-server/supabase-edge-handler.js
function buildCorsHeaders(request) {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-max-age": "86400",
    vary: "origin"
  };
}
function validateCommandPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  if (!("type" in payload) || typeof payload.type !== "string") {
    throw new Error("Missing command type");
  }
  return payload;
}
function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...buildCorsHeaders(request)
    }
  });
}
function preflightResponse(request) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request)
  });
}
async function handleEdgeRoomRequest(params) {
  const { request, roomService: roomService2, rateLimiter: rateLimiter2 } = params;
  if (request.method === "OPTIONS") {
    return preflightResponse(request);
  }
  if (rateLimiter2) {
    const decision = rateLimiter2.consume(request);
    if (!decision.allowed) {
      return jsonResponse(
        request,
        {
          ok: false,
          error: "Too many requests",
          retryAfterSeconds: decision.retryAfterSeconds ?? 1
        },
        429
      );
    }
  }
  try {
    const payload = validateCommandPayload(await request.json());
    if (payload.type === "attach") {
      const result2 = await roomService2.attach(payload.roomId, payload.playerId);
      return jsonResponse(request, { ok: true, result: result2 }, 200);
    }
    const result = await roomService2.processRoomCommand(payload);
    return jsonResponse(request, { ok: true, result }, 200);
  } catch (error) {
    return jsonResponse(
      request,
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      400
    );
  }
}

// dog_game/supabase/functions/dog-room/index.ts
var SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
var SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
var ALLOW_IN_MEMORY_FALLBACK = Deno.env.get("DOG_ALLOW_IN_MEMORY_FALLBACK") === "1";
var ROOM_TABLE = "dog_room_states";
var STORAGE_TIMEOUT_MS = 5e3;
var RATE_LIMIT_WINDOW_MS = Number(Deno.env.get("DOG_RATE_LIMIT_WINDOW_MS") ?? 1e4);
var RATE_LIMIT_MAX_REQUESTS = Number(Deno.env.get("DOG_RATE_LIMIT_MAX_REQUESTS") ?? 80);
var inMemoryStates = /* @__PURE__ */ new Map();
var rateLimitBuckets = /* @__PURE__ */ new Map();
function hasPersistentStore() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}
function persistenceConfigError() {
  return new Error(
    "Persistence is not configured: set SUPABASE_SERVICE_ROLE_KEY for the dog-room function, or set DOG_ALLOW_IN_MEMORY_FALLBACK=1 for local dev only."
  );
}
function canonicalRoomId(raw) {
  return String(raw ?? "").trim().toUpperCase();
}
function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const connectingIp = request.headers.get("cf-connecting-ip");
  if (connectingIp) {
    return connectingIp;
  }
  return "unknown";
}
var rateLimiter = {
  consume(request) {
    if (!Number.isFinite(RATE_LIMIT_WINDOW_MS) || RATE_LIMIT_WINDOW_MS <= 0) {
      return { allowed: true };
    }
    if (!Number.isFinite(RATE_LIMIT_MAX_REQUESTS) || RATE_LIMIT_MAX_REQUESTS <= 0) {
      return { allowed: true };
    }
    const key = getClientIp(request);
    const now = Date.now();
    const existing = rateLimitBuckets.get(key);
    if (!existing || now - existing.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
      rateLimitBuckets.set(key, { count: 1, windowStartMs: now });
      return { allowed: true };
    }
    if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
      const remainingMs = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - existing.windowStartMs));
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1e3))
      };
    }
    existing.count += 1;
    return { allowed: true };
  }
};
async function loadRoomState(roomId) {
  if (!hasPersistentStore()) {
    if (!ALLOW_IN_MEMORY_FALLBACK) {
      throw persistenceConfigError();
    }
    return inMemoryStates.get(roomId) ?? null;
  }
  const url = `${SUPABASE_URL}/rest/v1/${ROOM_TABLE}?room_id=eq.${encodeURIComponent(roomId)}&select=state&limit=1`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      accept: "application/json"
    },
    signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS)
  });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 220);
    throw new Error(`Failed to load room state (${response.status}): ${details || "no details"}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  return rows[0]?.state ?? null;
}
async function saveRoomState(roomId, state) {
  if (!hasPersistentStore()) {
    if (!ALLOW_IN_MEMORY_FALLBACK) {
      throw persistenceConfigError();
    }
    inMemoryStates.set(roomId, state);
    return;
  }
  const url = `${SUPABASE_URL}/rest/v1/${ROOM_TABLE}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify([
      {
        room_id: roomId,
        state,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]),
    signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS)
  });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 220);
    throw new Error(`Failed to persist room state (${response.status}): ${details || "no details"}`);
  }
}
var roomService = createSupabaseRoomService({
  store: {
    loadRoomState: async (roomId) => loadRoomState(canonicalRoomId(roomId)),
    saveRoomState: async (roomId, state) => saveRoomState(canonicalRoomId(roomId), state)
  }
});
Deno.serve(async (request) => {
  if (request.method === "POST") {
    const cloned = request.clone();
    const payload = await cloned.json().catch(() => null);
    if (payload && typeof payload === "object" && "roomId" in payload) {
      payload.roomId = canonicalRoomId(payload.roomId);
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(payload)
      });
    }
  }
  return handleEdgeRoomRequest({ request, roomService, rateLimiter });
});
