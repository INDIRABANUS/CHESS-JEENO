import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import { ensureTournamentActiveStreams } from './gameStreamManager.js';

/**
 * Handles a client request to join a tournament Socket.IO room.
 * Enforces tournament existence and access authorization.
 * 
 * @param {import('socket.io').Socket} socket
 * @param {Object} data - { tournamentId: string }
 * @param {Function} [callback] - Ack callback to client
 */
export const handleJoinTournament = async (socket, data, callback = () => {}) => {
  try {
    const tournamentId = data?.tournamentId;

    if (!tournamentId || !mongoose.isValidObjectId(tournamentId)) {
      const errRes = { success: false, error: 'Invalid or missing tournament ID' };
      if (typeof callback === 'function') callback(errRes);
      socket.emit('error', errRes);
      return;
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      const errRes = { success: false, error: 'Tournament not found' };
      if (typeof callback === 'function') callback(errRes);
      socket.emit('error', errRes);
      return;
    }

    // Access control:
    // DRAFT tournaments are private to the creator
    if (tournament.status === 'DRAFT' && tournament.createdBy.toString() !== socket.userId) {
      const errRes = { success: false, error: 'Access denied: Tournament is private' };
      if (typeof callback === 'function') callback(errRes);
      socket.emit('error', errRes);
      return;
    }

    const roomName = `tournament:${tournamentId}`;

    // Prevent duplicate subscriptions
    if (socket.rooms && socket.rooms.has(roomName)) {
      const ackRes = { success: true, room: roomName, tournamentId, alreadyJoined: true };
      if (typeof callback === 'function') callback(ackRes);
      return;
    }

    socket.join(roomName);

    const ackRes = { success: true, room: roomName, tournamentId };
    if (typeof callback === 'function') callback(ackRes);
    socket.emit('joinedTournament', ackRes);

    // Auto-stream any active pairings with Lichess games for this tournament
    ensureTournamentActiveStreams(tournamentId).catch((err) => {
      console.warn(`[Realtime] Failed to ensure active streams for tournament ${tournamentId}:`, err.message);
    });
  } catch (err) {
    const errRes = { success: false, error: err.message || 'Failed to join tournament room' };
    if (typeof callback === 'function') callback(errRes);
    socket.emit('error', errRes);
  }
};

/**
 * Handles a client request to leave a tournament Socket.IO room.
 * 
 * @param {import('socket.io').Socket} socket
 * @param {Object} data - { tournamentId: string }
 * @param {Function} [callback] - Ack callback to client
 */
export const handleLeaveTournament = async (socket, data, callback = () => {}) => {
  try {
    const tournamentId = data?.tournamentId;
    if (!tournamentId) {
      const errRes = { success: false, error: 'Invalid or missing tournament ID' };
      if (typeof callback === 'function') callback(errRes);
      return;
    }

    const roomName = `tournament:${tournamentId}`;
    socket.leave(roomName);

    const ackRes = { success: true, room: roomName, tournamentId };
    if (typeof callback === 'function') callback(ackRes);
    socket.emit('leftTournament', ackRes);
  } catch (err) {
    const errRes = { success: false, error: err.message || 'Failed to leave tournament room' };
    if (typeof callback === 'function') callback(errRes);
  }
};

export default {
  handleJoinTournament,
  handleLeaveTournament,
};
