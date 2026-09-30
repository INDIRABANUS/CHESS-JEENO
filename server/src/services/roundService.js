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

    roundPlan = generateSwissPairings({
      players: registeredPlayers,
      standings: standingsData.standings,
      previousRounds: fullPreviousRounds,
      roundNumber: nextRoundNumber,
    });
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
    if (
      tournament.format === 'SWISS' &&
      tournament.totalRounds &&
      numRound >= tournament.totalRounds
    ) {
      tournamentShouldFinish = true;
    } else if (tournament.format === 'ROUND_ROBIN') {
      const registeredPlayers = await TournamentPlayer.find({ tournamentId });
      if (registeredPlayers.length >= 2) {
        const totalRounds = registeredPlayers.length % 2 === 0
          ? registeredPlayers.length - 1
          : registeredPlayers.length;
        if (numRound >= totalRounds) {
          tournamentShouldFinish = true;
        }
      }
    } else if (tournament.format === 'KNOCKOUT') {
      const registeredPlayers = await TournamentPlayer.find({ tournamentId });
      const totalKnockoutRounds = calculateTotalRounds(registeredPlayers.length);
      if (numRound >= totalKnockoutRounds) {
        tournamentShouldFinish = true;
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
      if (tournament.status !== 'FINISHED' && tournament.status !== 'COMPLETED') {
        tournament.status = 'FINISHED';

        // Deterministic winner resolution from final standings if not already assigned
        if (!tournament.winnerPlayer) {
          try {
            const standingsData = await standingsService.getTournamentStandings(tournamentId);
            if (standingsData.standings.length > 0 && standingsData.standings[0].playerId) {
              tournament.winnerPlayer = standingsData.standings[0].playerId;
            }
          } catch (stErr) {
            console.warn(`[RoundService] Winner resolution warning: ${stErr.message}`);
          }
        }

        await tournament.save();

        // Broadcast tournament completion
        try {
          const { getIo } = await import('../realtime/socket.js');
          const io = getIo();
          if (io) {
            const populated = await tournament.populate('winnerPlayer', 'name email avatar lichessUsername');
            io.to(`tournament:${tournamentId}`).emit('TOURNAMENT_COMPLETED', {
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
      }
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
};
