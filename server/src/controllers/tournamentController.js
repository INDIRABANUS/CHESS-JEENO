import * as tournamentService from '../services/tournamentService.js';
import { resolveCreatorId } from '../utils/devUser.js';

/**
 * Create a new tournament.
 * @route POST /api/tournaments
 */
export const createTournament = async (req, res, next) => {
  try {
    const creatorId = await resolveCreatorId(req);
    const tournament = await tournamentService.createTournament(req.body, creatorId);

    res.status(201).json({
      success: true,
      data: tournament,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of tournaments.
 * @route GET /api/tournaments
 */
export const getTournaments = async (req, res, next) => {
  try {
    const { status, format } = req.query;
    const tournaments = await tournamentService.getTournaments({ status, format });

    res.status(200).json({
      success: true,
      data: tournaments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single tournament by ID.
 * @route GET /api/tournaments/:id
 */
export const getTournamentById = async (req, res, next) => {
  try {
    const currentUserId = await resolveCreatorId(req);
    const tournament = await tournamentService.getTournamentById(req.params.id, currentUserId);

    res.status(200).json({
      success: true,
      data: tournament,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing tournament.
 * @route PATCH /api/tournaments/:id
 */
export const updateTournament = async (req, res, next) => {
  try {
    const updatedTournament = await tournamentService.updateTournament(
      req.params.id,
      req.body
    );

    res.status(200).json({
      success: true,
      data: updatedTournament,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a tournament.
 * @route DELETE /api/tournaments/:id
 */
export const deleteTournament = async (req, res, next) => {
  try {
    const result = await tournamentService.deleteTournament(req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};
