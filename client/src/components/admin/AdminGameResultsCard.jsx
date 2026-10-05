import React from 'react';
import { Swords, CheckCircle2, AlertTriangle, Crown, Minus } from 'lucide-react';

/**
 * AdminGameResultsCard — Displays game outcome distribution, win rates, and completion breakdown.
 * 
 * @param {Object} props
 * @param {Object} props.games - Game statistics object
 * @param {number} props.games.totalGames
 * @param {number} props.games.completedGames
 * @param {number} props.games.abortedGames
 * @param {number} props.games.whiteWins
 * @param {number} props.games.blackWins
 * @param {number} props.games.draws
 */
const AdminGameResultsCard = ({ games = {} }) => {
  const {
    totalGames = 0,
    completedGames = 0,
    abortedGames = 0,
    whiteWins = 0,
    blackWins = 0,
    draws = 0,
  } = games;

  const totalDecisive = whiteWins + blackWins + draws;
  const whiteWinPct = totalDecisive > 0 ? ((whiteWins / totalDecisive) * 100).toFixed(1) : '0.0';
  const blackWinPct = totalDecisive > 0 ? ((blackWins / totalDecisive) * 100).toFixed(1) : '0.0';
  const drawPct = totalDecisive > 0 ? ((draws / totalDecisive) * 100).toFixed(1) : '0.0';

  const completionRate = totalGames > 0 ? ((completedGames / totalGames) * 100).toFixed(1) : '0.0';
  const abortRate = totalGames > 0 ? ((abortedGames / totalGames) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Game Outcomes & Pairings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Completed matches, aborted games, and piece color win distribution
            </p>
          </div>
        </div>

        {totalGames === 0 ? (
          <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
            No games recorded yet on the platform.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Completed Games</span>
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {completedGames.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {completionRate}% of all pairings
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Aborted Games</span>
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {abortedGames.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {abortRate}% abort rate
                </div>
              </div>
            </div>

            {/* Decisive Outcomes Bar */}
            {totalDecisive > 0 && (
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <span>Match Outcomes Distribution</span>
                  <span className="text-slate-400 dark:text-slate-500 font-normal">
                    {totalDecisive.toLocaleString()} decided matches
                  </span>
                </div>

                <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${whiteWinPct}%` }}
                    title={`White Wins: ${whiteWins} (${whiteWinPct}%)`}
                  />
                  <div
                    className="bg-slate-400 dark:bg-slate-600 h-full transition-all duration-300"
                    style={{ width: `${drawPct}%` }}
                    title={`Draws: ${draws} (${drawPct}%)`}
                  />
                  <div
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${blackWinPct}%` }}
                    title={`Black Wins: ${blackWins} (${blackWinPct}%)`}
                  />
                </div>

                {/* Outcome Badges */}
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="p-2.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                    <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center justify-center space-x-1">
                      <Crown className="h-3 w-3" />
                      <span>White Wins</span>
                    </div>
                    <div className="text-lg font-bold text-indigo-950 dark:text-indigo-200 mt-0.5">
                      {whiteWins.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
                      {whiteWinPct}%
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center space-x-1">
                      <Minus className="h-3 w-3" />
                      <span>Draws</span>
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {draws.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {drawPct}%
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                    <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center justify-center space-x-1">
                      <Crown className="h-3 w-3" />
                      <span>Black Wins</span>
                    </div>
                    <div className="text-lg font-bold text-amber-950 dark:text-amber-200 mt-0.5">
                      {blackWins.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400">
                      {blackWinPct}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Total */}
      <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <span>Total Pairings Evaluated</span>
        <span className="font-bold text-slate-800 dark:text-slate-200">{totalGames.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default AdminGameResultsCard;
