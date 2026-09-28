/**
 * Knockout (Single-Elimination) Tournament Pairing Engine
 * 
 * Implements deterministic bracket seeding, BYE placement, stage calculation,
 * and round-to-round advancement for single-elimination chess tournaments.
 * 
 * Key Principles:
 * 1. Bracket size = smallest power of 2 >= player count (e.g. 5 players -> 8-slot bracket).
 * 2. Seeding: Deterministic based on player registration order (earliest registration is Seed 1).
 * 3. BYEs: Awarded in Round 1 to top seeds (bracketSize - playerCount).
 * 4. BYE Advancement: Immediately advances the player without creating a Lichess game.
 * 5. Deterministic Bracket Matching:
 *    - 2 players: 1 vs 2 (Final)
 *    - 4 players: 1 vs 4, 2 vs 3 (Semifinals)
 *    - 8 players: 1 vs 8, 4 vs 5, 2 vs 7, 3 vs 6 (Quarterfinals)
 *    - Adjacent winners face each other in subsequent rounds preserving bracket order.
 * 6. Color Balancing: Basic alternation between rounds for advancing players.
 */

/**
 * Calculates the smallest power of 2 greater than or equal to playerCount.
 * 
 * @param {number} playerCount 
 * @returns {number}
 */
export const calculateBracketSize = (playerCount) => {
  const count = Number(playerCount);
  if (!count || isNaN(count) || count < 2) {
    const error = new Error('At least 2 players are required for a Knockout tournament.');
    error.statusCode = 400;
    throw error;
  }

  let size = 2;
  while (size < count) {
    size *= 2;
  }
  return size;
};

/**
 * Calculates total number of knockout stages (rounds) for a given player count.
 * 
 * @param {number} playerCount 
 * @returns {number}
 */
export const calculateTotalRounds = (playerCount) => {
  const bracketSize = calculateBracketSize(playerCount);
  return Math.round(Math.log2(bracketSize));
};

/**
 * Returns human-friendly stage name (e.g. "Final", "Semifinals", "Quarterfinals").
 * 
 * @param {number} roundNumber 
 * @param {number} totalRounds 
 * @param {number} [matchCount] 
 * @returns {string}
 */
export const getKnockoutStageName = (roundNumber, totalRounds, matchCount = null) => {
  const remainingMatches = matchCount !== null
    ? matchCount
    : Math.pow(2, totalRounds - roundNumber);

  switch (remainingMatches) {
    case 1:
      return 'Final';
    case 2:
      return 'Semifinals';
    case 4:
      return 'Quarterfinals';
    case 8:
      return 'Round of 16';
    case 16:
      return 'Round of 32';
    default:
      return `Round ${roundNumber}`;
  }
};

/**
 * Generates the deterministic standard bracket seed pairs for a power-of-2 bracket.
 * 
 * Example for 8: [[1, 8], [4, 5], [2, 7], [3, 6]]
 * - Match 1 (1 vs 8) winner meets Match 2 (4 vs 5) winner in Semifinal 1
 * - Match 3 (2 vs 7) winner meets Match 4 (3 vs 6) winner in Semifinal 2
 * - Semifinal 1 winner meets Semifinal 2 winner in Final
 * 
 * @param {number} size - Must be a power of 2 >= 2
 * @returns {Array<[number, number]>}
 */
export const generateBracketSeedPairs = (size) => {
  if (size <= 2) {
    return [[1, 2]];
  }

  // Standard tournament bracket construction:
  // Starts with [1, 2] and recursively replaces each seed s with [s, 2*current - s + 1]
  let seeds = [1, 2];
  while (seeds.length < size) {
    const nextSize = seeds.length * 2;
    const nextSeeds = [];
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      nextSeeds.push(s);
      nextSeeds.push(nextSize + 1 - s);
    }
    seeds = nextSeeds;
  }

  // Form adjacent pairs: (seed[0], seed[1]), (seed[2], seed[3]), ...
  const matches = [];
  for (let i = 0; i < seeds.length; i += 2) {
    const s1 = seeds[i];
    const s2 = seeds[i + 1];
    matches.push(s1 < s2 ? [s1, s2] : [s2, s1]);
  }

  return matches;
};

/**
 * Normalizes player object to { id, name, seed }
 */
const normalizePlayer = (p, index) => {
  let id;
  let name = `Player ${index + 1}`;

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

  return {
    id,
    name,
    seed: index + 1,
  };
};

/**
 * Generates Round 1 pairings for a Knockout tournament.
 * 
 * @param {Array<Object>} players - List of registered players
 * @returns {{ roundNumber: number, stageName: string, bracketSize: number, totalRounds: number, pairings: Array<Object>, byeCount: number }}
 */
export const generateKnockoutInitialPairings = (players) => {
  if (!players || !Array.isArray(players) || players.length < 2) {
    const error = new Error('At least 2 players are required to create a round.');
    error.statusCode = 400;
    throw error;
  }

  const normalized = players.map(normalizePlayer);

  // Validate unique player IDs
  const idSet = new Set(normalized.map((p) => p.id));
  if (idSet.size !== normalized.length) {
    const error = new Error('Duplicate player IDs detected in tournament player list.');
    error.statusCode = 400;
    throw error;
  }

  const playerCount = normalized.length;
  const bracketSize = calculateBracketSize(playerCount);
  const totalRounds = calculateTotalRounds(playerCount);
  const byeCount = bracketSize - playerCount;
  const stageName = getKnockoutStageName(1, totalRounds, bracketSize / 2);

  const seedPairs = generateBracketSeedPairs(bracketSize);
  const pairings = [];

  for (let i = 0; i < seedPairs.length; i++) {
    const [s1, s2] = seedPairs[i];
    const p1 = s1 <= playerCount ? normalized[s1 - 1] : null;
    const p2 = s2 <= playerCount ? normalized[s2 - 1] : null;

    if (!p1 && !p2) {
      // Should mathematically never happen in single-elimination since playerCount >= bracketSize/2 + 1
      continue;
    }

    if (p1 && !p2) {
      // p1 receives a BYE and automatically advances
      pairings.push({
        whitePlayer: p1.id,
        blackPlayer: null,
        isBye: true,
        status: 'BYE',
        result: 'BYE',
        matchNumber: i + 1,
      });
    } else if (!p1 && p2) {
      // Symmetric fallback: p2 receives a BYE
      pairings.push({
        whitePlayer: p2.id,
        blackPlayer: null,
        isBye: true,
        status: 'BYE',
        result: 'BYE',
        matchNumber: i + 1,
      });
    } else {
      // Actual match between p1 and p2
      // Alternate colors per board for fair balance
      const white = i % 2 === 0 ? p1 : p2;
      const black = i % 2 === 0 ? p2 : p1;

      pairings.push({
        whitePlayer: white.id,
        blackPlayer: black.id,
        isBye: false,
        status: 'PENDING',
        result: 'PENDING',
        matchNumber: i + 1,
      });
    }
  }

  return {
    roundNumber: 1,
    stageName,
    bracketSize,
    totalRounds,
    pairings,
    byeCount,
  };
};

/**
 * Determines the authoritative winner of a pairing document.
 * 
 * @param {Object} pairing 
 * @returns {string|null} Player ID of winner, or null if match unresolved
 */
export const determinePairingWinner = (pairing) => {
  if (!pairing) return null;

  // BYE slot automatically won by the whitePlayer
  if (pairing.status === 'BYE' || pairing.result === 'BYE') {
    return (pairing.whitePlayer?._id || pairing.whitePlayer)?.toString() || null;
  }

  // Finished or completed match
  if (pairing.status === 'FINISHED' || pairing.status === 'COMPLETED') {
    if (pairing.result === '1-0' || pairing.result === 'WHITE_WIN') {
      return (pairing.whitePlayer?._id || pairing.whitePlayer)?.toString() || null;
    }
    if (pairing.result === '0-1' || pairing.result === 'BLACK_WIN') {
      return (pairing.blackPlayer?._id || pairing.blackPlayer)?.toString() || null;
    }
  }

  return null;
};

/**
 * Generates the next knockout stage pairings from the winners of the previous round.
 * 
 * @param {Object} params
 * @param {Object} params.previousRound - Previous Round document with populated or raw pairings
 * @param {number} params.roundNumber - The new round number being created
 * @param {number} params.totalRounds - Total stages in tournament
 * @returns {{ roundNumber: number, stageName: string, pairings: Array<Object> }}
 */
export const generateKnockoutNextRoundPairings = ({
  previousRound,
  roundNumber,
  totalRounds,
}) => {
  if (!previousRound || !Array.isArray(previousRound.pairings) || previousRound.pairings.length === 0) {
    const error = new Error('Previous round pairings are required to generate next stage.');
    error.statusCode = 400;
    throw error;
  }

  // Sort previous round pairings by createdAt or existing order to preserve bracket tree
  const sortedPairs = [...previousRound.pairings];

  const winners = [];
  const previousColorMap = new Map();

  for (let i = 0; i < sortedPairs.length; i++) {
    const p = sortedPairs[i];
    const winnerId = determinePairingWinner(p);

    if (!winnerId) {
      const error = new Error(
        `Cannot create round ${roundNumber}: match #${i + 1} from round ${previousRound.roundNumber} has not finished with a decisive winner.`
      );
      error.statusCode = 400;
      throw error;
    }

    winners.push(winnerId);

    // Track color played in previous round for color balancing
    const wId = (p.whitePlayer?._id || p.whitePlayer)?.toString();
    const bId = (p.blackPlayer?._id || p.blackPlayer)?.toString();
    if (winnerId === wId) {
      previousColorMap.set(winnerId, 'W');
    } else if (winnerId === bId) {
      previousColorMap.set(winnerId, 'B');
    } else {
      previousColorMap.set(winnerId, null);
    }
  }

  if (winners.length < 2) {
    const error = new Error('Knockout tournament has already concluded (only 1 winner remaining).');
    error.statusCode = 400;
    throw error;
  }

  if (winners.length % 2 !== 0) {
    const error = new Error(`Invalid winner count (${winners.length}) for knockout progression.`);
    error.statusCode = 400;
    throw error;
  }

  const nextPairings = [];
  const matchCount = winners.length / 2;
  const stageName = getKnockoutStageName(roundNumber, totalRounds, matchCount);

  // Pair adjacent winners from bracket tree: Winner(2*i) vs Winner(2*i + 1)
  for (let i = 0; i < winners.length; i += 2) {
    const w1 = winners[i];
    const w2 = winners[i + 1];

    if (w1 === w2) {
      const error = new Error(`Self-pairing detected in knockout bracket: player ${w1} vs ${w2}`);
      error.statusCode = 400;
      throw error;
    }

    const c1 = previousColorMap.get(w1);
    const c2 = previousColorMap.get(w2);

    let whitePlayer;
    let blackPlayer;

    // Color balance: alternate from previous round if one played White and one played Black
    if (c1 === 'W' && c2 === 'B') {
      whitePlayer = w2;
      blackPlayer = w1;
    } else if (c1 === 'B' && c2 === 'W') {
      whitePlayer = w1;
      blackPlayer = w2;
    } else {
      // Deterministic board alternating
      const boardIdx = i / 2;
      whitePlayer = boardIdx % 2 === 0 ? w1 : w2;
      blackPlayer = boardIdx % 2 === 0 ? w2 : w1;
    }

    nextPairings.push({
      whitePlayer,
      blackPlayer,
      isBye: false,
      status: 'PENDING',
      result: 'PENDING',
      matchNumber: i / 2 + 1,
    });
  }

  return {
    roundNumber,
    stageName,
    pairings: nextPairings,
  };
};

export default {
  calculateBracketSize,
  calculateTotalRounds,
  getKnockoutStageName,
  generateBracketSeedPairs,
  generateKnockoutInitialPairings,
  determinePairingWinner,
  generateKnockoutNextRoundPairings,
};
