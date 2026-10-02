import React from 'react';
import { Trophy } from 'lucide-react';

/**
 * StandingsTable — renders the live tournament standings table.
 *
 * Props:
 * @param {Array}  standings     – Array of standing entries
 * @param {Array}  rounds        – Array of tournament rounds (used for "After Round N" badge)
 * @param {string} currentUserId – Currently authenticated user ID (for "You" highlight)
 */
const StandingsTable = ({
  standings = [],
  rounds = [],
  currentUserId,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span>Standings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live tournament standings calculated deterministically from match outcomes and BYEs
          </p>
        </div>
        {rounds.length > 0 && (
          <div className="text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
            After Round {rounds.length}
          </div>
        )}
      </div>

      {standings.length === 0 ? (
        <div className="p-6 sm:p-8 text-center">
          <Trophy className="h-6 w-6 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">
            No standings available yet. Standings will populate as players register and matches conclude.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 text-xs text-slate-400 uppercase font-semibold border-b border-slate-100">
              <tr>
                <th className="px-2.5 sm:px-6 py-3 w-10 sm:w-16 text-center">Rank</th>
                <th className="px-2.5 sm:px-6 py-3">Player</th>
                <th className="hidden sm:table-cell px-6 py-3">Lichess</th>
                <th className="px-2.5 sm:px-6 py-3 text-center">Score</th>
                <th className="hidden sm:table-cell px-4 py-3 text-center">W</th>
                <th className="hidden sm:table-cell px-4 py-3 text-center">D</th>
                <th className="hidden sm:table-cell px-4 py-3 text-center">L</th>
                <th className="hidden sm:table-cell px-6 py-3 text-center">Games</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {standings.map((entry) => {
                const isCurrent =
                  currentUserId &&
                  (entry.playerId === currentUserId ||
                    entry.playerId?._id === currentUserId);

                return (
                  <tr
                    key={entry.playerId}
                    className={`hover:bg-slate-50/80 transition ${
                      isCurrent ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-2.5 sm:px-6 py-3 sm:py-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center font-bold text-xs rounded-full w-6 h-6 shrink-0 ${
                          entry.rank === 1
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : entry.rank === 2
                            ? 'bg-slate-200 text-slate-700 border border-slate-300'
                            : entry.rank === 3
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'text-slate-400 font-mono'
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>

                    {/* Player Info */}
                    <td className="px-2.5 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
                        {entry.avatar ? (
                          <img
                            src={entry.avatar}
                            alt={entry.name}
                            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border border-slate-200 object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200 shrink-0">
                            {(entry.name || 'P')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 flex items-center space-x-1.5 flex-wrap">
                            <span className="truncate" title={entry.name}>
                              {entry.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          {entry.email && (
                            <div className="text-xs sm:text-[11px] text-slate-400 truncate">{entry.email}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Lichess Username (hidden on mobile, restored on sm+) */}
                    <td className="hidden sm:table-cell px-6 py-4 text-xs font-mono text-indigo-600">
                      {entry.lichessUsername ? `@${entry.lichessUsername}` : '—'}
                    </td>

                    {/* Score */}
                    <td className="px-2.5 sm:px-6 py-3 sm:py-4 text-center font-bold text-slate-900 text-xs sm:text-sm">
                      <span className="px-2 sm:px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 font-mono whitespace-nowrap">
                        {entry.score} pts
                      </span>
                    </td>

                    {/* W (hidden on mobile, restored on sm+) */}
                    <td className="hidden sm:table-cell px-4 py-4 text-center font-semibold text-emerald-600 text-xs">
                      {entry.wins}
                    </td>

                    {/* D (hidden on mobile, restored on sm+) */}
                    <td className="hidden sm:table-cell px-4 py-4 text-center font-semibold text-slate-500 text-xs">
                      {entry.draws}
                    </td>

                    {/* L (hidden on mobile, restored on sm+) */}
                    <td className="hidden sm:table-cell px-4 py-4 text-center font-semibold text-rose-500 text-xs">
                      {entry.losses}
                    </td>

                    {/* Games (hidden on mobile, restored on sm+) */}
                    <td className="hidden sm:table-cell px-6 py-4 text-center text-xs text-slate-500 font-medium">
                      {entry.completedGames ?? entry.gamesPlayed ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StandingsTable;
