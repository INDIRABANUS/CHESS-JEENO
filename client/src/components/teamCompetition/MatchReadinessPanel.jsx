import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  AlertCircle,
  Crown,
  Users,
} from 'lucide-react';

const MatchReadinessPanel = ({ match, boards = [] }) => {
  if (!match) return null;

  const boardCount = match.boardCount || boards.length;

  // Calculate Team A stats
  const teamAFilledCount = boards.filter((b) => Boolean(b.teamAPlayer)).length;
  const teamAReadyCount = boards.filter((b) => Boolean(b.teamAPlayer) && Boolean(b.teamAReady)).length;
  const teamAIsComplete = teamAFilledCount === boardCount;
  const teamAAllReady = teamAReadyCount === boardCount;
  const teamALocked = Boolean(match.teamALineupLocked);

  // Calculate Team B stats
  const teamBFilledCount = boards.filter((b) => Boolean(b.teamBPlayer)).length;
  const teamBReadyCount = boards.filter((b) => Boolean(b.teamBPlayer) && Boolean(b.teamBReady)).length;
  const teamBIsComplete = teamBFilledCount === boardCount;
  const teamBAllReady = teamBReadyCount === boardCount;
  const teamBLocked = Boolean(match.teamBLineupLocked);

  const isMatchReady = match.status === 'READY';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <span>Match Readiness & Two-Level Verification</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Both teams must fill all boards, confirm player readiness, and have their captains lock the lineup.
          </p>
        </div>

        <div>
          {isMatchReady ? (
            <span className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-500 text-white shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>MATCH READY</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>{match.status === 'DRAFT' ? 'DRAFT PHASE' : 'AWAITING LOCKS'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Two Team Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team A Card */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                  A
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base">
                  {match.teamA?.name}
                </h4>
              </div>
              {teamALocked ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  <Lock className="h-3 w-3" />
                  <span>Locked</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                  <Unlock className="h-3 w-3" />
                  <span>Unlocked</span>
                </span>
              )}
            </div>

            {/* Checklist */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Board Positions:</span>
                <span className={`font-semibold ${teamAIsComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                  {teamAFilledCount} / {boardCount} filled
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Player Readiness:</span>
                <span className={`font-semibold ${teamAAllReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                  {teamAReadyCount} / {boardCount} ready
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Captain Confirmation:</span>
                <span className={`font-semibold ${teamALocked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  {teamALocked ? 'Confirmed & Locked' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Team B Card */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-violet-600 text-white font-extrabold text-xs flex items-center justify-center">
                  B
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base">
                  {match.teamB?.name}
                </h4>
              </div>
              {teamBLocked ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  <Lock className="h-3 w-3" />
                  <span>Locked</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                  <Unlock className="h-3 w-3" />
                  <span>Unlocked</span>
                </span>
              )}
            </div>

            {/* Checklist */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Board Positions:</span>
                <span className={`font-semibold ${teamBIsComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                  {teamBFilledCount} / {boardCount} filled
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Player Readiness:</span>
                <span className={`font-semibold ${teamBAllReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                  {teamBReadyCount} / {boardCount} ready
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Captain Confirmation:</span>
                <span className={`font-semibold ${teamBLocked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  {teamBLocked ? 'Confirmed & Locked' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div className="mt-5 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs flex items-center space-x-3">
        {isMatchReady ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        ) : (
          <Clock className="h-5 w-5 text-indigo-500 shrink-0" />
        )}
        <div className="text-slate-700 dark:text-slate-300">
          {isMatchReady ? (
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              Both team captains have completed and locked their board lineups. The match is fully READY!
            </span>
          ) : (
            <span>
              The match will transition to <strong className="text-indigo-600 dark:text-indigo-400">READY</strong> automatically once both team captains have filled all boards, ensured player readiness, and locked their respective lineups.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchReadinessPanel;
