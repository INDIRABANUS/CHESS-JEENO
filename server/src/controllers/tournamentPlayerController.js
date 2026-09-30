import * as tournamentPlayerService from '../services/tournamentPlayerService.js';

/**
 * Join a tournament.
 * @route POST /api/tournaments/:id/join
 */
export const joinTournament = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const player = await tournamentPlayerService.joinTournament(req.params.id, userId);

    res.status(200).json({
      success: true,
      data: player,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Leave a tournament.
 * @route POST /api/tournaments/:id/leave
 */
export const leaveTournament = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await tournamentPlayerService.leaveTournament(req.params.id, userId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all registered players in a tournament.
 * @route GET /api/tournaments/:id/players
 */
export const getTournamentPlayers = async (req, res, next) => {
  try {
    const players = await tournamentPlayerService.getTournamentPlayers(req.params.id);

    res.status(200).json({
      success: true,
      data: players,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark current player as READY.
 * @route POST /api/tournaments/:id/ready
 */
export const setPlayerReady = async (req, res, next) => {
  try {
    const tournamentId = req.params.id;
    const userId = req.user._id;

    const result = await tournamentPlayerService.setPlayerReady(tournamentId, userId, true);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark current player as NOT READY.
 * @route POST /api/tournaments/:id/not-ready
 */
export const setPlayerNotReady = async (req, res, next) => {
  try {
    const tournamentId = req.params.id;
    const userId = req.user._id;

    const result = await tournamentPlayerService.setPlayerReady(tournamentId, userId, false);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get tournament readiness statistics.
 * @route GET /api/tournaments/:id/readiness
 */
export const getTournamentReadiness = async (req, res, next) => {
  try {
    const readiness = await tournamentPlayerService.getTournamentReadiness(req.params.id);

    res.status(200).json({
      success: true,
      data: readiness,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  joinTournament,
  leaveTournament,
  getTournamentPlayers,
  setPlayerReady,
  setPlayerNotReady,
  getTournamentReadiness,
};
