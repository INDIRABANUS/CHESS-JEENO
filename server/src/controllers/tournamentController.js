import * as tournamentService from '../services/tournamentService.js';

/**
 * Create a new tournament.
 * @route POST /api/tournaments
 */
export const createTournament = async (req, res, next) => {
  try {
    const creatorId = req.user._id;
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
    const { status, format, view, sort } = req.query;

    const ALLOWED_VIEWS = ['all', 'my'];
    const ALLOWED_SORTS = ['relevance', 'startingSoon', 'newest', 'recentlyCompleted'];

    const normalizedView = ALLOWED_VIEWS.includes(view) ? view : 'all';
    const normalizedSort = ALLOWED_SORTS.includes(sort) ? sort : 'relevance';

    if (normalizedView === 'my' && !req.user) {
      const error = new Error('Authentication required for My Tournaments');
      error.statusCode = 401;
      return next(error);
    }

    const currentUserId = req.user ? req.user._id : null;

    const tournaments = await tournamentService.getTournaments({
      status,
      format,
      view: normalizedView,
      sort: normalizedSort,
      currentUserId,
    });

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
    const currentUserId = req.user ? req.user._id : null;
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
    const currentUserId = req.user._id;
    const updatedTournament = await tournamentService.updateTournament(
      req.params.id,
      req.body,
      currentUserId
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
    const currentUserId = req.user._id;
    const result = await tournamentService.deleteTournament(req.params.id, currentUserId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start ready check phase.
 * @route POST /api/tournaments/:id/ready-check
 */
export const startReadyCheck = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const tournament = await tournamentService.startReadyCheck(req.params.id, userId);

    res.status(200).json({
      success: true,
      data: tournament,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start countdown phase.
 * @route POST /api/tournaments/:id/countdown/start
 */
export const startCountdown = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const tournament = await tournamentService.startCountdown(req.params.id, userId, req.body);

    res.status(200).json({
      success: true,
      data: tournament,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel active countdown.
 * @route POST /api/tournaments/:id/countdown/cancel
 */
export const cancelCountdown = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const tournament = await tournamentService.cancelCountdown(req.params.id, userId);

    res.status(200).json({
      success: true,
      data: tournament,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start tournament / Round 1.
 * @route POST /api/tournaments/:id/start
 */
export const startTournament = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : null;
    const tournament = await tournamentService.startTournament(req.params.id, userId);

    res.status(200).json({
      success: true,
      data: tournament,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createTournament,
  getTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
  startReadyCheck,
  startCountdown,
  cancelCountdown,
  startTournament,
};
