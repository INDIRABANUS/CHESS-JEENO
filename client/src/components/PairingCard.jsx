import React from 'react';
import {
  Loader2,
  CheckCircle,
  ExternalLink,
  Zap,
  RefreshCw,
} from 'lucide-react';

/**
 * PairingCard — renders a single board/pairing inside a round.
 *
 * Props:
 * @param {Object}   pairing            – The pairing object from the round
 * @param {number}   roundNumber        – The round number this pairing belongs to
 * @param {number}   boardIndex         – Zero-based index of this pairing within the round (used for "Board N" label)
 * @param {string}   currentUserId      – The currently authenticated user's ID (stringified)
 * @param {boolean}  isHost             – Whether the current user is the tournament host
 * @param {Object}   pairingGameLoading – Map of pairingId → boolean loading state for CREATE GAME
 * @param {Object}   syncLoading        – Map of pairingId → boolean loading state for SYNC RESULT
 * @param {Object}   rematchLoading     – Map of pairingId → boolean loading state for REMATCH
 * @param {Function} onCreateGame       – (roundNumber, pairingId) => void
 * @param {Function} onSyncResult       – (roundNumber, pairingId) => void
 * @param {Function} onRematch          – (roundNumber, pairingId) => void
 */
const PairingCard = ({
  pairing,
  roundNumber,
  boardIndex,
  currentUserId,
  isHost,
  pairingGameLoading,
  syncLoading,
  rematchLoading,
  isTournamentComplete = false,
  onCreateGame,
  onSyncResult,
  onRematch,
}) => {
  const isPairingLoading = Boolean(pairingGameLoading[pairing._id]);
  const isGameReady = Boolean(pairing.lichessGameId);
  const isBye = pairing.status === 'BYE' || pairing.result === 'BYE' || !pairing.blackPlayer;

  const whiteUserId = (pairing.whitePlayer?._id || pairing.whitePlayer?.id || pairing.whitePlayer)?.toString();
  const blackUserId = (pairing.blackPlayer?._id || pairing.blackPlayer?.id || pairing.blackPlayer)?.toString();
  const myUserId = currentUserId?.toString();

  const isCurrentWhite = Boolean(myUserId && whiteUserId && whiteUserId === myUserId);
  const isCurrentBlack = Boolean(myUserId && blackUserId && blackUserId === myUserId);
  const isParticipant = isCurrentWhite || isCurrentBlack;
  const canManageGame = isHost || isParticipant;

  return (
    <div
      className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs transition-colors"
    >
      {/* Board / Match Number */}
      <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 dark:text-slate-500">
        <span>Board {boardIndex + 1}</span>
      </div>

      {/* Matchup: White vs Black */}
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4 w-full sm:w-auto">
        {/* White Player */}
        <div className="flex items-center space-x-2 justify-start sm:justify-end text-left sm:text-right min-w-0 flex-1">
          <span
            className="w-5 h-5 rounded-full bg-white dark:bg-slate-200 border-2 border-slate-700 flex items-center justify-center text-xs font-bold text-slate-800 shadow-2xs shrink-0 order-first sm:order-last"
            title="White Pieces"
          >
            ♔
          </span>
          <div className="min-w-0 flex-1 sm:flex-initial">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={pairing.whitePlayer?.name || 'Player'}>
              {pairing.whitePlayer?.name || 'Player'}
            </div>
            {pairing.whitePlayer?.lichessUsername && (
              <div className="text-xs sm:text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                @{pairing.whitePlayer.lichessUsername}
              </div>
            )}
          </div>
        </div>

        {/* VS separator */}
        <div className="flex items-center justify-center shrink-0">
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
            {isBye ? '—' : 'VS'}
          </span>
        </div>

        {/* Black Player / BYE */}
        {isBye ? (
          <div className="flex items-center space-x-2 justify-start text-left min-w-0 flex-1">
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
              BYE (Auto-Advance)
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 justify-start text-left min-w-0 flex-1">
            <span
              className="w-5 h-5 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-xs font-bold text-white shadow-2xs shrink-0"
              title="Black Pieces"
            >
              ♚
            </span>
            <div className="min-w-0 flex-1 sm:flex-initial">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={pairing.blackPlayer?.name || 'Player'}>
                {pairing.blackPlayer?.name || 'Player'}
              </div>
              {pairing.blackPlayer?.lichessUsername && (
                <div className="text-xs sm:text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                  @{pairing.blackPlayer.lichessUsername}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Match Status, Result & Lichess Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
        {/* Status Badges Row */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Pairing Status Badge */}
          <span
            className={`px-2 py-0.5 rounded font-semibold text-[11px] flex items-center space-x-1 ${
              isBye
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : pairing.status === 'FINISHED' || pairing.status === 'COMPLETED'
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                : pairing.status === 'ABORTED' || pairing.status === 'CANCELLED'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                : pairing.status === 'ACTIVE' || pairing.status === 'READY'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {pairing.status === 'ACTIVE' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                <span>LIVE</span>
              </>
            ) : isBye ? (
              <span>BYE</span>
            ) : (
              <span>{pairing.status}</span>
            )}
          </span>

          {/* Realtime Clocks if available */}
          {pairing.clocks && (typeof pairing.clocks.white === 'number' || typeof pairing.clocks.black === 'number') && (
            <span
              className="px-1.5 py-0.5 rounded font-mono text-xs sm:text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              title="Remaining clock time"
            >
              ⏱ {typeof pairing.clocks.white === 'number' ? `${Math.floor(pairing.clocks.white / 60)}:${String(pairing.clocks.white % 60).padStart(2, '0')}` : '—'} / {typeof pairing.clocks.black === 'number' ? `${Math.floor(pairing.clocks.black / 60)}:${String(pairing.clocks.black % 60).padStart(2, '0')}` : '—'}
            </span>
          )}

          {/* Realtime Last Move if available */}
          {pairing.lastMove && (
            <span
              className="px-1.5 py-0.5 rounded font-mono text-xs sm:text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              title={`Last move: ${pairing.lastMove}`}
            >
              Move: {pairing.lastMove}
            </span>
          )}

          {/* Lichess Raw Status Badge */}
          {pairing.lichessStatus && (
            <span
              className="px-1.5 py-0.5 rounded font-mono text-xs sm:text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              title={`Lichess status: ${pairing.lichessStatus}`}
            >
              {pairing.lichessStatus}
            </span>
          )}

          {/* Result */}
          <span
            className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
              isBye
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : pairing.result && pairing.result !== 'PENDING'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {isBye ? 'BYE' : pairing.result === 'PENDING' ? '—' : pairing.result}
          </span>
        </div>

        {/* Lichess Action / Review Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full sm:w-auto">
          {isBye ? (
            <div className="inline-flex items-center justify-center space-x-1 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold w-full sm:w-auto min-h-[36px]">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>AUTO-ADVANCED</span>
            </div>
          ) : isTournamentComplete ? (
            pairing.lichessGameId ? (
              <a
                href={
                  pairing.lichessGameUrl ||
                  `https://lichess.org/${pairing.lichessGameId}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold shadow-2xs transition w-full sm:w-auto min-h-[36px]"
                title="Review game on Lichess"
              >
                <span>REVIEW ON LICHESS</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="inline-flex items-center justify-center px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-medium w-full sm:w-auto min-h-[36px]">
                Concluded
              </span>
            )
          ) : pairing.status === 'ABORTED' || pairing.result === 'ABORTED' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full sm:w-auto">
              {canManageGame && (
                <button
                  onClick={() => onRematch(roundNumber, pairing._id)}
                  disabled={Boolean(rematchLoading[pairing._id])}
                  title="Start a new Lichess rematch game for this aborted pairing"
                  className="inline-flex items-center justify-center space-x-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition w-full sm:w-auto min-h-[40px] cursor-pointer"
                >
                  {Boolean(rematchLoading[pairing._id]) ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>REMATCHING...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      <span>REMATCH</span>
                    </>
                  )}
                </button>
              )}
              {pairing.lichessGameId && (
                <a
                  href={pairing.lichessGameUrl || `https://lichess.org/${pairing.lichessGameId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center space-x-1 px-2.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 transition w-full sm:w-auto min-h-[40px]"
                  title="View aborted game on Lichess"
                >
                  <span>Aborted Game</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : isGameReady ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full sm:w-auto">
              {/* SYNC RESULT Button */}
              <button
                onClick={() => onSyncResult(roundNumber, pairing._id)}
                disabled={Boolean(syncLoading[pairing._id])}
                title="Sync game result and status from Lichess"
                className="inline-flex items-center justify-center space-x-1 px-2.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition w-full sm:w-auto min-h-[40px] cursor-pointer"
              >
                {Boolean(syncLoading[pairing._id]) ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>SYNCING...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3" />
                    <span>SYNC RESULT</span>
                  </>
                )}
              </button>

              {/* PLAY ON LICHESS Link */}
              <a
                href={
                  pairing.lichessGameUrl ||
                  `https://lichess.org/${pairing.lichessGameId}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center space-x-1.5 px-3 py-2 text-white rounded-lg text-xs font-semibold shadow-xs transition w-full sm:w-auto min-h-[40px] ${
                  isCurrentWhite
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : isCurrentBlack
                    ? 'bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 dark:border dark:border-slate-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                title={
                  isCurrentWhite
                    ? `Play as White (@${pairing.whitePlayer?.lichessUsername || 'White'}) on Lichess`
                    : isCurrentBlack
                    ? `Play as Black (@${pairing.blackPlayer?.lichessUsername || 'Black'}) on Lichess`
                    : 'Open game on Lichess in a new tab'
                }
              >
                <span>
                  {isCurrentWhite
                    ? 'PLAY AS WHITE ♔'
                    : isCurrentBlack
                    ? 'PLAY AS BLACK ♚'
                    : 'VIEW ON LICHESS'}
                </span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : canManageGame ? (
            <button
              onClick={() =>
                onCreateGame(roundNumber, pairing._id)
              }
              disabled={isPairingLoading}
              title="Create real Lichess match for this pairing"
              className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition w-full sm:w-auto min-h-[40px] cursor-pointer"
            >
              {isPairingLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>CREATING GAME...</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  <span>CREATE LICHESS GAME</span>
                </>
              )}
            </button>
          ) : (
            <span
              className="inline-flex items-center justify-center px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-medium w-full sm:w-auto min-h-[36px]"
              title="Game not created yet by participants or host"
            >
              Awaiting Game
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PairingCard;
