import { requireLichessToken, getLichessConfig, getTokenForUser } from '../config/lichess.js';

let mockTransport = null;
let mockExportTransport = null;

/**
 * Allows automated tests to set a mock transport handler for game creation.
 * Set to null to restore real network calls.
 * 
 * @param {Function|null} handler - async (params) => responseData
 */
export const setMockTransport = (handler) => {
  mockTransport = handler;
};

/**
 * Allows automated tests to set a mock transport handler for game export/results.
 * Set to null to restore real network calls.
 * 
 * @param {Function|null} handler - async (gameId) => responseData
 */
export const setMockExportTransport = (handler) => {
  mockExportTransport = handler;
};

/**
 * Creates a Lichess game between two players using the configured time control.
 * In bulk-pairing, each player participant's authorization token is securely resolved and forwarded.
 * 
 * @param {Object} params
 * @param {string} params.whiteUsername - Lichess username for White
 * @param {string} params.blackUsername - Lichess username for Black
 * @param {number} params.clockLimit - Clock limit in seconds (e.g. 300)
 * @param {number} params.increment - Increment in seconds (e.g. 0)
 * @param {boolean} params.rated - Whether the game is rated
 * @param {string} [params.token] - Optional explicit organizer token override
 * @param {string} [params.whiteToken] - Optional explicit White player token override
 * @param {string} [params.blackToken] - Optional explicit Black player token override
 * @returns {Promise<{ gameId: string, gameUrl: string, raw: Object }>}
 */
export const createGame = async ({
  whiteUsername,
  blackUsername,
  clockLimit,
  increment = 0,
  rated = false,
  token,
  whiteToken,
  blackToken,
}) => {
  // 1. Validate input parameters
  if (!whiteUsername || !whiteUsername.trim()) {
    const error = new Error('White player Lichess username is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!blackUsername || !blackUsername.trim()) {
    const error = new Error('Black player Lichess username is required.');
    error.statusCode = 400;
    throw error;
  }

  const white = whiteUsername.trim();
  const black = blackUsername.trim();

  const limitSec = Number(clockLimit);
  if (isNaN(limitSec) || limitSec < 1) {
    const error = new Error('Clock limit must be a positive integer in seconds.');
    error.statusCode = 400;
    throw error;
  }

  const incSec = Number(increment) || 0;
  const isRated = Boolean(rated);

  const isProduction = process.env.NODE_ENV === 'production';

  // 2. Resolve individual player authorization tokens
  const resolvedWhiteToken = whiteToken || (!isProduction ? getTokenForUser(white) : null);
  if (!resolvedWhiteToken) {
    const error = new Error(`Missing Lichess token for player: ${white}`);
    error.statusCode = 400;
    throw error;
  }

  const resolvedBlackToken = blackToken || (!isProduction ? getTokenForUser(black) : null);
  if (!resolvedBlackToken) {
    const error = new Error(`Missing Lichess token for player: ${black}`);
    error.statusCode = 400;
    throw error;
  }

  if (resolvedWhiteToken === resolvedBlackToken) {
    const error = new Error('White and Black tokens cannot be identical.');
    error.statusCode = 400;
    throw error;
  }

  // 3. Ensure organizer API token is present
  const apiToken = token || (isProduction ? (process.env.LICHESS_API_TOKEN || resolvedWhiteToken) : (resolvedWhiteToken || requireLichessToken()));

  const playersPayload = `${resolvedWhiteToken}:${resolvedBlackToken}`;

  // 4. If mock transport is registered (used in test suite), invoke it directly
  if (mockTransport) {
    const mockResult = await mockTransport({
      whiteUsername: white,
      blackUsername: black,
      clockLimit: limitSec,
      increment: incSec,
      rated: isRated,
      token: apiToken,
      whiteToken: resolvedWhiteToken,
      blackToken: resolvedBlackToken,
      playersPayload,
    });

    if (!mockResult?.gameId) {
      const error = new Error('Mock Lichess transport failed to return gameId.');
      error.statusCode = 502;
      throw error;
    }

    return {
      gameId: mockResult.gameId,
      gameUrl: mockResult.gameUrl || `https://lichess.org/${mockResult.gameId}`,
      raw: mockResult,
    };
  }

  // 5. Real Lichess API Network Call
  const { baseUrl } = getLichessConfig();
  const endpoint = `${baseUrl}/api/bulk-pairing`;

  console.log(
    `[Lichess Bulk-Pairing] Requesting game: White=@${white} (tokenPresent=true) vs Black=@${black} (tokenPresent=true), ${limitSec}+${incSec}, rated=${isRated}`
  );

  const formBody = new URLSearchParams({
    players: playersPayload,
    'clock.limit': String(limitSec),
    'clock.increment': String(incSec),
    rated: isRated ? 'true' : 'false',
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken || resolvedWhiteToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody.toString(),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { rawText: responseText };
    }

    if (!response.ok) {
      console.error(`[Lichess API Error] HTTP ${response.status}:`, JSON.stringify(data));
      const error = new Error();
      error.statusCode = response.status >= 500 ? 502 : response.status;
      const details =
        data?.error ||
        data?.message ||
        (data?.tokens ? JSON.stringify(data.tokens) : null) ||
        (typeof data?.rawText === 'string' ? data.rawText : null) ||
        `HTTP ${response.status}`;

      if (response.status === 401) {
        error.message = `Lichess API authentication failed (HTTP 401): ${details}. Please verify LICHESS_API_TOKEN.`;
      } else if (response.status === 403) {
        error.message = `Lichess API forbidden (HTTP 403): ${details}`;
      } else if (response.status === 404) {
        error.message = `One of the players ('${white}' or '${black}') was not found on Lichess: ${details}`;
      } else {
        error.message = `Lichess API returned status ${response.status}: ${details}`;
      }
      throw error;
    }

    console.log(`[Lichess API Success] HTTP ${response.status}:`, JSON.stringify(data));

    // Extract gameId from bulk-pairing response
    let gameId = null;
    if (data.games && Array.isArray(data.games) && data.games.length > 0) {
      const first = data.games[0];
      gameId = typeof first === 'string' ? first : (first?.id || first?.gameId || null);
    } else if (data.id) {
      gameId = data.id;
    } else if (data.challenge?.id) {
      gameId = data.challenge.id;
    }

    if (!gameId) {
      const error = new Error(`Lichess API did not return a valid game ID. Response: ${JSON.stringify(data)}`);
      error.statusCode = 502;
      throw error;
    }

    const gameUrl = data.challenge?.url || data.url || `https://lichess.org/${gameId}`;

    return {
      gameId,
      gameUrl,
      raw: data,
    };
  } catch (err) {
    if (err.statusCode) {
      throw err;
    }
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      const timeoutError = new Error('Request to Lichess API timed out.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    const networkError = new Error('Failed to connect to Lichess API.');
    networkError.statusCode = 502;
    throw networkError;
  }
};

/**
 * Normalizes raw Lichess game export JSON data into domain fields.
 * 
 * @param {Object} data - Raw Lichess game JSON object
 * @returns {Object} Normalized game result object
 */
export const normalizeLichessGame = (data) => {
  if (!data || typeof data !== 'object') {
    const error = new Error('Invalid or empty game data received from Lichess.');
    error.statusCode = 502;
    throw error;
  }

  const gameId = data.id || null;
  const status = (data.status || 'unknown').toLowerCase();
  const winner = data.winner ? data.winner.toLowerCase() : null;

  const whiteUsername =
    data.players?.white?.user?.name ||
    data.players?.white?.user?.id ||
    data.players?.white?.name ||
    null;

  const blackUsername =
    data.players?.black?.user?.name ||
    data.players?.black?.user?.id ||
    data.players?.black?.name ||
    null;

  // Terminal completed statuses
  const FINISHED_STATUSES = new Set([
    'mate',
    'resign',
    'outoftime',
    'timeout',
    'draw',
    'stalemate',
    'cheat',
    'variantend',
    'unknown',
  ]);

  // Terminal aborted/unstarted statuses
  const ABORTED_STATUSES = new Set(['aborted', 'nostart']);

  let completed = false;
  let result = null;
  let pairingStatus = 'ACTIVE';

  if (FINISHED_STATUSES.has(status)) {
    completed = true;
    pairingStatus = 'FINISHED';
    if (winner === 'white') {
      result = '1-0';
    } else if (winner === 'black') {
      result = '0-1';
    } else {
      // Draw or stalemate or no winner
      result = '1/2-1/2';
    }
  } else if (ABORTED_STATUSES.has(status)) {
    completed = true;
    pairingStatus = 'ABORTED';
    result = 'ABORTED';
  } else {
    // In progress ('created', 'started', etc.)
    completed = false;
    pairingStatus = 'ACTIVE';
    result = null;
  }

  return {
    gameId,
    status,
    winner,
    whiteUsername,
    blackUsername,
    completed,
    result,
    pairingStatus,
    raw: data,
  };
};

/**
 * Fetches game export details from Lichess and returns a normalized result.
 * Uses official Lichess game export endpoint with JSON accept header.
 * 
 * @param {string} gameId - The Lichess 8-character game ID
 * @param {Object} [options]
 * @param {string} [options.token] - Optional API token for authorized export
 * @returns {Promise<Object>} Normalized game result
 */
export const getGameResult = async (gameId, options = {}) => {
  if (!gameId || typeof gameId !== 'string' || !gameId.trim()) {
    const error = new Error('Lichess game ID is required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanGameId = gameId.trim();

  // If mock export transport is registered, use it
  if (mockExportTransport) {
    const mockData = await mockExportTransport(cleanGameId);
    if (!mockData) {
      const error = new Error(`Mock transport returned no data for game ${cleanGameId}`);
      error.statusCode = 502;
      throw error;
    }
    return normalizeLichessGame(mockData);
  }

  const { baseUrl, token: configToken } = getLichessConfig();
  const apiToken = options.token || configToken;

  const headers = {
    Accept: 'application/json',
  };
  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }

  const query = 'moves=false&pgnInJson=false&clocks=false&evals=false&opening=false';
  let url = `${baseUrl}/game/export/${cleanGameId}?${query}`;

  try {
    let response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });

    // Fallback to /api/game/export if /game/export returns 404
    if (response.status === 404) {
      const altUrl = `${baseUrl}/api/game/export/${cleanGameId}?${query}`;
      const altResponse = await fetch(altUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (altResponse.ok) {
        response = altResponse;
      }
    }

    if (!response.ok) {
      const error = new Error();
      error.statusCode = response.status >= 500 ? 502 : response.status;
      if (response.status === 404) {
        error.message = `Lichess game not found: ${cleanGameId}`;
      } else {
        error.message = `Lichess API returned status ${response.status} while exporting game: ${cleanGameId}`;
      }
      throw error;
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const error = new Error(`Invalid JSON received from Lichess for game: ${cleanGameId}`);
      error.statusCode = 502;
      throw error;
    }

    return normalizeLichessGame(data);
  } catch (err) {
    if (err.statusCode) {
      throw err;
    }
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      const timeoutError = new Error('Request to Lichess API timed out.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    const networkError = new Error(`Failed to fetch Lichess game result: ${err.message}`);
    networkError.statusCode = 502;
    throw networkError;
  }
};

export default {
  createGame,
  getGameResult,
  normalizeLichessGame,
  setMockTransport,
  setMockExportTransport,
};
