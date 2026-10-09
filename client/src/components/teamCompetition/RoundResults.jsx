import React, { useState } from 'react';
import { Layers, Calendar, Clock, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import MatchScoreCard from './MatchScoreCard';

const RoundResults = ({ rounds = [], matches = [], competitionId }) => {
  const [expandedRounds, setExpandedRounds] = useState(() => {
    // Expand all by default or at least the first round
    const initial = {};
    rounds.forEach((r) => {
      initial[r._id] = true;
    });
    return initial;
  });

  const toggleRound = (roundId) => {
    setExpandedRounds((prev) => ({
      ...prev,
      [roundId]: !prev[roundId],
    }));
  };

  if (!rounds || rounds.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
        <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          No Rounds Scheduled
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Competition rounds and results will be displayed here as matches are scheduled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {rounds.map((round) => {
        const roundMatches = matches.filter(
          (m) => (m.round?._id || m.round)?.toString() === round._id.toString()
        );
        const isExpanded = expandedRounds[round._id] ?? true;

        const finalMatchesCount = roundMatches.filter((m) => m.scoringStatus === 'FINAL').length;
        const reviewRequiredCount = roundMatches.filter((m) => m.scoringStatus === 'REVIEW_REQUIRED').length;

        return (
          <div
            key={round._id}
            className="bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs"
          >
            {/* Collapsible Round Header */}
            <button
              type="button"
              onClick={() => toggleRound(round._id)}
              className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
            >
              <div className="flex items-center space-x-3.5">
                <span className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                  R{round.roundNumber}
                </span>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {round.name || `Round ${round.roundNumber}`}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        round.status === 'COMPLETED'
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          : round.status === 'READY'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : round.status === 'LINEUP'
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {round.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                    <span>{roundMatches.length} {roundMatches.length === 1 ? 'Match' : 'Matches'}</span>
                    {finalMatchesCount > 0 && (
                      <span>• <strong className="text-emerald-600 dark:text-emerald-400">{finalMatchesCount} Final</strong></span>
                    )}
                    {reviewRequiredCount > 0 && (
                      <span>• <strong className="text-amber-600 dark:text-amber-400">{reviewRequiredCount} Review Required</strong></span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </button>

            {/* Expanded Matches List */}
            {isExpanded && (
              <div className="p-5 sm:p-6 space-y-4">
                {roundMatches.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-400 font-medium">
                      No matches scheduled in this round yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roundMatches.map((match) => (
                      <MatchScoreCard
                        key={match._id || match.matchId}
                        match={match}
                        competitionId={competitionId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RoundResults;
