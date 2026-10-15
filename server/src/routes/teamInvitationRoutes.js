import express from 'express';
import {
  acceptInvitation,
  declineInvitation,
} from '../controllers/teamCompetitionController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/:invitationId/accept', requireAuth, acceptInvitation);
router.post('/:invitationId/decline', requireAuth, declineInvitation);

export default router;
