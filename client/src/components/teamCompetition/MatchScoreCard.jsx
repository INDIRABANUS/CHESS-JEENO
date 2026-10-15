import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Swords, ChevronRight, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const MatchScoreCard = ({ match, competitionId }) => {
  if (!match) return null;

  const teamA = match.teamA || {};
  const teamB = match.teamB || {};
  const compId = competitionId || match.competition?._id || match.competition;
  const matchId = match.matchId || match._id;

  const isFinal = match.scoringStatus === 'FINAL';
  const isReviewRequired = match.scoringStatus === 'REVIEW_REQUIRED';
  const isCompleted = match.status === 'COMPLETED';

  // Winner logic
  const isDraw = isFinal && match.teamAResult === 'DRAW';
  const teamAWon = isFinal && match.teamAResult === 'WIN';
  const teamBWon = isFinal && match.teamBResult === 'WIN';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-500">
            {match.boardCount || 4} Boards
          </span>
          {match.scheduledStart && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-slate-400 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(match.scheduledStart).toLocaleDateString()}</span>
              </span>
            </>
          )}
        </div>

        {/* Scoring Status Tag */}
        <div>
          {isFinal && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>FINAL</span>
            </span>
          )}
          {isReviewRequired && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>REVIEW REQUIRED</span>
            </span>
          )}
          {!isFinal && !isReviewRequired && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <span>{match.status}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Score & Teams Grid */}
      <div className="grid grid-cols-7 items-center gap-2 sm:gap-4 py-2">
        {/* Team A */}
        <div className="col-span-3 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
            {(teamA.name || 'TA').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h4
              className={`font-black text-sm sm:text-base truncate ${
                teamAWon
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {teamA.name || 'Team A'}
            </h4>
            {teamAWon && (
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <Trophy className="w-3 h-3" />
                <span>Winner (+3 pts)</span>
              </span>
            )}
            {isDraw && (
              <span className="text-[11px] font-bold text-slate-400">
                Draw (+1 pt)
              </span>
            )}
          </div>
        </div>

        {/* Score Display (Center) */}
        <div className="col-span-1 text-center flex flex-col items-center justify-center">
          {isFinal ? (
            <div className="flex items-center justify-center space-x-1 sm:space-x-2 font-black text-lg sm:text-2xl text-slate-900 dark:text-white">
              <span>{match.teamAScore ?? 0}</span>
              <span className="text-slate-300 dark:text-slate-600 font-normal">-</span>
              <span>{match.teamBScore ?? 0}</span>
            </div>
          ) : isReviewRequired ? (
            <div className="text-center">
              <div className="font-extrabold text-sm text-amber-600 dark:text-amber-400">
                {match.teamAScore ?? 0} - {match.teamBScore ?? 0}*
              </div>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                Pending
              </span>
            </div>
          ) : (
            <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center font-black text-xs">
              VS
            </span>
          )}
        </div>

        {/* Team B */}
        <div className="col-span-3 flex items-center space-x-3 justify-end text-right">
          <div className="min-w-0 order-2 sm:order-1">
            <h4
              className={`font-black text-sm sm:text-base truncate ${
                teamBWon
                  ? 'text-violet-600 dark:text-violet-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {teamB.name || 'Team B'}
            </h4>
            {teamBWon && (
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <Trophy className="w-3 h-3" />
                <span>Winner (+3 pts)</span>
              </span>
            )}
            {isDraw && (
              <span className="text-[11px] font-bold text-slate-400">
                Draw (+1 pt)
              </span>
            )}
          </div>
          <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm order-1 sm:order-2">
            {(teamB.name || 'TB').slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Footer Details Link */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {isFinal && (
            <span>
              Match Points: <strong className="text-slate-800 dark:text-slate-200">{match.teamAMatchPoints ?? 0} – {match.teamBMatchPoints ?? 0}</strong>
            </span>
          )}
          {isReviewRequired && (
            <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
              ⚠️ Organizer review required for aborted board(s)
            </span>
          )}
          {!isFinal && !isReviewRequired && (
            <span className="text-slate-400">Scores pending completion</span>
          )}
        </div>

        <Link
          to={`/team-competitions/${compId}/matches/${matchId}`}
          className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition"
        >
          <span>View Match</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default MatchScoreCard;
