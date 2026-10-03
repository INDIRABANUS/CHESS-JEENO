import React from 'react';
import { Loader2, Zap } from 'lucide-react';
import PairingCard from './PairingCard';

/**
 * RoundCard — renders a single tournament round, including its header,
 * status badge, bulk game creation button, BYE notice, and pairings.
 *
 * Props:
 * @param {Object}   round              – The round data object
 * @param {string}   currentUserId      – Authenticated user's ID
 * @param {boolean}  isHost             – Whether current user is host
 * @param {Object}   roundBulkLoading   – Map of roundNumber → boolean loading state
 * @param {Object}   pairingGameLoading – Map of pairingId → boolean loading state
 * @param {Object}   syncLoading        – Map of pairingId → boolean loading state
 * @param {Object}   rematchLoading     – Map of pairingId → boolean loading state
 * @param {Function} onCreateAllGames   – (roundNumber) => void
 * @param {Function} onCreateGame       – (roundNumber, pairingId) => void
 * @param {Function} onSyncResult       – (roundNumber, pairingId) => void
 * @param {Function} onRematch          – (roundNumber, pairingId) => void
 */
const RoundCard = ({
  round,
  currentUserId,
  isHost,
  roundBulkLoading = {},
  pairingGameLoading = {},
  syncLoading = {},
  rematchLoading = {},
  isTournamentComplete = false,
  onCreateAllGames,
  onCreateGame,
  onSyncResult,
  onRematch,
}) => {
  const roundPairings = round.pairings || [];
  const hasPendingGames = !isTournamentComplete && roundPairings.some(
    (p) =>
      !p.lichessGameId &&
      p.status !== 'BYE' &&
      p.result !== 'BYE' &&
      p.blackPlayer &&
      !['FINISHED', 'COMPLETED', 'ABORTED', 'CANCELLED'].includes(p.status)
  );
  const isRoundBulkLoading = Boolean(roundBulkLoading[round.roundNumber]);

  const completedGamesCount = roundPairings.filter((p) =>
    ['FINISHED', 'COMPLETED', 'BYE'].includes(p.status) ||
    ['1-0', '0-1', '1/2-1/2', 'WHITE_WIN', 'BLACK_WIN', 'DRAW', 'BYE'].includes(p.result)
  ).length;
  const isRoundDone =
    roundPairings.length === 0 || completedGamesCount === roundPairings.length;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/40 dark:bg-slate-900/40 transition-colors">
      {/* Round Header */}
      <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <span className="font-bold text-slate-900 dark:text-slate-100 text-base shrink-0">
            {round.stageName
              ? `${round.stageName} (Round ${round.roundNumber})`
              : `Round ${round.roundNumber}`}
          </span>
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${
              isRoundDone
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            }`}
          >
            {isRoundDone ? 'FINISHED' : 'IN PROGRESS'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
            {completedGamesCount} / {roundPairings.length} games complete
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium sm:hidden shrink-0">
            • {round.pairings?.length || 0} Match(es)
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline shrink-0">
            {round.pairings?.length || 0} Match(es)
          </span>

          {/* CREATE ALL LICHESS GAMES Button */}
          {hasPendingGames && (
            <button
              onClick={() => onCreateAllGames && onCreateAllGames(round.roundNumber)}
              disabled={isRoundBulkLoading}
              title="Create Lichess games for all eligible pairings in this round"
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs w-full sm:w-auto min-h-[40px] cursor-pointer"
            >
              {isRoundBulkLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>CREATING GAMES...</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>CREATE ALL LICHESS GAMES</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* BYE Player Notice (if any) */}
      {round.byePlayer && (
        <div className="mx-3.5 sm:mx-4 mt-3 p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 rounded-lg flex items-center justify-between gap-2 text-xs text-indigo-900 dark:text-indigo-200">
          <span className="font-medium min-w-0 truncate">
            Player on BYE: <span className="font-bold">{round.byePlayer.name}</span>
            {round.byePlayer.lichessUsername && (
              <span className="font-mono text-indigo-600 dark:text-indigo-400 ml-1">
                (@{round.byePlayer.lichessUsername})
              </span>
            )}
          </span>
          <span className="text-[11px] bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 shrink-0">
            BYE
          </span>
        </div>
      )}

      {/* Pairings List */}
      <div className="p-3.5 sm:p-4">
        {round.pairings && round.pairings.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {round.pairings.map((pairing, pIdx) => (
              <PairingCard
                key={pairing._id}
                pairing={pairing}
                roundNumber={round.roundNumber}
                boardIndex={pIdx}
                currentUserId={currentUserId}
                isHost={isHost}
                pairingGameLoading={pairingGameLoading}
                syncLoading={syncLoading}
                rematchLoading={rematchLoading}
                isTournamentComplete={isTournamentComplete}
                onCreateGame={onCreateGame}
                onSyncResult={onSyncResult}
                onRematch={onRematch}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-2">
            No matches scheduled for this round.
          </p>
        )}
      </div>
    </div>
  );
};

export default RoundCard;
