import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import lichessService from './lichessService.js';
import * as lichessOAuthService from './lichessOAuthService.js';

// In-flight concurrency lock to prevent duplicate game creation race conditions
const inFlightPairingIds = new Set();

/**
 * Creates a Lichess game for a single pairing in a tournament round.
 * 
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 * @param {string} pairingId
 * @param {Object} [options]
 * @param {string|mongoose.Types.ObjectId} [userId]
 * @returns {Promise<Pairing>}
 */
export const createLichessGameForPairing = async (
  tournamentId,
  roundNumber,
  pairingId,
  options = {},
  userId = null
) => {
  // 1. Validate ObjectIds
  if (!mongoose.isValidObjectId(tournamentId)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const numRound = Number(roundNumber);
  if (isNaN(numRound) || numRound < 1) {
    const error = new Error('Round not found');
    error.statusCode = 404;
    throw error;
  }

  if (!mongoose.isValidObjectId(pairingId)) {
    const error = new Error('Pairing not found');
    error.statusCode = 404;
    throw error;
  }

  // 2. Concurrency protection
  const pairingIdStr = pairingId.toString();
  if (inFlightPairingIds.has(pairingIdStr)) {
    const error = new Error('A Lichess game creation request for this pairing is already in progress.');
    error.statusCode = 400;
    throw error;
  }

  inFlightPairingIds.add(pairingIdStr);

  try {
    // 3. Find Tournament
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      const error = new Error('Tournament not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify host ownership if userId is provided
    if (userId && tournament.createdBy.toString() !== userId.toString()) {
      const error = new Error('You are not authorized to create Lichess games for this tournament');
      error.statusCode = 403;
      throw error;
    }

    // 4. Find Round
    const round = await Round.findOne({
      tournamentId: tournament._id,
      roundNumber: numRound,
    });
    if (!round) {
      const error = new Error('Round not found');
      error.statusCode = 404;
      throw error;
    }

    // 5. Find Pairing with populated players
    const pairing = await Pairing.findById(pairingId)
      .populate('whitePlayer', 'name email avatar lichessUsername')
      .populate('blackPlayer', 'name email avatar lichessUsername');

    if (!pairing) {
      const error = new Error('Pairing not found');
      error.statusCode = 404;
      throw error;
    }

    // 6. Verify Pairing belongs to the specified Tournament and Round
    if (pairing.tournamentId.toString() !== tournament._id.toString()) {
      const error = new Error('Pairing does not belong to the specified tournament.');
      error.statusCode = 400;
      throw error;
    }

    if (pairing.roundId.toString() !== round._id.toString()) {
      const error = new Error('Pairing does not belong to the specified round.');
      error.statusCode = 400;
      throw error;
    }

    // 7. Duplicate game protection
    if (pairing.lichessGameId) {
      const error = new Error('Lichess game has already been created for this pairing.');
      error.statusCode = 400;
      throw error;
    }

    // 7b. Reject game creation for BYE pairings
    if (pairing.status === 'BYE' || pairing.result === 'BYE' || !pairing.blackPlayer) {
      const error = new Error('Cannot create Lichess game for a BYE pairing.');
      error.statusCode = 400;
      throw error;
    }

    // 8. Verify both players have linked Lichess usernames
    const rawWhiteUsername = pairing.whitePlayer?.lichessUsername?.trim();
    const rawBlackUsername = pairing.blackPlayer?.lichessUsername?.trim();

    if (!rawWhiteUsername || !rawBlackUsername) {
      const error = new Error('Both players must have linked Lichess usernames before creating a game.');
      error.statusCode = 400;
      throw error;
    }

    const whiteUserId = pairing.whitePlayer?._id || pairing.whitePlayer;
    const blackUserId = pairing.blackPlayer?._id || pairing.blackPlayer;

    if (!whiteUserId || !blackUserId) {
      const error = new Error('Both players must be valid tournament participants.');
      error.statusCode = 400;
      throw error;
    }

    // Explicitly allow development-token bridge fallback only when options.allowDevBridge is true
    const allowDevBridge = Boolean(options.allowDevBridge || options.useDevBridge);

    // 9. Resolve both players' Lichess OAuth credentials securely from User records
    const whiteCreds = await lichessOAuthService.resolveLichessPlayerCredentials(whiteUserId, {
      allowDevBridge,
    });
    const blackCreds = await lichessOAuthService.resolveLichessPlayerCredentials(blackUserId, {
      allowDevBridge,
    });

    const whiteUsername = whiteCreds.lichessUsername;
    const blackUsername = blackCreds.lichessUsername;
    const resolvedWhiteToken = options.whiteToken || whiteCreds.accessToken;
    const resolvedBlackToken = options.blackToken || blackCreds.accessToken;

    // 10. Call Lichess API (or mock transport in tests) using resolved credentials
    const { gameId, gameUrl } = await lichessService.createGame({
      whiteUsername,
      blackUsername,
      clockLimit: tournament.clockLimit,
      increment: tournament.increment,
      rated: tournament.rated,
      token: options.token,
      whiteToken: resolvedWhiteToken,
      blackToken: resolvedBlackToken,
    });

    // 11. Update Pairing document (never store tokens in Pairing)
    pairing.lichessGameId = gameId;
    pairing.lichessGameUrl = gameUrl;
    pairing.status = 'ACTIVE';
    // Result remains PENDING / null as required
    await pairing.save();

    // 12. Trigger background Lichess game stream
    try {
      const { startStream } = await import('../realtime/gameStreamManager.js');
      const { getIo } = await import('../realtime/socket.js');
      const io = getIo();
      if (io) {
        io.to(`tournament:${tournamentId}`).emit('GAME_STARTED', {
          tournamentId: tournamentId.toString(),
          roundNumber: numRound,
          pairingId: pairing._id.toString(),
          lichessGameId: gameId,
          status: 'started',
          result: null,
          white: { id: whiteUsername, name: pairing.whitePlayer?.name || whiteUsername },
          black: { id: blackUsername, name: pairing.blackPlayer?.name || blackUsername },
        });
      }

      startStream({
        tournamentId: tournamentId.toString(),
        roundNumber: numRound,
        pairingId: pairing._id.toString(),
        lichessGameId: gameId,
        token: resolvedWhiteToken || resolvedBlackToken,
      }).catch((streamErr) => {
        console.warn(`[Realtime] Stream start warning for ${gameId}:`, streamErr.message);
      });
    } catch (realtimeErr) {
      console.warn('[Realtime] Failed to initiate stream:', realtimeErr.message);
    }

    return pairing;
  } finally {
    inFlightPairingIds.delete(pairingIdStr);
  }
};

/**
 * Creates Lichess games for all eligible pairings in a tournament round.
 * 
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
export const createAllLichessGamesForRound = async (
  tournamentId,
  roundNumber,
  options = {},
  userId = null
) => {
  if (!mongoose.isValidObjectId(tournamentId)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const numRound = Number(roundNumber);
  if (isNaN(numRound) || numRound < 1) {
    const error = new Error('Round not found');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Verify host ownership if userId is provided
  if (userId && tournament.createdBy.toString() !== userId.toString()) {
    const error = new Error('You are not authorized to create Lichess games for this tournament');
    error.statusCode = 403;
    throw error;
  }

  const round = await Round.findOne({
    tournamentId: tournament._id,
    roundNumber: numRound,
  });
  if (!round) {
    const error = new Error('Round not found');
    error.statusCode = 404;
    throw error;
  }

  const pairings = await Pairing.find({
    roundId: round._id,
    tournamentId: tournament._id,
  })
    .sort({ createdAt: 1 })
    .populate('whitePlayer', 'name email avatar lichessUsername')
    .populate('blackPlayer', 'name email avatar lichessUsername');

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const results = [];

  for (const p of pairings) {
    // Skip BYE pairings (no game needed)
    if (p.status === 'BYE' || p.result === 'BYE' || !p.blackPlayer) {
      skipped++;
      results.push({
        pairingId: p._id,
        status: 'SKIPPED',
        reason: 'BYE pairing does not require a Lichess game',
      });
      continue;
    }

    // Already has Lichess game -> skip
    if (p.lichessGameId) {
      skipped++;
      results.push({
        pairingId: p._id,
        status: 'SKIPPED',
        reason: 'Lichess game already exists',
        gameId: p.lichessGameId,
        gameUrl: p.lichessGameUrl,
      });
      continue;
    }

    // Missing usernames -> fail per-pairing without crashing the batch
    const whiteUsername = p.whitePlayer?.lichessUsername?.trim();
    const blackUsername = p.blackPlayer?.lichessUsername?.trim();
    if (!whiteUsername || !blackUsername) {
      failed++;
      results.push({
        pairingId: p._id,
        status: 'FAILED',
        reason: 'Both players must have linked Lichess usernames before creating a game.',
      });
      continue;
    }

    try {
      const updated = await createLichessGameForPairing(
        tournamentId,
        numRound,
        p._id,
        options,
        userId
      );
      created++;
      results.push({
        pairingId: p._id,
        status: 'CREATED',
        gameId: updated.lichessGameId,
        gameUrl: updated.lichessGameUrl,
      });
    } catch (err) {
      failed++;
      results.push({
        pairingId: p._id,
        status: 'FAILED',
        reason: err.message,
      });
    }
  }

  // Refetch all pairings in round
  const allPairings = await Pairing.find({
    roundId: round._id,
    tournamentId: tournament._id,
  })
    .sort({ createdAt: 1 })
    .populate('whitePlayer', 'name email avatar lichessUsername')
    .populate('blackPlayer', 'name email avatar lichessUsername');

  return {
    round: numRound,
    total: pairings.length,
    created,
    skipped,
    failed,
    results,
    pairings: allPairings,
  };
};

/**
 * Synchronizes the status and result of an existing Lichess game back to the Pairing document.
 * 
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 * @param {string} pairingId
 * @param {Object} [options]
 * @returns {Promise<Pairing>}
 */
export const syncPairingResult = async (
  tournamentId,
  roundNumber,
  pairingId,
  options = {},
  userId = null
) => {
  // If only pairingId was provided as first argument
  let tId = tournamentId;
  let rNum = roundNumber;
  let pId = pairingId;

  if (!roundNumber && !pairingId) {
    pId = tournamentId;
    tId = null;
    rNum = null;
  }

  if (pId && !mongoose.isValidObjectId(pId)) {
    const error = new Error('Pairing not found');
    error.statusCode = 404;
    throw error;
  }

  // 1. Validate Tournament & Round if provided
  let tournament = null;
  if (tId) {
    if (!mongoose.isValidObjectId(tId)) {
      const error = new Error('Tournament not found');
      error.statusCode = 404;
      throw error;
    }
    tournament = await Tournament.findById(tId);
    if (!tournament) {
      const error = new Error('Tournament not found');
      error.statusCode = 404;
      throw error;
    }
  }

  let round = null;
  if (rNum !== null && rNum !== undefined) {
    const numRound = Number(rNum);
    if (isNaN(numRound) || numRound < 1) {
      const error = new Error('Round not found');
      error.statusCode = 404;
      throw error;
    }
    if (tournament) {
      round = await Round.findOne({
        tournamentId: tournament._id,
        roundNumber: numRound,
      });
      if (!round) {
        const error = new Error('Round not found');
        error.statusCode = 404;
        throw error;
      }
    }
  }

  // 2. Find Pairing with populated players
  const pairing = await Pairing.findById(pId)
    .populate('whitePlayer', 'name email avatar lichessUsername')
    .populate('blackPlayer', 'name email avatar lichessUsername');

  if (!pairing) {
    const error = new Error('Pairing not found');
    error.statusCode = 404;
    throw error;
  }

  // 3. Verify relationships
  if (tournament && pairing.tournamentId.toString() !== tournament._id.toString()) {
    const error = new Error('Pairing does not belong to the specified tournament.');
    error.statusCode = 400;
    throw error;
  }

  if (round && pairing.roundId.toString() !== round._id.toString()) {
    const error = new Error('Pairing does not belong to the specified round.');
    error.statusCode = 400;
    throw error;
  }

  // Verify ownership or participant authorization if userId is provided
  if (userId) {
    const isCreator = tournament && tournament.createdBy.toString() === userId.toString();
    const isPlayer =
      (pairing.whitePlayer && pairing.whitePlayer._id.toString() === userId.toString()) ||
      (pairing.blackPlayer && pairing.blackPlayer._id.toString() === userId.toString());
    if (!isCreator && !isPlayer) {
      const error = new Error('You are not authorized to sync this pairing result');
      error.statusCode = 403;
      throw error;
    }
  }

  // 4. Verify pairing has a Lichess game ID
  if (!pairing.lichessGameId) {
    const error = new Error('This pairing does not have an associated Lichess game.');
    error.statusCode = 400;
    throw error;
  }

  // 5. Prevent unnecessary updates if already finalized
  const isAlreadyFinished =
    pairing.status === 'FINISHED' &&
    ['1-0', '0-1', '1/2-1/2'].includes(pairing.result);

  if (isAlreadyFinished && !options.force) {
    return pairing;
  }

  // 6. Fetch game state from Lichess
  const gameData = await lichessService.getGameResult(pairing.lichessGameId, options);

  // 7. Update Pairing
  pairing.lichessStatus = gameData.status;

  if (gameData.completed) {
    pairing.status = gameData.pairingStatus; // 'FINISHED' or 'ABORTED'
    if (gameData.result) {
      pairing.result = gameData.result;
    }
    if (!pairing.completedAt) {
      pairing.completedAt = new Date();
    }
  } else {
    // Game still running
    pairing.status = 'ACTIVE';
  }

  await pairing.save();
  return pairing;
};

export default {
  createLichessGameForPairing,
  createAllLichessGamesForRound,
  syncPairingResult,
};
