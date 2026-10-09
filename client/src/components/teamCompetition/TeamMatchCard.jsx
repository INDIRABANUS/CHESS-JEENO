import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  ChevronRight,
  Layers,
  Crown,
} from 'lucide-react';

const getMatchStatusBadge = (status, scoringStatus) => {
  if (status === 'COMPLETED') {
    if (scoringStatus === 'REVIEW_REQUIRED') {
      return {
        bg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700',
        label: 'Review Required',
      };
    }
    if (scoringStatus === 'FINAL') {
      return {
        bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700',
        label: 'Final',
      };
    }
    return {
      bg: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700',
      label: 'Completed',
    };
  }

  switch (status) {
    case 'IN_PROGRESS':
      return {
        bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        label: 'In Progress',
      };
    case 'READY':
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        label: 'Ready',
      };
    case 'LINEUP':
      return {
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
        label: 'Lineup Phase',
      };
    case 'DRAFT':
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        label: 'Draft',
      };
    case 'CANCELLED':
      return {
        bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
        label: 'Cancelled',
      };
    default:
      return {
        bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        label: status || 'Pending',
      };
  }
};

const TeamMatchCard = ({ match, competitionId }) => {
  const statusBadge = getMatchStatusBadge(match.status, match.scoringStatus);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      {/* Top Header: Round info & status */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
            {match.round?.name || `Round ${match.round?.roundNumber || ''}`}
          </span>
          <span className="inline-flex items-center space-x-1">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            <span>{match.boardCount} {match.boardCount === 1 ? 'Board' : 'Boards'}</span>
          </span>
        </div>
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full border ${statusBadge.bg}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* Teams Matchup Center Section */}
      <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-4 py-2 border-y border-slate-100 dark:border-slate-800/80 my-2">
        {/* Team A */}
        <div className="md:col-span-2 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            {match.teamA?.name ? match.teamA.name.slice(0, 2).toUpperCase() : 'TA'}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 dark:text-white text-base truncate">
              {match.teamA?.name || 'Team A'}
            </h4>
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <Crown className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="truncate">Capt: {match.teamA?.captain?.name || 'Captain'}</span>
            </div>
          </div>
        </div>

        {/* VS / Score Separator */}
        <div className="md:col-span-1 flex flex-col items-center justify-center py-1">
          {match.scoringStatus === 'FINAL' ? (
            <>
              <div className="flex items-center space-x-2 px-3 py-1 rounded-xl bg-slate-900 text-white dark:bg-slate-800 text-sm font-black shadow-xs">
                <span>{match.teamAScore ?? 0}</span>
                <span className="text-slate-400 font-bold">-</span>
                <span>{match.teamBScore ?? 0}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                {match.teamAResult === 'WIN'
                  ? `${match.teamA?.name?.split(' ')[0] || 'Team A'} Won`
                  : match.teamBResult === 'WIN'
                  ? `${match.teamB?.name?.split(' ')[0] || 'Team B'} Won`
                  : 'Draw'}
              </span>
            </>
          ) : match.scoringStatus === 'REVIEW_REQUIRED' ? (
            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              Review Req.
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              VS
            </span>
          )}
        </div>

        {/* Team B */}
        <div className="md:col-span-2 flex items-center space-x-3 md:justify-end">
          <div className="min-w-0 md:text-right order-2 md:order-1">
            <h4 className="font-bold text-slate-900 dark:text-white text-base truncate">
              {match.teamB?.name || 'Team B'}
            </h4>
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 md:justify-end">
              <Crown className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="truncate">Capt: {match.teamB?.captain?.name || 'Captain'}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0 order-1 md:order-2">
            {match.teamB?.name ? match.teamB.name.slice(0, 2).toUpperCase() : 'TB'}
          </div>
        </div>
      </div>

      {/* Lock status & Scheduling */}
      <div className="pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center space-x-1">
            {match.teamALineupLocked ? (
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Unlock className="h-3.5 w-3.5 text-slate-400" />
            )}
            <span className={match.teamALineupLocked ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
              {match.teamA?.name?.split(' ')[0] || 'Team A'} {match.teamALineupLocked ? 'Locked' : 'Open'}
            </span>
          </span>

          <span className="text-slate-300 dark:text-slate-700">•</span>

          <span className="inline-flex items-center space-x-1">
            {match.teamBLineupLocked ? (
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Unlock className="h-3.5 w-3.5 text-slate-400" />
            )}
            <span className={match.teamBLineupLocked ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
              {match.teamB?.name?.split(' ')[0] || 'Team B'} {match.teamBLineupLocked ? 'Locked' : 'Open'}
            </span>
          </span>
        </div>

        {match.scheduledStart && (
          <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
            <span>{new Date(match.scheduledStart).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
        <Link
          to={`/team-competitions/${competitionId}/matches/${match._id}`}
          className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition min-h-[44px]"
        >
          <span>View Match & Lineups</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

export default TeamMatchCard;
