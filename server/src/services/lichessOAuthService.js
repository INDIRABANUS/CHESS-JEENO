import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import {
  LICHESS_OAUTH_CONFIG,
  getOAuthClientId,
  getOAuthRedirectUri,
} from '../config/lichessOAuth.js';
import { getTokenForUser } from '../config/lichess.js';

// In-memory store for short-lived OAuth transactions
// Key: state string
// Value: { userId: string, codeVerifier: string, expiresAt: number }
const oauthTransactions = new Map();

/**
 * Generates a cryptographically secure random code verifier for PKCE (RFC 7636).
 *
 * @param {number} [length=64] - Length of verifier (between 43 and 128 characters)
 * @returns {string}
 */
export const generateCodeVerifier = (length = 64) => {
  const boundedLength = Math.max(43, Math.min(128, length));
  return crypto.randomBytes(boundedLength).toString('base64url').slice(0, boundedLength);
};

/**
 * Generates an S256 code challenge from a code verifier.
 *
 * @param {string} verifier
 * @returns {string} Base64URL-encoded SHA-256 digest
 */
export const generateCodeChallenge = (verifier) => {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
};

/**
 * Generates a cryptographically secure random state parameter for CSRF mitigation.
 *
 * @returns {string}
 */
export const generateState = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Stores a temporary OAuth transaction.
 *
 * @param {Object} params
 * @param {string} params.state
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string} params.codeVerifier
 * @param {number} [params.ttlMs=600000] - Expiration time in ms (default 10 min)
 */
export const saveOAuthTransaction = ({ state, userId, codeVerifier, ttlMs = 600000 }) => {
  oauthTransactions.set(state, {
    userId: userId.toString(),
    codeVerifier,
    expiresAt: Date.now() + ttlMs,
  });
};

/**
 * Consumes an OAuth transaction by state.
 * Enforces single-use consumption and validates expiration.
 *
 * @param {string} state
 * @returns {{ userId: string, codeVerifier: string }|null}
 */
export const consumeOAuthTransaction = (state) => {
  if (!state || typeof state !== 'string') return null;

  const transaction = oauthTransactions.get(state);
  if (!transaction) return null;

  // Single-use: delete immediately to prevent replay attacks
  oauthTransactions.delete(state);

  if (Date.now() > transaction.expiresAt) {
    return null; // Expired
  }

  return {
    userId: transaction.userId,
    codeVerifier: transaction.codeVerifier,
  };
};

/**
 * Checks whether an active unexpired transaction exists for a state.
 *
 * @param {string} state
 * @returns {boolean}
 */
export const hasOAuthTransaction = (state) => {
  const transaction = oauthTransactions.get(state);
  if (!transaction) return false;
  if (Date.now() > transaction.expiresAt) {
    oauthTransactions.delete(state);
    return false;
  }
  return true;
};

/**
 * Clears all stored OAuth transactions (useful for isolated testing).
 */
export const clearAllOAuthTransactions = () => {
  oauthTransactions.clear();
};

/**
 * Creates the Lichess authorization URL with PKCE parameters and records the transaction.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated CHESS JEENO user ID
 * @returns {{ url: string, state: string, codeVerifier: string }}
 */
export const createAuthorizationUrl = (userId) => {
  if (!userId) {
    const error = new Error('Authentication required to initiate Lichess connection');
    error.statusCode = 401;
    throw error;
  }

  const codeVerifier = generateCodeVerifier(64);
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  saveOAuthTransaction({
    state,
    userId,
    codeVerifier,
  });

  const params = new URLSearchParams({
    response_type: LICHESS_OAUTH_CONFIG.responseType,
    client_id: getOAuthClientId(),
    redirect_uri: getOAuthRedirectUri(),
    scope: LICHESS_OAUTH_CONFIG.defaultScopes.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: LICHESS_OAUTH_CONFIG.codeChallengeMethod,
    state,
  });

  const url = `${LICHESS_OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`;

  return {
    url,
    state,
    codeVerifier,
  };
};

/**
 * Exchanges authorization code and PKCE code_verifier for Lichess access token.
 *
 * @param {Object} params
 * @param {string} params.code
 * @param {string} params.codeVerifier
 * @param {string} [params.redirectUri]
 * @returns {Promise<Object>} Token response data
 */
export const exchangeCodeForToken = async ({ code, codeVerifier, redirectUri = getOAuthRedirectUri() }) => {
  if (!code || !codeVerifier) {
    const error = new Error('Authorization code and code_verifier are required for token exchange');
    error.statusCode = 400;
    throw error;
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: getOAuthClientId(),
  });

  let response;
  try {
    response = await fetch(LICHESS_OAUTH_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  } catch (err) {
    const error = new Error(`Network error contacting Lichess token endpoint: ${err.message}`);
    error.statusCode = 502;
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const error = new Error('Invalid JSON response from Lichess token endpoint');
    error.statusCode = 502;
    throw error;
  }

  if (!response.ok || data.error) {
    const errorDescription = data.error_description || data.error || 'Token exchange failed';
    const error = new Error(`Lichess token exchange failed: ${errorDescription}`);
    error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw error;
  }

  if (!data.access_token) {
    const error = new Error('Lichess token response did not contain an access_token');
    error.statusCode = 502;
    throw error;
  }

  return data;
};

/**
 * Fetches authenticated Lichess account details using an access token.
 *
 * @param {string} accessToken
 * @returns {Promise<{ id: string, username: string }>}
 */
export const fetchLichessAccount = async (accessToken) => {
  if (!accessToken) {
    const error = new Error('Access token is required to fetch Lichess account');
    error.statusCode = 400;
    throw error;
  }

  let response;
  try {
    response = await fetch(LICHESS_OAUTH_CONFIG.accountEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (err) {
    const error = new Error(`Network error contacting Lichess account endpoint: ${err.message}`);
    error.statusCode = 502;
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const error = new Error('Invalid JSON response from Lichess account endpoint');
    error.statusCode = 502;
    throw error;
  }

  if (!response.ok || !data.id || !data.username) {
    const error = new Error('Failed to retrieve Lichess account profile with the provided access token');
    error.statusCode = response.status === 401 ? 401 : 502;
    throw error;
  }

  return {
    id: data.id.toLowerCase(),
    username: data.username,
    title: data.title || null,
  };
};

/**
 * Stores the verified Lichess connection in the User document.
 * Prevents multiple CHESS JEENO accounts from claiming the same Lichess account.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Object} connectionDetails
 * @param {Object} connectionDetails.account - { id, username }
 * @param {Object} connectionDetails.tokenData - { access_token, refresh_token, expires_in, token_type, scope }
 * @returns {Promise<User>}
 */
export const storeLichessConnection = async (userId, { account, tokenData }) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (!account || !account.id || !account.username) {
    const error = new Error('Valid Lichess account details required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedLichessId = account.id.toLowerCase().trim();

  // Prevent duplicate connections: verify this Lichess account is not already claimed by another user
  const duplicate = await User.findOne({
    lichessUserId: normalizedLichessId,
    _id: { $ne: userId },
  });

  if (duplicate) {
    const error = new Error(
      `The Lichess account "${account.username}" is already connected to another CHESS JEENO account.`
    );
    error.statusCode = 409;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;

  user.lichessUsername = account.username;
  user.lichessUserId = normalizedLichessId;
  user.lichessOAuth = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresAt,
    tokenType: tokenData.token_type || 'Bearer',
    scope: tokenData.scope || LICHESS_OAUTH_CONFIG.defaultScopes.join(' '),
    connectedAt: new Date(),
  };

  await user.save();
  return user;
};

/**
 * Removes the stored Lichess OAuth credentials and username association from the user profile.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const disconnectLichess = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (!user.lichessUserId && !user.lichessUsername) {
    const error = new Error('No Lichess account is currently connected to this profile.');
    error.statusCode = 400;
    throw error;
  }

  user.lichessUsername = null;
  user.lichessUserId = null;
  user.lichessOAuth = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    tokenType: null,
    scope: null,
    connectedAt: null,
  };

  await user.save();

  return {
    success: true,
    message: 'Lichess account disconnected successfully',
  };
};

/**
 * Retrieves safe connection status for a user.
 * Never returns access tokens, refresh tokens, or PKCE verifiers.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{ connected: boolean, username: string|null, lichessUserId: string|null, connectedAt: Date|null }>}
 */
export const getConnectionStatus = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const isConnected = Boolean(user.lichessUserId && user.lichessUsername);

  return {
    connected: isConnected,
    username: user.lichessUsername || null,
    lichessUserId: user.lichessUserId || null,
    connectedAt: user.lichessOAuth?.connectedAt || null,
  };
};

/**
 * Resolves Lichess credentials for a player to be used exclusively in backend game creation.
 * Explicitly queries normally hidden OAuth access tokens with select('+lichessOAuth.accessToken').
 * Never returns tokens to the frontend or logs them.
 *
 * @param {string|mongoose.Types.ObjectId} userId - CHESS JEENO User ID
 * @param {Object} [options]
 * @param {boolean} [options.allowDevBridge=false] - Whether to allow development-token bridge fallback
 * @returns {Promise<{ userId: string, lichessUsername: string, lichessUserId: string, accessToken: string, source: 'oauth'|'dev_bridge' }>}
 */
export const resolveLichessPlayerCredentials = async (userId, options = {}) => {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // 1. Explicitly select the normally-hidden OAuth credential fields
  const user = await User.findById(userId).select('+lichessOAuth.accessToken');
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // 2. Verify user has a linked Lichess account
  if (!user.lichessUsername && !user.lichessUserId) {
    const error = new Error('Player has not connected a Lichess account.');
    error.statusCode = 400;
    throw error;
  }

  let accessToken = user.lichessOAuth?.accessToken || null;
  let source = 'oauth';

  const isProduction = process.env.NODE_ENV === 'production';

  // 3. Fallback to development-token bridge ONLY if explicitly enabled AND NOT in production
  if (!accessToken && options.allowDevBridge && !isProduction) {
    const devToken = getTokenForUser(user.lichessUsername);
    if (devToken) {
      accessToken = devToken;
      source = 'dev_bridge';
    }
  }

  // 4. Verify access token is present
  if (!accessToken) {
    const error = new Error(
      user.lichessUsername
        ? `Player has not connected a valid Lichess account via OAuth (@${user.lichessUsername}). Lichess connection is incomplete.`
        : 'Player has not connected a Lichess account.'
    );
    error.statusCode = 400;
    throw error;
  }

  // 5. Verify Lichess username exists
  if (!user.lichessUsername) {
    const error = new Error('Lichess connection is incomplete.');
    error.statusCode = 400;
    throw error;
  }

  return {
    userId: user._id.toString(),
    lichessUsername: user.lichessUsername,
    lichessUserId: user.lichessUserId || user.lichessUsername.toLowerCase(),
    accessToken,
    source,
  };
};

export default {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  saveOAuthTransaction,
  consumeOAuthTransaction,
  hasOAuthTransaction,
  clearAllOAuthTransactions,
  createAuthorizationUrl,
  exchangeCodeForToken,
  fetchLichessAccount,
  storeLichessConnection,
  disconnectLichess,
  getConnectionStatus,
  resolveLichessPlayerCredentials,
};
