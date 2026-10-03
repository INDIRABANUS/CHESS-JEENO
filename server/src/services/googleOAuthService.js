import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import {
  GOOGLE_OAUTH_CONFIG,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRedirectUri,
  getFrontendClientUrl,
} from '../config/googleOAuth.js';
import { generateToken } from './authService.js';
import { isValidAvatarUrl, sanitizeUserProfile } from './userService.js';

// In-memory store for short-lived OAuth state transactions
// Key: state string
// Value: { createdAt: number, expiresAt: number }
const googleOAuthTransactions = new Map();

// In-memory store for short-lived frontend session handoff exchange tickets
// Key: ticket string
// Value: { user: Object, token: string, expiresAt: number }
const googleExchangeTickets = new Map();

/**
 * Generates a cryptographically secure random state parameter for CSRF mitigation.
 * @returns {string} 64-character hex string
 */
export const generateState = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Stores a temporary Google OAuth state transaction.
 * @param {Object} params
 * @param {string} params.state
 * @param {number} [params.ttlMs=600000] - Expiration time in ms (default 10 min)
 */
export const saveOAuthTransaction = ({ state, ttlMs = 600000 }) => {
  googleOAuthTransactions.set(state, {
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  });
};

/**
 * Consumes an OAuth transaction by state.
 * Enforces single-use consumption and validates expiration.
 * @param {string} state
 * @returns {boolean} true if state was valid and consumed, false otherwise
 */
export const consumeOAuthTransaction = (state) => {
  if (!state || typeof state !== 'string') return false;

  const transaction = googleOAuthTransactions.get(state);
  if (!transaction) return false;

  // Single-use: delete immediately to prevent replay attacks
  googleOAuthTransactions.delete(state);

  if (Date.now() > transaction.expiresAt) {
    return false; // Expired
  }

  return true;
};

/**
 * Checks whether an active unexpired state transaction exists.
 * @param {string} state
 * @returns {boolean}
 */
export const hasOAuthTransaction = (state) => {
  const transaction = googleOAuthTransactions.get(state);
  if (!transaction) return false;
  if (Date.now() > transaction.expiresAt) {
    googleOAuthTransactions.delete(state);
    return false;
  }
  return true;
};

/**
 * Creates a short-lived one-time exchange ticket for secure frontend handoff.
 * Prevents putting sensitive JWTs into URL query parameters.
 * @param {Object} params
 * @param {Object} params.user
 * @param {string} params.token
 * @param {number} [params.ttlMs=60000] - 60 seconds TTL
 * @returns {string} ticket
 */
export const createExchangeTicket = ({ user, token, ttlMs = 60000 }) => {
  const ticket = crypto.randomBytes(32).toString('hex');
  googleExchangeTickets.set(ticket, {
    user,
    token,
    expiresAt: Date.now() + ttlMs,
  });
  return ticket;
};

/**
 * Consumes a one-time exchange ticket for token and user session data.
 * @param {string} ticket
 * @returns {{ user: Object, token: string }|null}
 */
export const consumeExchangeTicket = (ticket) => {
  if (!ticket || typeof ticket !== 'string') return null;

  const session = googleExchangeTickets.get(ticket);
  if (!session) return null;

  // Single-use: delete immediately
  googleExchangeTickets.delete(ticket);

  if (Date.now() > session.expiresAt) {
    return null; // Expired
  }

  return {
    user: session.user,
    token: session.token,
  };
};

/**
 * Clears all stored Google OAuth transactions and tickets (for test isolation).
 */
export const clearAllGoogleTransactions = () => {
  googleOAuthTransactions.clear();
  googleExchangeTickets.clear();
};

/**
 * Generates the Google OAuth 2.0 authorization URL and saves the state.
 * @param {Object} [options]
 * @param {string} [options.redirectUri]
 * @returns {{ url: string, state: string }}
 */
export const createAuthorizationUrl = (options = {}) => {
  const clientId = getGoogleClientId();
  const redirectUri = options.redirectUri || getGoogleRedirectUri();

  const state = generateState();
  saveOAuthTransaction({ state });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: GOOGLE_OAUTH_CONFIG.responseType,
    scope: GOOGLE_OAUTH_CONFIG.defaultScopes.join(' '),
    state,
    access_type: GOOGLE_OAUTH_CONFIG.accessType,
    prompt: GOOGLE_OAUTH_CONFIG.prompt,
  });

  const url = `${GOOGLE_OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`;

  return {
    url,
    state,
  };
};

/**
 * Exchanges authorization code for Google tokens.
 * @param {Object} params
 * @param {string} params.code
 * @param {string} [params.redirectUri]
 * @returns {Promise<Object>} Token response data
 */
export const exchangeCodeForToken = async ({ code, redirectUri = getGoogleRedirectUri() }) => {
  if (!code || typeof code !== 'string') {
    const error = new Error('Authorization code is required for token exchange');
    error.statusCode = 400;
    throw error;
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    const error = new Error('Google OAuth credentials not configured on the server');
    error.statusCode = 500;
    throw error;
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  let response;
  try {
    response = await fetch(GOOGLE_OAUTH_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  } catch (err) {
    const error = new Error(`Network error contacting Google token endpoint: ${err.message}`);
    error.statusCode = 502;
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const error = new Error('Invalid JSON response from Google token endpoint');
    error.statusCode = 502;
    throw error;
  }

  if (!response.ok || data.error) {
    const errorDescription = data.error_description || data.error || 'Google token exchange failed';
    const error = new Error(`Google token exchange failed: ${errorDescription}`);
    error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw error;
  }

  if (!data.access_token) {
    const error = new Error('Google token response did not contain an access_token');
    error.statusCode = 502;
    throw error;
  }

  return data;
};

/**
 * Fetches verified Google user profile using access token from UserInfo endpoint.
 * @param {string} accessToken
 * @returns {Promise<{ googleId: string, email: string, emailVerified: boolean, name: string, avatar: string|null }>}
 */
export const fetchGoogleUserInfo = async (accessToken) => {
  if (!accessToken) {
    const error = new Error('Access token is required to fetch Google user info');
    error.statusCode = 400;
    throw error;
  }

  let response;
  try {
    response = await fetch(GOOGLE_OAUTH_CONFIG.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (err) {
    const error = new Error(`Network error contacting Google user info endpoint: ${err.message}`);
    error.statusCode = 502;
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const error = new Error('Invalid JSON response from Google user info endpoint');
    error.statusCode = 502;
    throw error;
  }

  if (!response.ok || !data.sub) {
    const error = new Error('Failed to retrieve verified Google profile');
    error.statusCode = response.status === 401 ? 401 : 502;
    throw error;
  }

  if (!data.email) {
    const error = new Error('Google account does not provide an email address');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = data.email.toLowerCase().trim();
  const displayName = (data.name && typeof data.name === 'string' && data.name.trim())
    ? data.name.trim()
    : normalizedEmail.split('@')[0];

  return {
    googleId: data.sub,
    email: normalizedEmail,
    emailVerified: Boolean(data.email_verified),
    name: displayName.slice(0, 50),
    avatar: data.picture && typeof data.picture === 'string' ? data.picture.trim() : null,
  };
};

/**
 * Authenticates a Google identity within the CHESS JEENO user database.
 * Strictly adheres to Milestone 3 account handling rules:
 * - Case A: New Google user -> creates user with authProvider="google", googleId, email, name, avatar
 * - Case B: Existing Google user -> reuses account without duplication
 * - Case C: Existing local account with same email -> controlled 409 conflict, no silent merge or account creation
 * - Case D: Conflicting Google identity -> safe conflict rejection
 *
 * @param {Object} googleProfile
 * @param {string} googleProfile.googleId
 * @param {string} googleProfile.email
 * @param {string} googleProfile.name
 * @param {string|null} googleProfile.avatar
 * @returns {Promise<{ user: Object, token: string, isNewUser: boolean }>}
 */
export const authenticateGoogleUser = async ({ googleId, email, name, avatar }) => {
  if (!googleId || typeof googleId !== 'string' || !googleId.trim()) {
    const error = new Error('Google identity identifier (sub) is required');
    error.statusCode = 400;
    throw error;
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    const error = new Error('Google email is required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Case B: Check if an account already exists with this exact Google subject identifier
  const existingGoogleUser = await User.findOne({ googleId: googleId.trim() });
  if (existingGoogleUser) {
    // If the user's avatar is missing and Google provides one, update it safely
    if (!existingGoogleUser.avatar && avatar && isValidAvatarUrl(avatar)) {
      existingGoogleUser.avatar = avatar;
      await existingGoogleUser.save();
    }

    const token = generateToken(existingGoogleUser._id);
    return {
      user: sanitizeUserProfile(existingGoogleUser),
      token,
      isNewUser: false,
    };
  }

  // Check if an account exists with this email under a different provider or missing googleId
  const existingEmailUser = await User.findOne({ email: normalizedEmail });
  if (existingEmailUser) {
    // Case D: Account has another Google identity
    if (existingEmailUser.googleId && existingEmailUser.googleId !== googleId.trim()) {
      const error = new Error(
        'This email address is already associated with a different Google account. Authentication rejected.'
      );
      error.statusCode = 409;
      error.code = 'GOOGLE_IDENTITY_CONFLICT';
      throw error;
    }

    // Case C: Existing local (or other) account with the same email
    // DO NOT silently create another CHESS JEENO account.
    // DO NOT automatically merge accounts.
    // DO NOT automatically convert the local account into a Google account.
    const error = new Error(
      'An account with this email address already exists. Please sign in using your existing email and password.'
    );
    error.statusCode = 409;
    error.code = 'EMAIL_EXISTS_LOCAL_AUTH';
    throw error;
  }

  // Case A: Brand new Google user
  const sanitizedAvatar = avatar && isValidAvatarUrl(avatar) ? avatar.slice(0, 2000) : null;
  const displayName = name ? name.trim().slice(0, 50) : normalizedEmail.split('@')[0];

  const newUser = await User.create({
    name: displayName,
    email: normalizedEmail,
    authProvider: 'google',
    googleId: googleId.trim(),
    avatar: sanitizedAvatar,
    passwordHash: null,
  });

  const token = generateToken(newUser._id);

  return {
    user: sanitizeUserProfile(newUser),
    token,
    isNewUser: true,
  };
};

export default {
  generateState,
  saveOAuthTransaction,
  consumeOAuthTransaction,
  hasOAuthTransaction,
  createExchangeTicket,
  consumeExchangeTicket,
  clearAllGoogleTransactions,
  createAuthorizationUrl,
  exchangeCodeForToken,
  fetchGoogleUserInfo,
  authenticateGoogleUser,
};
