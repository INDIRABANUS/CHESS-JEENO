import { getDatabaseStatus } from '../config/database.js';

/**
 * Health check controller
 * @route GET /api/health
 */
export const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Chess Tournament API is running',
    database: getDatabaseStatus(),
  });
};
