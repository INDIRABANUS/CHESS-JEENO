import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import { resolveCreatorId } from '../utils/devUser.js';

/**
 * Join a tournament.
 * @route POST /api/tournaments/:id/join
 */
export const joinTournament = async (req, res, next) => {
  try {
    const userId = await resolveCreatorId(req);
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
    const userId = await resolveCreatorId(req);
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
