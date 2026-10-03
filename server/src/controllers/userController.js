import * as userService from '../services/userService.js';
import * as dashboardService from '../services/dashboardService.js';

/**
 * Get current authenticated user profile.
 * @route GET /api/users/me
 */
export const getMe = async (req, res, next) => {
  try {
    // req.user is guaranteed by requireAuth middleware
    const user = await userService.getUserProfile(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current authenticated user's profile.
 * Authorization strictly enforces that a user can only update their own profile.
 * @route PATCH /api/users/me
 */
export const updateMe = async (req, res, next) => {
  try {
    const { name, bio, avatar } = req.body;
    // req.user._id is the sole source of truth; never accept arbitrary client userId
    const updatedUser = await userService.updateUserProfile(req.user._id, {
      name,
      bio,
      avatar,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user's comprehensive dashboard data:
 * - Active tournament, current round, user score & rank, next match pairing
 * - My Tournaments breakdown (active, upcoming, completed)
 * - Recent match results across tournaments
 * @route GET /api/users/dashboard
 */
export const getDashboard = async (req, res, next) => {
  try {
    const dashboardData = await dashboardService.getUserDashboardData(req.user._id);

    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getMe,
  updateMe,
  getDashboard,
};

