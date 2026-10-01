/**
 * Swiss Tournament Pairing Engine
 * 
 * Implements deterministic Swiss pairing for chess tournaments.
 * 
 * Core Rules:
 * 1. Players are ranked by current standings (score descending, wins descending, name ascending).
 * 2. Players are paired within score groups where possible.
 * 3. Never pair two players who have already played each other.
 * 4. Never create self-pairings.
 * 5. Float players to adjacent score groups when a group cannot be completely paired.
 * 6. Odd player count: exactly one player receives a BYE per round.
 *    - Prefer players who have not previously received a BYE.
 *    - Prefer players with lower scores.
 *    - Deterministic tie-breaking.
 * 7. Color balancing:
 *    - Track White and Black game counts for each player.
 *    - Prefer giving White to the player with fewer White games (smaller white - black difference).
 *    - Consider last color played as a secondary tie-break.
 *    - Deterministic board alternating tie-break if identical.
 * 8. Deterministic backtracking search:
 *    - If an initial pair leads to an impossible pairing down the tree, backtrack cleanly.
 *    - If no valid pairing is mathematically possible without repeat opponents, throw a clear controlled error.
 */

/**
 * Generates Swiss pairings for a tournament round.
 * 
 * @param {Object} params
 * @param {Array<Object>} params.players - Registered players (with userId or _id)
 * @param {Array<Object>} [params.standings] - Current tournament standings
 * @param {Array<Object>} [params.previousRounds] - Array of previous Round documents with pairings and byePlayer
 * @param {number} params.roundNumber - The round number being generated (>= 1)
 * @returns {{ roundNumber: number, pairings: Array<{ whitePlayer: string, blackPlayer: string }>, byePlayer: string|null }}
 */
export const generateSwissPairings = ({
  players,
  standings = [],
  previousRounds = [],
  roundNumber = 1,
}) => {
  if (!players || !Array.isArray(players) || players.length < 2) {
    const error = new Error('At least 2 players are required to create a round.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Build map of standings by player ID
  const standingsMap = new Map();
  if (Array.isArray(standings)) {
    for (const s of standings) {
      const pId = (s.playerId?._id || s.playerId)?.toString();
      if (pId) {
        standingsMap.set(pId, {
          score: Number(s.score) || 0,
          wins: Number(s.wins) || 0,
          draws: Number(s.draws) || 0,
          losses: Number(s.losses) || 0,
          name: s.name || '',
        });
      }
    }
  }

  // 2. Normalize and structure all participating players
  const normalizedPlayers = players.map((p) => {
    let id;
    let name = 'Player';

    if (p && typeof p === 'object') {
      if (p.userId) {
        id = (p.userId._id || p.userId.id || p.userId).toString();
        name = p.userId.name || name;
      } else if (p._id) {
        id = p._id.toString();
        name = p.name || name;
      } else if (p.id) {
        id = p.id.toString();
        name = p.name || name;
      } else {
        id = p.toString();
      }
    } else {
      id = String(p);
    }

    const s = standingsMap.get(id) || {};
    return {
      id,
      name: s.name || name,
      score: s.score !== undefined ? s.score : 0,
      wins: s.wins !== undefined ? s.wins : 0,
      draws: s.draws !== undefined ? s.draws : 0,
      losses: s.losses !== undefined ? s.losses : 0,
    };
  });

  // Verify unique players
  const uniqueIds = new Set(normalizedPlayers.map((p) => p.id));
  if (uniqueIds.size !== normalizedPlayers.length) {
    const error = new Error('Duplicate player IDs detected in tournament player list.');
    error.statusCode = 400;
    throw error;
  }

  // 3. Build Opponent History, BYE History, and Color History from previous rounds
  const opponentsMap = new Map();
  const byeHistory = new Set();
  const colorHistory = new Map();

  for (const p of normalizedPlayers) {
    opponentsMap.set(p.id, new Set());
    colorHistory.set(p.id, {
      white: 0,
      black: 0,
      lastColor: null,
      colorDifference: 0,
    });
  }

  // Sort previous rounds in chronological order
  const sortedRounds = [...previousRounds].sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));

  for (const round of sortedRounds) {
    if (round.byePlayer) {
      const byeId = (round.byePlayer._id || round.byePlayer)?.toString();
      if (byeId) {
        byeHistory.add(byeId);
      }
    }

    if (Array.isArray(round.pairings)) {
      for (const pairing of round.pairings) {
        const wId = (pairing.whitePlayer?._id || pairing.whitePlayer)?.toString();
        const bId = (pairing.blackPlayer?._id || pairing.blackPlayer)?.toString();

        if (wId && bId) {
          if (opponentsMap.has(wId)) opponentsMap.get(wId).add(bId);
          if (opponentsMap.has(bId)) opponentsMap.get(bId).add(wId);

          if (colorHistory.has(wId)) {
            const wCol = colorHistory.get(wId);
            wCol.white++;
            wCol.lastColor = 'W';
          }
          if (colorHistory.has(bId)) {
            const bCol = colorHistory.get(bId);
            bCol.black++;
            bCol.lastColor = 'B';
          }
        }
      }
    }
  }

  // Compute colorDifference for all players
  for (const p of normalizedPlayers) {
    const col = colorHistory.get(p.id);
    col.colorDifference = col.white - col.black;
  }

  // 4. Deterministic sorting of players
  // Order: 1. Score descending, 2. Wins descending, 3. Name ascending, 4. ID ascending
  const sortedPlayers = [...normalizedPlayers].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const nameCmp = (a.name || '').localeCompare(b.name || '');
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });

  const isOdd = sortedPlayers.length % 2 !== 0;

  // 5. Backtracking search to find a complete valid pairing and BYE
  let byeCandidates = [null];

  if (isOdd) {
    // Generate ordered list of BYE candidates
    // Prefer: 1. Player without previous BYE, 2. Lower score, 3. Fewer wins, 4. Name, 5. ID
    const candidates = [...sortedPlayers].sort((a, b) => {
      const aHadBye = byeHistory.has(a.id);
      const bHadBye = byeHistory.has(b.id);
      if (aHadBye !== bHadBye) return aHadBye ? 1 : -1;
      if (a.score !== b.score) return a.score - b.score; // Lower score first
      if (a.wins !== b.wins) return a.wins - b.wins;
      const nameCmp = (a.name || '').localeCompare(b.name || '');
      if (nameCmp !== 0) return nameCmp;
      return a.id.localeCompare(b.id);
    });
    byeCandidates = candidates;
  }

  let finalRawPairs = null;
  let chosenByePlayer = null;

  for (const byeCandidate of byeCandidates) {
    const pool = byeCandidate
      ? sortedPlayers.filter((p) => p.id !== byeCandidate.id)
      : sortedPlayers;

    const pairs = findSwissPairsBacktracking(pool, opponentsMap, colorHistory);
    if (pairs !== null) {
      finalRawPairs = pairs;
      chosenByePlayer = byeCandidate ? byeCandidate.id : null;
      break;
    }
  }

  if (!finalRawPairs) {
    const error = new Error(
      'Cannot generate Swiss pairings: no valid pairings exist without repeat matchups. All possible opponents have already been played.'
    );
    error.statusCode = 400;
    error.code = 'ALL_MATCHUPS_EXHAUSTED';
    throw error;
  }

  // 6. Assign Colors for each paired matchup
  const finalPairings = finalRawPairs.map(([p1, p2], boardIndex) => {
    const { white, black } = assignColors(p1, p2, colorHistory, boardIndex);
    return {
      whitePlayer: white.id,
      blackPlayer: black.id,
    };
  });

  return {
    roundNumber,
    pairings: finalPairings,
    byePlayer: chosenByePlayer,
  };
};

/**
 * Recursive backtracking algorithm to find a complete set of pairings.
 * Pairs players within score groups, down-floating when necessary.
 * 
 * @param {Array<Object>} remainingPlayers - Players still needing a match, sorted by score desc
 * @param {Map<string, Set<string>>} opponentsMap - Opponents each player has already faced
 * @param {Map<string, Object>} colorHistory - White/Black game counts
 * @returns {Array<[Object, Object]>|null}
 */
const findSwissPairsBacktracking = (remainingPlayers, opponentsMap, colorHistory) => {
  if (remainingPlayers.length === 0) {
    return [];
  }

  const p1 = remainingPlayers[0];
  const pool = remainingPlayers.slice(1);
  const p1Opponents = opponentsMap.get(p1.id) || new Set();

  // Find all eligible opponents who have not played p1 before
  const eligibleOpponents = pool.filter((cand) => !p1Opponents.has(cand.id));

  if (eligibleOpponents.length === 0) {
    return null; // Dead end for p1
  }

  // Sort candidate opponents deterministically:
  // 1. Minimum score difference (pair within score group first, then nearest float)
  // 2. Color compatibility (prefer candidates wanting the opposite color)
  // 3. Name ascending
  // 4. ID ascending
  const p1Col = colorHistory.get(p1.id) || { colorDifference: 0 };

  eligibleOpponents.sort((a, b) => {
    const scoreDiffA = Math.abs(p1.score - a.score);
    const scoreDiffB = Math.abs(p1.score - b.score);
    if (scoreDiffA !== scoreDiffB) {
      return scoreDiffA - scoreDiffB;
    }

    // Color compatibility penalty:
    // If one player has played more Whites (diff > 0) and one has played more Blacks (diff < 0), compatibility is highest
    const aCol = colorHistory.get(a.id) || { colorDifference: 0 };
    const bCol = colorHistory.get(b.id) || { colorDifference: 0 };

    const penaltyA = computeColorCompatibilityPenalty(p1Col.colorDifference, aCol.colorDifference);
    const penaltyB = computeColorCompatibilityPenalty(p1Col.colorDifference, bCol.colorDifference);
    if (penaltyA !== penaltyB) {
      return penaltyA - penaltyB;
    }

    const nameCmp = (a.name || '').localeCompare(b.name || '');
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });

  // Try each candidate opponent
  for (const cand of eligibleOpponents) {
    const nextRemaining = pool.filter((p) => p.id !== cand.id);
    const subResult = findSwissPairsBacktracking(nextRemaining, opponentsMap, colorHistory);

    if (subResult !== null) {
      return [[p1, cand], ...subResult];
    }
  }

  return null;
};

/**
 * Computes color compatibility penalty between two players based on their colorDifference.
 * Lower penalty = better match.
 */
const computeColorCompatibilityPenalty = (diff1, diff2) => {
  // Ideal: one wants White (diff < 0) and one wants Black (diff > 0)
  if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0)) {
    return 0;
  }
  // Neutral: at least one is balanced (diff === 0)
  if (diff1 === 0 || diff2 === 0) {
    return 1;
  }
  // Both want White (both diff < 0) or both want Black (both diff > 0)
  return 2 + Math.abs(diff1 + diff2);
};

/**
 * Assigns White and Black pieces for a paired matchup.
 * 
 * Rules:
 * 1. Player with fewer White games (smaller white - black difference) gets White.
 * 2. If equal, player who played Black last round gets White.
 * 3. If still equal, board-alternating tie-breaker:
 *    - Even board index: p1 gets White
 *    - Odd board index: p2 gets White
 * 
 * @param {Object} p1 - First player (higher ranked)
 * @param {Object} p2 - Second player
 * @param {Map<string, Object>} colorHistory
 * @param {number} boardIndex - 0-indexed board number
 * @returns {{ white: Object, black: Object }}
 */
export const assignColors = (p1, p2, colorHistory, boardIndex = 0) => {
  const c1 = colorHistory.get(p1.id) || { white: 0, black: 0, colorDifference: 0, lastColor: null };
  const c2 = colorHistory.get(p2.id) || { white: 0, black: 0, colorDifference: 0, lastColor: null };

  const diff1 = c1.colorDifference;
  const diff2 = c2.colorDifference;

  // 1. Primary rule: Player with smaller colorDifference gets White
  if (diff1 < diff2) {
    return { white: p1, black: p2 };
  }
  if (diff2 < diff1) {
    return { white: p2, black: p1 };
  }

  // 2. Secondary rule: Alternation from last round
  if (c1.lastColor === 'B' && c2.lastColor === 'W') {
    return { white: p1, black: p2 };
  }
  if (c1.lastColor === 'W' && c2.lastColor === 'B') {
    return { white: p2, black: p1 };
  }

  // 3. Final deterministic tie-break: Alternate colors per board
  if (boardIndex % 2 === 0) {
    return { white: p1, black: p2 };
  } else {
    return { white: p2, black: p1 };
  }
};

export const getSwissPairings = generateSwissPairings;

export default {
  generateSwissPairings,
  getSwissPairings,
  assignColors,
};
