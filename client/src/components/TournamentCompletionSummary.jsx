import React from 'react';
import { Trophy, Users, CheckCircle, Share2, Award, Calendar } from 'lucide-react';
import { FORMAT_LABELS } from '../utils/constants';

/**
 * TournamentCompletionSummary — prominent summary shown near the top of completed tournaments.
 *
 * Props:
 * @param {Object} tournament – Tournament document (winnerPlayer, name, format, status, completionReason, etc.)
 * @param {Array}  standings  – Array of final standings entries
 * @param {Array}  players    – Array of registered players
 * @param {Function} [onShare] – Optional callback to open share/invite modal
 */
const TournamentCompletionSummary = ({
  tournament,
  standings = [],
  players = [],
  onShare,
}) => {
  if (!tournament) return null;

  // Determine winner
  const winnerUser = tournament.winnerPlayer;
  const winnerStanding = winnerUser
    ? standings.find((s) => {
        const sId = (s.playerId?._id || s.playerId?.id || s.playerId)?.toString();
        const wId = (winnerUser._id || winnerUser.id || winnerUser)?.toString();
        return sId && wId && sId === wId;
      })
    : standings.length > 0 && standings[0].score > 0
    ? standings[0]
    : null;

  const winnerName = winnerUser?.name || winnerStanding?.name || null;
  const winnerLichess = winnerUser?.lichessUsername || winnerStanding?.lichessUsername || null;
  const winnerScore = winnerStanding?.score !== undefined ? winnerStanding.score : null;

  // Participant count
  const participantCount =
    (players && players.length > 0)
      ? players.length
      : (standings && standings.length > 0)
      ? standings.length
      : tournament.registeredPlayers || 0;

  // Completion reason text
  const getCompletionReasonText = (reason) => {
    if (reason === 'TOTAL_ROUNDS_REACHED') return 'All scheduled rounds concluded';
    if (reason === 'ALL_MATCHUPS_EXHAUSTED') return 'All tournament matchups completed';
    return 'All tournament matches concluded';
  };

  const formatText = FORMAT_LABELS[tournament.format] || tournament.format;

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-indigo-500/10 dark:from-amber-950/30 dark:via-emerald-950/30 dark:to-indigo-950/30 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
        {/* Left side: Trophy + Main details */}
        <div className="flex items-start space-x-3.5 sm:space-x-4 min-w-0">
          <div className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-400 to-amber-600 text-white rounded-xl shadow-md shrink-0">
            <Trophy className="h-6 w-6 sm:h-8 sm:w-8" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Status & Format tags */}
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center space-x-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle className="h-3 w-3" />
                <span>TOURNAMENT CONCLUDED</span>
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {formatText}
              </span>
            </div>

            {/* Tournament Name */}
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate" title={tournament.name}>
              {tournament.name}
            </h2>

            {/* Winner / Champion Display */}
            {winnerName ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <div className="flex items-center space-x-1.5 font-bold text-slate-900 dark:text-slate-100">
                  <span className="text-amber-500">🏆 Champion:</span>
                  <span className="underline decoration-amber-400 font-extrabold">{winnerName}</span>
                </div>
                {winnerLichess && (
                  <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                    (@{winnerLichess})
                  </span>
                )}
                {winnerScore !== null && (
                  <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800">
                    {winnerScore} {winnerScore === 1 ? 'pt' : 'pts'}
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 italic">
                Winner not determined
              </div>
            )}
          </div>
        </div>

        {/* Right side: Key Metadata and Actions */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-200 dark:border-slate-800 shrink-0">
          {/* Participants pill */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">{participantCount}</span>
            <span>Participants</span>
          </div>

          {/* Completion reason pill */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300" title={getCompletionReasonText(tournament.completionReason)}>
            <Award className="h-3.5 w-3.5 text-emerald-500" />
            <span className="truncate max-w-[160px] sm:max-w-[200px]">
              {getCompletionReasonText(tournament.completionReason)}
            </span>
          </div>

          {/* Share CTA button */}
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center justify-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer min-h-[32px]"
              title="Share completed tournament results"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentCompletionSummary;
