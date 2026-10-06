import express from 'express';
import {
  createCompetition,
  getCompetitions,
  getCompetitionById,
  updateCompetition,
  openRegistration,
  setReady,
  cancelCompetition,
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  removeTeam,
  invitePlayer,
  getTeamMembers,
  removeMember,
  acceptInvitation,
  declineInvitation,
  transferCaptain,
  getMyInvitations,
} from '../controllers/teamCompetitionController.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// User pending invitations across all competitions
router.get('/my/invitations', requireAuth, getMyInvitations);

// Competition list & creation
router.route('/')
  .post(requireAuth, createCompetition)
  .get(optionalAuth, getCompetitions);

// Single competition lifecycle actions
router.post('/:id/registration', requireAuth, openRegistration);
router.post('/:id/ready', requireAuth, setReady);
router.post('/:id/cancel', requireAuth, cancelCompetition);

// Single competition details & update
router.route('/:id')
  .get(optionalAuth, getCompetitionById)
  .patch(requireAuth, updateCompetition);

// Teams under a competition
router.route('/:competitionId/teams')
  .post(requireAuth, createTeam)
  .get(optionalAuth, getTeams);

router.route('/:competitionId/teams/:teamId')
  .get(optionalAuth, getTeamById)
  .patch(requireAuth, updateTeam)
  .delete(requireAuth, removeTeam);

// Team membership sub-routes under competition
router.route('/:competitionId/teams/:teamId/invitations')
  .post(requireAuth, invitePlayer);

router.route('/:competitionId/teams/:teamId/members')
  .get(optionalAuth, getTeamMembers);

router.route('/:competitionId/teams/:teamId/members/:userId')
  .delete(requireAuth, removeMember);

router.post('/:competitionId/teams/:teamId/transfer-captain', requireAuth, transferCaptain);

export default router;
