import api from './api';

/**
 * Fetch tournaments with optional filters, view, and sorting.
 * @param {Object} [filters]
 * @param {string} [filters.status]
 * @param {string} [filters.format]
 * @param {string} [filters.view] - 'all' | 'my'
 * @param {string} [filters.sort] - 'relevance' | 'startingSoon' | 'newest' | 'recentlyCompleted'
 */
export const getTournaments = async (filters = {}) => {
  const response = await api.get('/tournaments', { params: filters });
  return response.data;
};

/**
 * Fetch a single tournament by ID.
 * @param {string} id
 */
export const getTournamentById = async (id) => {
  const response = await api.get(`/tournaments/${id}`);
  return response.data;
};

/**
 * Create a new tournament.
 * @param {Object} tournamentData
 */
export const createTournament = async (tournamentData) => {
  const response = await api.post('/tournaments', tournamentData);
  return response.data;
};

/**
 * Update an existing tournament.
 * @param {string} id
 * @param {Object} updateData
 */
export const updateTournament = async (id, updateData) => {
  const response = await api.patch(`/tournaments/${id}`, updateData);
  return response.data;
};

/**
 * Delete a tournament (allowed only for DRAFT or REGISTRATION status).
 * @param {string} id
 */
export const deleteTournament = async (id) => {
  const response = await api.delete(`/tournaments/${id}`);
  return response.data;
};

/**
 * Fetch registered players for a tournament.
 * @param {string} tournamentId
 */
export const getTournamentPlayers = async (tournamentId) => {
  const response = await api.get(`/tournaments/${tournamentId}/players`);
  return response.data;
};

/**
 * Submit a join request for a tournament.
 * @param {string} tournamentId
 */
export const requestJoinTournament = async (tournamentId) => {
  const response = await api.post(`/tournaments/${tournamentId}/join-requests`);
  return response.data;
};

/**
 * Register current user for a tournament (kept for backward compatibility; creates request in V2).
 * @param {string} tournamentId
 */
export const joinTournament = async (tournamentId) => {
  const response = await api.post(`/tournaments/${tournamentId}/join-requests`);
  return response.data;
};

/**
 * Fetch join requests for a tournament (host only).
 * @param {string} tournamentId
 * @param {string} [status] - Optional filter: PENDING, APPROVED, REJECTED
 */
export const getTournamentJoinRequests = async (tournamentId, status = null) => {
  const params = status ? { status } : {};
  const response = await api.get(`/tournaments/${tournamentId}/join-requests`, { params });
  return response.data;
};

/**
 * Approve a join request (host only).
 * @param {string} tournamentId
 * @param {string} requestId
 */
export const approveJoinRequest = async (tournamentId, requestId) => {
  const response = await api.post(`/tournaments/${tournamentId}/join-requests/${requestId}/approve`);
  return response.data;
};

/**
 * Reject a join request (host only).
 * @param {string} tournamentId
 * @param {string} requestId
 */
export const rejectJoinRequest = async (tournamentId, requestId) => {
  const response = await api.post(`/tournaments/${tournamentId}/join-requests/${requestId}/reject`);
  return response.data;
};

/**
 * Check current user's join request status.
 * @param {string} tournamentId
 */
export const getMyJoinRequestStatus = async (tournamentId) => {
  const response = await api.get(`/tournaments/${tournamentId}/join-requests/my-status`);
  return response.data;
};

/**
 * Withdraw current user from a tournament.
 * @param {string} tournamentId
 */
export const leaveTournament = async (tournamentId) => {
  const response = await api.post(`/tournaments/${tournamentId}/leave`);
  return response.data;
};

/**
 * Fetch current development user identity.
 */
export const getCurrentDevUser = async () => {
  const response = await api.get('/dev-user');
  return response.data;
};

/**
 * Create the next round and Round Robin pairings.
 * @param {string} tournamentId
 */
export const createRound = async (tournamentId) => {
  const response = await api.post(`/tournaments/${tournamentId}/rounds`);
  return response.data;
};

/**
 * Fetch all rounds and pairings for a tournament.
 * @param {string} tournamentId
 */
export const getTournamentRounds = async (tournamentId) => {
  const response = await api.get(`/tournaments/${tournamentId}/rounds`);
  return response.data;
};

/**
 * Fetch a single round by round number.
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 */
export const getTournamentRound = async (tournamentId, roundNumber) => {
  const response = await api.get(`/tournaments/${tournamentId}/rounds/${roundNumber}`);
  return response.data;
};

/**
 * Create a Lichess game for a single pairing.
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 * @param {string} pairingId
 */
export const createPairingLichessGame = async (tournamentId, roundNumber, pairingId) => {
  const response = await api.post(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/pairings/${pairingId}/lichess`
  );
  return response.data;
};

/**
 * Create Lichess games for all eligible pairings in a round.
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 */
export const createAllRoundLichessGames = async (tournamentId, roundNumber) => {
  const response = await api.post(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/lichess`
  );
  return response.data;
};

/**
 * Sync the status and result of a Lichess game back to MongoDB Pairing.
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 * @param {string} pairingId
 */
export const syncPairingResult = async (tournamentId, roundNumber, pairingId) => {
  const response = await api.post(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/pairings/${pairingId}/sync`
  );
  return response.data;
};

/**
 * Fetch tournament standings.
 * @param {string} tournamentId
 */
export const getTournamentStandings = async (tournamentId) => {
  const response = await api.get(`/tournaments/${tournamentId}/standings`);
  return response.data;
};

/**
 * Fetch round completion status.
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 */
export const getRoundStatus = async (tournamentId, roundNumber) => {
  const response = await api.get(`/tournaments/${tournamentId}/rounds/${roundNumber}/status`);
  return response.data;
};

/**
 * Mark current player READY.
 * @param {string} tournamentId
 */
export const setPlayerReady = async (tournamentId) => {
  const response = await api.post(`/tournaments/${tournamentId}/ready`);
  return response.data;
};

/**
 * Mark current player NOT READY.
 * @param {string} tournamentId
 */
export const setPlayerNotReady = async (tournamentId) => {
  const response = await api.post(`/tournaments/${tournamentId}/not-ready`);
  return response.data;
};

/**
 * Fetch tournament readiness stats.
 * @param {string} tournamentId
 */
export const getTournamentReadiness = async (tournamentId) => {
  const response = await api.get(`/tournaments/${tournamentId}/readiness`);
  return response.data;
};

/**
 * Start ready check phase (host only).
 * @param {string} tournamentId
 */
export const startReadyCheck = async (tournamentId) => {
  const response = await api.post(`/tournaments/${tournamentId}/ready-check`);
  return response.data;
};

/**
 * Start tournament countdown (host only).
 * @param {string} tournamentId
 * @param {Object} [data]
 */
export const startCountdown = async (tournamentId, data = {}) => {
  const response = await api.post(`/tournaments/${tournamentId}/countdown/start`, data);
  return response.data;
};

/**
 * Cancel active countdown (host only).
 * @param {string} tournamentId
 */
export const cancelCountdown = async (tournamentId) => {
  const response = await api.post(`/tournaments/${tournamentId}/countdown/cancel`);
  return response.data;
};

/**
 * Start tournament / Round 1.
 * @param {string} tournamentId
 */
export const startTournament = async (tournamentId) => {
  const response = await api.post(`/tournaments/${tournamentId}/start`);
  return response.data;
};

/**
 * Rematch an aborted pairing.
 * @param {string} tournamentId
 * @param {number|string} roundNumber
 * @param {string} pairingId
 */
export const rematchPairing = async (tournamentId, roundNumber, pairingId) => {
  const response = await api.post(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/pairings/${pairingId}/rematch`
  );
  return response.data;
};

export default {
  getTournaments,
  getTournamentById,
  createTournament,
  updateTournament,
  deleteTournament,
  getTournamentPlayers,
  requestJoinTournament,
  getTournamentJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  getMyJoinRequestStatus,
  joinTournament,
  leaveTournament,
  getCurrentDevUser,
  createRound,
  getTournamentRounds,
  getTournamentRound,
  createPairingLichessGame,
  createAllRoundLichessGames,
  syncPairingResult,
  getTournamentStandings,
  getRoundStatus,
  setPlayerReady,
  setPlayerNotReady,
  getTournamentReadiness,
  startReadyCheck,
  startCountdown,
  cancelCountdown,
  startTournament,
  rematchPairing,
};
