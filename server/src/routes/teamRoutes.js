import express from 'express';
import {
  invitePlayer,
  getTeamMembers,
  removeMember,
  transferCaptain,
} from '../controllers/teamCompetitionController.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Direct team invitations and roster management
router.route('/:teamId/invitations')
  .post(requireAuth, invitePlayer);

router.route('/:teamId/members')
  .get(optionalAuth, getTeamMembers);

router.route('/:teamId/members/:userId')
  .delete(requireAuth, removeMember);

router.post('/:teamId/transfer-captain', requireAuth, transferCaptain);

export default router;
