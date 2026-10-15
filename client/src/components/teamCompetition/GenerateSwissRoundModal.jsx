import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Swords,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  RotateCcw,
  Shield,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import * as teamCompetitionService from '../../services/teamCompetitionService';

const GenerateSwissRoundModal = ({
  isOpen,
  onClose,
  competitionId,
  competitionName,
  onRoundGenerated,
}) => {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [generationError, setGenerationError] = useState(null);

  // Form options
  const [boardCount, setBoardCount] = useState(4);
  const [scheduledStart, setScheduledStart] = useState('');
  const [roundName, setRoundName] = useState('');
  const [regenerate, setRegenerate] = useState(false);

  useEffect(() => {
    if (!isOpen || !competitionId) return;

    let isMounted = true;
    setLoadingPreview(true);
    setPreviewError(null);
    setGenerationError(null);
    setRegenerate(false);

    teamCompetitionService
      .getSwissPreview(competitionId)
      .then((data) => {
        if (isMounted) {
          setPreviewData(data);
          setRoundName(data.nextRoundNumber ? `Round ${data.nextRoundNumber}` : '');
          setLoadingPreview(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setPreviewError(
            err.response?.data?.message || err.message || 'Failed to load Swiss round preview'
          );
          setLoadingPreview(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, competitionId]);

  if (!isOpen) return null;

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setGenerationError(null);

    try {
      const payload = {
        name: roundName.trim() || undefined,
        boardCount: parseInt(boardCount, 10) || 4,
        scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : null,
        regenerate,
      };

      const result = await teamCompetitionService.generateSwissRound(
        competitionId,
        payload
      );

      if (onRoundGenerated) {
        onRoundGenerated(result);
      }
      onClose();
    } catch (err) {
      setGenerationError(
        err.response?.data?.message || err.message || 'Failed to generate Swiss round'
      );
    } finally {
      setGenerating(false);
    }
  };

  const eligibleCount = previewData?.eligibleTeamsCount ?? 0;
  const isTeamCountValid = eligibleCount >= 2;
  const nextRoundNumber = previewData?.nextRoundNumber ?? 1;
  const hasBlocker = previewData?.hasUnresolvedBlocker ?? false;
  const blockerReason = previewData?.blockerReason ?? null;
  const canRegenerate = previewData?.canRegenerate ?? false;
  const canGenerate = (previewData?.canGenerate ?? false) || (canRegenerate && regenerate);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Generate Swiss Round {nextRoundNumber}</span>
                <span className="text-[10px] uppercase font-extrabold tracking-wider bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                  Swiss System
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {competitionName || 'Team Competition'} • Standings-based pairing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Loading State */}
        {loadingPreview ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Calculating Swiss standings and pairings...</p>
          </div>
        ) : previewError ? (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{previewError}</span>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Active Teams
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-center space-x-1">
                  <Users className="h-4 w-4 text-indigo-500 inline mr-1" />
                  {previewData.eligibleTeamsCount}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {previewData.eligibleTeamsCount % 2 === 0 ? 'Even pool' : 'Odd pool (1 BYE)'}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Round
                </span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 flex items-center justify-center space-x-1">
                  <Layers className="h-4 w-4 inline mr-1" />
                  {nextRoundNumber}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Round-by-round
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Matches
                </span>
                <span className="text-2xl font-black text-violet-600 dark:text-violet-400 flex items-center justify-center space-x-1">
                  <Swords className="h-4 w-4 inline mr-1" />
                  {previewData.totalMatches}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Proposed pairings
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  BYE Team
                </span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center space-x-1 truncate mt-1">
                  {previewData.byeTeam ? previewData.byeTeam.name : 'None'}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {previewData.byeTeam ? '0 match pts' : 'Even bracket'}
                </span>
              </div>
            </div>

            {/* Unresolved Match Blocker Alert */}
            {hasBlocker && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <p className="font-bold">Next Round Blocked by Preceding Results</p>
                  <p className="mt-0.5">{blockerReason}</p>
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                    All matches and boards in the preceding round must be finalized or resolved before generating the next Swiss round.
                  </p>
                </div>
              </div>
            )}

            {/* Ineligibility Warning */}
            {!isTeamCountValid && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold">Minimum Active Teams Required</p>
                  <p className="mt-0.5">
                    Swiss scheduling requires at least 2 active squads. Currently only {eligibleCount} squad is active.
                  </p>
                </div>
              </div>
            )}

            {/* Safe Regeneration Checkbox if Round Already Exists Pre-Start */}
            {canRegenerate && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs sm:text-sm space-y-2">
                <div className="flex items-start space-x-3">
                  <RotateCcw className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">Round {nextRoundNumber} Already Exists (Pre-Start)</p>
                    <p className="mt-0.5">
                      Round {nextRoundNumber} has been generated but no matches have started yet. You can safely regenerate this round with updated options or team rosters.
                    </p>
                  </div>
                </div>

                <label className="flex items-center space-x-2 pt-2 border-t border-amber-200 dark:border-amber-800/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={regenerate}
                    onChange={(e) => setRegenerate(e.target.checked)}
                    className="rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Confirm safe regeneration of Round {nextRoundNumber} (replaces un-started fixtures)
                  </span>
                </label>
              </div>
            )}

            {/* Proposed Swiss Pairings Preview */}
            {previewData?.proposedPairings && previewData.proposedPairings.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                    <Swords className="h-4 w-4 text-indigo-500" />
                    <span>Proposed Team Pairings for Round {nextRoundNumber}</span>
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {previewData.proposedPairings.length} match{previewData.proposedPairings.length > 1 ? 'es' : ''}
                  </span>
                </div>

                <div className="space-y-2">
                  {previewData.proposedPairings.map((pair, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 rounded-xl space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-bold">{pair.teamA?.name || 'Team A'}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                            {pair.teamAPoints} pts
                          </span>
                        </div>

                        <span className="text-xs font-bold text-slate-400">VS</span>

                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                            {pair.teamBPoints} pts
                          </span>
                          <span className="font-bold">{pair.teamB?.name || 'Team B'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
                        <span
                          className={`font-medium ${
                            pair.isRematch
                              ? 'text-amber-600 dark:text-amber-400 font-bold'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {pair.repeatAvoidance}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          Home/Away: {pair.teamA?.name} (White B1)
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Assigned BYE Info */}
                  {previewData.byeTeam && (
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs space-y-1">
                      <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 font-bold">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span>Assigned BYE: {previewData.byeTeam.name}</span>
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        {previewData.byeReason || 'Deterministic tie-break based on standings'} (receives 0 match points, no unplayed Lichess match created).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Configuration Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Boards Per Match
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={boardCount}
                  onChange={(e) =>
                    setBoardCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))
                  }
                  disabled={generating || !canGenerate}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden disabled:opacity-50"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Sequential boards 1 to {boardCount} per team match (1–20)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Scheduled Start Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  disabled={generating || !canGenerate}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden disabled:opacity-50"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Scheduled timestamp for generated matches
                </span>
              </div>
            </div>

            {/* Generation Error */}
            {generationError && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-start space-x-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{generationError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={generating}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={generating || !canGenerate}
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2 min-h-[44px]"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating Round...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span>
                      {canRegenerate && regenerate
                        ? `Regenerate Round ${nextRoundNumber}`
                        : `Generate Round ${nextRoundNumber}`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default GenerateSwissRoundModal;
