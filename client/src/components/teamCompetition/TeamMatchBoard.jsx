import React from 'react';
import { CheckCircle2, Clock, User, ShieldCheck, Check, X, Loader2 } from 'lucide-react';

const TeamMatchBoard = ({
  board,
  teamAName = 'Team A',
  teamBName = 'Team B',
  currentUserId,
  onToggleReady,
  actionLoading = false,
  isLocked = false,
}) => {
  const isUserPlayerA = currentUserId && board.teamAPlayer?._id === currentUserId;
  const isUserPlayerB = currentUserId && board.teamBPlayer?._id === currentUserId;
  const isUserAssigned = isUserPlayerA || isUserPlayerB;

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isUserAssigned
          ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
      }`}
    >
      {/* Board Number Header */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-extrabold uppercase tracking-wide">
            Board {board.boardNumber}
          </span>
          {isUserAssigned && (
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-semibold text-[11px]">
              Your Board
            </span>
          )}
        </div>
        {board.locked && (
          <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Board Confirmed</span>
          </span>
        )}
      </div>

      {/* Main Board Lineup: Player A vs Player B */}
      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-11 items-center gap-4">
        {/* Team A Player (cols 1-5) */}
        <div className="md:col-span-5 flex flex-col space-y-2">
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {teamAName} (White)
          </div>
          {board.teamAPlayer ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center shrink-0">
                  {board.teamAPlayer.avatar ? (
                    <img
                      src={board.teamAPlayer.avatar}
                      alt={board.teamAPlayer.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>{board.teamAPlayer.name?.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {board.teamAPlayer.name}
                  </div>
                  {board.teamAPlayer.lichessUsername && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      @{board.teamAPlayer.lichessUsername}
                    </div>
                  )}
                </div>
              </div>

              {/* Ready Badge & User Action */}
              <div className="flex items-center space-x-2 shrink-0">
                {board.teamAReady ? (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Ready</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Pending</span>
                  </span>
                )}

                {isUserPlayerA && !isLocked && onToggleReady && (
                  <button
                    onClick={() => onToggleReady(board.boardNumber, !board.teamAReady)}
                    disabled={actionLoading}
                    className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                      board.teamAReady
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : board.teamAReady ? (
                      'Set Not Ready'
                    ) : (
                      'I Am Ready'
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
              Lineup unassigned
            </div>
          )}
        </div>

        {/* VS Indicator (col 6) */}
        <div className="md:col-span-1 flex justify-center py-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
            VS
          </span>
        </div>

        {/* Team B Player (cols 7-11) */}
        <div className="md:col-span-5 flex flex-col space-y-2">
          <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider md:text-right">
            {teamBName} (Black)
          </div>
          {board.teamBPlayer ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 md:flex-row-reverse">
              <div className="flex items-center space-x-3 min-w-0 md:flex-row-reverse md:space-x-reverse">
                <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-bold flex items-center justify-center shrink-0">
                  {board.teamBPlayer.avatar ? (
                    <img
                      src={board.teamBPlayer.avatar}
                      alt={board.teamBPlayer.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>{board.teamBPlayer.name?.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 md:text-right">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {board.teamBPlayer.name}
                  </div>
                  {board.teamBPlayer.lichessUsername && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      @{board.teamBPlayer.lichessUsername}
                    </div>
                  )}
                </div>
              </div>

              {/* Ready Badge & User Action */}
              <div className="flex items-center space-x-2 shrink-0 md:flex-row-reverse md:space-x-reverse">
                {board.teamBReady ? (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Ready</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Pending</span>
                  </span>
                )}

                {isUserPlayerB && !isLocked && onToggleReady && (
                  <button
                    onClick={() => onToggleReady(board.boardNumber, !board.teamBReady)}
                    disabled={actionLoading}
                    className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                      board.teamBReady
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : board.teamBReady ? (
                      'Set Not Ready'
                    ) : (
                      'I Am Ready'
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
              Lineup unassigned
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamMatchBoard;
