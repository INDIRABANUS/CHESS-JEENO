import * as authService from '../services/authService.js';

/**
 * Register a new user account.
 * @route POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, lichessUsername } = req.body;
    const result = await authService.registerUser({
      name,
      email,
      password,
      lichessUsername,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log in to an existing account.
 * @route POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser({ email, password });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get the currently authenticated user.
 * @route GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    // req.user is guaranteed by requireAuth middleware
    const user = await authService.getCurrentUser(req.user._id);

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

export default {
  register,
  login,
  getMe,
};
