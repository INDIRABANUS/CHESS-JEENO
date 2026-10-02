import React from 'react';
import { Clock, Layers, Users, Calendar } from 'lucide-react';
import { formatTimeControl, formatDate } from '../utils/formatters';
import { FORMAT_LABELS } from '../utils/constants';

/**
 * TournamentSpecsGrid — renders the 4-column specifications grid showing
 * time control, format, player count/readiness, and scheduled start time.
 *
 * Props:
 * @param {Object}  tournament       – Tournament document containing format, clockLimit, etc.
 * @param {Array}   players          – Registered players array
 * @param {number}  playerCount      – Optional precalculated total registered player count
 * @param {number}  readyPlayerCount – Number of players who have marked themselves ready
 * @param {boolean} allPlayersReady  – Whether all players (min 2) are ready
 */
const TournamentSpecsGrid = ({
  tournament,
  players = [],
  playerCount,
  readyPlayerCount = 0,
  allPlayersReady = false,
}) => {
  if (!tournament) return null;

  const totalPlayers = playerCount ?? players.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 bg-white">
      <div className="p-3.5 sm:p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-center space-x-2 text-slate-500 text-xs mb-1">
          <Clock className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold uppercase tracking-wider">Time Control</span>
        </div>
        <div className="text-base font-bold text-slate-800">
          {formatTimeControl(tournament.clockLimit, tournament.increment)}
        </div>
        <div className="text-xs sm:text-[11px] text-slate-400 mt-0.5">
          {Math.floor(tournament.clockLimit / 60)} min base + {tournament.increment}s inc
        </div>
      </div>

      <div className="p-3.5 sm:p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-center space-x-2 text-slate-500 text-xs mb-1">
          <Layers className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold uppercase tracking-wider">Format</span>
        </div>
        <div className="text-base font-bold text-slate-800">
          {FORMAT_LABELS[tournament.format] || tournament.format}
        </div>
        <div className="text-xs sm:text-[11px] text-slate-400 mt-0.5">
          {tournament.format === 'SWISS' && tournament.totalRounds
            ? `${tournament.totalRounds} scheduled rounds`
            : tournament.format === 'ROUND_ROBIN'
            ? 'All-play-all schedule'
            : tournament.format === 'KNOCKOUT'
            ? 'Single-elimination bracket'
            : 'Standard tournament bracket'}
        </div>
      </div>

      <div className="p-3.5 sm:p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-center space-x-2 text-slate-500 text-xs mb-1">
          <Users className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold uppercase tracking-wider">Players</span>
        </div>
        <div className="text-base font-bold text-slate-800">
          {totalPlayers} / {tournament.maxPlayers ? tournament.maxPlayers : 'Open'}
        </div>
        <div className="text-xs sm:text-[11px] text-slate-500 mt-0.5 font-medium flex items-center space-x-1.5">
          <span className={`inline-block w-2 h-2 rounded-full ${allPlayersReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span>{readyPlayerCount} / {totalPlayers} READY</span>
        </div>
      </div>

      <div className="p-3.5 sm:p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-center space-x-2 text-slate-500 text-xs mb-1">
          <Calendar className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold uppercase tracking-wider">Start Time</span>
        </div>
        <div className="text-sm font-bold text-slate-800 truncate">
          {formatDate(tournament.startTime)}
        </div>
        <div className="text-xs sm:text-[11px] text-slate-400 mt-0.5">
          {tournament.startTime ? 'Scheduled' : 'TBD'}
        </div>
      </div>
    </div>
  );
};

export default TournamentSpecsGrid;
