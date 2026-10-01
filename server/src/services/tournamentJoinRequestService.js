import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import TournamentJoinRequest from '../models/TournamentJoinRequest.js';

/**
 * Creates a join request for a player.
 *
 * @param {string} tournamentId
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<TournamentJoinRequest>}
 */
export const createJoinRequest = async (tournamentId, userId) => {
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

  // Only allow requesting when tournament status is REGISTRATION
  if (tournament.status !== 'REGISTRATION') {
    const error = new Error(
      `Cannot request to join tournament with status '${tournament.status}'. Registration is closed.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Check if user is already an approved participant
  const existingPlayer = await TournamentPlayer.findOne({ tournamentId, userId });
  if (existingPlayer) {
    const error = new Error('You are already registered for this tournament');
    error.statusCode = 400;
    throw error;
  }

  // Check tournament capacity against actual approved participants
  if (tournament.maxPlayers) {
    const currentCount = await TournamentPlayer.countDocuments({ tournamentId });
    if (currentCount >= tournament.maxPlayers) {
      const error = new Error('Tournament is full. Maximum participant capacity reached.');
      error.statusCode = 400;
      throw error;
    }
  }

  // Check if a request already exists for this user
  const existingRequest = await TournamentJoinRequest.findOne({
    tournament: tournamentId,
    user: userId,
  });

  if (existingRequest) {
    if (existingRequest.status === 'PENDING') {
      const error = new Error('You already have a pending join request for this tournament');
      error.statusCode = 400;
      throw error;
    }
    if (existingRequest.status === 'APPROVED') {
      const error = new Error('You have already been approved for this tournament');
      error.statusCode = 400;
      throw error;
    }
    if (existingRequest.status === 'REJECTED') {
      const error = new Error('Your join request for this tournament was rejected');
      error.statusCode = 400;
      throw error;
    }
  }

  try {
    const request = await TournamentJoinRequest.create({
      tournament: tournamentId,
      user: userId,
      status: 'PENDING',
      requestedAt: new Date(),
    });

    const populatedRequest = await request.populate('user', 'name email avatar lichessUsername');

    // Emit realtime notification to tournament room
    try {
      const { getIo } = await import('../realtime/socket.js');
      const io = getIo();
      if (io) {
        io.to(`tournament:${tournamentId}`).emit('JOIN_REQUEST_CREATED', {
          tournamentId,
          requestId: request._id,
          user: populatedRequest.user,
          status: 'PENDING',
        });
      }
    } catch (_) {
      // Non-blocking socket emission
    }

    return populatedRequest;
  } catch (err) {
    if (err.code === 11000) {
      const error = new Error('You already have a pending join request for this tournament');
      error.statusCode = 400;
      throw error;
    }
    throw err;
  }
};

/**
 * Retrieves all join requests for a tournament (host only).
 *
 * @param {string} tournamentId
 * @param {mongoose.Types.ObjectId|string} hostUserId
 * @param {string} [filterStatus] - Optional status filter: 'PENDING', 'APPROVED', 'REJECTED'
 * @returns {Promise<Array<TournamentJoinRequest>>}
 */
export const getJoinRequests = async (tournamentId, hostUserId, filterStatus = null) => {
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

  // Host authorization check
  if (tournament.createdBy.toString() !== hostUserId.toString()) {
    const error = new Error('Forbidden: Only the tournament host can view join requests.');
    error.statusCode = 403;
    throw error;
  }

  const query = { tournament: tournamentId };
  if (filterStatus) {
    query.status = filterStatus;
  }

  const requests = await TournamentJoinRequest.find(query)
    .sort({ requestedAt: -1 })
    .populate('user', 'name email avatar lichessUsername')
    .populate('reviewedBy', 'name email');

  return requests;
};

/**
 * Approves a pending join request and creates exactly one TournamentPlayer record.
 *
 * @param {string} tournamentId
 * @param {string} requestId
 * @param {mongoose.Types.ObjectId|string} hostUserId
 * @returns {Promise<{ request: TournamentJoinRequest, player: TournamentPlayer }>}
 */
export const approveJoinRequest = async (tournamentId, requestId, hostUserId) => {
  if (!mongoose.isValidObjectId(tournamentId) || !mongoose.isValidObjectId(requestId)) {
    const error = new Error('Invalid tournament or request ID');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Host authorization check
  if (tournament.createdBy.toString() !== hostUserId.toString()) {
    const error = new Error('Forbidden: Only the tournament host can approve join requests.');
    error.statusCode = 403;
    throw error;
  }

  const request = await TournamentJoinRequest.findById(requestId);
  if (!request) {
    const error = new Error('Join request not found');
    error.statusCode = 404;
    throw error;
  }

  // Ensure request belongs to this tournament
  if (request.tournament.toString() !== tournamentId.toString()) {
    const error = new Error('Join request does not belong to this tournament');
    error.statusCode = 400;
    throw error;
  }

  // Status check: must be PENDING
  if (request.status === 'APPROVED') {
    const error = new Error('Join request has already been approved');
    error.statusCode = 400;
    throw error;
  }
  if (request.status === 'REJECTED') {
    const error = new Error('Cannot approve a rejected join request');
    error.statusCode = 400;
    throw error;
  }
  if (request.status !== 'PENDING') {
    const error = new Error('Only pending join requests can be approved');
    error.statusCode = 400;
    throw error;
  }

  // Check if player is already a registered participant
  const existingPlayer = await TournamentPlayer.findOne({
    tournamentId,
    userId: request.user,
  });
  if (existingPlayer) {
    request.status = 'APPROVED';
    request.reviewedAt = new Date();
    request.reviewedBy = hostUserId;
    await request.save();

    const error = new Error('Player is already a participant in this tournament');
    error.statusCode = 400;
    throw error;
  }

  // Re-check tournament capacity
  if (tournament.maxPlayers) {
    const currentCount = await TournamentPlayer.countDocuments({ tournamentId });
    if (currentCount >= tournament.maxPlayers) {
      const error = new Error('Tournament is full. Cannot approve join request.');
      error.statusCode = 400;
      throw error;
    }
  }

  // Create exactly ONE TournamentPlayer record
  const player = await TournamentPlayer.create({
    tournamentId,
    userId: request.user,
    score: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gamesPlayed: 0,
    joinedAt: new Date(),
    isApproved: true,
  });

  // Mark request as APPROVED
  request.status = 'APPROVED';
  request.reviewedAt = new Date();
  request.reviewedBy = hostUserId;
  await request.save();

  const populatedRequest = await request.populate('user', 'name email avatar lichessUsername');
  const populatedPlayer = await player.populate('userId', 'name email avatar lichessUsername');

  // Broadcast realtime events to tournament room
  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      io.to(`tournament:${tournamentId}`).emit('JOIN_REQUEST_APPROVED', {
        tournamentId,
        requestId: request._id,
        userId: request.user._id,
      });
      io.to(`tournament:${tournamentId}`).emit('PLAYER_JOINED', {
        tournamentId,
        player: populatedPlayer,
      });
    }
  } catch (_) {
    // Non-blocking socket emission
  }

  return { request: populatedRequest, player: populatedPlayer };
};

/**
 * Rejects a pending join request. Does NOT create a TournamentPlayer.
 *
 * @param {string} tournamentId
 * @param {string} requestId
 * @param {mongoose.Types.ObjectId|string} hostUserId
 * @returns {Promise<TournamentJoinRequest>}
 */
export const rejectJoinRequest = async (tournamentId, requestId, hostUserId) => {
  if (!mongoose.isValidObjectId(tournamentId) || !mongoose.isValidObjectId(requestId)) {
    const error = new Error('Invalid tournament or request ID');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Host authorization check
  if (tournament.createdBy.toString() !== hostUserId.toString()) {
    const error = new Error('Forbidden: Only the tournament host can reject join requests.');
    error.statusCode = 403;
    throw error;
  }

  const request = await TournamentJoinRequest.findById(requestId);
  if (!request) {
    const error = new Error('Join request not found');
    error.statusCode = 404;
    throw error;
  }

  // Ensure request belongs to this tournament
  if (request.tournament.toString() !== tournamentId.toString()) {
    const error = new Error('Join request does not belong to this tournament');
    error.statusCode = 400;
    throw error;
  }

  // Status check: must be PENDING
  if (request.status === 'REJECTED') {
    const error = new Error('Join request has already been rejected');
    error.statusCode = 400;
    throw error;
  }
  if (request.status === 'APPROVED') {
    const error = new Error('Cannot reject an already approved join request');
    error.statusCode = 400;
    throw error;
  }
  if (request.status !== 'PENDING') {
    const error = new Error('Only pending join requests can be rejected');
    error.statusCode = 400;
    throw error;
  }

  // Mark request as REJECTED
  request.status = 'REJECTED';
  request.reviewedAt = new Date();
  request.reviewedBy = hostUserId;
  await request.save();

  const populatedRequest = await request.populate('user', 'name email avatar lichessUsername');

  // Broadcast realtime event to tournament room
  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      io.to(`tournament:${tournamentId}`).emit('JOIN_REQUEST_REJECTED', {
        tournamentId,
        requestId: request._id,
        userId: request.user._id,
      });
    }
  } catch (_) {
    // Non-blocking socket emission
  }

  return populatedRequest;
};

/**
 * Gets a user's join request status for a tournament.
 *
 * @param {string} tournamentId
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<{ status: string, isParticipant: boolean, request: Object|null }>}
 */
export const getJoinRequestStatus = async (tournamentId, userId) => {
  if (!mongoose.isValidObjectId(tournamentId) || !userId) {
    return { status: 'NOT_REQUESTED', isParticipant: false, request: null };
  }

  // 1. Check if user is already an approved participant
  const player = await TournamentPlayer.findOne({ tournamentId, userId });
  if (player) {
    return { status: 'PARTICIPANT', isParticipant: true, request: null };
  }

  // 2. Check for an existing join request
  const request = await TournamentJoinRequest.findOne({
    tournament: tournamentId,
    user: userId,
  });

  if (request) {
    return {
      status: request.status,
      isParticipant: false,
      request,
    };
  }

  return { status: 'NOT_REQUESTED', isParticipant: false, request: null };
};
