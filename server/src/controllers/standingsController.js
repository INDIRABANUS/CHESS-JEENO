import * as standingsService from '../services/standingsService.js';

/**
 * Get standings for a tournament.
 * @route GET /api/tournaments/:id/standings
 */
export const getTournamentStandings = async (req, res, next) => {
  try {
    const data = await standingsService.getTournamentStandings(req.params.id);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getTournamentStandings,
};
