import express from 'express';
import {
  createJoinRequest,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  getMyJoinRequestStatus,
} from '../controllers/tournamentJoinRequestController.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

// Player creates join request
router.post('/', requireAuth, createJoinRequest);

// Host views all join requests
router.get('/', requireAuth, getJoinRequests);

// Player checks their own request status
router.get('/my-status', optionalAuth, getMyJoinRequestStatus);

// Host approves join request
router.post('/:requestId/approve', requireAuth, approveJoinRequest);

// Host rejects join request
router.post('/:requestId/reject', requireAuth, rejectJoinRequest);

export default router;
