import React from 'react';
import { Trophy, Medal, Crown, TrendingUp, Minus } from 'lucide-react';

const TeamStandingTable = ({ standings = [], loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-4" />
        <div className="space-y-3 max-w-2xl mx-auto">
          <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
        <Trophy className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          No Standings Available
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Standings will be automatically calculated as matches reach final completed results.
        </p>
      </div>
    );
  }

  const getRankBadge = (rank) => {
    switch (rank) {
      case 1:
        return (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 font-black text-xs shadow-xs border border-amber-300/60 dark:border-amber-700/60">
            <Medal className="w-4 h-4 text-amber-500 mr-0.5" />
            1
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-black text-xs border border-slate-300 dark:border-slate-700">
            <Medal className="w-4 h-4 text-slate-400 mr-0.5" />
            2
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-800/10 text-amber-900 dark:bg-amber-950/40 dark:text-amber-400 font-black text-xs border border-amber-700/30">
            <Medal className="w-4 h-4 text-amber-700 mr-0.5" />
            3
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-bold text-xs">
            {rank}
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Table Header Note */}
      <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Official Competition Standings</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ranked by: 1. Match Points (3/1/0) • 2. Board Points • 3. Score Difference • 4. Team Name
          </p>
        </div>
        <div className="text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full self-start sm:self-auto">
          Deterministic Scoring V4
        </div>
      </div>

      {/* Responsive Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider">
              <th scope="col" className="py-3.5 pl-4 sm:pl-6 pr-2 w-14 text-center">
                Rank
              </th>
              <th scope="col" className="py-3.5 px-3">
                Squad / Team
              </th>
              <th scope="col" className="py-3.5 px-2.5 text-center" title="Matches Played">
                P
              </th>
              <th scope="col" className="py-3.5 px-2.5 text-center text-emerald-600 dark:text-emerald-400" title="Wins">
                W
              </th>
              <th scope="col" className="py-3.5 px-2.5 text-center text-slate-500" title="Draws">
                D
              </th>
              <th scope="col" className="py-3.5 px-2.5 text-center text-rose-500" title="Losses">
                L
              </th>
              <th scope="col" className="py-3.5 px-3 text-center" title="Board Points For">
                Board Pts
              </th>
              <th scope="col" className="py-3.5 px-3 text-center" title="Score Difference (Board Points For - Against)">
                Diff
              </th>
              <th scope="col" className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black">
                  Match Pts
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
            {standings.map((entry) => {
              const diff = entry.scoreDifference || 0;
              const diffText = diff > 0 ? `+${diff}` : `${diff}`;
              const diffColor =
                diff > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : diff < 0
                  ? 'text-rose-500 dark:text-rose-400'
                  : 'text-slate-400';

              return (
                <tr
                  key={entry.teamId || entry.team?._id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Rank */}
                  <td className="py-4 pl-4 sm:pl-6 pr-2 text-center">
                    {getRankBadge(entry.rank)}
                  </td>

                  {/* Team Name & Captain */}
                  <td className="py-4 px-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {(entry.name || entry.team?.name || 'T').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {entry.name || entry.team?.name}
                        </div>
                        {entry.team?.captain?.name && (
                          <div className="flex items-center space-x-1 text-[11px] text-slate-400 truncate">
                            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Capt: {entry.team.captain.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Played */}
                  <td className="py-4 px-2.5 text-center font-bold text-slate-800 dark:text-slate-200">
                    {entry.played}
                  </td>

                  {/* Wins */}
                  <td className="py-4 px-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                    {entry.wins}
                  </td>

                  {/* Draws */}
                  <td className="py-4 px-2.5 text-center font-bold text-slate-500">
                    {entry.draws}
                  </td>

                  {/* Losses */}
                  <td className="py-4 px-2.5 text-center font-bold text-rose-500">
                    {entry.losses}
                  </td>

                  {/* Board Points */}
                  <td className="py-4 px-3 text-center font-extrabold text-slate-900 dark:text-white">
                    {entry.boardPoints !== undefined ? entry.boardPoints : entry.boardPointsFor || 0}
                  </td>

                  {/* Score Difference */}
                  <td className={`py-4 px-3 text-center font-black ${diffColor}`}>
                    {diffText}
                  </td>

                  {/* Match Points */}
                  <td className="py-4 pr-4 sm:pr-6 pl-3 text-right">
                    <span className="inline-flex items-center px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-black text-sm">
                      {entry.matchPoints}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamStandingTable;
