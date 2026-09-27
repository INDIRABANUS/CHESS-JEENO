import express from 'express';
import {
  createTournament,
  getTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
} from '../controllers/tournamentController.js';
import { getTournamentStandings } from '../controllers/standingsController.js';
import tournamentPlayerRoutes from './tournamentPlayerRoutes.js';
import roundRoutes from './roundRoutes.js';

const router = express.Router();

router.route('/')
  .post(createTournament)
  .get(getTournaments);

// Standings endpoint
router.route('/:id/standings')
  .get(getTournamentStandings);

router.route('/:id')
  .get(getTournamentById)
  .patch(updateTournament)
  .delete(deleteTournament);

// Player registration subroutes (join, leave, players)
router.use('/:id', tournamentPlayerRoutes);

// Rounds and pairings subroutes (create round, get rounds, get single round)
router.use('/:id/rounds', roundRoutes);

export default router;
