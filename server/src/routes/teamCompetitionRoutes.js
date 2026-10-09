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
import {
  createRound,
  getRounds,
  getRoundById,
  updateRound,
  createMatch,
  getMatches,
  getMatchById,
  getMatchBoards,
  updateMatch,
  cancelMatch,
  updateLineup,
  setPlayerReady,
  lockLineup,
  unlockLineup,
  startMatch,
  retryFailedBoards,
  syncMatchResults,
  getMatchResult,
  getRoundResults,
  getCompetitionStandings,
  resolveMatchResult,
  generateRoundRobinSchedule,
  getRoundRobinPreview,
} from '../controllers/teamMatchController.js';
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

// ==========================================
// Team Competition V2: Rounds & Matches
// ==========================================

// Rounds under a competition
router.route('/:competitionId/rounds')
  .post(requireAuth, createRound)
  .get(optionalAuth, getRounds);

router.route('/:competitionId/rounds/:roundId')
  .get(optionalAuth, getRoundById)
  .patch(requireAuth, updateRound);

// Matches under a round
router.route('/:competitionId/rounds/:roundId/matches')
  .post(requireAuth, createMatch)
  .get(optionalAuth, getMatches);

// Matches under a competition
router.route('/:competitionId/matches')
  .get(optionalAuth, getMatches);

// Single Match details & update
router.route('/:competitionId/matches/:matchId')
  .get(optionalAuth, getMatchById)
  .patch(requireAuth, updateMatch);

// Match cancellation
router.post('/:competitionId/matches/:matchId/cancel', requireAuth, cancelMatch);

// Match boards
router.get('/:competitionId/matches/:matchId/boards', optionalAuth, getMatchBoards);

// Match lineup management
router.patch('/:competitionId/matches/:matchId/lineup', requireAuth, updateLineup);

// Match player readiness
router.post('/:competitionId/matches/:matchId/ready', requireAuth, setPlayerReady);

// Match team lineup lock & unlock
router.post('/:competitionId/matches/:matchId/lock-lineup', requireAuth, lockLineup);
router.post('/:competitionId/matches/:matchId/unlock-lineup', requireAuth, unlockLineup);

// Match execution & Lichess games
router.post('/:competitionId/matches/:matchId/start', requireAuth, startMatch);
router.post('/:competitionId/matches/:matchId/retry', requireAuth, retryFailedBoards);
router.post('/:competitionId/matches/:matchId/sync', optionalAuth, syncMatchResults);

// ==========================================
// Team Competition V4: Scoring, Results & Standings
// ==========================================

// Competition Standings
router.get('/:competitionId/standings', optionalAuth, getCompetitionStandings);
router.get('/:id/standings', optionalAuth, getCompetitionStandings);

// Round Results
router.get('/:competitionId/rounds/:roundId/results', optionalAuth, getRoundResults);

// Match Result Breakdown & Result Resolution
router.get('/:competitionId/matches/:matchId/result', optionalAuth, getMatchResult);
router.post('/:competitionId/matches/:matchId/resolve-result', requireAuth, resolveMatchResult);

// ==========================================
// Team Competition V5: Round Robin Scheduling
// ==========================================

router.post('/:competitionId/schedule/round-robin', requireAuth, generateRoundRobinSchedule);
router.post('/:id/schedule/round-robin', requireAuth, generateRoundRobinSchedule);

router.get('/:competitionId/schedule/round-robin/preview', optionalAuth, getRoundRobinPreview);
router.get('/:id/schedule/round-robin/preview', optionalAuth, getRoundRobinPreview);

export default router;



