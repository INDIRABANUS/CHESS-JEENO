import dotenv from 'dotenv';
dotenv.config();

/**
 * Lichess Configuration
 * 
 * Provides server-side access to Lichess API settings.
 * All tokens are kept strictly on the backend and never exposed.
 */
export const getLichessConfig = () => {
  const token = process.env.LICHESS_API_TOKEN?.trim() || null;
  const baseUrl = process.env.LICHESS_BASE_URL?.trim() || 'https://lichess.org';

  return {
    token,
    baseUrl,
    isConfigured: Boolean(token),
  };
};

/**
 * Validates that LICHESS_API_TOKEN is configured.
 * Throws a formatted error if missing.
 */
export const requireLichessToken = () => {
  const config = getLichessConfig();
  if (!config.token) {
    const error = new Error('Lichess API token is not configured on the server. Please set LICHESS_API_TOKEN in server/.env.');
    error.statusCode = 500;
    throw error;
  }
  return config.token;
};

/**
 * Default development player usernames.
 */
export const DEFAULT_DEV_PLAYERS = {
  1: { username: 'pavakka_ib', name: 'Dev Player 1' },
  2: { username: 'indirabanus', name: 'Dev Player 2' },
  3: { username: 'player3_lichess', name: 'Dev Player 3' },
  4: { username: 'player4_lichess', name: 'Dev Player 4' },
};

/**
 * Retrieves the mapping of Lichess usernames to their corresponding development tokens.
 * Maps: lichessUsername (lowercase) -> token
 * 
 * Supports:
 *  - LICHESS_USER_PLAYER_X and LICHESS_TOKEN_PLAYER_X (X = 1..4)
 *  - LICHESS_TOKEN_<USERNAME> (e.g. LICHESS_TOKEN_PAVAKKA_IB)
 *  - LICHESS_API_TOKEN fallback for player 1 / pavakka_ib
 * 
 * @returns {Map<string, string>}
 */
export const getPlayerTokenMap = () => {
  const map = new Map();

  // 1. Process numbered player environment variables (1 to 4)
  for (let i = 1; i <= 4; i++) {
    const defaultUser = DEFAULT_DEV_PLAYERS[i]?.username || `player${i}`;
    const username = (process.env[`LICHESS_USER_PLAYER_${i}`]?.trim() || defaultUser).toLowerCase();
    let token = process.env[`LICHESS_TOKEN_PLAYER_${i}`]?.trim() || null;

    // Fallback for Player 1: if no explicit player 1 token, use master LICHESS_API_TOKEN
    if (!token && i === 1 && process.env.LICHESS_API_TOKEN) {
      token = process.env.LICHESS_API_TOKEN.trim();
    }

    if (username && token) {
      map.set(username, token);
    }
  }

  // 2. Process direct username-named tokens: LICHESS_TOKEN_<USERNAME>
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith('LICHESS_TOKEN_') && !key.match(/^LICHESS_TOKEN_PLAYER_\d+$/)) {
      const username = key.replace('LICHESS_TOKEN_', '').toLowerCase();
      const token = val?.trim();
      if (username && token && !map.has(username)) {
        map.set(username, token);
      }
    }
  }

  return map;
};

/**
 * Resolves the authorization token for a specific Lichess username.
 * 
 * @param {string} lichessUsername
 * @returns {string|null}
 */
export const getTokenForUser = (lichessUsername) => {
  if (!lichessUsername) return null;
  const map = getPlayerTokenMap();
  return map.get(lichessUsername.trim().toLowerCase()) || null;
};

/**
 * Safe summary of development player accounts and token status (tokens themselves omitted).
 * 
 * @returns {Array<{ index: number, username: string, hasToken: boolean }>}
 */
export const getDevPlayerStatus = () => {
  const tokenMap = getPlayerTokenMap();
  const result = [];

  for (let i = 1; i <= 4; i++) {
    const defaultUser = DEFAULT_DEV_PLAYERS[i]?.username || `player${i}`;
    const username = (process.env[`LICHESS_USER_PLAYER_${i}`]?.trim() || defaultUser).toLowerCase();
    result.push({
      index: i,
      username,
      hasToken: tokenMap.has(username),
    });
  }

  return result;
};

export default {
  getLichessConfig,
  requireLichessToken,
  getPlayerTokenMap,
  getTokenForUser,
  getDevPlayerStatus,
  DEFAULT_DEV_PLAYERS,
};
