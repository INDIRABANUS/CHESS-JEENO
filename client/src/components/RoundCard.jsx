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
  onCreateAllGames,
  onCreateGame,
  onSyncResult,
  onRematch,
}) => {
  const roundPairings = round.pairings || [];
  const hasPendingGames = roundPairings.some(
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
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40">
      {/* Round Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-slate-900 text-base">
            {round.stageName
              ? `${round.stageName} (Round ${round.roundNumber})`
              : `Round ${round.roundNumber}`}
          </span>
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
              isRoundDone
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isRoundDone ? 'FINISHED' : 'IN PROGRESS'}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {completedGamesCount} / {roundPairings.length} games complete
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-500 font-medium">
            {round.pairings?.length || 0} Match(es)
          </span>

          {/* CREATE ALL LICHESS GAMES Button */}
          {hasPendingGames && (
            <button
              onClick={() => onCreateAllGames && onCreateAllGames(round.roundNumber)}
              disabled={isRoundBulkLoading}
              title="Create Lichess games for all eligible pairings in this round"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
            >
              {isRoundBulkLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  <span>CREATING GAMES...</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 text-indigo-600" />
                  <span>CREATE ALL LICHESS GAMES</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* BYE Player Notice (if any) */}
      {round.byePlayer && (
        <div className="mx-4 mt-3 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between text-xs text-indigo-900">
          <span className="font-medium">
            Player on BYE: <span className="font-bold">{round.byePlayer.name}</span>
            {round.byePlayer.lichessUsername && (
              <span className="font-mono text-indigo-600 ml-1">
                (@{round.byePlayer.lichessUsername})
              </span>
            )}
          </span>
          <span className="text-[11px] bg-white text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200">
            BYE
          </span>
        </div>
      )}

      {/* Pairings List */}
      <div className="p-4">
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
                onCreateGame={onCreateGame}
                onSyncResult={onSyncResult}
                onRematch={onRematch}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic text-center py-2">
            No matches scheduled for this round.
          </p>
        )}
      </div>
    </div>
  );
};

export default RoundCard;
