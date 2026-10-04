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

export default {
  getAdminMe,
};
