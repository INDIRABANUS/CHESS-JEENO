/**
 * Team Round Robin pairing engine using the deterministic circle-method algorithm.
 *
 * Requirements & Mathematical Guarantees:
 * - Every eligible active team plays every other eligible active team exactly once across the full schedule.
 * - Never schedules a team against itself.
 * - Never schedules a team twice in the same round.
 * - For an even number of teams N:
 *     - Total rounds: N - 1
 *     - Matches per round: N / 2
 *     - Total matches: N * (N - 1) / 2
 *     - Zero BYEs
 * - For an odd number of teams N:
 *     - Dummy BYE placeholder added
 *     - Total rounds: N
 *     - Matches per round: (N - 1) / 2
 *     - Total matches: N * (N - 1) / 2
 *     - Exactly 1 BYE per round; every team receives exactly 1 BYE across the tournament.
 * - Minimum supported number of teams: 2.
 * - Stable team identifiers and deterministic ordering (sorted by string ID) so repeated
 *   generation from the same inputs produces the identical schedule.
 * - Balanced Home/Away (teamA / teamB) side assignment.
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
 * Generates the full Round Robin schedule using the circle-method algorithm.
 *
 * @param {Array<string|mongoose.Types.ObjectId|Object>} teams - List of eligible active teams
 * @returns {{
 *   totalTeams: number,
 *   totalRounds: number,
 *   totalMatches: number,
 *   byesCount: number,
 *   rounds: Array<{
 *     roundNumber: number,
 *     matches: Array<{ teamA: string, teamB: string }>,
 *     byeTeam: string|null
 *   }>
 * }}
 */
export const generateTeamRoundRobinSchedule = (teams) => {
  const normalizedIds = normalizeTeamIds(teams);

  if (normalizedIds.length < 2) {
    const error = new Error(
      `Round Robin scheduling requires at least 2 active teams. Provided: ${normalizedIds.length}`
    );
    error.statusCode = 400;
    throw error;
  }

  // Deduplicate and deterministically sort team IDs
  const uniqueSortedTeams = Array.from(new Set(normalizedIds)).sort((a, b) =>
    a.localeCompare(b)
  );

  if (uniqueSortedTeams.length < 2) {
    const error = new Error('Round Robin scheduling requires at least 2 distinct active teams.');
    error.statusCode = 400;
    throw error;
  }

  const n = uniqueSortedTeams.length;
  const isOdd = n % 2 !== 0;

  // Circle method list: if odd, append null as dummy BYE placeholder
  const rotatingList = [...uniqueSortedTeams];
  if (isOdd) {
    rotatingList.push(null);
  }

  const m = rotatingList.length; // Always even, m >= 2
  const totalRounds = m - 1;
  const expectedTotalMatches = (n * (n - 1)) / 2;

  const rounds = [];
  let totalMatchesCount = 0;
  let totalByesCount = 0;

  for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
    const roundNumber = roundIdx + 1;
    const matches = [];
    let byeTeam = null;

    for (let i = 0; i < m / 2; i++) {
      const p1 = rotatingList[i];
      const p2 = rotatingList[m - 1 - i];

      if (p1 === null) {
        byeTeam = p2;
        totalByesCount++;
      } else if (p2 === null) {
        byeTeam = p1;
        totalByesCount++;
      } else {
        if (p1 === p2) {
          throw new Error('Self-pairing detected in Round Robin algorithm');
        }

        // Alternating home/away balance across rounds and boards
        let teamA;
        let teamB;
        if ((roundIdx + i) % 2 === 0) {
          teamA = p1;
          teamB = p2;
        } else {
          teamA = p2;
          teamB = p1;
        }

        matches.push({ teamA, teamB });
        totalMatchesCount++;
      }
    }

    rounds.push({
      roundNumber,
      matches,
      byeTeam,
    });

    // Clockwise rotation: fix index 0, rotate indices 1 to m-1
    const last = rotatingList.pop();
    rotatingList.splice(1, 0, last);
  }

  if (totalMatchesCount !== expectedTotalMatches) {
    throw new Error(
      `Algorithm error: expected ${expectedTotalMatches} total matches, generated ${totalMatchesCount}`
    );
  }

  return {
    totalTeams: n,
    totalRounds,
    totalMatches: totalMatchesCount,
    byesCount: totalByesCount,
    rounds,
  };
};

export default {
  normalizeTeamIds,
  generateTeamRoundRobinSchedule,
};
