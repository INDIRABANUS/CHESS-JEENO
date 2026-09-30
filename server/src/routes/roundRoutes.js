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
  rematchAbortedPairing,
} from '../controllers/pairingController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

router.route('/')
  .post(requireAuth, createRound)
  .get(getRounds);

router.route('/:roundNumber')
  .get(getRoundByNumber);

// Round completion status endpoint (public)
router.route('/:roundNumber/status')
  .get(getRoundStatus);

// Lichess Game Creation Endpoints (authenticated host)
router.route('/:roundNumber/lichess')
  .post(requireAuth, createAllRoundLichessGames);

router.route('/:roundNumber/pairings/:pairingId/lichess')
  .post(requireAuth, createPairingLichessGame);

// Lichess Game Sync Endpoint (authenticated host or participant)
router.route('/:roundNumber/pairings/:pairingId/sync')
  .post(requireAuth, syncPairingResult);

// Lichess Game Rematch Endpoint (authenticated host or participant)
router.route('/:roundNumber/pairings/:pairingId/rematch')
  .post(requireAuth, rematchAbortedPairing);

export default router;
