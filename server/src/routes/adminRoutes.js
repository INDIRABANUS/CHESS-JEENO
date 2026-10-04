import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import { getAdminMe } from '../controllers/adminController.js';

const router = express.Router();

/**
 * @route   GET /api/admin/me
 * @desc    Get safe administrative identity for authenticated admin
 * @access  Private (Bearer JWT + ADMIN role)
 */
router.get('/me', requireAuth, requireAdmin, getAdminMe);

export default router;
