/**
 * Round Robin pairing engine using the standard cyclic polygon algorithm.
 * 
 * Guarantees:
 * - Every pair of players meets exactly once across the full schedule.
 * - Even player count N -> N - 1 rounds, N / 2 pairings per round.
 * - Odd player count N -> N rounds, (N - 1) / 2 pairings per round, exactly 1 BYE per round.
 * - Every player receives at most one BYE per tournament schedule.
 * - Deterministic color assignment (no random regeneration).
 * - whitePlayer !== blackPlayer always.
 */

/**
 * Generates the complete Round Robin schedule for an array of player IDs.
 * 
 * @param {Array<string|mongoose.Types.ObjectId>} players - Array of player identifiers
 * @returns {Array<{ roundNumber: number, pairings: Array<{ whitePlayer: string, blackPlayer: string }>, byePlayer: string|null }>}
 */
export const generateRoundRobinSchedule = (players) => {
  if (!players || !Array.isArray(players) || players.length < 2) {
    const error = new Error('At least 2 players are required to create a round.');
    error.statusCode = 400;
    throw error;
  }

  // Normalize IDs to string
  const normalizedPlayers = players.map((p) => {
    if (p && typeof p === 'object') {
      if (p.userId) {
        return p.userId._id ? p.userId._id.toString() : p.userId.toString();
      }
      if (p._id) {
        return p._id.toString();
      }
    }
    return p.toString();
  });

  const n = normalizedPlayers.length;
  const isOdd = n % 2 !== 0;

  // If odd, append null to represent the BYE dummy slot
  const rotatingList = [...normalizedPlayers];
  if (isOdd) {
    rotatingList.push(null);
  }

  const m = rotatingList.length; // Always even (m >= 2)
  const totalRounds = m - 1;
  const schedule = [];

  for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
    const roundNumber = roundIdx + 1;
    const pairings = [];
    let byePlayer = null;

    for (let i = 0; i < m / 2; i++) {
      const p1 = rotatingList[i];
      const p2 = rotatingList[m - 1 - i];

      if (p1 === null) {
        byePlayer = p2;
      } else if (p2 === null) {
        byePlayer = p1;
      } else {
        if (p1 === p2) {
          throw new Error('Self-pairing detected in Round Robin algorithm');
        }

        // Deterministic color assignment: alternate colors per round and board
        let whitePlayer;
        let blackPlayer;
        if ((roundIdx + i) % 2 === 0) {
          whitePlayer = p1;
          blackPlayer = p2;
        } else {
          whitePlayer = p2;
          blackPlayer = p1;
        }

        pairings.push({
          whitePlayer,
          blackPlayer,
        });
      }
    }

    schedule.push({
      roundNumber,
      pairings,
      byePlayer,
    });

    // Cyclic rotation: keep index 0 fixed, rotate the rest clockwise
    // Pop the last element and insert it at index 1
    const last = rotatingList.pop();
    rotatingList.splice(1, 0, last);
  }

  return schedule;
};

/**
 * Get pairings and bye for a specific round number.
 * 
 * @param {Array<string|mongoose.Types.ObjectId>} players 
 * @param {number} roundNumber 
 */
export const getPairingsForRound = (players, roundNumber) => {
  const schedule = generateRoundRobinSchedule(players);
  const totalRounds = schedule.length;

  if (roundNumber < 1 || roundNumber > totalRounds) {
    const error = new Error(
      `Invalid round number ${roundNumber}. Total rounds for this tournament format is ${totalRounds}.`
    );
    error.statusCode = 400;
    throw error;
  }

  return schedule[roundNumber - 1];
};

export default {
  generateRoundRobinSchedule,
  getPairingsForRound,
};
