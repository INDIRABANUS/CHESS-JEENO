/**
 * evaluateSwissEngine.js — Evaluation & Spike Utility
 *
 * Evaluates whether the external TypeScript library @echecs/swiss
 * can reliably handle CHESS JEENO's Swiss pairing requirements.
 *
 * NOTE: This is an evaluation script only.
 * It is NOT imported by any production tournament code.
 */

import { pair as pairDutch } from '@echecs/swiss';
import { pair as pairDubov } from '@echecs/swiss/dubov';
import { generateSwissPairings } from './swissPairing.js';

// ============================================================================
// 1. ADAPTER IMPLEMENTATION
// ============================================================================

/**
 * Translates CHESS JEENO tournament data structures into the @echecs/swiss expected format.
 *
 * Assumptions & Mappings:
 * - CHESS JEENO players have an `id` (or `_id`, `userId`), and optionally a `rating`.
 * - @echecs/swiss expects `Player[]` where each object has `{ id: string, rating?: number }`.
 * - CHESS JEENO previous rounds contain `roundNumber`, `pairings[]`, and `byePlayer`.
 * - @echecs/swiss expects `CompletedRound[]` where each round has:
 *     - `byes: Array<{ kind: 'pairing' | 'full' | 'half' | 'zero', player: string }>`
 *     - `games: Array<{ white: string, black: string, result: 'white' | 'black' | 'draw' | 'none' }>`
 * - Result translation:
 *     - '1-0' or 'WHITE_WIN' -> 'white'
 *     - '0-1' or 'BLACK_WIN' -> 'black'
 *     - '1/2-1/2' or 'DRAW'  -> 'draw'
 *     - other / aborted      -> 'none'
 *
 * @param {Array<Object>} players - CHESS JEENO player representations
 * @param {Array<Object>} previousRounds - Chronological previous Round documents
 * @returns {{ echecsPlayers: Array<Object>, echecsRounds: Array<Object> }}
 */
export const adaptChessJeenoToEchecs = (players, previousRounds = []) => {
  const echecsPlayers = players.map((p) => {
    const id = (p.id || p.userId?._id || p._id || p).toString();
    const rating = p.rating ? Number(p.rating) : undefined;
    return rating ? { id, rating } : { id };
  });

  const sortedRounds = [...previousRounds].sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));

  const echecsRounds = sortedRounds.map((round) => {
    const byes = [];
    if (round.byePlayer) {
      const byeId = (round.byePlayer._id || round.byePlayer?.id || round.byePlayer).toString();
      byes.push({ kind: 'pairing', player: byeId });
    }

    const games = [];
    if (Array.isArray(round.pairings)) {
      for (const p of round.pairings) {
        const white = (p.whitePlayer?._id || p.whitePlayer?.id || p.whitePlayer)?.toString();
        const black = (p.blackPlayer?._id || p.blackPlayer?.id || p.blackPlayer)?.toString();

        if (white && black) {
          let result = 'none';
          if (p.result === '1-0' || p.result === 'WHITE_WIN') result = 'white';
          else if (p.result === '0-1' || p.result === 'BLACK_WIN') result = 'black';
          else if (p.result === '1/2-1/2' || p.result === 'DRAW') result = 'draw';

          games.push({ white, black, result });
        }
      }
    }

    return { byes, games };
  });

  return { echecsPlayers, echecsRounds };
};

/**
 * Normalizes output from @echecs/swiss into a standard comparison format.
 *
 * @param {Object} raw - Raw output from @echecs/swiss
 * @returns {{ pairings: Array<{ whitePlayer: string, blackPlayer: string }>, byePlayer: string|null }}
 */
export const normalizeEchecsResult = (raw) => {
  if (!raw) return { pairings: [], byePlayer: null };
  const pairings = (raw.games || []).map((g) => ({
    whitePlayer: g.white,
    blackPlayer: g.black,
  }));
  const byePlayer = raw.byes && raw.byes.length > 0 ? raw.byes[0].player : null;
  return { pairings, byePlayer };
};

/**
 * Normalizes output from CHESS JEENO's generateSwissPairings.
 *
 * @param {Object} raw - Output from generateSwissPairings
 * @returns {{ pairings: Array<{ whitePlayer: string, blackPlayer: string }>, byePlayer: string|null }}
 */
export const normalizeChessJeenoResult = (raw) => {
  if (!raw) return { pairings: [], byePlayer: null };
  const pairings = (raw.pairings || []).map((p) => ({
    whitePlayer: (p.whitePlayer?._id || p.whitePlayer)?.toString(),
    blackPlayer: (p.blackPlayer?._id || p.blackPlayer)?.toString(),
  }));
  const byePlayer = raw.byePlayer ? (raw.byePlayer._id || raw.byePlayer).toString() : null;
  return { pairings, byePlayer };
};

// ============================================================================
// 2. SCENARIO EVALUATION RUNNER
// ============================================================================

/**
 * Helper to compute cumulative scores and standings for scenario logging.
 */
const computeScoresFromRounds = (players, rounds) => {
  const scoreMap = new Map();
  for (const p of players) {
    scoreMap.set(p.id, 0);
  }

  for (const r of rounds) {
    if (r.byePlayer) {
      const bId = (r.byePlayer._id || r.byePlayer?.id || r.byePlayer).toString();
      scoreMap.set(bId, (scoreMap.get(bId) || 0) + 1);
    }
    if (Array.isArray(r.pairings)) {
      for (const p of r.pairings) {
        const wId = (p.whitePlayer?._id || p.whitePlayer?.id || p.whitePlayer)?.toString();
        const bId = (p.blackPlayer?._id || p.blackPlayer?.id || p.blackPlayer)?.toString();
        if (p.result === '1-0') {
          scoreMap.set(wId, (scoreMap.get(wId) || 0) + 1);
        } else if (p.result === '0-1') {
          scoreMap.set(bId, (scoreMap.get(bId) || 0) + 1);
        } else if (p.result === '1/2-1/2') {
          scoreMap.set(wId, (scoreMap.get(wId) || 0) + 0.5);
          scoresMap.set(bId, (scoresMap.get(bId) || 0) + 0.5);
        }
      }
    }
  }

  return scoreMap;
};

/**
 * Checks whether any pairing in a set repeats an opponent from previous rounds.
 */
const checkForRepeatedOpponents = (pairings, previousRounds) => {
  const previousMatchups = new Set();
  for (const r of previousRounds) {
    if (Array.isArray(r.pairings)) {
      for (const p of r.pairings) {
        const w = (p.whitePlayer?._id || p.whitePlayer?.id || p.whitePlayer)?.toString();
        const b = (p.blackPlayer?._id || p.blackPlayer?.id || p.blackPlayer)?.toString();
        if (w && b) {
          const key = [w, b].sort().join(' vs ');
          previousMatchups.add(key);
        }
      }
    }
  }

  const repeated = [];
  for (const p of pairings) {
    const key = [p.whitePlayer, p.blackPlayer].sort().join(' vs ');
    if (previousMatchups.has(key)) {
      repeated.push(key);
    }
  }

  return { hasRepeats: repeated.length > 0, repeatedMatchups: repeated };
};

/**
 * Checks whether matchups match regardless of color orientation.
 */
const areMatchupsEquivalent = (pairs1, pairs2) => {
  if (pairs1.length !== pairs2.length) return false;
  const set1 = new Set(pairs1.map((p) => [p.whitePlayer, p.blackPlayer].sort().join(' vs ')));
  const set2 = new Set(pairs2.map((p) => [p.whitePlayer, p.blackPlayer].sort().join(' vs ')));
  if (set1.size !== set2.size) return false;
  for (const item of set1) {
    if (!set2.has(item)) return false;
  }
  return true;
};

/**
 * Evaluates a single scenario across both engines.
 */
export const evaluateScenario = (scenario) => {
  const { name, players, previousRounds = [], roundNumber = 1 } = scenario;

  // 1. Adapter conversion
  const { echecsPlayers, echecsRounds } = adaptChessJeenoToEchecs(players, previousRounds);

  // 2. Prepare CHESS JEENO standings input
  const standings = players.map((p) => ({
    playerId: p.id,
    name: p.name || p.id,
    score: p.score || 0,
    wins: p.wins || 0,
    draws: p.draws || 0,
    losses: p.losses || 0,
  }));

  // 3. Run external engine (@echecs/swiss Dutch)
  let echecsResult = null;
  let echecsError = null;
  let isEchecsDeterministic = true;

  try {
    const run1 = pairDutch(echecsPlayers, echecsRounds);
    const run2 = pairDutch(echecsPlayers, echecsRounds);
    const run3 = pairDutch(echecsPlayers, echecsRounds);

    if (
      JSON.stringify(run1) !== JSON.stringify(run2) ||
      JSON.stringify(run1) !== JSON.stringify(run3)
    ) {
      isEchecsDeterministic = false;
    }
    echecsResult = normalizeEchecsResult(run1);
  } catch (err) {
    echecsError = `${err.constructor.name}: ${err.message}`;
  }

  // 4. Run CHESS JEENO engine
  let jeenoResult = null;
  let jeenoError = null;
  let isJeenoDeterministic = true;

  try {
    const run1 = generateSwissPairings({
      players,
      standings,
      previousRounds,
      roundNumber,
    });
    const run2 = generateSwissPairings({
      players,
      standings,
      previousRounds,
      roundNumber,
    });
    const run3 = generateSwissPairings({
      players,
      standings,
      previousRounds,
      roundNumber,
    });

    if (
      JSON.stringify(run1) !== JSON.stringify(run2) ||
      JSON.stringify(run1) !== JSON.stringify(run3)
    ) {
      isJeenoDeterministic = false;
    }
    jeenoResult = normalizeChessJeenoResult(run1);
  } catch (err) {
    jeenoError = `${err.constructor.name}: ${err.message}`;
  }

  // 5. Analysis
  const existingPairings = previousRounds.map((r) => ({
    round: r.roundNumber,
    pairings: (r.pairings || []).map((p) => `${p.whitePlayer} vs ${p.blackPlayer}`),
    bye: r.byePlayer || null,
  }));

  const echecsRepeats = echecsResult
    ? checkForRepeatedOpponents(echecsResult.pairings, previousRounds)
    : { hasRepeats: false, repeatedMatchups: [] };

  const jeenoRepeats = jeenoResult
    ? checkForRepeatedOpponents(jeenoResult.pairings, previousRounds)
    : { hasRepeats: false, repeatedMatchups: [] };

  // Comparison categories
  let comparison = 'different';
  if (echecsError && jeenoError) {
    comparison = 'both_unable_to_pair';
  } else if (echecsError && !jeenoError) {
    comparison = 'external_unable_to_pair';
  } else if (!echecsError && jeenoError) {
    comparison = 'jeeno_unable_to_pair';
  } else if (echecsResult && jeenoResult) {
    const sameMatchups = areMatchupsEquivalent(echecsResult.pairings, jeenoResult.pairings);
    const sameByes = echecsResult.byePlayer === jeenoResult.byePlayer;
    const sameColors = JSON.stringify(echecsResult.pairings) === JSON.stringify(jeenoResult.pairings);

    if (sameMatchups && sameByes && sameColors) {
      comparison = 'identical_pairing_and_colors';
    } else if (sameMatchups && sameByes && !sameColors) {
      comparison = 'same_matchups_different_colors';
    } else if (!sameMatchups && sameByes) {
      comparison = 'different_matchups_same_bye';
    } else if (sameMatchups && !sameByes) {
      comparison = 'same_matchups_different_bye';
    } else {
      comparison = 'different_matchups_and_different_bye';
    }
  }

  return {
    name,
    playerCount: players.length,
    completedRounds: previousRounds.length,
    currentScores: players.map((p) => `${p.id}: ${p.score || 0}`).join(', '),
    existingPairings,
    roundNumber,
    external: {
      succeeded: !echecsError,
      pairings: echecsResult ? echecsResult.pairings : [],
      bye: echecsResult ? echecsResult.byePlayer : null,
      error: echecsError,
      hasRepeatedOpponents: echecsRepeats.hasRepeats,
      repeatedMatchups: echecsRepeats.repeatedMatchups,
      isDeterministic: isEchecsDeterministic,
    },
    jeeno: {
      succeeded: !jeenoError,
      pairings: jeenoResult ? jeenoResult.pairings : [],
      bye: jeenoResult ? jeenoResult.byePlayer : null,
      error: jeenoError,
      hasRepeatedOpponents: jeenoRepeats.hasRepeats,
      repeatedMatchups: jeenoRepeats.repeatedMatchups,
      isDeterministic: isJeenoDeterministic,
    },
    comparison,
  };
};

// ============================================================================
// 3. DETERMINISTIC TEST SCENARIOS DEFINITION
// ============================================================================

export const runAllEvaluationScenarios = () => {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('CHESS JEENO — SWISS ENGINE EVALUATION SUITE');
  console.log('Evaluating @echecs/swiss (FIDE Dutch) vs CHESS JEENO Swiss Engine');
  console.log('══════════════════════════════════════════════════════════════════\n');

  const results = [];

  // ==========================================================================
  // SCENARIO A: 4 Players (Round 1, Round 2, Round 3)
  // ==========================================================================
  const players4 = [
    { id: 'Alice', name: 'Alice', score: 0, rating: 2200 },
    { id: 'Bob', name: 'Bob', score: 0, rating: 2000 },
    { id: 'Carol', name: 'Carol', score: 0, rating: 1800 },
    { id: 'Dave', name: 'Dave', score: 0, rating: 1600 },
  ];

  // A.1: Round 1
  results.push(
    evaluateScenario({
      name: 'Scenario A.1: 4 Players - Round 1 (Initial Seeding)',
      players: players4,
      previousRounds: [],
      roundNumber: 1,
    })
  );

  // A.2: Round 2 (Alice beat Carol [1-0], Bob drew with Dave [0.5-0.5])
  const round1A = {
    roundNumber: 1,
    pairings: [
      { whitePlayer: 'Alice', blackPlayer: 'Carol', result: '1-0' },
      { whitePlayer: 'Bob', blackPlayer: 'Dave', result: '1/2-1/2' },
    ],
  };
  const players4R2 = [
    { id: 'Alice', name: 'Alice', score: 1 },
    { id: 'Bob', name: 'Bob', score: 0.5 },
    { id: 'Dave', name: 'Dave', score: 0.5 },
    { id: 'Carol', name: 'Carol', score: 0 },
  ];
  results.push(
    evaluateScenario({
      name: 'Scenario A.2: 4 Players - Round 2 (Score Groups: 1, 0.5, 0)',
      players: players4R2,
      previousRounds: [round1A],
      roundNumber: 2,
    })
  );

  // A.3: Round 3 (Alice drew Bob [0.5-0.5], Carol beat Dave [1-0])
  const round2A = {
    roundNumber: 2,
    pairings: [
      { whitePlayer: 'Bob', blackPlayer: 'Alice', result: '1/2-1/2' },
      { whitePlayer: 'Dave', blackPlayer: 'Carol', result: '0-1' },
    ],
  };
  const players4R3 = [
    { id: 'Alice', name: 'Alice', score: 1.5 },
    { id: 'Carol', name: 'Carol', score: 1 },
    { id: 'Bob', name: 'Bob', score: 1 },
    { id: 'Dave', name: 'Dave', score: 0.5 },
  ];
  results.push(
    evaluateScenario({
      name: 'Scenario A.3: 4 Players - Round 3 (Final Round of 4-Player Swiss)',
      players: players4R3,
      previousRounds: [round1A, round2A],
      roundNumber: 3,
    })
  );

  // ==========================================================================
  // SCENARIO B: 5 Players (Odd Count, BYE handling, Subsequent Rounds)
  // ==========================================================================
  const players5 = [
    { id: 'P1', name: 'P1', score: 0, rating: 2100 },
    { id: 'P2', name: 'P2', score: 0, rating: 1900 },
    { id: 'P3', name: 'P3', score: 0, rating: 1700 },
    { id: 'P4', name: 'P4', score: 0, rating: 1500 },
    { id: 'P5', name: 'P5', score: 0, rating: 1300 },
  ];

  // B.1: Round 1 (5 players, 1 BYE)
  results.push(
    evaluateScenario({
      name: 'Scenario B.1: 5 Players - Round 1 (Odd player BYE assignment)',
      players: players5,
      previousRounds: [],
      roundNumber: 1,
    })
  );

  // B.2: Round 2 (P5 got BYE in R1, P1 beat P3, P2 beat P4)
  const round1B = {
    roundNumber: 1,
    byePlayer: 'P5',
    pairings: [
      { whitePlayer: 'P1', blackPlayer: 'P3', result: '1-0' },
      { whitePlayer: 'P4', blackPlayer: 'P2', result: '0-1' },
    ],
  };
  const players5R2 = [
    { id: 'P1', name: 'P1', score: 1 },
    { id: 'P2', name: 'P2', score: 1 },
    { id: 'P5', name: 'P5', score: 1 },
    { id: 'P3', name: 'P3', score: 0 },
    { id: 'P4', name: 'P4', score: 0 },
  ];
  results.push(
    evaluateScenario({
      name: 'Scenario B.2: 5 Players - Round 2 (P5 had BYE, cannot receive 2nd BYE)',
      players: players5R2,
      previousRounds: [round1B],
      roundNumber: 2,
    })
  );

  // ==========================================================================
  // SCENARIO C: 6 Players (Multiple Rounds, No Repeated Opponents)
  // ==========================================================================
  const players6 = [
    { id: 'P1', name: 'P1', score: 1 },
    { id: 'P2', name: 'P2', score: 1 },
    { id: 'P3', name: 'P3', score: 1 },
    { id: 'P4', name: 'P4', score: 0 },
    { id: 'P5', name: 'P5', score: 0 },
    { id: 'P6', name: 'P6', score: 0 },
  ];
  const round1C = {
    roundNumber: 1,
    pairings: [
      { whitePlayer: 'P1', blackPlayer: 'P4', result: '1-0' },
      { whitePlayer: 'P2', blackPlayer: 'P5', result: '1-0' },
      { whitePlayer: 'P3', blackPlayer: 'P6', result: '1-0' },
    ],
  };
  results.push(
    evaluateScenario({
      name: 'Scenario C: 6 Players - Round 2 (Score Groups 1 vs 1 and 0 vs 0)',
      players: players6,
      previousRounds: [round1C],
      roundNumber: 2,
    })
  );

  // ==========================================================================
  // SCENARIO D: 7 Players (BYE Distribution & Score Groups)
  // ==========================================================================
  const players7 = [
    { id: 'P1', name: 'P1', score: 1 },
    { id: 'P2', name: 'P2', score: 1 },
    { id: 'P3', name: 'P3', score: 1 },
    { id: 'P7', name: 'P7', score: 1 }, // P7 had BYE in R1
    { id: 'P4', name: 'P4', score: 0 },
    { id: 'P5', name: 'P5', score: 0 },
    { id: 'P6', name: 'P6', score: 0 },
  ];
  const round1D = {
    roundNumber: 1,
    byePlayer: 'P7',
    pairings: [
      { whitePlayer: 'P1', blackPlayer: 'P4', result: '1-0' },
      { whitePlayer: 'P2', blackPlayer: 'P5', result: '1-0' },
      { whitePlayer: 'P3', blackPlayer: 'P6', result: '1-0' },
    ],
  };
  results.push(
    evaluateScenario({
      name: 'Scenario D: 7 Players - Round 2 (BYE distribution among score 0 players)',
      players: players7,
      previousRounds: [round1D],
      roundNumber: 2,
    })
  );

  // ==========================================================================
  // SCENARIO E: 8 Players (Multiple Score Groups, Multiple Rounds)
  // ==========================================================================
  const players8 = [
    { id: 'A', name: 'A', score: 2 },
    { id: 'B', name: 'B', score: 1.5 },
    { id: 'C', name: 'C', score: 1.5 },
    { id: 'D', name: 'D', score: 1 },
    { id: 'E', name: 'E', score: 1 },
    { id: 'F', name: 'F', score: 0.5 },
    { id: 'G', name: 'G', score: 0.5 },
    { id: 'H', name: 'H', score: 0 },
  ];
  const round1E = {
    roundNumber: 1,
    pairings: [
      { whitePlayer: 'A', blackPlayer: 'E', result: '1-0' },
      { whitePlayer: 'B', blackPlayer: 'F', result: '1-0' },
      { whitePlayer: 'C', blackPlayer: 'G', result: '1-0' },
      { whitePlayer: 'D', blackPlayer: 'H', result: '1-0' },
    ],
  };
  const round2E = {
    roundNumber: 2,
    pairings: [
      { whitePlayer: 'D', blackPlayer: 'A', result: '0-1' },
      { whitePlayer: 'B', blackPlayer: 'C', result: '1/2-1/2' },
      { whitePlayer: 'F', blackPlayer: 'G', result: '1/2-1/2' },
      { whitePlayer: 'E', blackPlayer: 'H', result: '1-0' },
    ],
  };
  results.push(
    evaluateScenario({
      name: 'Scenario E: 8 Players - Round 3 (4 distinct score brackets: 2, 1.5, 1, 0.5, 0)',
      players: players8,
      previousRounds: [round1E, round2E],
      roundNumber: 3,
    })
  );

  // ==========================================================================
  // SCENARIO F: Previous-Opponent Restriction
  // ==========================================================================
  // Ensure that even if players share the same score, they are not paired if they previously played
  const playersF = [
    { id: 'X1', name: 'X1', score: 1 },
    { id: 'X2', name: 'X2', score: 1 },
    { id: 'X3', name: 'X3', score: 1 },
    { id: 'X4', name: 'X4', score: 1 },
  ];
  const round1F = {
    roundNumber: 1,
    pairings: [
      { whitePlayer: 'X1', blackPlayer: 'X2', result: '1/2-1/2' },
      { whitePlayer: 'X3', blackPlayer: 'X4', result: '1/2-1/2' },
    ],
  };
  results.push(
    evaluateScenario({
      name: 'Scenario F: Previous-Opponent Restriction (X1 must NOT play X2 again)',
      players: playersF,
      previousRounds: [round1F],
      roundNumber: 2,
    })
  );

  // ==========================================================================
  // SCENARIO G: Colour History & Balancing
  // ==========================================================================
  // P1 played White twice in a row; P2 played Black twice in a row
  const playersG = [
    { id: 'WhiteLover', name: 'WhiteLover', score: 1 },
    { id: 'BlackLover', name: 'BlackLover', score: 1 },
    { id: 'Neutral1', name: 'Neutral1', score: 1 },
    { id: 'Neutral2', name: 'Neutral2', score: 1 },
  ];
  const round1G = {
    roundNumber: 1,
    pairings: [
      { whitePlayer: 'WhiteLover', blackPlayer: 'Neutral1', result: '1-0' },
      { whitePlayer: 'Neutral2', blackPlayer: 'BlackLover', result: '0-1' },
    ],
  };
  const round2G = {
    roundNumber: 2,
    pairings: [
      { whitePlayer: 'WhiteLover', blackPlayer: 'Neutral2', result: '0-1' },
      { whitePlayer: 'Neutral1', blackPlayer: 'BlackLover', result: '1-0' },
    ],
  };
  results.push(
    evaluateScenario({
      name: 'Scenario G: Colour History (WhiteLover had 2 Whites, BlackLover had 2 Blacks)',
      players: playersG,
      previousRounds: [round1G, round2G],
      roundNumber: 3,
    })
  );

  // ==========================================================================
  // SCENARIO H: Score Groups (Ties vs Spreads)
  // ==========================================================================
  const playersH = [
    { id: 'Top1', name: 'Top1', score: 2 },
    { id: 'Mid1', name: 'Mid1', score: 1 },
    { id: 'Mid2', name: 'Mid2', score: 1 },
    { id: 'Mid3', name: 'Mid3', score: 1 },
    { id: 'Mid4', name: 'Mid4', score: 1 },
    { id: 'Bot1', name: 'Bot1', score: 0 },
  ];
  const round1H = {
    roundNumber: 1,
    pairings: [
      { whitePlayer: 'Top1', blackPlayer: 'Bot1', result: '1-0' },
      { whitePlayer: 'Mid1', blackPlayer: 'Mid2', result: '1/2-1/2' },
      { whitePlayer: 'Mid3', blackPlayer: 'Mid4', result: '1/2-1/2' },
    ],
  };
  const round2H = {
    roundNumber: 2,
    pairings: [
      { whitePlayer: 'Mid1', blackPlayer: 'Top1', result: '0-1' },
      { whitePlayer: 'Mid2', blackPlayer: 'Mid3', result: '1/2-1/2' },
      { whitePlayer: 'Mid4', blackPlayer: 'Bot1', result: '1/2-1/2' },
    ],
  };
  results.push(
    evaluateScenario({
      name: 'Scenario H: Score Groups Down-Floating (Top1 on 2pts must float down to 1pt group)',
      players: playersH,
      previousRounds: [round1H, round2H],
      roundNumber: 3,
    })
  );

  // ==========================================================================
  // SCENARIO I: Late Tournament State (Round 4 of 4)
  // ==========================================================================
  // 6 players after 4 rounds
  const playersI = [
    { id: 'P1', name: 'P1', score: 3 },
    { id: 'P2', name: 'P2', score: 2.5 },
    { id: 'P3', name: 'P3', score: 2 },
    { id: 'P4', name: 'P4', score: 2 },
    { id: 'P5', name: 'P5', score: 1.5 },
    { id: 'P6', name: 'P6', score: 1 },
  ];
  const roundsI = [
    {
      roundNumber: 1,
      pairings: [
        { whitePlayer: 'P1', blackPlayer: 'P4', result: '1-0' },
        { whitePlayer: 'P2', blackPlayer: 'P5', result: '1-0' },
        { whitePlayer: 'P3', blackPlayer: 'P6', result: '1-0' },
      ],
    },
    {
      roundNumber: 2,
      pairings: [
        { whitePlayer: 'P1', blackPlayer: 'P2', result: '1/2-1/2' },
        { whitePlayer: 'P3', blackPlayer: 'P4', result: '1/2-1/2' },
        { whitePlayer: 'P5', blackPlayer: 'P6', result: '1/2-1/2' },
      ],
    },
    {
      roundNumber: 3,
      pairings: [
        { whitePlayer: 'P3', blackPlayer: 'P1', result: '0-1' },
        { whitePlayer: 'P2', blackPlayer: 'P4', result: '1-0' },
        { whitePlayer: 'P6', blackPlayer: 'P5', result: '1/2-1/2' },
      ],
    },
    {
      roundNumber: 4,
      pairings: [
        { whitePlayer: 'P1', blackPlayer: 'P5', result: '1/2-1/2' },
        { whitePlayer: 'P4', blackPlayer: 'P6', result: '1/2-1/2' },
        { whitePlayer: 'P2', blackPlayer: 'P3', result: '0-1' },
      ],
    },
  ];
  results.push(
    evaluateScenario({
      name: 'Scenario I: Late Tournament State (6 players, Round 5 pairing check)',
      players: playersI,
      previousRounds: roundsI,
      roundNumber: 5,
    })
  );

  // ==========================================================================
  // SCENARIO J: Exhausted Pairing State (All valid pairings exhausted)
  // ==========================================================================
  // In 4 players, after 3 rounds, every player has played all other 3 players.
  // Round 4 is mathematically impossible without repeats.
  const playersJ = [
    { id: 'A', name: 'A', score: 2.5 },
    { id: 'B', name: 'B', score: 1.5 },
    { id: 'C', name: 'C', score: 1 },
    { id: 'D', name: 'D', score: 1 },
  ];
  const roundsJ = [
    {
      roundNumber: 1,
      pairings: [
        { whitePlayer: 'A', blackPlayer: 'C', result: '1-0' },
        { whitePlayer: 'D', blackPlayer: 'B', result: '0-1' },
      ],
    },
    {
      roundNumber: 2,
      pairings: [
        { whitePlayer: 'B', blackPlayer: 'A', result: '1/2-1/2' },
        { whitePlayer: 'C', blackPlayer: 'D', result: '1/2-1/2' },
      ],
    },
    {
      roundNumber: 3,
      pairings: [
        { whitePlayer: 'A', blackPlayer: 'D', result: '1-0' },
        { whitePlayer: 'B', blackPlayer: 'C', result: '0-1' },
      ],
    },
  ];
  results.push(
    evaluateScenario({
      name: 'Scenario J: Exhausted Pairing State (4 players after 3 complete rounds)',
      players: playersJ,
      previousRounds: roundsJ,
      roundNumber: 4,
    })
  );

  // ==========================================================================
  // SCENARIO K: Invalid / Impossible States
  // ==========================================================================
  // K.1: Insufficient players (< 2)
  results.push(
    evaluateScenario({
      name: 'Scenario K.1: Insufficient Players (Only 1 player)',
      players: [{ id: 'Solo', name: 'Solo', score: 0 }],
      previousRounds: [],
      roundNumber: 1,
    })
  );

  // K.2: Inconsistent / unknown player in previous round
  results.push(
    evaluateScenario({
      name: 'Scenario K.2: Inconsistent History (Ghost player in round 1)',
      players: [
        { id: 'Real1', name: 'Real1', score: 1 },
        { id: 'Real2', name: 'Real2', score: 0 },
      ],
      previousRounds: [
        {
          roundNumber: 1,
          pairings: [{ whitePlayer: 'Real1', blackPlayer: 'GhostUser999', result: '1-0' }],
        },
      ],
      roundNumber: 2,
    })
  );

  // K.3: Duplicate game in same round
  results.push(
    evaluateScenario({
      name: 'Scenario K.3: Duplicate Game in Same Round',
      players: [
        { id: 'P1', name: 'P1', score: 1 },
        { id: 'P2', name: 'P2', score: 1 },
      ],
      previousRounds: [
        {
          roundNumber: 1,
          pairings: [
            { whitePlayer: 'P1', blackPlayer: 'P2', result: '1-0' },
            { whitePlayer: 'P1', blackPlayer: 'P2', result: '1-0' },
          ],
        },
      ],
      roundNumber: 2,
    })
  );

  // K.4: Invalid Player References (Duplicate player IDs in active players list)
  results.push(
    evaluateScenario({
      name: 'Scenario K.4: Invalid Player References (Duplicate Player ID in Roster)',
      players: [
        { id: 'DupUser', name: 'DupUser', score: 0 },
        { id: 'DupUser', name: 'DupUser', score: 0 },
      ],
      previousRounds: [],
      roundNumber: 1,
    })
  );

  // ==========================================================================
  // 4. PRINT FORMATTED RESULTS (TASK 7)
  // ==========================================================================
  for (const r of results) {
    console.log('──────────────────────────────────────────────────────────────────');
    console.log(`📋 ${r.name}`);
    console.log(`   Player Count:       ${r.playerCount}`);
    console.log(`   Completed Rounds:   ${r.completedRounds}`);
    console.log(`   Current Scores:     ${r.currentScores}`);
    console.log(
      `   Existing Pairings:  ${
        r.existingPairings.length === 0
          ? 'None (Round 1)'
          : r.existingPairings.map((ep) => `R${ep.round}: [${ep.pairings.join(', ')}]${ep.bye ? ` (BYE: ${ep.bye})` : ''}`).join('; ')
      }`
    );
    console.log(
      `   External Engine:    ${
        r.external.succeeded
          ? `SUCCESS -> [${r.external.pairings.map((p) => `${p.whitePlayer}(W) vs ${p.blackPlayer}(B)`).join(', ')}]${
              r.external.bye ? ` (BYE: ${r.external.bye})` : ''
            }`
          : `FAILED -> Error: ${r.external.error}`
      }`
    );
    console.log(`   External BYE:       ${r.external.bye || 'None'}`);
    console.log(`   External Repeated?: ${r.external.hasRepeatedOpponents ? `YES (${r.external.repeatedMatchups.join(', ')})` : 'NO'}`);
    console.log(`   External Determ.?:  ${r.external.isDeterministic ? 'YES (100% stable)' : 'NO'}`);
    console.log(
      `   CHESS JEENO Engine: ${
        r.jeeno.succeeded
          ? `SUCCESS -> [${r.jeeno.pairings.map((p) => `${p.whitePlayer}(W) vs ${p.blackPlayer}(B)`).join(', ')}]${
              r.jeeno.bye ? ` (BYE: ${r.jeeno.bye})` : ''
            }`
          : `FAILED -> Error: ${r.jeeno.error}`
      }`
    );
    console.log(`   Comparison Result:  ${r.comparison}`);
  }

  // ==========================================================================
  // 5. TOURNAMENT COMPLETION INVESTIGATION (TASK 9)
  // ==========================================================================
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('INVESTIGATION: TOURNAMENT COMPLETION DETECTION (TASK 9)');
  console.log('══════════════════════════════════════════════════════════════════');

  console.log(`
Question:
"After a Swiss round is completed, how can CHESS JEENO reliably determine
whether another valid Swiss round can be generated, versus the tournament
being genuinely complete?"

Key Findings from Investigation:

1. Configured totalRounds Reached:
   - When roundNumber >= tournament.totalRounds, tournament is complete by schedule.
   - CHESS JEENO currently handles this in roundService.js lines 422-427.

2. Exhausted Pairing State (Early Completion):
   - In Swiss tournaments with few players or high totalRounds (e.g. 4 players with totalRounds = 5),
     all valid matchups are completely exhausted after Round 3.
   - What @echecs/swiss returns:
     When pairings are exhausted, @echecs/swiss returns:
       { byes: [], games: [] } (an empty games array!)
     It does NOT throw an error when given valid CompletedRound[] data.
     Therefore: echecsResult.games.length === 0 indicates pairings are exhausted!
   - What CHESS JEENO currently does:
     generateSwissPairings throws an Error:
       "Cannot generate Swiss pairings: no valid pairings exist without repeat matchups."
     In roundService.js, this error currently causes createRound to fail with a 400 error
     rather than transitioning the tournament status to 'FINISHED'.

3. Reliable Tournament Completion Algorithm:
   A tournament is genuinely complete after round N when EITHER:
   A) N >= tournament.totalRounds (Scheduled conclusion)
   OR
   B) A probe call to the pairing engine for round N+1 yields:
      - For @echecs/swiss: result.games.length === 0 && result.byes.length === 0
      - For CHESS JEENO: generateSwissPairings throws the exhausted-pairings error
      In this case, the tournament can be marked FINISHED early with a note:
      "All possible matchups have been completed."
  `);

  return results;
};

// Execute if run directly via node
runAllEvaluationScenarios();
