import express from 'express';
import {
  createTournament,
  getTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
  startReadyCheck,
  startCountdown,
  cancelCountdown,
  startTournament,
} from '../controllers/tournamentController.js';
import { getTournamentStandings } from '../controllers/standingsController.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';
import tournamentPlayerRoutes from './tournamentPlayerRoutes.js';
import roundRoutes from './roundRoutes.js';

const router = express.Router();

router.route('/')
  .post(requireAuth, createTournament)
  .get(getTournaments);

// Standings endpoint (public)
router.route('/:id/standings')
  .get(getTournamentStandings);

// Lifecycle endpoints (authenticated host)
router.post('/:id/ready-check', requireAuth, startReadyCheck);
router.post('/:id/countdown/start', requireAuth, startCountdown);
router.post('/:id/countdown/cancel', requireAuth, cancelCountdown);
router.post('/:id/start', requireAuth, startTournament);

router.route('/:id')
  .get(optionalAuth, getTournamentById)
  .patch(requireAuth, updateTournament)
  .delete(requireAuth, deleteTournament);

// Player registration subroutes (join, leave, players, ready, not-ready, readiness)
router.use('/:id', tournamentPlayerRoutes);

// Rounds and pairings subroutes (create round, get rounds, get single round, pairings, rematch)
router.use('/:id/rounds', roundRoutes);

export default router;
