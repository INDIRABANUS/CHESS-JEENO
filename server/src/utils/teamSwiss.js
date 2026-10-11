/**
 * Team Swiss pairing engine.
 *
 * Implements deterministic Swiss pairings for team chess competitions.
 *
 * Mathematical & Algorithmic Guarantees:
 * 1. Seed & rank teams deterministically by current authoritative standings:
 *    - Match Points DESC
 *    - Board Points DESC
 *    - Score Difference DESC
 *    - Team Name ASC
 *    - Team ID ASC
 * 2. Pair teams with equal or similar match points (score groups).
 * 3. Strictly avoid repeat opponents whenever a valid alternative exists.
 * 4. Never schedule a team twice in the same round.
 * 5. Never self-pair a team.
 * 6. Odd number of eligible teams: exactly 1 BYE per round.
 *    - Prefer eligible teams that have not previously received a BYE.
 *    - Prefer teams lower in standings (lowest match points, board points).
 *    - Deterministic tie-break by team name and stable ID.
 * 7. When avoiding repeat opponents is mathematically impossible:
 *    - If allowRematches is false: throws controlled error with code 'ALL_MATCHUPS_EXHAUSTED'.
 *    - If allowRematches is true (default fallback): pairs teams minimizing prior matchup counts
 *      and score differences, explicitly flagging isRematch: true and providing clear rationale.
 * 8. Balanced teamA (Home) and teamB (Away) assignment across rounds.
 * 9. Deterministic tie-breaks ensuring identical inputs produce identical pairings.
 */

/**
 * Normalizes and extracts stable string identifiers from team documents or IDs.
 *
 * @param {Array<string|mongoose.Types.ObjectId|Object>} teams
 * @returns {Array<string>}
 */
export const normalizeTeamIds = (teams) => {
  if (!teams || !Array.isArray(teams)) {
    return [];
  }

  return teams
    .map((team) => {
      if (!team) return null;
      if (typeof team === 'object') {
        if (team._id) return team._id.toString();
        if (team.id) return team.id.toString();
      }
      return team.toString();
    })
    .filter(Boolean);
};

/**
 * Helper to get string ID from doc or ID.
 */
const toIdString = (item) => {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (item._id) return item._id.toString();
  if (item.id) return item.id.toString();
  return String(item);
};

/**
 * Assigns teamA and teamB for a paired matchup based on historical home/away balance.
 */
const assignSides = (t1, t2, sideHistory, matchIndex) => {
  const h1 = sideHistory.get(t1.id) || { teamA: 0, teamB: 0, lastSide: null };
  const h2 = sideHistory.get(t2.id) || { teamA: 0, teamB: 0, lastSide: null };

  const diff1 = h1.teamA - h1.teamB;
  const diff2 = h2.teamA - h2.teamB;

  // Prefer assigning teamA to the team with fewer teamA assignments (smaller diff)
  if (diff1 < diff2) {
    return { teamA: t1, teamB: t2 };
  }
  if (diff2 < diff1) {
    return { teamA: t2, teamB: t1 };
  }

  // Secondary tie-break: avoid repeating last side
  if (h1.lastSide === 'teamA' && h2.lastSide !== 'teamA') {
    return { teamA: t2, teamB: t1 };
  }
  if (h2.lastSide === 'teamA' && h1.lastSide !== 'teamA') {
    return { teamA: t1, teamB: t2 };
  }

  // Deterministic board alternating fallback
  if (matchIndex % 2 === 0) {
    return { teamA: t1, teamB: t2 };
  }
  return { teamA: t2, teamB: t1 };
};

/**
 * Recursive backtracking search to find a complete set of pairings with zero repeat opponents.
 *
 * @param {Array<Object>} remainingTeams - Teams needing a pairing, ordered by rank
 * @param {Map<string, Set<string>>} opponentsMap - Opponents faced previously
 * @param {Map<string, Object>} sideHistory - Historical side balance
 * @returns {Array<[Object, Object]>|null}
 */
const findStrictSwissPairsBacktracking = (
  remainingTeams,
  opponentsMap,
  sideHistory
) => {
  if (remainingTeams.length === 0) {
    return [];
  }

  const t1 = remainingTeams[0];
  const pool = remainingTeams.slice(1);
  const t1Opponents = opponentsMap.get(t1.id) || new Set();

  // Find all candidate opponents who have not played t1 before
  const eligibleOpponents = pool.filter((cand) => !t1Opponents.has(cand.id));

  if (eligibleOpponents.length === 0) {
    return null; // Dead end: t1 has no available fresh opponent in pool
  }

  // Sort candidate opponents deterministically:
  // 1. Minimum match point difference (pair within score group first)
  // 2. Minimum board point difference
  // 3. Side balance compatibility
  // 4. Team name ASC
  // 5. Team ID ASC
  eligibleOpponents.sort((a, b) => {
    const mpDiffA = Math.abs(t1.matchPoints - a.matchPoints);
    const mpDiffB = Math.abs(t1.matchPoints - b.matchPoints);
    if (mpDiffA !== mpDiffB) return mpDiffA - mpDiffB;

    const bpDiffA = Math.abs(t1.boardPoints - b.boardPoints);
    const bpDiffB = Math.abs(t1.boardPoints - b.boardPoints);
    if (bpDiffA !== bpDiffB) return bpDiffA - bpDiffB;

    const hA = sideHistory.get(a.id) || { teamA: 0, teamB: 0 };
    const hB = sideHistory.get(b.id) || { teamA: 0, teamB: 0 };
    const h1 = sideHistory.get(t1.id) || { teamA: 0, teamB: 0 };

    const compA = Math.abs((h1.teamA - h1.teamB) + (hA.teamA - hA.teamB));
    const compB = Math.abs((h1.teamA - h1.teamB) + (hB.teamA - hB.teamB));
    if (compA !== compB) return compA - compB;

    const nameCmp = (a.name || '').localeCompare(b.name || '');
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });

  for (const cand of eligibleOpponents) {
    const nextRemaining = pool.filter((p) => p.id !== cand.id);
    const subResult = findStrictSwissPairsBacktracking(
      nextRemaining,
      opponentsMap,
      sideHistory
    );

    if (subResult !== null) {
      return [[t1, cand], ...subResult];
    }
  }

  return null;
};

/**
 * Backtracking pairing search permitting rematches when non-repeat pairing is mathematically impossible.
 * Minimizes prior meeting counts, score differences, and applies stable tie-breaks.
 *
 * @param {Array<Object>} remainingTeams
 * @param {Map<string, Map<string, number>>} matchCountsMap
 * @param {Map<string, Object>} sideHistory
 * @returns {Array<[Object, Object]>|null}
 */
const findRematchSwissPairsBacktracking = (
  remainingTeams,
  matchCountsMap,
  sideHistory
) => {
  if (remainingTeams.length === 0) {
    return [];
  }

  const t1 = remainingTeams[0];
  const pool = remainingTeams.slice(1);
  const t1Counts = matchCountsMap.get(t1.id) || new Map();

  const candidates = [...pool];

  // Sort candidates by:
  // 1. Minimum prior meeting count (0 meetings first, then 1, then 2...)
  // 2. Minimum match point difference
  // 3. Minimum board point difference
  // 4. Team name ASC
  // 5. Team ID ASC
  candidates.sort((a, b) => {
    const countA = t1Counts.get(a.id) || 0;
    const countB = t1Counts.get(b.id) || 0;
    if (countA !== countB) return countA - countB;

    const mpDiffA = Math.abs(t1.matchPoints - a.matchPoints);
    const mpDiffB = Math.abs(t1.matchPoints - b.matchPoints);
    if (mpDiffA !== mpDiffB) return mpDiffA - mpDiffB;

    const bpDiffA = Math.abs(t1.boardPoints - b.boardPoints);
    const bpDiffB = Math.abs(t1.boardPoints - b.boardPoints);
    if (bpDiffA !== bpDiffB) return bpDiffA - bpDiffB;

    const nameCmp = (a.name || '').localeCompare(b.name || '');
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });

  for (const cand of candidates) {
    const nextRemaining = pool.filter((p) => p.id !== cand.id);
    const subResult = findRematchSwissPairsBacktracking(
      nextRemaining,
      matchCountsMap,
      sideHistory
    );

    if (subResult !== null) {
      return [[t1, cand], ...subResult];
    }
  }

  return null;
};

/**
 * Generates deterministic Swiss pairings for a round in a team competition.
 *
 * @param {Object} params
 * @param {Array<Object|string>} params.teams - List of eligible active teams
 * @param {Array<Object>} [params.standings] - Current competition standings from standingsService
 * @param {Array<Object>} [params.previousRounds] - Previous round records with pairings/matches and byeTeam
 * @param {number} params.roundNumber - The round number being generated (>= 1)
 * @param {Object} [params.options]
 * @param {boolean} [params.options.allowRematches=true] - Whether to fallback to rematch pairing if strict non-repeat is mathematically impossible
 * @returns {{
 *   roundNumber: number,
 *   pairings: Array<{
 *     teamA: string,
 *     teamB: string,
 *     teamAPoints: number,
 *     teamBPoints: number,
 *     isRematch: boolean,
 *     priorMeetings: number,
 *     repeatAvoidance: string
 *   }>,
 *   byeTeam: string|null,
 *   byeReason: string|null,
 *   hadRematches: boolean,
 *   totalMatches: number,
 *   eligibleTeamsCount: number
 * }}
 */
export const generateTeamSwissPairings = ({
  teams,
  standings = [],
  previousRounds = [],
  roundNumber = 1,
  options = {},
}) => {
  if (!teams || !Array.isArray(teams)) {
    const error = new Error('Swiss scheduling requires an array of active teams.');
    error.statusCode = 400;
    throw error;
  }

  if (teams.length < 2) {
    const error = new Error(
      `Swiss scheduling requires at least 2 active teams. Current active teams: ${teams.length}`
    );
    error.statusCode = 400;
    throw error;
  }

  // 1. Build map of authoritative standings by team ID
  const standingsMap = new Map();
  if (Array.isArray(standings)) {
    standings.forEach((s) => {
      const tid = toIdString(s.teamId || s.team);
      if (tid) {
        standingsMap.set(tid, {
          matchPoints: Number(s.matchPoints) || 0,
          boardPoints: Number(s.boardPoints || s.boardPointsFor) || 0,
          scoreDifference: Number(s.scoreDifference) || 0,
          name: s.name || '',
          rank: s.rank || null,
        });
      }
    });
  }

  // 2. Normalize and structure all participating teams
  const normalizedTeams = teams.map((t) => {
    let id;
    let name = 'Team';

    if (t && typeof t === 'object') {
      id = toIdString(t);
      name = t.name || name;
    } else {
      id = String(t);
    }

    const s = standingsMap.get(id) || {};
    return {
      id,
      name: s.name || name,
      matchPoints:
        s.matchPoints !== undefined
          ? s.matchPoints
          : (t && typeof t === 'object' && t.matchPoints !== undefined ? t.matchPoints : 0),
      boardPoints:
        s.boardPoints !== undefined
          ? s.boardPoints
          : (t && typeof t === 'object' && t.boardPoints !== undefined ? t.boardPoints : 0),
      scoreDifference:
        s.scoreDifference !== undefined
          ? s.scoreDifference
          : (t && typeof t === 'object' && t.scoreDifference !== undefined ? t.scoreDifference : 0),
      rank: s.rank || (t && typeof t === 'object' ? t.rank : null) || null,
    };
  });

  // Verify unique teams
  const uniqueIds = new Set(normalizedTeams.map((t) => t.id));
  if (uniqueIds.size !== normalizedTeams.length) {
    const error = new Error('Duplicate team IDs detected in active teams list.');
    error.statusCode = 400;
    throw error;
  }

  if (uniqueIds.size < 2) {
    const error = new Error('Swiss scheduling requires at least 2 distinct active teams.');
    error.statusCode = 400;
    throw error;
  }

  // 3. Build Opponent History, BYE History, and Side History from previous rounds
  const opponentsMap = new Map();
  const matchCountsMap = new Map();
  const byeHistory = new Set();
  const sideHistory = new Map();

  for (const t of normalizedTeams) {
    opponentsMap.set(t.id, new Set());
    matchCountsMap.set(t.id, new Map());
    sideHistory.set(t.id, {
      teamA: 0,
      teamB: 0,
      lastSide: null,
    });
  }

  // Sort previous rounds chronologically
  const sortedRounds = [...previousRounds].sort(
    (a, b) => (a.roundNumber || 0) - (b.roundNumber || 0)
  );

  for (const round of sortedRounds) {
    if (round.byeTeam) {
      const byeId = toIdString(round.byeTeam);
      if (byeId) {
        byeHistory.add(byeId);
      }
    }

    const matchesList = round.matches || round.pairings || [];
    if (Array.isArray(matchesList)) {
      for (const m of matchesList) {
        const tAId = toIdString(m.teamA);
        const tBId = toIdString(m.teamB);

        if (tAId && tBId) {
          if (opponentsMap.has(tAId)) opponentsMap.get(tAId).add(tBId);
          if (opponentsMap.has(tBId)) opponentsMap.get(tBId).add(tAId);

          if (matchCountsMap.has(tAId)) {
            const count = matchCountsMap.get(tAId).get(tBId) || 0;
            matchCountsMap.get(tAId).set(tBId, count + 1);
          }
          if (matchCountsMap.has(tBId)) {
            const count = matchCountsMap.get(tBId).get(tAId) || 0;
            matchCountsMap.get(tBId).set(tAId, count + 1);
          }

          if (sideHistory.has(tAId)) {
            const hA = sideHistory.get(tAId);
            hA.teamA += 1;
            hA.lastSide = 'teamA';
          }
          if (sideHistory.has(tBId)) {
            const hB = sideHistory.get(tBId);
            hB.teamB += 1;
            hB.lastSide = 'teamB';
          }
        }
      }
    }
  }

  // 4. Deterministic sorting of teams by authoritative standings
  // Order:
  // 1. Match Points DESC
  // 2. Board Points DESC
  // 3. Score Difference DESC
  // 4. Team Name ASC
  // 5. Team ID ASC
  const sortedTeams = [...normalizedTeams].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (b.boardPoints !== a.boardPoints) return b.boardPoints - a.boardPoints;
    if (b.scoreDifference !== a.scoreDifference) return b.scoreDifference - a.scoreDifference;
    const nameCmp = (a.name || '').localeCompare(b.name || '');
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });

  const isOdd = sortedTeams.length % 2 !== 0;

  // 5. BYE Candidate Selection for Odd Team Counts
  let byeCandidates = [null];

  if (isOdd) {
    // Generate ordered list of BYE candidates:
    // Prefer:
    // 1. Teams that have NOT previously received a BYE
    // 2. Lower match points first (bottom of standings)
    // 3. Lower board points first
    // 4. Lower score difference first
    // 5. Team name ASC
    // 6. Team ID ASC
    const candidates = [...sortedTeams].sort((a, b) => {
      const aHadBye = byeHistory.has(a.id);
      const bHadBye = byeHistory.has(b.id);
      if (aHadBye !== bHadBye) return aHadBye ? 1 : -1;
      if (a.matchPoints !== b.matchPoints) return a.matchPoints - b.matchPoints;
      if (a.boardPoints !== b.boardPoints) return a.boardPoints - b.boardPoints;
      if (a.scoreDifference !== b.scoreDifference) return a.scoreDifference - b.scoreDifference;
      const nameCmp = (a.name || '').localeCompare(b.name || '');
      if (nameCmp !== 0) return nameCmp;
      return a.id.localeCompare(b.id);
    });
    byeCandidates = candidates;
  }

  let finalRawPairs = null;
  let chosenByeTeam = null;
  let chosenByeReason = null;
  let usedRematches = false;

  // Try finding a strict non-repeat pairing first across all BYE candidates
  for (const byeCandidate of byeCandidates) {
    const pool = byeCandidate
      ? sortedTeams.filter((t) => t.id !== byeCandidate.id)
      : sortedTeams;

    const pairs = findStrictSwissPairsBacktracking(pool, opponentsMap, sideHistory);
    if (pairs !== null) {
      finalRawPairs = pairs;
      chosenByeTeam = byeCandidate ? byeCandidate.id : null;
      if (byeCandidate) {
        chosenByeReason = byeHistory.has(byeCandidate.id)
          ? 'Lowest ranked team (all eligible teams have received prior BYEs)'
          : 'Lowest ranked eligible team with no prior BYE';
      }
      usedRematches = false;
      break;
    }
  }

  // 6. Fallback when strict non-repeat pairings are mathematically impossible
  if (!finalRawPairs) {
    const allowRematches = options.allowRematches !== false;

    if (!allowRematches) {
      const error = new Error(
        'Cannot generate Swiss round: no valid pairings exist without repeat matchups. All possible non-repeat opponent pairings have been exhausted.'
      );
      error.statusCode = 400;
      error.code = 'ALL_MATCHUPS_EXHAUSTED';
      throw error;
    }

    // Rematch backtracking search
    for (const byeCandidate of byeCandidates) {
      const pool = byeCandidate
        ? sortedTeams.filter((t) => t.id !== byeCandidate.id)
        : sortedTeams;

      const pairs = findRematchSwissPairsBacktracking(pool, matchCountsMap, sideHistory);
      if (pairs !== null) {
        finalRawPairs = pairs;
        chosenByeTeam = byeCandidate ? byeCandidate.id : null;
        if (byeCandidate) {
          chosenByeReason = byeHistory.has(byeCandidate.id)
            ? 'Lowest ranked team (rematch fallback)'
            : 'Lowest ranked eligible team with no prior BYE';
        }
        usedRematches = true;
        break;
      }
    }
  }

  if (!finalRawPairs) {
    const error = new Error(
      'Cannot generate Swiss pairings: unable to find any valid pairings for the given teams.'
    );
    error.statusCode = 400;
    error.code = 'NO_VALID_PAIRINGS';
    throw error;
  }

  // 7. Assign Sides (teamA / teamB) and format output pairings
  const finalPairings = finalRawPairs.map(([p1, p2], matchIdx) => {
    const { teamA, teamB } = assignSides(p1, p2, sideHistory, matchIdx);
    const priorMeetings = (matchCountsMap.get(teamA.id)?.get(teamB.id)) || 0;
    const isRematch = priorMeetings > 0;

    let repeatAvoidance = 'Fresh opponent (no prior matchup)';
    if (isRematch) {
      repeatAvoidance = `Rematch (played ${priorMeetings} time${priorMeetings > 1 ? 's' : ''} previously; all valid non-repeat options exhausted)`;
    }

    return {
      teamA: teamA.id,
      teamB: teamB.id,
      teamAPoints: teamA.matchPoints,
      teamBPoints: teamB.matchPoints,
      isRematch,
      priorMeetings,
      repeatAvoidance,
    };
  });

  return {
    roundNumber,
    pairings: finalPairings,
    byeTeam: chosenByeTeam,
    byeReason: chosenByeReason,
    hadRematches: usedRematches || finalPairings.some((p) => p.isRematch),
    totalMatches: finalPairings.length,
    eligibleTeamsCount: sortedTeams.length,
  };
};

export default {
  normalizeTeamIds,
  generateTeamSwissPairings,
};
