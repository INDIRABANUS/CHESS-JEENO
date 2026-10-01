import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import TournamentJoinRequest from '../models/TournamentJoinRequest.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

const VALID_FORMATS = ['ROUND_ROBIN', 'SWISS', 'KNOCKOUT'];
const ALLOWED_UPDATE_FIELDS = [
  'name',
  'description',
  'format',
  'rated',
  'clockLimit',
  'increment',
  'startTime',
  'maxPlayers',
  'totalRounds',
];

/**
 * Validates tournament input fields.
 * Throws an Error with statusCode = 400 if validation fails.
 */
export const validateTournamentPayload = (payload, isPartial = false) => {
  const { name, format, clockLimit, increment, maxPlayers, startTime, rated } = payload;

  // Name validation
  if (!isPartial || name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      const error = new Error('Tournament name is required');
      error.statusCode = 400;
      throw error;
    }
  }

  // Format validation
  if (!isPartial || format !== undefined) {
    if (!format || !VALID_FORMATS.includes(format)) {
      const error = new Error(`Invalid format. Allowed formats: ${VALID_FORMATS.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Clock limit validation
  if (!isPartial || clockLimit !== undefined) {
    const clock = Number(clockLimit);
    if (isNaN(clock) || clock < 1) {
      const error = new Error('Clock limit must be a number greater than or equal to 1');
      error.statusCode = 400;
      throw error;
    }
  }

  // Increment validation
  if (!isPartial || increment !== undefined) {
    const inc = Number(increment);
    if (isNaN(inc) || inc < 0) {
      const error = new Error('Increment must be a number greater than or equal to 0');
      error.statusCode = 400;
      throw error;
    }
  }

  // Max players validation
  if (maxPlayers !== undefined && maxPlayers !== null && maxPlayers !== '') {
    const players = Number(maxPlayers);
    if (isNaN(players) || players < 2) {
      const error = new Error('Maximum players must be at least 2');
      error.statusCode = 400;
      throw error;
    }
  }

  // Start time validation
  if (startTime !== undefined && startTime !== null && startTime !== '') {
    const date = new Date(startTime);
    if (isNaN(date.getTime())) {
      const error = new Error('Start time must be a valid date');
      error.statusCode = 400;
      throw error;
    }
  }

  // Rated validation
  if (rated !== undefined && typeof rated !== 'boolean') {
    const error = new Error('Rated field must be a boolean');
    error.statusCode = 400;
    throw error;
  }

  // Swiss totalRounds validation
  if (format === 'SWISS') {
    if (!isPartial || payload.totalRounds !== undefined) {
      if (payload.totalRounds === undefined || payload.totalRounds === null || payload.totalRounds === '') {
        const error = new Error('Total rounds is required for Swiss tournaments');
        error.statusCode = 400;
        throw error;
      }
      const rounds = Number(payload.totalRounds);
      if (isNaN(rounds) || !Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
        const error = new Error('Total rounds for Swiss tournaments must be an integer between 1 and 20');
        error.statusCode = 400;
        throw error;
      }
    }
  }
};

/**
 * Creates a new tournament.
 */
export const createTournament = async (payload, creatorId) => {
  validateTournamentPayload(payload, false);

  const {
    name,
    description = '',
    format,
    rated = false,
    clockLimit,
    increment = 0,
    startTime = null,
    maxPlayers = null,
    totalRounds = null,
  } = payload;

  const tournament = await Tournament.create({
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    format,
    totalRounds: format === 'SWISS' ? Number(totalRounds) : null,
    rated: Boolean(rated),
    clockLimit: Number(clockLimit),
    increment: Number(increment),
    startTime: startTime ? new Date(startTime) : null,
    maxPlayers: maxPlayers ? Number(maxPlayers) : null,
    createdBy: creatorId,
    status: 'REGISTRATION',
  });

  return await tournament.populate('createdBy', 'name email avatar lichessUsername');
};

/**
 * Retrieves a list of tournaments with optional status and format filters.
 * Dynamically computes registered player count from TournamentPlayer collection.
 */
export const getTournaments = async ({ status, format } = {}) => {
  const query = {};

  if (status) {
    query.status = status;
  }

  if (format) {
    query.format = format;
  }

  const tournaments = await Tournament.find(query)
    .sort({ startTime: 1, createdAt: -1 })
    .populate('createdBy', 'name email avatar lichessUsername');

  const tournamentIds = tournaments.map((t) => t._id);
  const playerCounts = await TournamentPlayer.aggregate([
    { $match: { tournamentId: { $in: tournamentIds } } },
    { $group: { _id: '$tournamentId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(playerCounts.map((c) => [c._id.toString(), c.count]));

  const readyCounts = await TournamentPlayer.aggregate([
    { $match: { tournamentId: { $in: tournamentIds }, isReady: true } },
    { $group: { _id: '$tournamentId', count: { $sum: 1 } } },
  ]);
  const readyMap = new Map(readyCounts.map((c) => [c._id.toString(), c.count]));

  return tournaments.map((t) => {
    const obj = t.toObject();
    obj.registeredPlayers = countMap.get(t._id.toString()) || 0;
    obj.readyPlayers = readyMap.get(t._id.toString()) || 0;
    return obj;
  });
};

/**
 * Retrieves a single tournament by ID.
 * Dynamically computes registered player count, readiness counts, and current user status.
 */
export const getTournamentById = async (id, currentUserId = null) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(id)
    .populate('createdBy', 'name email avatar lichessUsername')
    .populate('winnerPlayer', 'name email avatar lichessUsername');

  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const registeredPlayers = await TournamentPlayer.countDocuments({ tournamentId: id });
  const readyPlayers = await TournamentPlayer.countDocuments({ tournamentId: id, isReady: true });
  let isRegistered = false;
  let isCurrentUserReady = false;
  let joinRequestStatus = 'NOT_REQUESTED';
  let userJoinRequest = null;

  if (currentUserId) {
    const playerRecord = await TournamentPlayer.findOne({ tournamentId: id, userId: currentUserId });
    if (playerRecord) {
      isRegistered = true;
      isCurrentUserReady = Boolean(playerRecord.isReady);
      joinRequestStatus = 'PARTICIPANT';
    } else {
      const requestRecord = await TournamentJoinRequest.findOne({ tournament: id, user: currentUserId });
      if (requestRecord) {
        joinRequestStatus = requestRecord.status;
        userJoinRequest = requestRecord;
      }
    }
  }

  const result = tournament.toObject();
  result.registeredPlayers = registeredPlayers;
  result.readyPlayers = readyPlayers;
  result.isRegistered = isRegistered;
  result.isCurrentUserReady = isCurrentUserReady;
  result.joinRequestStatus = joinRequestStatus;
  result.userJoinRequest = userJoinRequest;

  // If current user is host, also compute count of pending join requests
  const creatorIdStr = (tournament.createdBy?._id || tournament.createdBy)?.toString();
  if (currentUserId && creatorIdStr === currentUserId.toString()) {
    result.pendingJoinRequestsCount = await TournamentJoinRequest.countDocuments({
      tournament: id,
      status: 'PENDING',
    });
  } else {
    result.pendingJoinRequestsCount = 0;
  }

  return result;
};

/**
 * Updates an existing tournament.
 */
export const updateTournament = async (id, updateData, currentUserId = null) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Check if tournament exists
  const existingTournament = await Tournament.findById(id);
  if (!existingTournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Verify ownership if currentUserId is provided
  if (currentUserId && existingTournament.createdBy.toString() !== currentUserId.toString()) {
    const error = new Error('You are not authorized to update this tournament');
    error.statusCode = 403;
    throw error;
  }

  // Prevent status modification through this endpoint
  if (updateData.status !== undefined && updateData.status !== existingTournament.status) {
    const error = new Error('Changing tournament status via this endpoint is not allowed');
    error.statusCode = 400;
    throw error;
  }

  // Filter allowed fields only
  const sanitizedUpdates = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (updateData[field] !== undefined) {
      sanitizedUpdates[field] = updateData[field];
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    const error = new Error('No valid fields provided for update');
    error.statusCode = 400;
    throw error;
  }

  // Validate only provided fields
  validateTournamentPayload(sanitizedUpdates, true);

  if (sanitizedUpdates.name !== undefined) {
    sanitizedUpdates.name = sanitizedUpdates.name.trim();
  }
  if (sanitizedUpdates.description !== undefined) {
    sanitizedUpdates.description = sanitizedUpdates.description.trim();
  }
  if (sanitizedUpdates.clockLimit !== undefined) {
    sanitizedUpdates.clockLimit = Number(sanitizedUpdates.clockLimit);
  }
  if (sanitizedUpdates.increment !== undefined) {
    sanitizedUpdates.increment = Number(sanitizedUpdates.increment);
  }
  if (sanitizedUpdates.maxPlayers !== undefined) {
    sanitizedUpdates.maxPlayers = sanitizedUpdates.maxPlayers
      ? Number(sanitizedUpdates.maxPlayers)
      : null;
  }
  if (sanitizedUpdates.startTime !== undefined) {
    sanitizedUpdates.startTime = sanitizedUpdates.startTime
      ? new Date(sanitizedUpdates.startTime)
      : null;
  }
  if (sanitizedUpdates.totalRounds !== undefined) {
    sanitizedUpdates.totalRounds = sanitizedUpdates.totalRounds
      ? Number(sanitizedUpdates.totalRounds)
      : null;
  }

  const updatedTournament = await Tournament.findByIdAndUpdate(
    id,
    { $set: sanitizedUpdates },
    { new: true, runValidators: true }
  ).populate('createdBy', 'name email avatar lichessUsername');

  return updatedTournament;
};

/**
 * Deletes a tournament if in DRAFT or REGISTRATION status.
 */
export const deleteTournament = async (id, currentUserId = null) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(id);
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Verify ownership if currentUserId is provided
  if (currentUserId && tournament.createdBy.toString() !== currentUserId.toString()) {
    const error = new Error('You are not authorized to delete this tournament');
    error.statusCode = 403;
    throw error;
  }

  // Safety check: only allow deletion of DRAFT or REGISTRATION tournaments
  if (tournament.status !== 'DRAFT' && tournament.status !== 'REGISTRATION') {
    const error = new Error(
      `Cannot delete tournament with status '${tournament.status}'. Only DRAFT or REGISTRATION tournaments can be deleted.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Cascade delete associated tournament players, rounds, and pairings
  await TournamentPlayer.deleteMany({ tournamentId: id });
  await Round.deleteMany({ tournamentId: id });
  await Pairing.deleteMany({ tournamentId: id });

  await Tournament.findByIdAndDelete(id);

  return { message: 'Tournament deleted successfully' };
};

/**
 * Initiates the ready check phase for a tournament.
 * 
 * @param {string} tournamentId
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Tournament>}
 */
export const startReadyCheck = async (tournamentId, userId) => {
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

  if (tournament.createdBy.toString() !== userId.toString()) {
    const error = new Error('Only the tournament host can start the ready check.');
    error.statusCode = 403;
    throw error;
  }

  if (tournament.status !== 'REGISTRATION' && tournament.status !== 'DRAFT') {
    const error = new Error(`Cannot start ready check for tournament with status '${tournament.status}'.`);
    error.statusCode = 400;
    throw error;
  }

  tournament.status = 'READY_CHECK';
  await tournament.save();

  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      io.to(`tournament:${tournamentId}`).emit('READY_CHECK_STARTED', {
        tournamentId: tournament._id.toString(),
        status: 'READY_CHECK',
      });
    }
  } catch (err) {
    // Non-fatal realtime warning
  }

  return tournament;
};

/**
 * Starts the server-authoritative tournament countdown.
 * Validates player readiness and prevents duplicate countdowns.
 * 
 * @param {string} tournamentId
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Object} [options]
 * @returns {Promise<Tournament>}
 */
export const startCountdown = async (tournamentId, userId, options = {}) => {
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

  // Verify host authorization
  if (tournament.createdBy.toString() !== userId.toString()) {
    const error = new Error('Only the tournament host can start the countdown.');
    error.statusCode = 403;
    throw error;
  }

  // If already in COUNTDOWN, reject duplicate countdown creation
  if (tournament.status === 'COUNTDOWN') {
    const error = new Error('Tournament countdown is already in progress.');
    error.statusCode = 400;
    throw error;
  }

  // Check tournament status
  if (['RUNNING', 'IN_PROGRESS', 'FINISHED', 'COMPLETED'].includes(tournament.status)) {
    const error = new Error('Tournament has already started.');
    error.statusCode = 400;
    throw error;
  }

  if (!['REGISTRATION', 'READY_CHECK', 'DRAFT'].includes(tournament.status)) {
    const error = new Error(`Cannot start countdown from status '${tournament.status}'.`);
    error.statusCode = 400;
    throw error;
  }

  // Validate player readiness
  const totalPlayers = await TournamentPlayer.countDocuments({ tournamentId });
  if (totalPlayers < 2) {
    const error = new Error('At least 2 players are required to start the tournament.');
    error.statusCode = 400;
    throw error;
  }

  const readyCount = await TournamentPlayer.countDocuments({ tournamentId, isReady: true });
  if (readyCount < totalPlayers) {
    const error = new Error(
      `${readyCount} of ${totalPlayers} players are ready. All players must be ready before starting countdown.`
    );
    error.statusCode = 400;
    throw error;
  }

  const countdownSeconds = Number(options.countdownSeconds) > 0 ? Number(options.countdownSeconds) : 60;
  const countdownStartedAt = new Date();
  const scheduledStartAt = new Date(Date.now() + countdownSeconds * 1000);

  // Atomic update to guard against concurrent startCountdown calls
  const updatedTournament = await Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      status: { $in: ['REGISTRATION', 'READY_CHECK', 'DRAFT'] },
    },
    {
      $set: {
        status: 'COUNTDOWN',
        countdownSeconds,
        countdownStartedAt,
        scheduledStartAt,
      },
    },
    { new: true }
  ).populate('createdBy', 'name email avatar lichessUsername');

  if (!updatedTournament) {
    const error = new Error('Tournament countdown is already in progress or status changed.');
    error.statusCode = 400;
    throw error;
  }

  const finalTournament = updatedTournament;

  // Broadcast realtime event
  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      io.to(`tournament:${tournamentId}`).emit('COUNTDOWN_STARTED', {
        tournamentId: tournamentId.toString(),
        countdownStartedAt: finalTournament.countdownStartedAt,
        scheduledStartAt: finalTournament.scheduledStartAt,
        countdownSeconds: finalTournament.countdownSeconds,
      });
    }
  } catch (err) {
    // Non-fatal realtime warning
  }

  const resObj = finalTournament.toObject();
  resObj.registeredPlayers = totalPlayers;
  resObj.readyPlayers = readyCount;
  return resObj;
};

/**
 * Cancels an active countdown and returns the tournament to REGISTRATION.
 * 
 * @param {string} tournamentId
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Tournament>}
 */
export const cancelCountdown = async (tournamentId, userId) => {
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

  if (tournament.createdBy.toString() !== userId.toString()) {
    const error = new Error('Only the tournament host can cancel the countdown.');
    error.statusCode = 403;
    throw error;
  }

  if (tournament.status !== 'COUNTDOWN') {
    return tournament;
  }

  tournament.status = 'REGISTRATION';
  tournament.countdownStartedAt = null;
  tournament.scheduledStartAt = null;
  await tournament.save();

  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      io.to(`tournament:${tournamentId}`).emit('COUNTDOWN_CANCELLED', {
        tournamentId: tournamentId.toString(),
        status: 'REGISTRATION',
      });
    }
  } catch (err) {
    // Non-fatal realtime warning
  }

  return tournament;
};

/**
 * Starts the tournament, transitioning to RUNNING/IN_PROGRESS and generating Round 1 pairings.
 * Idempotent: repeated calls safely return the running tournament.
 * 
 * @param {string} tournamentId
 * @param {string|mongoose.Types.ObjectId} [userId]
 * @returns {Promise<Tournament>}
 */
export const startTournament = async (tournamentId, userId = null) => {
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

  if (userId && tournament.createdBy.toString() !== userId.toString()) {
    const error = new Error('Only the tournament host can start the tournament.');
    error.statusCode = 403;
    throw error;
  }

  // Idempotency: if already running, return
  if (tournament.status === 'RUNNING' || tournament.status === 'IN_PROGRESS') {
    return tournament;
  }

  const totalPlayers = await TournamentPlayer.countDocuments({ tournamentId });
  if (totalPlayers < 2) {
    const error = new Error('At least 2 players are required to start the tournament.');
    error.statusCode = 400;
    throw error;
  }

  tournament.status = 'RUNNING';
  tournament.startTime = tournament.startTime || new Date();
  tournament.countdownStartedAt = null;
  tournament.scheduledStartAt = null;
  await tournament.save();

  // Automatically create Round 1 pairings if none exist yet
  const existingRound1 = await Round.findOne({ tournamentId, roundNumber: 1 });
  if (!existingRound1) {
    try {
      const roundService = await import('./roundService.js');
      await roundService.createRound(tournamentId, null);
    } catch (roundErr) {
      console.warn(`[TournamentService] Notice on initial round creation: ${roundErr.message}`);
    }
  }

  // Broadcast tournament start
  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      io.to(`tournament:${tournamentId}`).emit('TOURNAMENT_STARTED', {
        tournamentId: tournamentId.toString(),
        status: 'RUNNING',
        roundNumber: 1,
      });
    }
  } catch (err) {
    // Non-fatal realtime warning
  }

  return tournament;
};

export default {
  createTournament,
  getTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
  startReadyCheck,
  startCountdown,
  cancelCountdown,
  startTournament,
};
