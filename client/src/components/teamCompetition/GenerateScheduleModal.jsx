import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import * as teamCompetitionService from '../../services/teamCompetitionService';

const GenerateScheduleModal = ({
  isOpen,
  onClose,
  competitionId,
  competitionName,
  onScheduleGenerated,
}) => {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [generationError, setGenerationError] = useState(null);

  // Form options
  const [boardCount, setBoardCount] = useState(4);
  const [scheduledStart, setScheduledStart] = useState('');
  const [regenerate, setRegenerate] = useState(false);
  const [showPairingsPreview, setShowPairingsPreview] = useState(false);

  useEffect(() => {
    if (!isOpen || !competitionId) return;

    let isMounted = true;
    setLoadingPreview(true);
    setPreviewError(null);
    setGenerationError(null);
    setRegenerate(false);

    teamCompetitionService
      .getRoundRobinPreview(competitionId)
      .then((data) => {
        if (isMounted) {
          setPreviewData(data);
          setLoadingPreview(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setPreviewError(
            err.response?.data?.message || err.message || 'Failed to load schedule preview'
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
        boardCount: parseInt(boardCount, 10) || 4,
        scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : null,
        regenerate,
      };

      const result = await teamCompetitionService.generateRoundRobinSchedule(
        competitionId,
        payload
      );

      if (onScheduleGenerated) {
        onScheduleGenerated(result);
      }
      onClose();
    } catch (err) {
      setGenerationError(
        err.response?.data?.message || err.message || 'Failed to generate Round Robin schedule'
      );
    } finally {
      setGenerating(false);
    }
  };

  const eligibleCount = previewData?.eligibleTeamsCount ?? 0;
  const isTeamCountValid = eligibleCount >= 2;
  const hasExistingSchedule = previewData?.hasExistingSchedule ?? false;
  const canRegenerate = previewData?.canRegenerate ?? false;

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
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Generate Round Robin Schedule
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {competitionName || 'Team Competition'}
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
            <p className="text-sm font-medium">Calculating schedule parameters...</p>
          </div>
        ) : previewError ? (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{previewError}</span>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="space-y-6">
            {/* Schedule Specification Metrics */}
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
                  {previewData.eligibleTeamsCount % 2 === 0 ? 'Even count' : 'Odd (with BYE)'}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Rounds
                </span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 flex items-center justify-center space-x-1">
                  <Layers className="h-4 w-4 inline mr-1" />
                  {previewData.roundsCount}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {previewData.eligibleTeamsCount % 2 === 0 ? 'N - 1 rounds' : 'N rounds'}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Matches
                </span>
                <span className="text-2xl font-black text-violet-600 dark:text-violet-400 flex items-center justify-center space-x-1">
                  <Swords className="h-4 w-4 inline mr-1" />
                  {previewData.matchesCount}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  N × (N - 1) / 2
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  BYE Distribution
                </span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 flex items-center justify-center space-x-1">
                  <Clock className="h-4 w-4 inline mr-1" />
                  {previewData.totalByes}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {previewData.byesPerRound > 0 ? '1 BYE / round' : '0 BYEs'}
                </span>
              </div>
            </div>

            {/* Ineligibility Warning */}
            {!isTeamCountValid && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold">Minimum Active Teams Required</p>
                  <p className="mt-0.5">
                    A Round Robin tournament requires at least 2 active squads to generate matchups.
                    Currently only {eligibleCount} squad is active. Register additional squads before scheduling.
                  </p>
                </div>
              </div>
            )}

            {/* Existing Schedule Warning */}
            {hasExistingSchedule && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs sm:text-sm space-y-2">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">Schedule Already Exists</p>
                    <p className="mt-0.5">
                      This competition already has rounds and matches scheduled.
                      {canRegenerate
                        ? ' Since no matches have started yet, you can safely regenerate the schedule.'
                        : ' One or more matches have already started or completed; regeneration is locked.'}
                    </p>
                  </div>
                </div>

                {canRegenerate && (
                  <label className="flex items-center space-x-2 pt-2 border-t border-amber-200 dark:border-amber-800/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={regenerate}
                      onChange={(e) => setRegenerate(e.target.checked)}
                      className="rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Confirm safe regeneration (replaces existing un-played rounds and matches)
                    </span>
                  </label>
                )}
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
                  onChange={(e) => setBoardCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                  disabled={generating || !isTeamCountValid || (hasExistingSchedule && !regenerate)}
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
                  disabled={generating || !isTeamCountValid || (hasExistingSchedule && !regenerate)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden disabled:opacity-50"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Default starting timestamp for generated fixtures
                </span>
              </div>
            </div>

            {/* Collapsible Pairings Preview */}
            {previewData?.previewRounds && previewData.previewRounds.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPairingsPreview(!showPairingsPreview)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Layers className="h-4 w-4 text-indigo-500" />
                    <span>Deterministic Matchups Preview ({previewData.previewRounds.length} Rounds)</span>
                  </div>
                  <div className="text-slate-400">
                    {showPairingsPreview ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {showPairingsPreview && (
                  <div className="max-h-56 overflow-y-auto p-4 space-y-3 bg-white dark:bg-slate-900 text-xs">
                    {previewData.previewRounds.map((rnd) => (
                      <div
                        key={rnd.roundNumber}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                          <span>Round {rnd.roundNumber}</span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            {rnd.matchesCount} {rnd.matchesCount === 1 ? 'match' : 'matches'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          {rnd.matches.map((m, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-0.5"
                            >
                              <span className="truncate max-w-[45%] font-medium">
                                {m.teamA?.name || 'Team A'}
                              </span>
                              <span className="text-slate-400 text-[10px] uppercase font-bold px-1.5">
                                VS
                              </span>
                              <span className="truncate max-w-[45%] font-medium text-right">
                                {m.teamB?.name || 'Team B'}
                              </span>
                            </div>
                          ))}

                          {rnd.byeTeam && (
                            <div className="text-amber-600 dark:text-amber-400 text-[11px] italic pt-0.5 flex items-center space-x-1">
                              <Clock className="h-3 w-3 inline" />
                              <span>BYE: {rnd.byeTeam.name || 'Team'} sits out</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {generationError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{generationError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={generating}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px]"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  generating ||
                  !isTeamCountValid ||
                  (hasExistingSchedule && (!canRegenerate || !regenerate))
                }
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition flex items-center space-x-2 min-h-[44px] cursor-pointer"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating Schedule...</span>
                  </>
                ) : hasExistingSchedule && regenerate ? (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>Regenerate Schedule</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate Schedule</span>
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

export default GenerateScheduleModal;
