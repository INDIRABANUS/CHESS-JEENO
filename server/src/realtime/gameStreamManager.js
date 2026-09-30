import mongoose from 'mongoose';
import { getIo } from './socket.js';
import { normalizeStreamEvent } from './eventNormalizer.js';
import * as pairingService from '../services/pairingService.js';
import * as standingsService from '../services/standingsService.js';
import * as roundService from '../services/roundService.js';
import * as lichessOAuthService from '../services/lichessOAuthService.js';
import { requireLichessToken } from '../config/lichess.js';
import Pairing from '../models/Pairing.js';
import Round from '../models/Round.js';

// In-memory registry of active Lichess game streams
// Key: lichessGameId (string) -> StreamEntry
const activeStreams = new Map();

// Mock stream transport for automated testing
let mockStreamTransport = null;

export const setMockStreamTransport = (handler) => {
  mockStreamTransport = handler;
};

export const getMockStreamTransport = () => mockStreamTransport;

export const MAX_RECONNECT_ATTEMPTS = 3;

/**
 * Starts or reuses a backend Lichess game stream for a pairing.
 * 
 * @param {Object} params
 * @param {string} params.tournamentId
 * @param {number|string} params.roundNumber
 * @param {string} params.pairingId
 * @param {string} params.lichessGameId
 * @param {string} [params.token] - Lichess authorization token
 * @returns {Promise<Object>}
 */
export const startStream = async ({
  tournamentId,
  roundNumber,
  pairingId,
  lichessGameId,
  token = null,
}) => {
  if (!lichessGameId) {
    throw new Error('lichessGameId is required to start game stream');
  }

  const cleanGameId = lichessGameId.trim();

  // 1. One stream per game - reuse existing stream if already active
  if (activeStreams.has(cleanGameId)) {
    return activeStreams.get(cleanGameId);
  }

  // 2. Validate that pairing exists and is not already terminal in DB
  if (pairingId && mongoose.isValidObjectId(pairingId)) {
    const pairing = await Pairing.findById(pairingId);
    if (pairing && (pairing.status === 'FINISHED' || pairing.status === 'ABORTED')) {
      return null;
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';
  let streamToken = token;
  if (!streamToken && pairingId && mongoose.isValidObjectId(pairingId)) {
    try {
      const pairing = await Pairing.findById(pairingId).populate('whitePlayer blackPlayer');
      if (pairing?.whitePlayer?._id) {
        try {
          const creds = await lichessOAuthService.resolveLichessPlayerCredentials(
            pairing.whitePlayer._id,
            { allowDevBridge: !isProduction }
          );
          streamToken = creds.accessToken;
        } catch {
          // Try black player
        }
      }
      if (!streamToken && pairing?.blackPlayer?._id) {
        try {
          const creds = await lichessOAuthService.resolveLichessPlayerCredentials(
            pairing.blackPlayer._id,
            { allowDevBridge: !isProduction }
          );
          streamToken = creds.accessToken;
        } catch {
          // Fall back to dev token only in non-production
        }
      }
    } catch {
      // Ignore lookup failure
    }
  }

  if (!streamToken && !mockStreamTransport && !isProduction) {
    try {
      streamToken = requireLichessToken();
    } catch {
      streamToken = null;
    }
  }

  // 4. Create stream entry in registry
  const streamEntry = {
    lichessGameId: cleanGameId,
    tournamentId: tournamentId ? tournamentId.toString() : null,
    roundNumber: roundNumber !== null && roundNumber !== undefined ? Number(roundNumber) : null,
    pairingId: pairingId ? pairingId.toString() : null,
    token: streamToken,
    abortController: new AbortController(),
    reconnectAttempts: 0,
    isClosing: false,
    startedAt: Date.now(),
    mockHandle: null,
  };

  activeStreams.set(cleanGameId, streamEntry);

  // 5. Connect stream
  initiateStreamConnection(streamEntry);

  return streamEntry;
};

/**
 * Internal runner that initiates the HTTP stream connection and processes NDJSON chunks.
 */
const initiateStreamConnection = async (streamEntry) => {
  const { lichessGameId, tournamentId, roundNumber, pairingId, token } = streamEntry;
  const context = { tournamentId, roundNumber, pairingId, lichessGameId };

  // A. If mock stream transport is registered (used in tests), use it
  if (mockStreamTransport) {
    try {
      const handle = mockStreamTransport({
        lichessGameId,
        context,
        onEvent: (rawEvent) => handleIncomingEvent(rawEvent, streamEntry),
        onError: (err) => handleStreamError(err, streamEntry),
        onClose: () => handleStreamClose(streamEntry),
      });
      streamEntry.mockHandle = handle;
    } catch (err) {
      handleStreamError(err, streamEntry);
    }
    return;
  }

  // B. Real Lichess NDJSON Stream
  const baseUrl = process.env.LICHESS_BASE_URL?.trim() || 'https://lichess.org';
  const url = `${baseUrl}/api/board/game/stream/${lichessGameId}`;

  const headers = {
    Accept: 'application/x-ndjson',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: streamEntry.abortController.signal,
    });

    if (!response.ok) {
      const statusText = `Lichess stream HTTP ${response.status}`;
      console.warn(`[StreamManager] Stream connection failed for ${lichessGameId}: ${statusText}`);

      // Fatal client errors (401, 403, 404) should not be retried infinitely
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        stopStream(lichessGameId);
        return;
      }
      throw new Error(statusText);
    }

    if (!response.body) {
      throw new Error('Lichess response contains no readable body');
    }

    // Reset reconnect attempts on successful connection
    streamEntry.reconnectAttempts = 0;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!streamEntry.isClosing) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep last incomplete chunk in buffer
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const rawEvent = JSON.parse(trimmed);
          await handleIncomingEvent(rawEvent, streamEntry);
        } catch (jsonErr) {
          console.warn(`[StreamManager] Failed to parse NDJSON line for game ${lichessGameId}:`, jsonErr.message);
        }
      }
    }

    handleStreamClose(streamEntry);
  } catch (err) {
    if (err.name === 'AbortError' || streamEntry.isClosing) {
      // Intentional abort or closure
      return;
    }
    handleStreamError(err, streamEntry);
  }
};

/**
 * Processes an incoming raw Lichess stream event.
 */
const handleIncomingEvent = async (rawEvent, streamEntry) => {
  const { tournamentId, roundNumber, pairingId, lichessGameId } = streamEntry;
  const context = { tournamentId, roundNumber, pairingId, lichessGameId };

  const normalized = normalizeStreamEvent(rawEvent, context);
  if (!normalized) return;

  const { eventType, payload } = normalized;

  // 1. Broadcast normalized event to tournament room
  let io = null;
  try {
    io = getIo();
  } catch {
    // Socket server might not be running in isolated unit tests
  }

  if (io && tournamentId) {
    io.to(`tournament:${tournamentId}`).emit(eventType, payload);
  }

  // 2. Handle terminal events: sync results with database
  if (eventType === 'GAME_FINISHED' || eventType === 'GAME_ABORTED') {
    try {
      // Reuse existing canonical syncPairingResult logic
      if (pairingId) {
        await pairingService.syncPairingResult(
          tournamentId,
          roundNumber,
          pairingId,
          { force: true }
        );
      }

      // Recalculate and broadcast tournament standings
      if (tournamentId) {
        await standingsService.syncTournamentPlayerScores(tournamentId);
        const standingsData = await standingsService.getTournamentStandings(tournamentId);
        if (io) {
          io.to(`tournament:${tournamentId}`).emit('STANDINGS_UPDATED', {
            tournamentId,
            standings: standingsData.standings,
          });
        }

        // Check if round is complete
        if (roundNumber !== null && roundNumber !== undefined) {
          const roundStatus = await roundService.getRoundCompletionStatus(tournamentId, roundNumber);
          if (roundStatus.complete && io) {
            io.to(`tournament:${tournamentId}`).emit('ROUND_COMPLETED', {
              tournamentId,
              roundNumber: Number(roundNumber),
              complete: true,
            });
          }
        }
      }
    } catch (syncErr) {
      console.error(`[StreamManager] Error syncing terminal result for ${lichessGameId}:`, syncErr.message);
    } finally {
      // Clean up terminal stream
      stopStream(lichessGameId);
    }
  }
};

/**
 * Handles unexpected stream connection errors with bounded reconnect.
 */
const handleStreamError = (err, streamEntry) => {
  const { lichessGameId } = streamEntry;
  console.warn(`[StreamManager] Stream error for game ${lichessGameId}:`, err.message);

  if (streamEntry.isClosing) {
    return;
  }

  if (streamEntry.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    streamEntry.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, streamEntry.reconnectAttempts), 5000);
    console.log(
      `[StreamManager] Scheduling reconnect #${streamEntry.reconnectAttempts} for ${lichessGameId} in ${delay}ms`
    );
    setTimeout(() => {
      if (!streamEntry.isClosing && activeStreams.has(lichessGameId)) {
        streamEntry.abortController = new AbortController();
        initiateStreamConnection(streamEntry);
      }
    }, delay);
  } else {
    console.warn(`[StreamManager] Max reconnect attempts reached for ${lichessGameId}. Stopping stream.`);
    stopStream(lichessGameId);
  }
};

/**
 * Handles stream close.
 */
const handleStreamClose = (streamEntry) => {
  const { lichessGameId } = streamEntry;
  if (!streamEntry.isClosing && streamEntry.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    handleStreamError(new Error('Stream closed unexpectedly'), streamEntry);
  } else {
    stopStream(lichessGameId);
  }
};

/**
 * Stops an active Lichess game stream and removes it from registry.
 * 
 * @param {string} lichessGameId
 */
export const stopStream = (lichessGameId) => {
  if (!lichessGameId) return;
  const cleanGameId = lichessGameId.trim();
  const entry = activeStreams.get(cleanGameId);

  if (entry) {
    entry.isClosing = true;
    try {
      entry.abortController.abort();
    } catch {
      // Ignore abort errors
    }
    if (entry.mockHandle && typeof entry.mockHandle.stop === 'function') {
      try {
        entry.mockHandle.stop();
      } catch {
        // Ignore mock stop errors
      }
    }
    activeStreams.delete(cleanGameId);
  }
};

/**
 * Stops all active streams (e.g. for server shutdown or test teardown).
 */
export const stopAllStreams = () => {
  for (const gameId of Array.from(activeStreams.keys())) {
    stopStream(gameId);
  }
  activeStreams.clear();
};

/**
 * Returns number of active streams currently registered.
 */
export const getActiveStreamsCount = () => activeStreams.size;

/**
 * Checks if a stream is currently active for a game.
 */
export const hasStream = (lichessGameId) => activeStreams.has(lichessGameId?.trim());

/**
 * Returns the stream entry for a game if active.
 */
export const getActiveStream = (lichessGameId) => activeStreams.get(lichessGameId?.trim()) || null;

/**
 * Ensures all eligible active pairings with Lichess games in a tournament have running streams.
 * 
 * @param {string} tournamentId
 */
export const ensureTournamentActiveStreams = async (tournamentId) => {
  if (!tournamentId || !mongoose.isValidObjectId(tournamentId)) return;

  const activePairings = await Pairing.find({
    tournamentId,
    lichessGameId: { $ne: null },
    status: { $in: ['ACTIVE', 'READY'] },
  }).populate('whitePlayer blackPlayer');

  for (const pairing of activePairings) {
    if (!pairing.lichessGameId || activeStreams.has(pairing.lichessGameId)) {
      continue;
    }

    let roundNumber = 1;
    try {
      const round = await Round.findById(pairing.roundId);
      if (round) roundNumber = round.roundNumber;
    } catch {
      // Use default
    }

    startStream({
      tournamentId: tournamentId.toString(),
      roundNumber,
      pairingId: pairing._id.toString(),
      lichessGameId: pairing.lichessGameId,
    }).catch((err) => {
      console.warn(`[StreamManager] Auto-start stream error for ${pairing.lichessGameId}:`, err.message);
    });
  }
};

export default {
  startStream,
  stopStream,
  stopAllStreams,
  getActiveStreamsCount,
  hasStream,
  getActiveStream,
  setMockStreamTransport,
  getMockStreamTransport,
  ensureTournamentActiveStreams,
  MAX_RECONNECT_ATTEMPTS,
};
