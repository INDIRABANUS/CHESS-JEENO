import express from 'express';
import {
  createRound,
  getRounds,
  getRoundByNumber,
  getRoundStatus,
} from '../controllers/roundController.js';
import {
  createPairingLichessGame,
  createAllRoundLichessGames,
  syncPairingResult,
} from '../controllers/pairingController.js';

const router = express.Router({ mergeParams: true });

router.route('/')
  .post(createRound)
  .get(getRounds);

router.route('/:roundNumber')
  .get(getRoundByNumber);

// Round completion status endpoint
router.route('/:roundNumber/status')
  .get(getRoundStatus);

// Lichess Game Creation Endpoints
router.route('/:roundNumber/lichess')
  .post(createAllRoundLichessGames);

router.route('/:roundNumber/pairings/:pairingId/lichess')
  .post(createPairingLichessGame);

// Lichess Game Sync Endpoint
router.route('/:roundNumber/pairings/:pairingId/sync')
  .post(syncPairingResult);

export default router;

