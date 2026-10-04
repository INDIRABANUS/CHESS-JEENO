import * as adminService from '../services/adminService.js';

/**
 * Admin Controller.
 * Provides platform-level administration endpoints.
 */

/**
 * Returns safe identity information for the currently authenticated administrator.
 * Smoke-test endpoint to verify authorization layer and identity boundaries.
 * 
 * Guarantees:
 * - Never returns passwordHash, OAuth secrets, JWTs, Lichess tokens, or Google secrets.
 * - Minimum required identity surface.
 * 
 * @route GET /api/admin/me
 * @access Private (Bearer JWT + ADMIN role)
 */
export const getAdminMe = async (req, res, next) => {
  try {
    // req.user is guaranteed by requireAuth and requireAdmin
    const user = req.user;

    res.status(200).json({
      success: true,
      admin: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns platform-level overview data:
 * - User and tournament aggregate statistics
 * - Recent user registrations (newest first, limited)
 * - Recent tournaments with participant counts
 * - Application-level operational status
 * 
 * @route GET /api/admin/overview
 * @access Private (Bearer JWT + ADMIN role)
 */
export const getAdminOverview = async (req, res, next) => {
  try {
    const overview = await adminService.getPlatformOverview();

    res.status(200).json({
      success: true,
      overview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns a paginated, searchable, filterable list of users.
 * 
 * Query params:
 * - page: number (>= 1, default 1)
 * - limit: number (1-50, default 20)
 * - search: string (matches name, email, lichessUsername)
 * - role: string ('USER' | 'ADMIN')
 * 
 * @route GET /api/admin/users
 * @access Private (Bearer JWT + ADMIN role)
 */
export const getAdminUsers = async (req, res, next) => {
  try {
    const { page, limit, search, role } = req.query;
    const result = await adminService.getAdminUsers({ page, limit, search, role });

    res.status(200).json({
      success: true,
      users: result.users,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns safe administrator details for a single user by ID.
 * 
 * @route GET /api/admin/users/:userId
 * @access Private (Bearer JWT + ADMIN role)
 */
export const getAdminUserDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await adminService.getAdminUserDetails(userId);

    res.status(200).json({
      success: true,
      user,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a user's role between USER and ADMIN.
 * 
 * Body:
 * - role: 'USER' | 'ADMIN'
 * 
 * @route PATCH /api/admin/users/:userId/role
 * @access Private (Bearer JWT + ADMIN role)
 */
export const updateAdminUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body || {};
    const updatedUser = await adminService.updateAdminUserRole(userId, role, req.user._id);

    res.status(200).json({
      success: true,
      message: `User role successfully updated to ${updatedUser.role}`,
      user: updatedUser,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns a paginated, searchable, filterable list of tournaments for administrators.
 * 
 * Query params:
 * - page: number (>= 1, default 1)
 * - limit: number (1-50, default 20)
 * - search: string (matches tournament name, creator, or ID)
 * - status: string (tournament lifecycle status)
 * - format: string (ROUND_ROBIN, SWISS, KNOCKOUT)
 * 
 * @route GET /api/admin/tournaments
 * @access Private (Bearer JWT + ADMIN role)
 */
export const getAdminTournaments = async (req, res, next) => {
  try {
    const { page, limit, search, status, format } = req.query;
    const result = await adminService.getAdminTournaments({ page, limit, search, status, format });

    res.status(200).json({
      success: true,
      tournaments: result.tournaments,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns safe administrator inspection details for a single tournament by ID.
 * 
 * @route GET /api/admin/tournaments/:tournamentId
 * @access Private (Bearer JWT + ADMIN role)
 */
export const getAdminTournamentDetails = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await adminService.getAdminTournamentDetails(tournamentId);

    res.status(200).json({
      success: true,
      tournament,
      data: tournament,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Safely cancels a tournament as a platform administrator.
 * 
 * @route PATCH /api/admin/tournaments/:tournamentId/cancel
 * @access Private (Bearer JWT + ADMIN role)
 */
export const cancelAdminTournament = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const result = await adminService.cancelAdminTournament(tournamentId, req.user._id);

    res.status(200).json({
      success: true,
      message: `Tournament "${result.name}" was successfully cancelled.`,
      tournament: result,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAdminMe,
  getAdminOverview,
  getAdminUsers,
  getAdminUserDetails,
  updateAdminUserRole,
  getAdminTournaments,
  getAdminTournamentDetails,
  cancelAdminTournament,
};


