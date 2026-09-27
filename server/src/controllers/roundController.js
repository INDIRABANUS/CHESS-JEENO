import * as roundService from '../services/roundService.js';

/**
 * Create next round with Round Robin pairings.
 * @route POST /api/tournaments/:id/rounds
 */
export const createRound = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await roundService.createRound(req.params.id, userId);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all rounds and pairings for a tournament.
 * @route GET /api/tournaments/:id/rounds
 */
export const getRounds = async (req, res, next) => {
  try {
    const rounds = await roundService.getRounds(req.params.id);

    res.status(200).json({
      success: true,
      data: rounds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single round and its pairings by round number.
 * @route GET /api/tournaments/:id/rounds/:roundNumber
 */
export const getRoundByNumber = async (req, res, next) => {
  try {
    const data = await roundService.getRoundByNumber(
      req.params.id,
      req.params.roundNumber
    );

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get completion status of a round.
 * @route GET /api/tournaments/:id/rounds/:roundNumber/status
 */
export const getRoundStatus = async (req, res, next) => {
  try {
    const statusData = await roundService.getRoundCompletionStatus(
      req.params.id,
      req.params.roundNumber
    );

    res.status(200).json({
      success: true,
      data: statusData,
    });
  } catch (error) {
    next(error);
  }
};
