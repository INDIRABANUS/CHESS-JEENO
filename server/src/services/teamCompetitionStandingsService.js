import mongoose from 'mongoose';
import TeamCompetition from '../models/TeamCompetition.js';
import TeamCompetitionTeam from '../models/TeamCompetitionTeam.js';
import TeamMatch from '../models/TeamMatch.js';
import TeamCompetitionStanding from '../models/TeamCompetitionStanding.js';

/**
 * Validates MongoDB ObjectId.
 */
export const validateObjectId = (id, fieldName = 'ID') => {
  if (!id || !mongoose.isValidObjectId(id)) {
    const error = new Error(`Invalid ${fieldName}`);
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Helper to convert ObjectId or populated object to string.
 */
const toIdString = (docOrId) => {
  if (!docOrId) return null;
  if (typeof docOrId === 'string') return docOrId;
  return docOrId._id ? docOrId._id.toString() : docOrId.toString();
};

/**
 * Calculates deterministic score for an individual board.
 *
 * Scoring Rules:
 * - win  = 1.0 pt (2 half-points)
 * - draw = 0.5 pt (1 half-point)
 * - loss = 0.0 pt (0 half-points)
 *
 * Color assignment policy:
 * - Odd boards (1, 3, 5...): Team A is White, Team B is Black
 * - Even boards (2, 4, 6...): Team B is White, Team A is Black
 * (Verified against board.whitePlayer / board.blackPlayer if populated)
 *
 * @param {Object} board
 * @returns {Object} board scoring details
 */
export const calculateBoardScore = (board) => {
  if (!board) {
    return {
      isTerminal: false,
      isScoreable: false,
      isAborted: false,
      teamAHalfPoints: 0,
      teamBHalfPoints: 0,
      teamAPoints: null,
      teamBPoints: null,
      effectiveResult: null,
    };
  }

  // An organizer override takes precedence over raw Lichess result
  const effectiveResult = board.overrideResult || board.result;

  if (!effectiveResult) {
    return {
      isTerminal: false,
      isScoreable: false,
      isAborted: false,
      teamAHalfPoints: 0,
      teamBHalfPoints: 0,
      teamAPoints: null,
      teamBPoints: null,
      effectiveResult: null,
    };
  }

  // ABORTED board policy: Non-scoreable without organizer override
  if (effectiveResult === 'ABORTED') {
    return {
      isTerminal: true,
      isScoreable: false,
      isAborted: true,
      teamAHalfPoints: 0,
      teamBHalfPoints: 0,
      teamAPoints: null,
      teamBPoints: null,
      effectiveResult: 'ABORTED',
    };
  }

  // Draw policy: 0.5 points to each team (1 half-point each)
  if (effectiveResult === '1/2-1/2' || effectiveResult === 'draw') {
    return {
      isTerminal: true,
      isScoreable: true,
      isAborted: false,
      teamAHalfPoints: 1,
      teamBHalfPoints: 1,
      teamAPoints: 0.5,
      teamBPoints: 0.5,
      effectiveResult: '1/2-1/2',
    };
  }

  // Determine which team played White
  let isTeamAWhite;
  if (board.whitePlayer && board.teamAPlayer) {
    isTeamAWhite = toIdString(board.whitePlayer) === toIdString(board.teamAPlayer);
  } else if (typeof board.boardNumber === 'number') {
    // Alternating policy: Odd board = Team A White, Even board = Team B White
    isTeamAWhite = board.boardNumber % 2 === 1;
  } else {
    isTeamAWhite = true;
  }

  if (effectiveResult === '1-0') {
    // White wins
    const teamAWins = isTeamAWhite;
    return {
      isTerminal: true,
      isScoreable: true,
      isAborted: false,
      teamAHalfPoints: teamAWins ? 2 : 0,
      teamBHalfPoints: teamAWins ? 0 : 2,
      teamAPoints: teamAWins ? 1 : 0,
      teamBPoints: teamAWins ? 0 : 1,
      effectiveResult: '1-0',
    };
  }

  if (effectiveResult === '0-1') {
    // Black wins
    const teamAWins = !isTeamAWhite;
    return {
      isTerminal: true,
      isScoreable: true,
      isAborted: false,
      teamAHalfPoints: teamAWins ? 2 : 0,
      teamBHalfPoints: teamAWins ? 0 : 2,
      teamAPoints: teamAWins ? 1 : 0,
      teamBPoints: teamAWins ? 0 : 1,
      effectiveResult: '0-1',
    };
  }

  // Unknown terminal format fallback
  return {
    isTerminal: true,
    isScoreable: false,
    isAborted: false,
    teamAHalfPoints: 0,
    teamBHalfPoints: 0,
    teamAPoints: null,
    teamBPoints: null,
    effectiveResult,
  };
};

/**
 * Calculates match result, team scores, match points, and scoring status from boards.
 *
 * Scoring Rules:
 * - teamAScore = sum of Team A board points
 * - teamBScore = sum of Team B board points
 * - Match Win  = 3 match points
 * - Match Draw = 1 match point
 * - Match Loss = 0 match points
 *
 * Aborted Board Policy:
 * - If any board is ABORTED (and not overridden), scoringStatus = REVIEW_REQUIRED
 * - No match points or winner awarded while in REVIEW_REQUIRED
 *
 * @param {Object} match
 * @param {Array<Object>} boards
 * @returns {Object} calculated match results
 */
export const calculateMatchScore = (match, boards = []) => {
  if (!boards || boards.length === 0) {
    return {
      isAllTerminal: false,
      hasAbortedBoard: false,
      hasNonScoreableBoard: false,
      scoringStatus: 'PENDING',
      teamAScore: 0,
      teamBScore: 0,
      teamAResult: null,
      teamBResult: null,
      winnerTeam: null,
      teamAMatchPoints: 0,
      teamBMatchPoints: 0,
      boardScores: [],
    };
  }

  let totalTeamAHalfPoints = 0;
  let totalTeamBHalfPoints = 0;
  let allTerminal = true;
  let hasAbortedBoard = false;
  let hasNonScoreableBoard = false;

  const boardScores = boards.map((b) => {
    const score = calculateBoardScore(b);
    if (!score.isTerminal) {
      allTerminal = false;
    }
    if (score.isAborted) {
      hasAbortedBoard = true;
      hasNonScoreableBoard = true;
    } else if (!score.isScoreable) {
      hasNonScoreableBoard = true;
    } else {
      totalTeamAHalfPoints += score.teamAHalfPoints;
      totalTeamBHalfPoints += score.teamBHalfPoints;
    }
    return {
      boardId: b._id,
      boardNumber: b.boardNumber,
      ...score,
    };
  });

  const teamAScore = totalTeamAHalfPoints / 2;
  const teamBScore = totalTeamBHalfPoints / 2;

  // If match has an aborted board or non-scoreable board, require organizer review
  if (hasAbortedBoard || hasNonScoreableBoard) {
    return {
      isAllTerminal: allTerminal,
      hasAbortedBoard,
      hasNonScoreableBoard,
      scoringStatus: 'REVIEW_REQUIRED',
      teamAScore,
      teamBScore,
      teamAResult: null,
      teamBResult: null,
      winnerTeam: null,
      teamAMatchPoints: 0,
      teamBMatchPoints: 0,
      boardScores,
    };
  }

  // If not all boards finished yet, match is PENDING
  if (!allTerminal) {
    return {
      isAllTerminal: false,
      hasAbortedBoard: false,
      hasNonScoreableBoard: false,
      scoringStatus: 'PENDING',
      teamAScore,
      teamBScore,
      teamAResult: null,
      teamBResult: null,
      winnerTeam: null,
      teamAMatchPoints: 0,
      teamBMatchPoints: 0,
      boardScores,
    };
  }

  // All boards finished & scoreable -> FINAL match result
  let teamAResult = 'DRAW';
  let teamBResult = 'DRAW';
  let winnerTeam = null;
  let teamAMatchPoints = 1;
  let teamBMatchPoints = 1;

  if (teamAScore > teamBScore) {
    teamAResult = 'WIN';
    teamBResult = 'LOSS';
    winnerTeam = match.teamA?._id || match.teamA;
    teamAMatchPoints = 3;
    teamBMatchPoints = 0;
  } else if (teamBScore > teamAScore) {
    teamAResult = 'LOSS';
    teamBResult = 'WIN';
    winnerTeam = match.teamB?._id || match.teamB;
    teamAMatchPoints = 0;
    teamBMatchPoints = 3;
  }

  return {
    isAllTerminal: true,
    hasAbortedBoard: false,
    hasNonScoreableBoard: false,
    scoringStatus: 'FINAL',
    teamAScore,
    teamBScore,
    teamAResult,
    teamBResult,
    winnerTeam,
    teamAMatchPoints,
    teamBMatchPoints,
    boardScores,
  };
};

/**
 * Deterministically rebuilds and persists competition standings from all FINAL matches.
 *
 * Basic Ranking Rules (V4):
 * 1. Match Points DESC
 * 2. Board Points DESC
 * 3. Score Difference DESC (boardPointsFor - boardPointsAgainst)
 * 4. Team Name ASC
 *
 * @param {string} competitionId
 * @returns {Promise<{ competitionId: string, standings: Array<Object> }>}
 */
export const rebuildCompetitionStandings = async (competitionId) => {
  validateObjectId(competitionId, 'competition ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  // 1. Fetch all active teams in this competition
  const activeTeams = await TeamCompetitionTeam.find({
    competition: competitionId,
    status: 'ACTIVE',
  })
    .populate('captain', '_id name email avatar lichessUsername')
    .lean();

  const standingsMap = new Map();

  activeTeams.forEach((t) => {
    const tid = t._id.toString();
    standingsMap.set(tid, {
      competition: competitionId,
      team: t,
      teamId: t._id,
      name: t.name || 'Unnamed Squad',
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      matchPoints: 0,
      boardPointsFor: 0,
      boardPointsAgainst: 0,
      boardPoints: 0,
      scoreDifference: 0,
    });
  });

  // 2. Fetch all authoritative FINAL matches across all rounds for this competition
  const finalMatches = await TeamMatch.find({
    competition: competitionId,
    status: 'COMPLETED',
    scoringStatus: 'FINAL',
  }).lean();

  // 3. Aggregate match points and board points idempotently
  for (const match of finalMatches) {
    const teamAId = toIdString(match.teamA);
    const teamBId = toIdString(match.teamB);

    const statsA = standingsMap.get(teamAId);
    const statsB = standingsMap.get(teamBId);

    if (statsA) {
      statsA.played += 1;
      statsA.matchPoints += match.teamAMatchPoints || 0;
      statsA.boardPointsFor += match.teamAScore || 0;
      statsA.boardPointsAgainst += match.teamBScore || 0;

      if (match.teamAResult === 'WIN') statsA.wins += 1;
      else if (match.teamAResult === 'DRAW') statsA.draws += 1;
      else if (match.teamAResult === 'LOSS') statsA.losses += 1;
    }

    if (statsB) {
      statsB.played += 1;
      statsB.matchPoints += match.teamBMatchPoints || 0;
      statsB.boardPointsFor += match.teamBScore || 0;
      statsB.boardPointsAgainst += match.teamAScore || 0;

      if (match.teamBResult === 'WIN') statsB.wins += 1;
      else if (match.teamBResult === 'DRAW') statsB.draws += 1;
      else if (match.teamBResult === 'LOSS') statsB.losses += 1;
    }
  }

  // 4. Compute derived fields
  for (const stats of standingsMap.values()) {
    stats.boardPoints = stats.boardPointsFor;
    stats.scoreDifference = stats.boardPointsFor - stats.boardPointsAgainst;
  }

  // 5. Deterministic sorting according to V4 Basic Ranking Rules:
  //    1. Match Points DESC
  //    2. Board Points DESC
  //    3. Score Difference DESC
  //    4. Team Name ASC
  //    5. Fallback: Team ID ASC
  const standings = Array.from(standingsMap.values());

  standings.sort((a, b) => {
    // 1. Match Points DESC
    if (b.matchPoints !== a.matchPoints) {
      return b.matchPoints - a.matchPoints;
    }
    // 2. Board Points DESC
    if (b.boardPoints !== a.boardPoints) {
      return b.boardPoints - a.boardPoints;
    }
    // 3. Score Difference DESC
    if (b.scoreDifference !== a.scoreDifference) {
      return b.scoreDifference - a.scoreDifference;
    }
    // 4. Team Name ASC
    const nameDiff = (a.name || '').localeCompare(b.name || '');
    if (nameDiff !== 0) {
      return nameDiff;
    }
    // 5. Deterministic fallback: Team ID ASC
    return (a.teamId?.toString() || '').localeCompare(b.teamId?.toString() || '');
  });

  // Assign 1-indexed ranks
  standings.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  // 6. Synchronize with persisted TeamCompetitionStanding model
  const bulkOps = standings.map((s) => ({
    updateOne: {
      filter: { competition: competitionId, team: s.teamId },
      update: {
        $set: {
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          matchPoints: s.matchPoints,
          boardPointsFor: s.boardPointsFor,
          boardPointsAgainst: s.boardPointsAgainst,
          boardPoints: s.boardPoints,
          scoreDifference: s.scoreDifference,
          rank: s.rank,
        },
      },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    await TeamCompetitionStanding.bulkWrite(bulkOps);
  }

  // Clean up any stale standings records for teams no longer active
  const activeTeamIds = activeTeams.map((t) => t._id);
  await TeamCompetitionStanding.deleteMany({
    competition: competitionId,
    team: { $nin: activeTeamIds },
  });

  return {
    competitionId: competition._id,
    competitionName: competition.name,
    standings,
  };
};

/**
 * Get competition standings (deterministically recalculated).
 *
 * @param {string} competitionId
 * @returns {Promise<{ competitionId: string, standings: Array<Object> }>}
 */
export const getCompetitionStandings = async (competitionId) => {
  return rebuildCompetitionStandings(competitionId);
};

export default {
  validateObjectId,
  calculateBoardScore,
  calculateMatchScore,
  rebuildCompetitionStandings,
  getCompetitionStandings,
};
