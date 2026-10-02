import React from 'react';
import { Swords, Trophy, RefreshCw, ExternalLink } from 'lucide-react';

/**
 * MyPairingCard — renders the active user's current pairing, opponent details,
 * game outcome banners, rematch controls, and Lichess game links.
 *
 * Props:
 * @param {Object}   myCurrentPairing – User's active pairing data
 * @param {Object}   currentStanding  – User's current tournament standing (score, rank)
 * @param {Object}   rematchLoading   – Map of pairingId -> boolean loading state
 * @param {Object}   syncLoading      – Map of pairingId -> boolean loading state
 * @param {Function} onRematch        – (roundNumber, pairingId) => void
 * @param {Function} onSyncResult     – (roundNumber, pairingId) => void
 */
const MyPairingCard = ({
  myCurrentPairing,
  currentStanding,
  rematchLoading = {},
  syncLoading = {},
  onRematch,
  onSyncResult,
}) => {
  if (!myCurrentPairing) return null;

  const p = myCurrentPairing.pairing;
  const isWhite = myCurrentPairing.isWhite;
  const opponent = myCurrentPairing.opponent;
  const isAborted = p.status === 'ABORTED' || p.result === 'ABORTED';
  const isFinished = p.status === 'FINISHED' || ['1-0', '0-1', '1/2-1/2'].includes(p.result);

  let resultLabel = null;
  let pointDelta = null;
  let bannerStyle = '';

  if (isFinished) {
    if (p.result === '1-0') {
      resultLabel = isWhite ? 'YOU WON' : 'GAME LOST';
      pointDelta = isWhite ? '+1 POINT' : '+0 POINTS';
      bannerStyle = isWhite
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200';
    } else if (p.result === '0-1') {
      resultLabel = !isWhite ? 'YOU WON' : 'GAME LOST';
      pointDelta = !isWhite ? '+1 POINT' : '+0 POINTS';
      bannerStyle = !isWhite
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200';
    } else if (p.result === '1/2-1/2') {
      resultLabel = 'DRAW';
      pointDelta = '+0.5 POINT';
      bannerStyle = 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Swords className="h-5 w-5 text-amber-400" />
          <span className="font-extrabold text-sm tracking-wide">
            YOUR PAIRING — {myCurrentPairing.stageName || `Round ${myCurrentPairing.roundNumber}`}
          </span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className="text-slate-300">
            Tournament Score:{' '}
            <span className="font-bold text-amber-400 font-mono">
              {currentStanding?.score ?? 0} pts
            </span>
          </span>
          {currentStanding?.rank && (
            <span className="text-slate-300">
              Current Position:{' '}
              <span className="font-bold text-white">#{currentStanding.rank}</span>
            </span>
          )}
        </div>
      </div>

      <div className="p-3.5 sm:p-5">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                Opponent
              </div>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>{opponent?.name || 'Opponent'}</span>
                {opponent?.lichessUsername && (
                  <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    (@{opponent.lichessUsername})
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                You are playing as{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{isWhite ? 'White ♔' : 'Black ♚'}</span>
              </div>
            </div>

            {isFinished && resultLabel && (
              <div className={`p-3 rounded-lg border flex items-center space-x-3 ${bannerStyle}`}>
                <Trophy className="h-5 w-5 shrink-0" />
                <div>
                  <div className="text-xs sm:text-[10px] font-bold uppercase tracking-wider">
                    GAME COMPLETE
                  </div>
                  <div className="text-sm font-extrabold flex items-center space-x-2">
                    <span>{resultLabel}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 font-mono shadow-2xs">
                      {pointDelta}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {isAborted && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    GAME ABORTED
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    No tournament result was recorded. Request a rematch below.
                  </div>
                </div>
                <button
                  onClick={() => onRematch && onRematch(myCurrentPairing.roundNumber, p._id)}
                  disabled={Boolean(rematchLoading[p._id])}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 min-h-[40px] cursor-pointer"
                >
                  {Boolean(rematchLoading[p._id]) ? 'REMATCHING...' : 'REMATCH'}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Status:</span>
              <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                {p.status}
              </span>
              {p.result && p.result !== 'PENDING' && (
                <span className="font-bold text-xs text-indigo-700 dark:text-indigo-300 font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
                  {p.result}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full sm:w-auto">
              {p.lichessGameId && (
                <>
                  <button
                    onClick={() =>
                      onSyncResult && onSyncResult(myCurrentPairing.roundNumber, p._id)
                    }
                    disabled={Boolean(syncLoading[p._id])}
                    className="inline-flex items-center justify-center space-x-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition min-h-[40px] w-full sm:w-auto cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>SYNC RESULT</span>
                  </button>
                  <a
                    href={p.lichessGameUrl || `https://lichess.org/${p.lichessGameId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition min-h-[40px] w-full sm:w-auto"
                  >
                    <span>PLAY ON LICHESS</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPairingCard;
