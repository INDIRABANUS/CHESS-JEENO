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
    <div className="p-6 bg-slate-50/70 border-b border-slate-200">
      <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
        <Trophy className="h-4 w-4 text-indigo-600" />
        <span>Knockout Bracket Progression</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-2">
        {rounds.map((r) => {
          const stageTitle =
            r.stageName || (r.pairings?.length === 1 ? 'Final' : `Round ${r.roundNumber}`);
          return (
            <div
              key={r._id}
              className="bg-white rounded-lg border border-slate-200 shadow-xs p-3 flex flex-col justify-between"
            >
              <div className="border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {stageTitle}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
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
                      className="bg-slate-50/80 rounded border border-slate-200 p-2 text-xs space-y-1"
                    >
                      {/* White player slot */}
                      <div
                        className={`flex items-center justify-between px-1 py-0.5 rounded ${
                          wWinner
                            ? 'bg-emerald-50 text-emerald-900 font-bold'
                            : 'text-slate-700'
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
                            ? 'bg-emerald-50 text-emerald-900 font-bold'
                            : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate max-w-[130px] italic text-slate-500">
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
                        <div className="text-[10px] text-emerald-700 font-semibold pt-1 border-t border-slate-200/60 flex items-center space-x-1">
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
