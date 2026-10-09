import * as teamMatchService from '../services/teamMatchService.js';

/**
 * Create a new competition round (Organizer).
 * POST /api/team-competitions/:competitionId/rounds
 */
export const createRound = async (req, res, next) => {
  try {
    const { competitionId } = req.params;
    const { roundNumber, name, scheduledStart } = req.body;
    const round = await teamMatchService.createRound(
      competitionId,
      { roundNumber, name, scheduledStart },
      req.user._id
    );
    res.status(201).json({
      success: true,
      message: 'Round created successfully',
      data: round,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all rounds for a competition.
 * GET /api/team-competitions/:competitionId/rounds
 */
export const getRounds = async (req, res, next) => {
  try {
    const { competitionId } = req.params;
    const rounds = await teamMatchService.getRounds(competitionId);
    res.status(200).json({
      success: true,
      data: rounds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get round details including matches.
 * GET /api/team-competitions/:competitionId/rounds/:roundId
 */
export const getRoundById = async (req, res, next) => {
  try {
    const { competitionId, roundId } = req.params;
    const round = await teamMatchService.getRoundById(competitionId, roundId);
    res.status(200).json({
      success: true,
      data: round,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update round details or status.
 * PATCH /api/team-competitions/:competitionId/rounds/:roundId
 */
export const updateRound = async (req, res, next) => {
  try {
    const { competitionId, roundId } = req.params;
    const round = await teamMatchService.updateRound(
      competitionId,
      roundId,
      req.body,
      req.user._id
    );
    res.status(200).json({
      success: true,
      message: 'Round updated successfully',
      data: round,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a match inside a round (Organizer).
 * POST /api/team-competitions/:competitionId/rounds/:roundId/matches
 */
export const createMatch = async (req, res, next) => {
  try {
    const { competitionId, roundId } = req.params;
    const { teamA, teamB, boardCount, scheduledStart } = req.body;
    const match = await teamMatchService.createMatch(
      competitionId,
      roundId,
      { teamA, teamB, boardCount, scheduledStart },
      req.user._id
    );
    res.status(201).json({
      success: true,
      message: 'Match created successfully',
      data: match,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get matches for a competition or round.
 * GET /api/team-competitions/:competitionId/matches
 * GET /api/team-competitions/:competitionId/rounds/:roundId/matches
 */
export const getMatches = async (req, res, next) => {
  try {
    const { competitionId, roundId } = req.params;
    const matches = await teamMatchService.getMatches(competitionId, { roundId });
    res.status(200).json({
      success: true,
      data: matches,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single match details with boards and user context.
 * GET /api/team-competitions/:competitionId/matches/:matchId
 */
export const getMatchById = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const currentUserId = req.user?._id || null;
    const match = await teamMatchService.getMatchById(competitionId, matchId, currentUserId);
    res.status(200).json({
      success: true,
      data: match,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get boards for a match.
 * GET /api/team-competitions/:competitionId/matches/:matchId/boards
 */
export const getMatchBoards = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const boards = await teamMatchService.getMatchBoards(competitionId, matchId);
    res.status(200).json({
      success: true,
      data: boards,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update match scheduling or transition (Organizer).
 * PATCH /api/team-competitions/:competitionId/matches/:matchId
 */
export const updateMatch = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const match = await teamMatchService.updateMatch(
      competitionId,
      matchId,
      req.body,
      req.user._id
    );
    res.status(200).json({
      success: true,
      message: 'Match updated successfully',
      data: match,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a match (Organizer).
 * POST /api/team-competitions/:competitionId/matches/:matchId/cancel
 */
export const cancelMatch = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const match = await teamMatchService.cancelMatch(competitionId, matchId, req.user._id);
    res.status(200).json({
      success: true,
      message: 'Match cancelled successfully',
      data: match,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lineup Management (Team Captain).
 * PATCH /api/team-competitions/:competitionId/matches/:matchId/lineup
 */
export const updateLineup = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const { teamId, assignments, boardNumber, playerId } = req.body;

    // Handle either assignments array or single boardNumber/playerId payload
    const effectiveAssignments = assignments || [{ boardNumber, playerId }];

    const result = await teamMatchService.updateLineup(
      competitionId,
      matchId,
      { teamId, assignments: effectiveAssignments },
      req.user._id
    );
    res.status(200).json({
      success: true,
      message: 'Lineup updated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set player readiness for an assigned board.
 * POST /api/team-competitions/:competitionId/matches/:matchId/ready
 */
export const setPlayerReady = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const { boardNumber, ready = true } = req.body;
    const board = await teamMatchService.setPlayerReady(
      competitionId,
      matchId,
      { boardNumber, ready },
      req.user._id
    );
    res.status(200).json({
      success: true,
      message: `Board readiness marked as ${ready ? 'READY' : 'NOT READY'}`,
      data: board,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lock team lineup (Captain).
 * POST /api/team-competitions/:competitionId/matches/:matchId/lock-lineup
 */
export const lockLineup = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const { teamId } = req.body;
    const match = await teamMatchService.lockLineup(
      competitionId,
      matchId,
      { teamId },
      req.user._id
    );
    res.status(200).json({
      success: true,
      message: 'Team lineup locked successfully',
      data: match,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unlock team lineup (Captain).
 * POST /api/team-competitions/:competitionId/matches/:matchId/unlock-lineup
 */
export const unlockLineup = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const { teamId } = req.body;
    const match = await teamMatchService.unlockLineup(
      competitionId,
      matchId,
      { teamId },
      req.user._id
    );
    res.status(200).json({
      success: true,
      message: 'Team lineup unlocked successfully',
      data: match,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start a ready team match and create Lichess games for all boards (Organizer).
 * POST /api/team-competitions/:competitionId/matches/:matchId/start
 */
export const startMatch = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const result = await teamMatchService.startMatch(
      competitionId,
      matchId,
      req.user._id,
      req.body || {}
    );
    res.status(200).json({
      success: true,
      message: 'Match execution started',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retry failed boards for a team match (Organizer).
 * POST /api/team-competitions/:competitionId/matches/:matchId/retry
 */
export const retryFailedBoards = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const result = await teamMatchService.retryFailedBoards(
      competitionId,
      matchId,
      req.user._id,
      req.body || {}
    );
    res.status(200).json({
      success: true,
      message: 'Failed boards retry processed',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync Lichess game results for all boards in a team match.
 * POST /api/team-competitions/:competitionId/matches/:matchId/sync
 */
export const syncMatchResults = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const result = await teamMatchService.syncMatchResults(
      competitionId,
      matchId,
      req.user?._id || null,
      req.body || {}
    );
    res.status(200).json({
      success: true,
      message: 'Match results synchronized',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get match result breakdown.
 * GET /api/team-competitions/:competitionId/matches/:matchId/result
 */
export const getMatchResult = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const result = await teamMatchService.getMatchResult(competitionId, matchId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get round results including all match outcomes and scoring statuses.
 * GET /api/team-competitions/:competitionId/rounds/:roundId/results
 */
export const getRoundResults = async (req, res, next) => {
  try {
    const { competitionId, roundId } = req.params;
    const result = await teamMatchService.getRoundResults(competitionId, roundId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get competition standings (deterministically recalculated).
 * GET /api/team-competitions/:competitionId/standings
 */
export const getCompetitionStandings = async (req, res, next) => {
  try {
    const competitionId = req.params.competitionId || req.params.id;
    const result = await teamMatchService.getCompetitionStandings(competitionId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve an aborted or disputed board result (Organizer only).
 * POST /api/team-competitions/:competitionId/matches/:matchId/resolve-result
 */
export const resolveMatchResult = async (req, res, next) => {
  try {
    const { competitionId, matchId } = req.params;
    const result = await teamMatchService.resolveMatchResult(
      competitionId,
      matchId,
      req.body || {},
      req.user._id
    );
    res.status(200).json({
      success: true,
      message: 'Match result resolved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createRound,
  getRounds,
  getRoundById,
  updateRound,
  createMatch,
  getMatches,
  getMatchById,
  getMatchBoards,
  updateMatch,
  cancelMatch,
  updateLineup,
  setPlayerReady,
  lockLineup,
  unlockLineup,
  startMatch,
  retryFailedBoards,
  syncMatchResults,
  getMatchResult,
  getRoundResults,
  getCompetitionStandings,
  resolveMatchResult,
};


