import express from 'express';
import {
  joinTournament,
  leaveTournament,
  getTournamentPlayers,
  setPlayerReady,
  setPlayerNotReady,
  getTournamentReadiness,
} from '../controllers/tournamentPlayerController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

router.post('/join', requireAuth, joinTournament);
router.post('/leave', requireAuth, leaveTournament);
router.get('/players', getTournamentPlayers);
router.post('/ready', requireAuth, setPlayerReady);
router.post('/not-ready', requireAuth, setPlayerNotReady);
router.get('/readiness', getTournamentReadiness);

export default router;
