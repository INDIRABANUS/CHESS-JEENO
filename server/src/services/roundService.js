import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import { generateRoundRobinSchedule } from '../utils/roundRobin.js';
import { generateSwissPairings } from '../utils/swissPairing.js';
import {
  calculateTotalRounds,
  generateKnockoutInitialPairings,
  generateKnockoutNextRoundPairings,
  determinePairingWinner,
} from '../utils/knockoutPairing.js';
import * as standingsService from './standingsService.js';

/**
 * Cleanly and idempotently completes a tournament.
 * Persists status: 'FINISHED', sets completionReason, resolves winner deterministically,
 * and emits the existing TOURNAMENT_COMPLETED Socket.IO event.
 *
 * @param {Object|string} tournamentOrId
 * @param {'TOTAL_ROUNDS_REACHED'|'ALL_MATCHUPS_EXHAUSTED'} [reason='TOTAL_ROUNDS_REACHED']
 * @returns {Promise<Object>} The updated Tournament document
 */
export const finishTournament = async (tournamentOrId, reason = 'TOTAL_ROUNDS_REACHED') => {
  const tournamentId = tournamentOrId?._id || tournamentOrId;
  const tournament =
    tournamentOrId && typeof tournamentOrId.save === 'function'
      ? tournamentOrId
      : await Tournament.findById(tournamentId);

  if (!tournament) return null;

  // Idempotency: if already finished or completed, return without side effects
  if (tournament.status === 'FINISHED' || tournament.status === 'COMPLETED') {
    return tournament;
  }

  tournament.status = 'FINISHED';
  if (!tournament.completionReason) {
    tournament.completionReason = reason;
  }

  // Deterministic winner resolution from final standings if not already assigned
  if (!tournament.winnerPlayer) {
    try {
      const standingsData = await standingsService.getTournamentStandings(tournament._id);
      if (standingsData.standings.length > 0 && standingsData.standings[0].playerId) {
        tournament.winnerPlayer = standingsData.standings[0].playerId;
      }
    } catch (stErr) {
      console.warn(`[RoundService] Winner resolution warning: ${stErr.message}`);
    }
  }

  await tournament.save();

  // Broadcast tournament completion via existing Socket.IO mechanism
  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      const populated = await tournament.populate('winnerPlayer', 'name email avatar lichessUsername');
      io.to(`tournament:${tournament._id.toString()}`).emit('TOURNAMENT_COMPLETED', {
        tournamentId: tournament._id.toString(),
        status: 'FINISHED',
        winner: populated.winnerPlayer
          ? {
              id: populated.winnerPlayer._id.toString(),
              name: populated.winnerPlayer.name,
            }
          : null,
      });
    }
  } catch (bErr) {
    // Non-fatal
  }

  // Notify tournament participants about tournament completion
  try {
    const players = await TournamentPlayer.find({ tournamentId: tournament._id });
    const notificationService = await import('./notificationService.js');
    const notifPromises = [];
    for (const p of players) {
      const pUserId = p.userId?._id || p.userId;
      if (pUserId) {
        notifPromises.push(
          notificationService.createNotification({
            recipient: pUserId,
            type: 'TOURNAMENT_COMPLETED',
            title: 'Tournament completed',
            message: `${tournament.name} has finished. View the final standings.`,
            tournament: tournament._id,
            metadata: {
              tournamentName: tournament.name,
              completionReason: tournament.completionReason || reason,
            },
            eventKey: `TOURNAMENT_COMPLETED:${tournament._id.toString()}:${pUserId.toString()}`,
          }).catch((err) => console.warn('[Notification] Failed to create tournament completed notification:', err.message))
        );
      }
    }
    await Promise.all(notifPromises);
  } catch (nErr) {
    console.warn('[Notification] Tournament completion notification error:', nErr.message);
  }

  return tournament;
};

/**
 * Creates the next round and its Round Robin pairings.
 * 
 * @param {string} tournamentId
 * @returns {Promise<{ round: Round, pairings: Array<Pairing> }>}
 */
export const createRound = async (tournamentId, userId = null) => {
  if (!mongoose.isValidObjectId(tournamentId)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Verify ownership if userId is provided
  if (userId && tournament.createdBy.toString() !== userId.toString()) {
    const error = new Error('You are not authorized to create rounds for this tournament');
    error.statusCode = 403;
    throw error;
  }

  // Round creation allowed during pre-start and active tournament statuses
  const ALLOWED_ROUND_CREATION_STATUSES = [
    'REGISTRATION',
    'READY_CHECK',
    'COUNTDOWN',
    'RUNNING',
    'IN_PROGRESS',
  ];
  if (!ALLOWED_ROUND_CREATION_STATUSES.includes(tournament.status)) {
    if (
      (tournament.status === 'FINISHED' || tournament.status === 'COMPLETED') &&
      tournament.completionReason === 'ALL_MATCHUPS_EXHAUSTED'
    ) {
      return {
        round: null,
        pairings: [],
        tournament,
        completed: true,
        completionReason: 'ALL_MATCHUPS_EXHAUSTED',
        message: 'All possible matchups have been completed. Tournament has concluded.',
      };
    }
    const error = new Error(
      `Cannot create rounds for tournament with status '${tournament.status}'.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Retrieve registered players
  const registeredPlayers = await TournamentPlayer.find({ tournamentId })
    .sort({ joinedAt: 1 })
    .populate('userId', 'name email avatar lichessUsername');

  if (registeredPlayers.length < 2) {
    const error = new Error('At least 2 players are required to create a round.');
    error.statusCode = 400;
    throw error;
  }

  const isSwiss = tournament.format === 'SWISS';
  const isKnockout = tournament.format === 'KNOCKOUT';
  let totalRounds;

  // Determine total rounds based on tournament format
  if (isSwiss) {
    totalRounds = tournament.totalRounds;
    if (!totalRounds || totalRounds < 1) {
      const error = new Error('Swiss tournament totalRounds is not configured.');
      error.statusCode = 400;
      throw error;
    }
  } else if (isKnockout) {
    totalRounds = calculateTotalRounds(registeredPlayers.length);
  } else {
    // Generate full Round Robin schedule
    const schedule = generateRoundRobinSchedule(registeredPlayers);
    totalRounds = schedule.length;
  }

  // Determine next round number
  const existingRounds = await Round.find({ tournamentId }).sort({ roundNumber: 1 });
  const nextRoundNumber = existingRounds.length + 1;

  if (nextRoundNumber > totalRounds) {
    const error = new Error(
      isSwiss
        ? `All ${totalRounds} rounds have already been created for this Swiss tournament.`
        : isKnockout
        ? `All ${totalRounds} rounds have already been created for this Knockout tournament.`
        : `All ${totalRounds} rounds have already been created for this Round Robin tournament.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Prevent duplicate creation
  const duplicate = await Round.findOne({ tournamentId, roundNumber: nextRoundNumber });
  if (duplicate) {
    const error = new Error(`Round ${nextRoundNumber} already exists.`);
    error.statusCode = 400;
    throw error;
  }

  // Enforce sequential round completion: previous round must be complete
  if (nextRoundNumber > 1) {
    const prevRoundNumber = nextRoundNumber - 1;
    const prevStatus = await getRoundCompletionStatus(tournamentId, prevRoundNumber);
    if (!prevStatus.complete) {
      const error = new Error(
        'Previous round is not complete. Finish and sync all games before creating the next round.'
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // Extract planned pairings and bye for nextRoundNumber
  let roundPlan;
  if (isSwiss) {
    const fullPreviousRounds = await getRounds(tournamentId);
    const standingsData = await standingsService.getTournamentStandings(tournamentId);

    try {
      roundPlan = generateSwissPairings({
        players: registeredPlayers,
        standings: standingsData.standings,
        previousRounds: fullPreviousRounds,
        roundNumber: nextRoundNumber,
      });
    } catch (err) {
      const isExhausted =
        err.code === 'ALL_MATCHUPS_EXHAUSTED' ||
        (err.message && err.message.includes('no valid pairings exist without repeat matchups'));

      if (isExhausted) {
        // All valid matchups exhausted without repeats: complete tournament cleanly
        const finishedTournament = await finishTournament(tournament, 'ALL_MATCHUPS_EXHAUSTED');
        return {
          round: null,
          pairings: [],
          tournament: finishedTournament,
          completed: true,
          completionReason: 'ALL_MATCHUPS_EXHAUSTED',
          message: 'All possible matchups have been completed. Tournament has concluded.',
        };
      }

      // Re-throw any other pairing error (duplicate players, invalid input, etc.)
      throw err;
    }
  } else if (isKnockout) {
    if (nextRoundNumber === 1) {
      roundPlan = generateKnockoutInitialPairings(registeredPlayers);
    } else {
      const fullPreviousRounds = await getRounds(tournamentId);
      const prevRound = fullPreviousRounds.find((r) => r.roundNumber === nextRoundNumber - 1);
      roundPlan = generateKnockoutNextRoundPairings({
        previousRound: prevRound,
        roundNumber: nextRoundNumber,
        totalRounds,
      });
    }
  } else {
    const schedule = generateRoundRobinSchedule(registeredPlayers);
    roundPlan = schedule[nextRoundNumber - 1];
  }

  let round;
  let pairings = [];

  try {
    // 1. Create Round document
    round = await Round.create({
      tournamentId,
      roundNumber: nextRoundNumber,
      status: 'PENDING',
      stageName: roundPlan.stageName || null,
      byePlayer: roundPlan.byePlayer || null,
    });

    // If Knockout and totalRounds not persisted yet, persist derived totalRounds
    if (isKnockout && !tournament.totalRounds) {
      await Tournament.findByIdAndUpdate(tournamentId, { totalRounds });
    }

    // 2. Create Pairing documents
    if (roundPlan.pairings.length > 0) {
      const pairingDocs = roundPlan.pairings.map((p) => ({
        roundId: round._id,
        tournamentId,
        whitePlayer: p.whitePlayer,
        blackPlayer: p.blackPlayer || null,
        lichessGameId: null,
        lichessGameUrl: null,
        status: p.status || 'PENDING',
        result: p.result || 'PENDING',
        completedAt: p.status === 'BYE' ? new Date() : null,
      }));

      pairings = await Pairing.insertMany(pairingDocs);
    }
  } catch (err) {
    // Rollback in case of failure
    if (round && round._id) {
      await Round.findByIdAndDelete(round._id);
      await Pairing.deleteMany({ roundId: round._id });
    }
    if (err.code === 11000) {
      const error = new Error(`Round ${nextRoundNumber} already exists.`);
      error.statusCode = 400;
      throw error;
    }
    throw err;
  }

  // Populate round and pairings
  const populatedRound = await Round.findById(round._id).populate(
    'byePlayer',
    'name email avatar lichessUsername'
  );

  const populatedPairings = await Pairing.find({ roundId: round._id })
    .populate('whitePlayer', 'name email avatar lichessUsername')
    .populate('blackPlayer', 'name email avatar lichessUsername');

  // Generate in-app notifications for pairings and round readiness
  try {
    const notificationService = await import('./notificationService.js');
    const notifPromises = [];
    for (const p of populatedPairings) {
      const whiteId = p.whitePlayer?._id || p.whitePlayer;
      const blackId = p.blackPlayer?._id || p.blackPlayer;
      const whiteName = p.whitePlayer?.name || 'White';
      const blackName = p.blackPlayer?.name || 'Black';

      if (whiteId) {
        const msg = blackId
          ? `You have been paired against ${blackName}.`
          : `You have received a BYE for Round ${nextRoundNumber}.`;
        notifPromises.push(
          notificationService.createNotification({
            recipient: whiteId,
            type: 'PAIRING_CREATED',
            title: `Round ${nextRoundNumber} pairing ready`,
            message: msg,
            tournament: tournamentId,
            round: round._id,
            pairing: p._id,
            metadata: {
              roundNumber: nextRoundNumber,
              opponentName: blackId ? blackName : 'BYE',
              lichessGameUrl: p.lichessGameUrl || null,
            },
            eventKey: `PAIRING_CREATED:${p._id.toString()}:${whiteId.toString()}`,
          }).catch((err) => console.warn('[Notification] Failed to notify white player pairing:', err.message))
        );
      }

      if (blackId) {
        notifPromises.push(
          notificationService.createNotification({
            recipient: blackId,
            type: 'PAIRING_CREATED',
            title: `Round ${nextRoundNumber} pairing ready`,
            message: `You have been paired against ${whiteName}.`,
            tournament: tournamentId,
            round: round._id,
            pairing: p._id,
            metadata: {
              roundNumber: nextRoundNumber,
              opponentName: whiteName,
              lichessGameUrl: p.lichessGameUrl || null,
            },
            eventKey: `PAIRING_CREATED:${p._id.toString()}:${blackId.toString()}`,
          }).catch((err) => console.warn('[Notification] Failed to notify black player pairing:', err.message))
        );
      }
    }

    // Also notify registered players about the new round being ready
    for (const player of registeredPlayers) {
      const pUserId = player.userId?._id || player.userId;
      if (pUserId) {
        notifPromises.push(
          notificationService.createNotification({
            recipient: pUserId,
            type: 'ROUND_READY',
            title: `Round ${nextRoundNumber} is ready`,
            message: `Round ${nextRoundNumber} has been generated for ${tournament.name}.`,
            tournament: tournamentId,
            round: round._id,
            metadata: {
              roundNumber: nextRoundNumber,
              tournamentName: tournament.name,
            },
            eventKey: `ROUND_READY:${tournamentId.toString()}:${nextRoundNumber}:${pUserId.toString()}`,
          }).catch((err) => console.warn('[Notification] Failed to notify player round ready:', err.message))
        );
      }
    }
    await Promise.all(notifPromises);
  } catch (notifErr) {
    console.warn('[Notification] Round/pairing notification error:', notifErr.message);
  }

  return {
    round: populatedRound,
    pairings: populatedPairings,
  };
};

/**
 * Retrieves all rounds for a tournament along with their pairings.
 * 
 * @param {string} tournamentId
 * @returns {Promise<Array<Object>>}
 */
export const getRounds = async (tournamentId) => {
  if (!mongoose.isValidObjectId(tournamentId)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const rounds = await Round.find({ tournamentId })
    .sort({ roundNumber: 1 })
    .populate('byePlayer', 'name email avatar lichessUsername');

  if (rounds.length === 0) {
    return [];
  }

  const roundIds = rounds.map((r) => r._id);
  const allPairings = await Pairing.find({ roundId: { $in: roundIds } })
    .sort({ createdAt: 1 })
    .populate('whitePlayer', 'name email avatar lichessUsername')
    .populate('blackPlayer', 'name email avatar lichessUsername');

  // Group pairings by roundId
  const pairingsByRound = new Map();
  for (const p of allPairings) {
    const rId = p.roundId.toString();
    if (!pairingsByRound.has(rId)) {
      pairingsByRound.set(rId, []);
    }
    pairingsByRound.get(rId).push(p);
  }

  return rounds.map((r) => {
    const roundObj = r.toObject();
    roundObj.pairings = pairingsByRound.get(r._id.toString()) || [];
    return roundObj;
  });
};

/**
 * Retrieves a single round by tournament ID and round number.
 * 
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 * @returns {Promise<Object>}
 */
export const getRoundByNumber = async (tournamentId, roundNumber) => {
  if (!mongoose.isValidObjectId(tournamentId)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(tournamentId).populate(
    'createdBy',
    'name email avatar lichessUsername'
  );
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const num = Number(roundNumber);
  if (isNaN(num) || num < 1) {
    const error = new Error('Invalid round number. Round number must be an integer >= 1.');
    error.statusCode = 400;
    throw error;
  }

  const round = await Round.findOne({ tournamentId, roundNumber: num }).populate(
    'byePlayer',
    'name email avatar lichessUsername'
  );

  if (!round) {
    const error = new Error(`Round ${num} not found.`);
    error.statusCode = 404;
    throw error;
  }

  const pairings = await Pairing.find({ roundId: round._id })
    .sort({ createdAt: 1 })
    .populate('whitePlayer', 'name email avatar lichessUsername')
    .populate('blackPlayer', 'name email avatar lichessUsername');

  return {
    tournament: {
      _id: tournament._id,
      name: tournament.name,
      format: tournament.format,
      status: tournament.status,
    },
    round,
    pairings,
  };
};

/**
 * Evaluates completion status for a specific round in a tournament.
 * A round is complete when every real pairing has a terminal state (FINISHED or ABORTED)
 * and every pairing has been resolved/synchronized.
 * A BYE does not prevent round completion.
 * An ACTIVE or PENDING pairing means the round is NOT complete.
 *
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 * @returns {Promise<Object>}
 */
export const getRoundCompletionStatus = async (tournamentId, roundNumber) => {
  if (!mongoose.isValidObjectId(tournamentId)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const numRound = Number(roundNumber);
  if (isNaN(numRound) || numRound < 1) {
    const error = new Error('Invalid round number. Round number must be an integer >= 1.');
    error.statusCode = 400;
    throw error;
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const round = await Round.findOne({ tournamentId, roundNumber: numRound }).populate(
    'byePlayer',
    'name email avatar lichessUsername'
  );

  if (!round) {
    const error = new Error(`Round ${numRound} not found.`);
    error.statusCode = 404;
    throw error;
  }

  const pairings = await Pairing.find({ roundId: round._id, tournamentId });

  let finishedPairings = 0;
  let abortedPairings = 0;
  let pendingPairings = 0;
  let activePairings = 0;

  for (const p of pairings) {
    const isFinished =
      p.status === 'FINISHED' ||
      p.status === 'COMPLETED' ||
      p.status === 'BYE' ||
      p.result === 'BYE' ||
      ['1-0', '0-1', '1/2-1/2', 'WHITE_WIN', 'BLACK_WIN', 'DRAW'].includes(p.result);

    const isAborted =
      p.status === 'ABORTED' ||
      p.status === 'CANCELLED' ||
      p.result === 'ABORTED';

    if (isFinished) {
      finishedPairings++;
    } else if (isAborted) {
      abortedPairings++;
    } else if (p.status === 'PENDING' || p.status === 'CREATED') {
      pendingPairings++;
    } else {
      activePairings++;
    }
  }

  const totalPairings = pairings.length;
  // A round is complete ONLY when every pairing has finished (or BYE),
  // and ZERO aborted, active, or pending pairings remain.
  // In V2, an aborted pairing is UNRESOLVED until rematched/recovered.
  const complete =
    totalPairings === 0 ||
    (finishedPairings === totalPairings && abortedPairings === 0 && activePairings === 0 && pendingPairings === 0);

  // If complete and round.status is not COMPLETED, mark it COMPLETED
  if (complete && round.status !== 'COMPLETED') {
    round.status = 'COMPLETED';
    round.completedAt = round.completedAt || new Date();
    await round.save();
  }

  // If complete, check if tournament should transition to FINISHED
  if (complete) {
    let tournamentShouldFinish = false;
    let finishReason = 'TOTAL_ROUNDS_REACHED';

    if (
      tournament.format === 'SWISS' &&
      tournament.totalRounds &&
      numRound >= tournament.totalRounds
    ) {
      tournamentShouldFinish = true;
      finishReason = 'TOTAL_ROUNDS_REACHED';
    } else if (tournament.format === 'ROUND_ROBIN') {
      const registeredPlayers = await TournamentPlayer.find({ tournamentId });
      if (registeredPlayers.length >= 2) {
        const totalRounds = registeredPlayers.length % 2 === 0
          ? registeredPlayers.length - 1
          : registeredPlayers.length;
        if (numRound >= totalRounds) {
          tournamentShouldFinish = true;
          finishReason = 'TOTAL_ROUNDS_REACHED';
        }
      }
    } else if (tournament.format === 'KNOCKOUT') {
      const registeredPlayers = await TournamentPlayer.find({ tournamentId });
      const totalKnockoutRounds = calculateTotalRounds(registeredPlayers.length);
      if (numRound >= totalKnockoutRounds) {
        tournamentShouldFinish = true;
        finishReason = 'TOTAL_ROUNDS_REACHED';
        if (pairings.length === 1) {
          const finalMatch = pairings[0];
          const championId = determinePairingWinner(finalMatch);
          if (championId) {
            tournament.winnerPlayer = championId;
          }
        }
      }
    }

    if (tournamentShouldFinish) {
      await finishTournament(tournament, finishReason);
    }
  }

  return {
    roundNumber: numRound,
    complete,
    isComplete: complete,
    totalPairings,
    finishedPairings,
    abortedPairings,
    pendingPairings,
    activePairings,
    byePlayer: round.byePlayer || null,
  };
};

export default {
  createRound,
  getRounds,
  getRoundByNumber,
  getRoundCompletionStatus,
  finishTournament,
};
