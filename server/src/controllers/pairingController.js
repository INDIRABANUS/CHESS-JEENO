import * as pairingService from '../services/pairingService.js';
import * as standingsService from '../services/standingsService.js';
import * as roundService from '../services/roundService.js';
import { getIo } from '../realtime/socket.js';

/**
 * Create a Lichess game for a single pairing.
 * @route POST /api/tournaments/:id/rounds/:roundNumber/pairings/:pairingId/lichess
 */
export const createPairingLichessGame = async (req, res, next) => {
  try {
    const tournamentId = req.params.tournamentId || req.params.id;
    const { roundNumber, pairingId } = req.params;
    const userId = req.user ? req.user._id : null;

    const pairing = await pairingService.createLichessGameForPairing(
      tournamentId,
      roundNumber,
      pairingId,
      {},
      userId
    );

    res.status(200).json({
      success: true,
      data: pairing,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Lichess games for all eligible pairings in a round.
 * @route POST /api/tournaments/:id/rounds/:roundNumber/lichess
 */
export const createAllRoundLichessGames = async (req, res, next) => {
  try {
    const tournamentId = req.params.tournamentId || req.params.id;
    const { roundNumber } = req.params;
    const userId = req.user ? req.user._id : null;

    const summary = await pairingService.createAllLichessGamesForRound(
      tournamentId,
      roundNumber,
      {},
      userId
    );

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Synchronize the status and result of a Lichess game for a pairing.
 * @route POST /api/tournaments/:id/rounds/:roundNumber/pairings/:pairingId/sync
 */
export const syncPairingResult = async (req, res, next) => {
  try {
    const tournamentId = req.params.tournamentId || req.params.id;
    const { roundNumber, pairingId } = req.params;
    const userId = req.user ? req.user._id : null;

    const pairing = await pairingService.syncPairingResult(
      tournamentId,
      roundNumber,
      pairingId,
      {},
      userId
    );

    // If game reached terminal status, broadcast realtime standings & round status
    if (pairing.status === 'FINISHED' || pairing.status === 'ABORTED') {
      try {
        const io = getIo();
        if (io) {
          const standingsData = await standingsService.getTournamentStandings(tournamentId);
          io.to(`tournament:${tournamentId}`).emit('STANDINGS_UPDATED', {
            tournamentId,
            standings: standingsData.standings,
          });

          const roundStatus = await roundService.getRoundCompletionStatus(tournamentId, roundNumber);
          if (roundStatus.complete) {
            io.to(`tournament:${tournamentId}`).emit('ROUND_COMPLETED', {
              tournamentId,
              roundNumber: Number(roundNumber),
              complete: true,
            });
          }
        }
      } catch (broadcastErr) {
        console.warn('[Realtime] Broadcast on manual sync failed:', broadcastErr.message);
      }
    }

    res.status(200).json({
      success: true,
      data: pairing,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createPairingLichessGame,
  createAllRoundLichessGames,
  syncPairingResult,
};
