import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import {
  getAdminMe,
  getAdminOverview,
  getAdminUsers,
  getAdminUserDetails,
  updateAdminUserRole,
  getAdminTournaments,
  getAdminTournamentDetails,
  cancelAdminTournament,
} from '../controllers/adminController.js';

const router = express.Router();

/**
 * @route   GET /api/admin/me
 * @desc    Get safe administrative identity for authenticated admin
 * @access  Private (Bearer JWT + ADMIN role)
 */
router.get('/me', requireAuth, requireAdmin, getAdminMe);

/**
 * @route   GET /api/admin/overview
 * @desc    Get platform aggregate stats, recent users, tournaments, and system health
 * @access  Private (Bearer JWT + ADMIN role)
 */
router.get('/overview', requireAuth, requireAdmin, getAdminOverview);

/**
 * @route   GET /api/admin/users
 * @desc    Get paginated, searchable, filterable user list
 * @access  Private (Bearer JWT + ADMIN role)
 */
router.get('/users', requireAuth, requireAdmin, getAdminUsers);

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get safe administrator details for a single user
 * @access  Private (Bearer JWT + ADMIN role)
 */
router.get('/users/:userId', requireAuth, requireAdmin, getAdminUserDetails);

/**
 * @route   PATCH /api/admin/users/:userId/role
 * @desc    Update a user's role (USER <-> ADMIN) with lockout protection
 * @access  Private (Bearer JWT + ADMIN role)
 */
router.patch('/users/:userId/role', requireAuth, requireAdmin, updateAdminUserRole);

/**
 * @route   GET /api/admin/tournaments
 * @desc    Get paginated, searchable, filterable tournament list
 * @access  Private (Bearer JWT + ADMIN role)
 */
router.get('/tournaments', requireAuth, requireAdmin, getAdminTournaments);

/**
 * @route   GET /api/admin/tournaments/:tournamentId
 * @desc    Get safe administrator inspection details for a single tournament
 * @access  Private (Bearer JWT + ADMIN role)
 */
router.get('/tournaments/:tournamentId', requireAuth, requireAdmin, getAdminTournamentDetails);

/**
 * @route   PATCH /api/admin/tournaments/:tournamentId/cancel
 * @desc    Safely cancel a tournament as platform administrator
 * @access  Private (Bearer JWT + ADMIN role)
 */
router.patch('/tournaments/:tournamentId/cancel', requireAuth, requireAdmin, cancelAdminTournament);

export default router;


