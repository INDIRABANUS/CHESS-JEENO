import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';

/**
 * Register a user for a tournament.
 * 
 * @param {string} tournamentId
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<TournamentPlayer>}
 */
export const joinTournament = async (tournamentId, userId) => {
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

  // Only allow joining when status is REGISTRATION
  if (tournament.status !== 'REGISTRATION') {
    const error = new Error(
      `Cannot join tournament with status '${tournament.status}'. Registration is closed.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Check if user is already registered
  const existingPlayer = await TournamentPlayer.findOne({ tournamentId, userId });
  if (existingPlayer) {
    const error = new Error('You are already registered for this tournament');
    error.statusCode = 400;
    throw error;
  }

  // Check tournament capacity
  if (tournament.maxPlayers) {
    const currentCount = await TournamentPlayer.countDocuments({ tournamentId });
    if (currentCount >= tournament.maxPlayers) {
      const error = new Error('Tournament is full. Maximum participant capacity reached.');
      error.statusCode = 400;
      throw error;
    }
  }

  try {
    const newPlayer = await TournamentPlayer.create({
      tournamentId,
      userId,
      score: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gamesPlayed: 0,
      joinedAt: new Date(),
    });

    return await newPlayer.populate('userId', 'name email avatar lichessUsername');
  } catch (err) {
    // Catch compound unique index conflict (in case of concurrent double click)
    if (err.code === 11000) {
      const error = new Error('You are already registered for this tournament');
      error.statusCode = 400;
      throw error;
    }
    throw err;
  }
};

/**
 * Remove a user from a tournament.
 * 
 * @param {string} tournamentId
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<{ message: string }>}
 */
export const leaveTournament = async (tournamentId, userId) => {
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

  // Only allow leaving during REGISTRATION
  if (tournament.status !== 'REGISTRATION') {
    const error = new Error(
      `Cannot leave tournament with status '${tournament.status}'. Players cannot leave once registration is closed or the tournament is active.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Check if user is registered
  const player = await TournamentPlayer.findOne({ tournamentId, userId });
  if (!player) {
    const error = new Error('You are not registered for this tournament');
    error.statusCode = 400;
    throw error;
  }

  await TournamentPlayer.findByIdAndDelete(player._id);

  return { message: 'Successfully left the tournament' };
};

/**
 * Retrieve all registered players for a tournament.
 * 
 * @param {string} tournamentId
 * @returns {Promise<Array<TournamentPlayer>>}
 */
export const getTournamentPlayers = async (tournamentId) => {
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

  const players = await TournamentPlayer.find({ tournamentId })
    .sort({ joinedAt: 1 })
    .populate('userId', 'name email avatar lichessUsername');

  return players;
};

/**
 * Mark a player's readiness state (READY or NOT READY).
 * Server-authoritative, idempotent, and restricted to the registered player.
 * 
 * @param {string} tournamentId
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {boolean} isReady
 * @returns {Promise<Object>}
 */
export const setPlayerReady = async (tournamentId, userId, isReady = true) => {
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

  // Pre-start state check: only allow toggling ready during REGISTRATION or READY_CHECK
  if (tournament.status !== 'REGISTRATION' && tournament.status !== 'READY_CHECK') {
    const error = new Error(
      `Cannot change ready status when tournament status is '${tournament.status}'.`
    );
    error.statusCode = 400;
    throw error;
  }

  const player = await TournamentPlayer.findOne({ tournamentId, userId });
  if (!player) {
    const error = new Error('You are not registered for this tournament.');
    error.statusCode = 400;
    throw error;
  }

  const targetReady = Boolean(isReady);
  player.isReady = targetReady;
  player.readyAt = targetReady ? (player.readyAt || new Date()) : null;
  await player.save();

  // Compute aggregate readiness
  const totalPlayers = await TournamentPlayer.countDocuments({ tournamentId });
  const readyCount = await TournamentPlayer.countDocuments({ tournamentId, isReady: true });

  // Broadcast realtime event to tournament room
  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      io.to(`tournament:${tournamentId}`).emit('PLAYER_READY_CHANGED', {
        tournamentId: tournamentId.toString(),
        userId: userId.toString(),
        isReady: targetReady,
        readyCount,
        totalPlayers,
      });
    }
  } catch (socketErr) {
    // Non-fatal warning
  }

  return {
    success: true,
    isReady: targetReady,
    readyCount,
    totalPlayers,
  };
};

/**
 * Get tournament readiness statistics.
 * 
 * @param {string} tournamentId
 * @returns {Promise<Object>}
 */
export const getTournamentReadiness = async (tournamentId) => {
  if (!mongoose.isValidObjectId(tournamentId)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const totalPlayers = await TournamentPlayer.countDocuments({ tournamentId });
  const readyCount = await TournamentPlayer.countDocuments({ tournamentId, isReady: true });
  const players = await TournamentPlayer.find({ tournamentId })
    .populate('userId', 'name email avatar lichessUsername');

  return {
    tournamentId: tournamentId.toString(),
    totalPlayers,
    readyCount,
    allReady: totalPlayers >= 2 && readyCount === totalPlayers,
    players: players.map((p) => ({
      userId: p.userId?._id?.toString() || p.userId?.toString(),
      name: p.userId?.name || 'Anonymous',
      isReady: Boolean(p.isReady),
      readyAt: p.readyAt,
    })),
  };
};

export default {
  joinTournament,
  leaveTournament,
  getTournamentPlayers,
  setPlayerReady,
  getTournamentReadiness,
};
