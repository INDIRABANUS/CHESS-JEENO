import express from 'express';
import {
  joinTournament,
  leaveTournament,
  getTournamentPlayers,
} from '../controllers/tournamentPlayerController.js';

const router = express.Router({ mergeParams: true });

router.post('/join', joinTournament);
router.post('/leave', leaveTournament);
router.get('/players', getTournamentPlayers);

export default router;
