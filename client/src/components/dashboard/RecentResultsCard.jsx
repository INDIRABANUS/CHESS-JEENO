import React from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  ChevronRight,
  History,
  CheckCircle,
  XCircle,
  MinusCircle,
  Swords,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

/**
 * RecentResultsCard — Displays authentic recent match outcomes across tournaments:
 *
 * RECENT RESULTS
 * ✓ Win   vs Player A
 * ✗ Loss  vs Player B
 * ½ Draw  vs Player C
 */
const RecentResultsCard = ({ results = [] }) => {
  return (
    <div
      id="recent-results-card"
      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md p-5 sm:p-6 space-y-4 transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            RECENT RESULTS
          </h3>
        </div>
        {results.length > 0 && (
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
            {results.length} matches
          </span>
        )}
      </div>

      {/* Results List or Empty State */}
      {results && results.length > 0 ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 overflow-hidden">
          {results.map((item, index) => {
            const isWin = item.outcome === 'win';
            const isLoss = item.outcome === 'loss';
            const isDraw = item.outcome === 'draw';

            return (
              <div
                key={item.pairingId || index}
                className="p-3 sm:p-3.5 flex items-center justify-between bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60 transition-colors"
              >
                {/* Left: Outcome Badge & Opponent */}
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  {/* Result Tag (✓ Win, ✗ Loss, ½ Draw) */}
                  <div
                    className={`w-16 sm:w-20 px-2 py-1 rounded-lg font-extrabold text-xs sm:text-sm flex items-center justify-center space-x-1 shrink-0 ${isWin
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : isLoss
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                  >
                    <span className="font-bold">{item.symbol}</span>
                    <span className="tracking-wide">{item.label}</span>
                  </div>

                  {/* Opponent Info */}
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate flex items-center space-x-1.5">
                      <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">
                        vs
                      </span>
                      <span className="truncate">{item.opponent?.name || 'Opponent'}</span>
                      {item.opponent?.lichessUsername && (
                        <span className="hidden sm:inline text-xs font-mono text-indigo-600 dark:text-indigo-400 font-normal">
                          (@{item.opponent.lichessUsername})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.tournamentName}
                      {item.roundNumber ? ` &bull; Round ${item.roundNumber}` : ''}
                    </div>
                  </div>
                </div>

                {/* Right: Score Delta & Game Link */}
                <div className="flex items-center space-x-2 shrink-0">
                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${isWin
                        ? 'bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : isLoss
                          ? 'bg-rose-100/60 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100/60 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                  >
                    {item.pointDelta} pts
                  </span>

                  {item.lichessGameUrl && (
                    <a
                      href={item.lichessGameUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Review game on Lichess"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
          <Swords className="h-6 w-6 mx-auto text-slate-400 dark:text-slate-500" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">No completed matches yet</p>
          <p className="text-[11px] max-w-xs mx-auto text-slate-500 dark:text-slate-400">
            As you play and complete games in tournaments, your match results, scores, and links to Lichess games will be recorded here.
          </p>
        </div>
      )}
    </div>
  );
};

export default RecentResultsCard;
