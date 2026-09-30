import { io } from 'socket.io-client';

let socket = null;
let currentTournamentId = null;

const getServerUrl = () => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL.replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    // Strip trailing /api and any slashes, e.g. "https://api.example.com/api/" -> "https://api.example.com"
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  return 'http://localhost:5000';
};


/**
 * Connects the Socket.IO client using the CHESS JEENO JWT.
 * Strict rules:
 * - Handshake auth ONLY ({ auth: { token } })
 * - NEVER uses query parameters ?token=
 * - Single socket instance reused across the app
 * 
 * @param {string} [explicitToken]
 * @returns {import('socket.io-client').Socket|null}
 */
export const connectSocket = (explicitToken = null) => {
  const token = explicitToken || localStorage.getItem('token');
  if (!token) {
    return null;
  }

  // If already connected with the same token, reuse
  if (socket && socket.connected) {
    return socket;
  }

  // Clean up any stale or disconnected instance
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(getServerUrl(), {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    // Re-join tournament room if one was active prior to reconnect
    if (currentTournamentId) {
      socket.emit('joinTournament', { tournamentId: currentTournamentId });
    }
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
  });

  return socket;
};

/**
 * Returns the current socket instance.
 */
export const getSocket = () => socket;

/**
 * Disconnects the socket completely.
 */
export const disconnectSocket = () => {
  if (socket) {
    if (currentTournamentId) {
      socket.emit('leaveTournament', { tournamentId: currentTournamentId });
    }
    socket.disconnect();
    socket = null;
    currentTournamentId = null;
  }
};

/**
 * Joins a tournament room and listens for authoritative normalized events.
 * 
 * @param {string} tournamentId
 * @param {Object} [handlers]
 * @param {Function} [handlers.onGameStarted]
 * @param {Function} [handlers.onGameState]
 * @param {Function} [handlers.onGameFinished]
 * @param {Function} [handlers.onGameAborted]
 * @param {Function} [handlers.onStandingsUpdated]
 * @param {Function} [handlers.onRoundCompleted]
 */
export const joinTournamentRoom = (tournamentId, handlers = {}) => {
  if (!tournamentId) return;
  currentTournamentId = tournamentId;

  if (!socket || !socket.connected) {
    connectSocket();
  }

  if (socket) {
    // Emit join request with ack
    socket.emit('joinTournament', { tournamentId }, (res) => {
      if (res && !res.success) {
        console.warn(`[Socket.IO] Join room failed for ${tournamentId}:`, res.error);
      }
    });

    // Remove old listeners to prevent duplicate listener accumulation
    socket.off('GAME_STARTED');
    socket.off('GAME_STATE');
    socket.off('GAME_FINISHED');
    socket.off('GAME_ABORTED');
    socket.off('GAME_REMATCHED');
    socket.off('STANDINGS_UPDATED');
    socket.off('ROUND_COMPLETED');
    socket.off('PLAYER_READY_CHANGED');
    socket.off('READY_CHECK_STARTED');
    socket.off('COUNTDOWN_STARTED');
    socket.off('COUNTDOWN_CANCELLED');
    socket.off('TOURNAMENT_STARTED');
    socket.off('TOURNAMENT_COMPLETED');

    if (handlers.onGameStarted) socket.on('GAME_STARTED', handlers.onGameStarted);
    if (handlers.onGameState) socket.on('GAME_STATE', handlers.onGameState);
    if (handlers.onGameFinished) socket.on('GAME_FINISHED', handlers.onGameFinished);
    if (handlers.onGameAborted) socket.on('GAME_ABORTED', handlers.onGameAborted);
    if (handlers.onGameRematched) socket.on('GAME_REMATCHED', handlers.onGameRematched);
    if (handlers.onStandingsUpdated) socket.on('STANDINGS_UPDATED', handlers.onStandingsUpdated);
    if (handlers.onRoundCompleted) socket.on('ROUND_COMPLETED', handlers.onRoundCompleted);
    if (handlers.onPlayerReadyChanged) socket.on('PLAYER_READY_CHANGED', handlers.onPlayerReadyChanged);
    if (handlers.onReadyCheckStarted) socket.on('READY_CHECK_STARTED', handlers.onReadyCheckStarted);
    if (handlers.onCountdownStarted) socket.on('COUNTDOWN_STARTED', handlers.onCountdownStarted);
    if (handlers.onCountdownCancelled) socket.on('COUNTDOWN_CANCELLED', handlers.onCountdownCancelled);
    if (handlers.onTournamentStarted) socket.on('TOURNAMENT_STARTED', handlers.onTournamentStarted);
    if (handlers.onTournamentCompleted) socket.on('TOURNAMENT_COMPLETED', handlers.onTournamentCompleted);
  }
};

/**
 * Leaves a tournament room and unsubscribes from events.
 * 
 * @param {string} tournamentId
 */
export const leaveTournamentRoom = (tournamentId) => {
  if (socket && tournamentId) {
    socket.emit('leaveTournament', { tournamentId });
    socket.off('GAME_STARTED');
    socket.off('GAME_STATE');
    socket.off('GAME_FINISHED');
    socket.off('GAME_ABORTED');
    socket.off('GAME_REMATCHED');
    socket.off('STANDINGS_UPDATED');
    socket.off('ROUND_COMPLETED');
    socket.off('PLAYER_READY_CHANGED');
    socket.off('READY_CHECK_STARTED');
    socket.off('COUNTDOWN_STARTED');
    socket.off('COUNTDOWN_CANCELLED');
    socket.off('TOURNAMENT_STARTED');
    socket.off('TOURNAMENT_COMPLETED');
  }
  if (currentTournamentId === tournamentId) {
    currentTournamentId = null;
  }
};

export default {
  connectSocket,
  getSocket,
  disconnectSocket,
  joinTournamentRoom,
  leaveTournamentRoom,
};
