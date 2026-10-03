import React from 'react';
import { Award, Medal, CheckCircle2, Swords } from 'lucide-react';

/**
 * MyTournamentResultCard — renders the personal tournament result for an authenticated participant.
 * If current user did not participate, returns null.
 *
 * Props:
 * @param {Array}  standings     – Final standings array
 * @param {string} currentUserId – ID of the current authenticated user
 * @param {Object} tournament    – Tournament document
 */
const MyTournamentResultCard = ({
  standings = [],
  currentUserId,
  tournament,
}) => {
  if (!currentUserId || !standings || standings.length === 0) {
    return null;
  }

  const myIdStr = currentUserId.toString();
  const userStanding = standings.find((s) => {
    const sId = (s.playerId?._id || s.playerId?.id || s.playerId)?.toString();
    return sId && sId === myIdStr;
  });

  // If user is not an approved participant in standings, do NOT display this section
  if (!userStanding) {
    return null;
  }

  const isWinner = userStanding.rank === 1;
  const isPodium = userStanding.rank <= 3;
  const totalGames = userStanding.completedGames ?? userStanding.gamesPlayed ?? 0;

  return (
    <div className={`p-4 sm:p-5 rounded-xl border shadow-xs transition-colors ${
      isWinner
        ? 'bg-gradient-to-r from-amber-500/15 via-yellow-400/20 to-amber-500/10 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-amber-950/30 border-amber-300 dark:border-amber-700'
        : isPodium
        ? 'bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-indigo-950/30 border-indigo-200 dark:border-indigo-800'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        {/* Left: Rank & Title */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className={`p-2.5 rounded-lg flex-shrink-0 ${
            isWinner
              ? 'bg-amber-500 text-white'
              : isPodium
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            {isWinner ? (
              <Award className="h-5 w-5 sm:h-6 sm:w-6" />
            ) : (
              <Medal className="h-5 w-5 sm:h-6 sm:w-6" />
            )}
          </div>

          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Your Result
            </div>
            <div className="flex items-baseline space-x-2 flex-wrap">
              <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                #{userStanding.rank}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                of {standings.length} {standings.length === 1 ? 'Player' : 'Players'}
              </span>
              {isWinner && (
                <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-700">
                  🏆 Champion
                </span>
              )}
              {userStanding.rank === 2 && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded">
                  🥈 2nd Place
                </span>
              )}
              {userStanding.rank === 3 && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded">
                  🥉 3rd Place
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Score and W/D/L Breakdown */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          {/* Points */}
          <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg border border-indigo-100 dark:border-indigo-800 font-mono">
            {userStanding.score} {userStanding.score === 1 ? 'point' : 'points'}
          </div>

          {/* Record */}
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{userStanding.wins}W</span>
            <span className="mx-1 text-slate-400">·</span>
            <span className="font-semibold text-slate-600 dark:text-slate-400">{userStanding.draws}D</span>
            <span className="mx-1 text-slate-400">·</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">{userStanding.losses}L</span>
          </div>

          {/* Games played */}
          <div className="px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400">
            {totalGames} {totalGames === 1 ? 'game' : 'games'} played
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyTournamentResultCard;
