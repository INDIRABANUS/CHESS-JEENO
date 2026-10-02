import React from 'react';
import { Trophy } from 'lucide-react';

/**
 * KnockoutBracket — renders the visual stage-by-stage progression grid
 * for single-elimination / knockout tournaments.
 *
 * Props:
 * @param {Array} rounds – Array of round objects containing stageName, pairings, etc.
 */
const KnockoutBracket = ({ rounds = [] }) => {
  if (!rounds || rounds.length === 0) return null;

  return (
    <div className="p-3.5 sm:p-6 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
        <Trophy className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span>Knockout Bracket Progression</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-2">
        {rounds.map((r) => {
          const stageTitle =
            r.stageName || (r.pairings?.length === 1 ? 'Final' : `Round ${r.roundNumber}`);
          return (
            <div
              key={r._id}
              className="bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs p-3 flex flex-col justify-between"
            >
              <div className="border-b border-slate-100 dark:border-slate-700 pb-2 mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  {stageTitle}
                </span>
                <span className="text-xs sm:text-[10px] text-slate-400 dark:text-slate-400 font-medium">
                  {r.pairings?.length || 0} match(es)
                </span>
              </div>
              <div className="space-y-2">
                {r.pairings?.map((p, mIdx) => {
                  const wWinner =
                    p.result === '1-0' ||
                    p.result === 'WHITE_WIN' ||
                    p.status === 'BYE' ||
                    p.result === 'BYE';
                  const bWinner =
                    p.result === '0-1' || p.result === 'BLACK_WIN';
                  return (
                    <div
                      key={p._id || mIdx}
                      className="bg-slate-50/80 dark:bg-slate-900/70 rounded border border-slate-200 dark:border-slate-700 p-2 text-xs space-y-1"
                    >
                      {/* White player slot */}
                      <div
                        className={`flex items-center justify-between px-1 py-0.5 rounded ${
                          wWinner
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate max-w-[130px]">
                          {p.whitePlayer?.name || 'Player'}
                        </span>
                        <span className="font-mono text-[11px] font-bold">
                          {p.status === 'BYE' || p.result === 'BYE'
                            ? 'BYE'
                            : p.result === '1-0'
                            ? '1'
                            : p.result === '0-1'
                            ? '0'
                            : p.result === '1/2-1/2'
                            ? '½'
                            : '—'}
                        </span>
                      </div>
                      {/* Black player slot */}
                      <div
                        className={`flex items-center justify-between px-1 py-0.5 rounded ${
                          bWinner
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate max-w-[130px] italic text-slate-500 dark:text-slate-400">
                          {p.status === 'BYE' || !p.blackPlayer
                            ? 'BYE (Advances)'
                            : p.blackPlayer?.name || 'Player'}
                        </span>
                        <span className="font-mono text-[11px] font-bold">
                          {p.status === 'BYE' || !p.blackPlayer
                            ? ''
                            : p.result === '0-1'
                            ? '1'
                            : p.result === '1-0'
                            ? '0'
                            : p.result === '1/2-1/2'
                            ? '½'
                            : '—'}
                        </span>
                      </div>
                      {(wWinner || bWinner) && (
                        <div className="text-xs sm:text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold pt-1 border-t border-slate-200/60 dark:border-slate-700 flex items-center space-x-1">
                          <span>
                            Winner:{' '}
                            {wWinner
                              ? p.whitePlayer?.name || 'White'
                              : p.blackPlayer?.name || 'Black'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KnockoutBracket;
