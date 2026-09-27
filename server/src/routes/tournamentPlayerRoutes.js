import express from 'express';
import {
  joinTournament,
  leaveTournament,
  getTournamentPlayers,
} from '../controllers/tournamentPlayerController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

router.post('/join', requireAuth, joinTournament);
router.post('/leave', requireAuth, leaveTournament);
router.get('/players', getTournamentPlayers);

export default router;
