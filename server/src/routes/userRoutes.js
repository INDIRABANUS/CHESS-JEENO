import express from 'express';
import { getMe, updateMe } from '../controllers/userController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/users/me
 * @desc    Get current authenticated user profile
 * @access  Private (Bearer JWT)
 */
router.get('/me', requireAuth, getMe);

/**
 * @route   PATCH /api/users/me
 * @desc    Update current authenticated user profile
 * @access  Private (Bearer JWT)
 */
router.patch('/me', requireAuth, updateMe);

export default router;
