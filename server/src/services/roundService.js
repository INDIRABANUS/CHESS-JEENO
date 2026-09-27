import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import { generateRoundRobinSchedule } from '../utils/roundRobin.js';

/**
 * Creates the next round and its Round Robin pairings.
 * 
 * @param {string} tournamentId
 * @returns {Promise<{ round: Round, pairings: Array<Pairing> }>}
 */
export const createRound = async (tournamentId) => {
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

  // Round creation initially allowed only during REGISTRATION
  if (tournament.status !== 'REGISTRATION') {
    const error = new Error(
      `Cannot create rounds for tournament with status '${tournament.status}'. Initial rounds can only be created during REGISTRATION.`
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

  // Generate full Round Robin schedule
  const schedule = generateRoundRobinSchedule(registeredPlayers);
  const totalRounds = schedule.length;

  // Determine next round number
  const existingRounds = await Round.find({ tournamentId }).sort({ roundNumber: 1 });
  const nextRoundNumber = existingRounds.length + 1;

  if (nextRoundNumber > totalRounds) {
    const error = new Error(
      `All ${totalRounds} rounds have already been created for this Round Robin tournament.`
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
  const roundPlan = schedule[nextRoundNumber - 1];

  let round;
  let pairings = [];

  try {
    // 1. Create Round document
    round = await Round.create({
      tournamentId,
      roundNumber: nextRoundNumber,
      status: 'PENDING',
      byePlayer: roundPlan.byePlayer || null,
    });

    // 2. Create Pairing documents
    if (roundPlan.pairings.length > 0) {
      const pairingDocs = roundPlan.pairings.map((p) => ({
        roundId: round._id,
        tournamentId,
        whitePlayer: p.whitePlayer,
        blackPlayer: p.blackPlayer,
        lichessGameId: null,
        lichessGameUrl: null,
        status: 'PENDING',
        result: 'PENDING',
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
  // Complete when every pairing is terminal (FINISHED or ABORTED)
  // and no active or pending pairings exist. A BYE alone with 0 pairings is also complete.
  const complete =
    totalPairings === 0 || (finishedPairings + abortedPairings === totalPairings);

  // If complete and round.status is not COMPLETED, mark it COMPLETED
  if (complete && round.status !== 'COMPLETED') {
    round.status = 'COMPLETED';
    round.completedAt = round.completedAt || new Date();
    await round.save();
  }

  return {
    roundNumber: numRound,
    complete,
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
