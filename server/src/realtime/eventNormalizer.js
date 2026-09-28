/**
 * Lichess Stream Event Normalizer
 * 
 * Normalizes raw Lichess Board Game Stream NDJSON events into clean, lightweight
 * CHESS JEENO domain events for Socket.IO clients.
 * 
 * Security:
 * Strictly excludes any private tokens, Authorization headers, or internal database metadata.
 */

// Terminal finished statuses from Lichess
const FINISHED_STATUSES = new Set([
  'mate',
  'resign',
  'outoftime',
  'timeout',
  'draw',
  'stalemate',
  'cheat',
  'variantend',
]);

// Terminal aborted/unstarted statuses from Lichess
const ABORTED_STATUSES = new Set(['aborted', 'nostart']);

/**
 * Normalizes a raw Lichess stream event line (gameFull or gameState) into a CHESS JEENO event.
 * 
 * @param {Object} rawEvent - Raw parsed JSON event from Lichess NDJSON stream
 * @param {Object} context - Tournament context { tournamentId, roundNumber, pairingId, lichessGameId }
 * @returns {{ eventType: string, payload: Object } | null}
 */
export const normalizeStreamEvent = (rawEvent, context = {}) => {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const {
    tournamentId = null,
    roundNumber = null,
    pairingId = null,
    lichessGameId = rawEvent.id || null,
  } = context;

  const eventType = rawEvent.type;

  // 1. Initial full game snapshot ("gameFull")
  if (eventType === 'gameFull') {
    const state = rawEvent.state || {};
    const status = (state.status || 'started').toLowerCase();
    const winner = state.winner ? state.winner.toLowerCase() : null;

    let result = null;
    let chEvent = 'GAME_STARTED';

    if (FINISHED_STATUSES.has(status)) {
      chEvent = 'GAME_FINISHED';
      result = winner === 'white' ? '1-0' : (winner === 'black' ? '0-1' : '1/2-1/2');
    } else if (ABORTED_STATUSES.has(status)) {
      chEvent = 'GAME_ABORTED';
      result = 'ABORTED';
    } else if (state.moves && state.moves.trim().length > 0) {
      chEvent = 'GAME_STATE';
    }

    const movesStr = (state.moves || '').trim();
    const lastMove = movesStr ? movesStr.split(/\s+/).pop() : null;

    const clocks = {
      white: typeof state.wtime === 'number' ? Math.round(state.wtime / 1000) : null,
      black: typeof state.btime === 'number' ? Math.round(state.btime / 1000) : null,
    };

    return {
      eventType: chEvent,
      payload: {
        tournamentId: tournamentId ? tournamentId.toString() : null,
        roundNumber: roundNumber !== null && roundNumber !== undefined ? Number(roundNumber) : null,
        pairingId: pairingId ? pairingId.toString() : null,
        lichessGameId: lichessGameId || rawEvent.id || null,
        status,
        result,
        white: {
          id: rawEvent.white?.id || null,
          name: rawEvent.white?.name || rawEvent.white?.id || 'White',
        },
        black: {
          id: rawEvent.black?.id || null,
          name: rawEvent.black?.name || rawEvent.black?.id || 'Black',
        },
        clocks,
        lastMove,
      },
    };
  }

  // 2. Subsequent game state update ("gameState")
  if (eventType === 'gameState') {
    const status = (rawEvent.status || 'started').toLowerCase();
    const winner = rawEvent.winner ? rawEvent.winner.toLowerCase() : null;

    let result = null;
    let chEvent = 'GAME_STATE';

    if (FINISHED_STATUSES.has(status)) {
      chEvent = 'GAME_FINISHED';
      result = winner === 'white' ? '1-0' : (winner === 'black' ? '0-1' : '1/2-1/2');
    } else if (ABORTED_STATUSES.has(status)) {
      chEvent = 'GAME_ABORTED';
      result = 'ABORTED';
    }

    const movesStr = (rawEvent.moves || '').trim();
    const lastMove = movesStr ? movesStr.split(/\s+/).pop() : null;

    const clocks = {
      white: typeof rawEvent.wtime === 'number' ? Math.round(rawEvent.wtime / 1000) : null,
      black: typeof rawEvent.btime === 'number' ? Math.round(rawEvent.btime / 1000) : null,
    };

    return {
      eventType: chEvent,
      payload: {
        tournamentId: tournamentId ? tournamentId.toString() : null,
        roundNumber: roundNumber !== null && roundNumber !== undefined ? Number(roundNumber) : null,
        pairingId: pairingId ? pairingId.toString() : null,
        lichessGameId: lichessGameId || null,
        status,
        result,
        clocks,
        lastMove,
      },
    };
  }

  // Other Lichess event types (e.g. chatLine) are safely ignored
  return null;
};

export default {
  normalizeStreamEvent,
};
