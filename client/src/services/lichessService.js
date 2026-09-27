import api from './api';

/**
 * Fetch current user's Lichess connection status.
 *
 * @returns {Promise<{ connected: boolean, username: string|null, lichessUserId: string|null, connectedAt: string|null }>}
 */
export const getStatus = async () => {
  const response = await api.get('/lichess/status');
  return response.data?.data;
};

/**
 * Initiate Lichess OAuth 2.0 PKCE flow.
 * Requests authorization URL from backend and redirects the browser to Lichess.
 */
export const connect = async () => {
  const response = await api.get('/lichess/connect?json=true');
  const authUrl = response.data?.data?.url;
  if (!authUrl) {
    throw new Error('Failed to retrieve Lichess authorization URL');
  }
  // Redirect browser to official Lichess authorization page
  window.location.href = authUrl;
};

/**
 * Disconnect Lichess account from the authenticated user.
 *
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const disconnect = async () => {
  const response = await api.post('/lichess/disconnect');
  return response.data;
};

export default {
  getStatus,
  connect,
  disconnect,
};
