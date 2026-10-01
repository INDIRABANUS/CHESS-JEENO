import React from 'react';
import { Trophy } from 'lucide-react';

/**
 * TournamentCompleteCard — renders the completed tournament banner with champion
 * details and the current user's final standing summary.
 *
 * Props:
 * @param {Object} tournament – Tournament document containing winnerPlayer, name, etc.
 * @param {Object} currentStanding – Current player's standing entry (rank, score, W/D/L)
 */
const TournamentCompleteCard = ({ tournament, currentStanding }) => {
  if (!tournament) return null;

  return (
    <div className="p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-xl shadow-md text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-xs flex-shrink-0">
          <Trophy className="h-8 w-8 text-amber-300" />
        </div>
        <div>
          <div className="font-black text-lg tracking-wide flex items-center space-x-2">
            <span>TOURNAMENT COMPLETE</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-white/30 rounded-full">
              Concluded
            </span>
          </div>
          {tournament.winnerPlayer ? (
            <p className="text-sm text-emerald-100 mt-1">
              🏆 Champion: <strong className="text-white underline">{tournament.winnerPlayer.name}</strong>
              {tournament.winnerPlayer.lichessUsername && ` (@${tournament.winnerPlayer.lichessUsername})`}
            </p>
          ) : (
            <p className="text-xs text-emerald-100 mt-1">
              All scheduled matches have concluded. Final standings are displayed below.
            </p>
          )}
        </div>
      </div>

      {currentStanding && (
        <div className="bg-white/10 rounded-lg p-3 text-xs border border-white/20 flex items-center space-x-4">
          <div>
            <span className="text-emerald-200">Your Rank:</span>{' '}
            <strong className="text-white text-sm">#{currentStanding.rank}</strong>
          </div>
          <div className="border-l border-white/20 pl-3">
            <span className="text-emerald-200">Score:</span>{' '}
            <strong className="text-white font-mono text-sm">{currentStanding.score} pts</strong>
          </div>
          <div className="border-l border-white/20 pl-3 text-emerald-100 font-mono">
            {currentStanding.wins}W / {currentStanding.draws}D / {currentStanding.losses}L
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentCompleteCard;
