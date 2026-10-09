import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Layers,
  Crown,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Swords,
  XCircle,
  RefreshCw,
  Play,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as teamCompetitionService from '../services/teamCompetitionService';
import TeamMatchBoard from '../components/teamCompetition/TeamMatchBoard';
import TeamLineupManager from '../components/teamCompetition/TeamLineupManager';
import MatchReadinessPanel from '../components/teamCompetition/MatchReadinessPanel';
import ResolveResultModal from '../components/teamCompetition/ResolveResultModal';
import { getSocket } from '../services/socket';

const TeamMatchDetailsPage = () => {
  const { id: competitionIdParam, competitionId: compIdParamAlt, matchId } = useParams();
  const competitionId = competitionIdParam || compIdParamAlt;
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [match, setMatch] = useState(null);
  const [boards, setBoards] = useState([]);
  const [competition, setCompetition] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const loadMatchData = useCallback(async () => {
    if (!competitionId || !matchId) return;
    setLoading(true);
    setError(null);
    try {
      const [matchData, compData] = await Promise.all([
        teamCompetitionService.getMatchById(competitionId, matchId),
        teamCompetitionService.getCompetitionById(competitionId),
      ]);
      setMatch(matchData);
      setBoards(matchData.boards || []);
      setCompetition(compData);

      // If user is captain of Team A or Team B, load that team's members
      const userIdStr = user?._id?.toString();
      const capAId = matchData.teamA?.captain?._id?.toString() || matchData.teamA?.captain?.toString();
      const capBId = matchData.teamB?.captain?._id?.toString() || matchData.teamB?.captain?.toString();

      if (userIdStr && capAId === userIdStr) {
        const members = await teamCompetitionService.getTeamMembers(matchData.teamA._id);
        setTeamMembers(members.filter((m) => m.status === 'ACTIVE'));
      } else if (userIdStr && capBId === userIdStr) {
        const members = await teamCompetitionService.getTeamMembers(matchData.teamB._id);
        setTeamMembers(members.filter((m) => m.status === 'ACTIVE'));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load match details');
    } finally {
      setLoading(false);
    }
  }, [competitionId, matchId, user]);

  useEffect(() => {
    loadMatchData();
  }, [loadMatchData]);

  // Realtime Socket listener for match events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMatchUpdate = () => {
      loadMatchData();
    };

    socket.on('team-match:started', handleMatchUpdate);
    socket.on('team-match:completed', handleMatchUpdate);
    socket.on('team-match:status-changed', handleMatchUpdate);
    socket.on('team-competition:standings-updated', handleMatchUpdate);

    return () => {
      socket.off('team-match:started', handleMatchUpdate);
      socket.off('team-match:completed', handleMatchUpdate);
      socket.off('team-match:status-changed', handleMatchUpdate);
      socket.off('team-competition:standings-updated', handleMatchUpdate);
    };
  }, [loadMatchData]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-base font-medium">Loading match details...</p>
      </div>
    );
  }

  if (error && !match) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Unable to Load Match
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
        <Link
          to={`/team-competitions/${competitionId}`}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Competition</span>
        </Link>
      </div>
    );
  }

  const userContext = match?.userContext || {};
  const isOrganizer = Boolean(userContext.isOrganizer);
  const isCaptainA = Boolean(userContext.isCaptainA);
  const isCaptainB = Boolean(userContext.isCaptainB);
  const isCaptain = isCaptainA || isCaptainB;
  const isPlayer = Boolean(userContext.isPlayer);
  const userTeamSide = userContext.userTeamSide; // 'A' | 'B' | null

  const activeCaptainTeam = isCaptainA ? match?.teamA : isCaptainB ? match?.teamB : null;
  const activeCaptainLocked = isCaptainA
    ? match?.teamALineupLocked
    : isCaptainB
    ? match?.teamBLineupLocked
    : false;
  const activeCaptainLockedAt = isCaptainA
    ? match?.teamALineupLockedAt
    : isCaptainB
    ? match?.teamBLineupLockedAt
    : null;

  // Execution states
  const hasFailedBoards = boards.some(
    (b) => b.lichessStatus === 'ERROR' || (!b.lichessGameId && match?.status === 'IN_PROGRESS')
  );
  const assignedPlayerBoard = boards.find(
    (b) => b.boardNumber === userContext.assignedBoardNumber
  );

  // Handlers
  const handleSaveLineup = async (assignments) => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const teamId = activeCaptainTeam?._id;
      await teamCompetitionService.updateLineup(competitionId, matchId, {
        teamId,
        assignments,
      });
      setSuccessMsg('Team lineup updated successfully!');
      await loadMatchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save lineup');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockLineup = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const teamId = activeCaptainTeam?._id;
      const res = await teamCompetitionService.lockLineup(competitionId, matchId, { teamId });
      setSuccessMsg('Lineup locked successfully!');
      if (res.status === 'READY') {
        setSuccessMsg('Lineup locked! Both squads confirmed — MATCH IS READY TO START!');
      }
      await loadMatchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to lock lineup');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlockLineup = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const teamId = activeCaptainTeam?._id;
      await teamCompetitionService.unlockLineup(competitionId, matchId, { teamId });
      setSuccessMsg('Lineup unlocked. You can now modify board assignments.');
      await loadMatchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to unlock lineup');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePlayerReady = async (boardNumber, ready) => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await teamCompetitionService.setPlayerReady(competitionId, matchId, {
        boardNumber,
        ready,
      });
      setSuccessMsg(`Board ${boardNumber} readiness updated.`);
      await loadMatchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update readiness');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartMatch = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await teamCompetitionService.startMatch(competitionId, matchId);
      setShowStartModal(false);
      if (result.failedBoards?.length > 0) {
        setError(
          `Started with partial issues: ${result.successfulBoards?.length || 0} boards created, ${result.failedBoards.length} boards failed.`
        );
      } else {
        setSuccessMsg('Match started successfully! All Lichess games created.');
      }
      await loadMatchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to start match');
      setShowStartModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailedBoards = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await teamCompetitionService.retryFailedBoards(competitionId, matchId);
      if (result.failedBoards?.length > 0) {
        setError(
          `Retry completed with issues: ${result.successfulBoards?.length || 0} boards succeeded, ${result.failedBoards.length} boards still failed.`
        );
      } else {
        setSuccessMsg('All failed boards successfully retried and created!');
      }
      await loadMatchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to retry boards');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncResults = async () => {
    setSyncLoading(true);
    setError(null);
    try {
      const result = await teamCompetitionService.syncMatchResults(competitionId, matchId);
      if (result.completed) {
        setSuccessMsg('Match synchronized: ALL BOARDS FINISHED! Match is now COMPLETED.');
      } else {
        setSuccessMsg(`Synchronized ${result.syncedBoards} board(s) with Lichess.`);
      }
      await loadMatchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to sync match results');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCancelMatch = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await teamCompetitionService.cancelMatch(competitionId, matchId);
      setSuccessMsg('Match has been cancelled.');
      setShowCancelModal(false);
      await loadMatchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to cancel match');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveResult = async ({ boardNumber, result, reason }) => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await teamCompetitionService.resolveMatchResult(competitionId, matchId, {
        boardNumber,
        result,
        reason,
      });
      setIsResolveModalOpen(false);
      setSuccessMsg(res.message || 'Board result resolved and match recalculated successfully!');
      await loadMatchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to resolve board result');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          to={`/team-competitions/${competitionId}`}
          className="inline-flex items-center space-x-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to {competition?.name || 'Competition'}</span>
        </Link>

        <div className="flex items-center space-x-2">
          {/* Sync Results Button */}
          {(match?.status === 'IN_PROGRESS' || match?.status === 'COMPLETED' || match?.scoringStatus === 'REVIEW_REQUIRED' || hasFailedBoards) && (
            <button
              onClick={handleSyncResults}
              disabled={syncLoading || actionLoading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition min-h-[44px] shadow-sm cursor-pointer"
              title="Sync latest game results from Lichess"
            >
              <RefreshCw className={`h-4 w-4 ${syncLoading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Sync Results</span>
            </button>
          )}

          {/* Resolve Result Button (Organizer only, when REVIEW_REQUIRED) */}
          {isOrganizer && match?.scoringStatus === 'REVIEW_REQUIRED' && (
            <button
              onClick={() => setIsResolveModalOpen(true)}
              disabled={actionLoading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 transition min-h-[44px] shadow-sm cursor-pointer"
              title="Resolve Aborted Board"
            >
              <Shield className="h-4 w-4" />
              <span>Resolve Result</span>
            </button>
          )}

          {/* Start Match Button (Organizer only, when READY) */}
          {isOrganizer && match?.status === 'READY' && (
            <button
              onClick={() => setShowStartModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 transition min-h-[44px] shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Start Match</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={loadMatchData}
            disabled={loading || actionLoading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            title="Refresh Match Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Cancel Match Button (Organizer only) */}
          {isOrganizer && ['DRAFT', 'LINEUP', 'READY'].includes(match?.status) && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition min-h-[44px] cursor-pointer"
            >
              Cancel Match
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm flex items-center space-x-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Partial Failure Notice Card */}
      {hasFailedBoards && (
        <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                Some boards could not be started
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                One or more boards encountered game creation issues. Successfully started boards remain active on Lichess.
              </p>
            </div>
          </div>
          {isOrganizer && (
            <button
              onClick={handleRetryFailedBoards}
              disabled={actionLoading}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition min-h-[40px] shrink-0 cursor-pointer"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              <span>Retry Failed Boards</span>
            </button>
          )}
        </div>
      )}

      {/* Match Header Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-xl bg-white/10 text-white text-xs font-extrabold uppercase tracking-wider backdrop-blur-sm border border-white/10">
              {match.round?.name || `Round ${match.round?.roundNumber}`}
            </span>
            <span className="px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
              {match.boardCount} {match.boardCount === 1 ? 'Board' : 'Boards'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`px-3.5 py-1 text-xs font-extrabold rounded-full uppercase tracking-wider ${
                match.scoringStatus === 'FINAL'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : match.scoringStatus === 'REVIEW_REQUIRED'
                  ? 'bg-amber-400 text-amber-950 font-black shadow-md'
                  : match.status === 'READY'
                  ? 'bg-emerald-500 text-white animate-pulse'
                  : match.status === 'STARTING'
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : match.status === 'IN_PROGRESS'
                  ? 'bg-blue-600 text-white'
                  : match.status === 'COMPLETED'
                  ? 'bg-indigo-600 text-white'
                  : match.status === 'CANCELLED'
                  ? 'bg-rose-500 text-white'
                  : 'bg-indigo-500 text-white'
              }`}
            >
              {match.scoringStatus === 'FINAL'
                ? 'FINAL'
                : match.scoringStatus === 'REVIEW_REQUIRED'
                ? 'REVIEW REQUIRED'
                : match.status === 'IN_PROGRESS'
                ? 'IN PROGRESS'
                : match.status}
            </span>
          </div>
        </div>

        {/* Team Matchup Banner */}
        <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-6 py-4">
          {/* Team A */}
          <div className="md:col-span-2 flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-xl shadow-lg shrink-0">
              {match.teamA?.name?.slice(0, 2).toUpperCase() || 'TA'}
            </div>
            <div>
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                Team A
              </div>
              <h2 className="text-2xl font-black text-white">{match.teamA?.name}</h2>
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span>Capt: {match.teamA?.captain?.name}</span>
              </div>
            </div>
          </div>

          {/* Center: VS or Score Breakdown */}
          <div className="md:col-span-1 flex flex-col items-center justify-center">
            {match.scoringStatus === 'FINAL' ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center space-x-3 px-5 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-3xl shadow-xl">
                  <span className={match.teamAResult === 'WIN' ? 'text-emerald-400' : 'text-white'}>
                    {match.teamAScore ?? 0}
                  </span>
                  <span className="text-white/40 text-xl font-light">-</span>
                  <span className={match.teamBResult === 'WIN' ? 'text-emerald-400' : 'text-white'}>
                    {match.teamBScore ?? 0}
                  </span>
                </div>
                <div className="mt-2 text-center">
                  <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {match.winnerTeam
                      ? `${(match.winnerTeam._id?.toString() === match.teamA?._id?.toString() || match.winnerTeam?.toString() === match.teamA?._id?.toString() ? match.teamA?.name : match.teamB?.name)} Won`
                      : 'Match Drawn'}
                  </span>
                  <div className="text-[10px] text-slate-300 mt-1 font-semibold">
                    Match Points: {match.teamAMatchPoints ?? 0} – {match.teamBMatchPoints ?? 0}
                  </div>
                </div>
              </div>
            ) : match.scoringStatus === 'REVIEW_REQUIRED' ? (
              <div className="flex flex-col items-center text-center">
                <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
                  Review Required
                </span>
                <span className="text-[10px] text-amber-400/80 mt-1 font-medium">
                  Aborted Board
                </span>
              </div>
            ) : (
              <span className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-base text-white tracking-widest shadow-inner">
                VS
              </span>
            )}
          </div>

          {/* Team B */}
          <div className="md:col-span-2 flex items-center space-x-4 md:justify-end">
            <div className="md:text-right order-2 md:order-1">
              <div className="text-xs font-bold text-violet-300 uppercase tracking-wider">
                Team B
              </div>
              <h2 className="text-2xl font-black text-white">{match.teamB?.name}</h2>
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5 md:justify-end">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span>Capt: {match.teamB?.captain?.name}</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-extrabold text-xl shadow-lg shrink-0 order-1 md:order-2">
              {match.teamB?.name?.slice(0, 2).toUpperCase() || 'TB'}
            </div>
          </div>
        </div>

        {/* Hero Footer Meta */}
        {match.scheduledStart && (
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center space-x-2 text-xs text-slate-300">
            <Clock className="h-4 w-4 text-indigo-400" />
            <span>Scheduled Start: {new Date(match.scheduledStart).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Review Required Attention Box */}
      {match?.scoringStatus === 'REVIEW_REQUIRED' && (
        <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-sm">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-amber-950 dark:text-amber-200">
                Match Scoring on Hold — Organizer Review Required
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 max-w-2xl leading-relaxed">
                One or more boards in this match were aborted on Lichess without a deterministic result. In accordance with competition rules, team scores and standings points are on hold until the competition organizer provides an authoritative board result resolution.
              </p>
            </div>
          </div>
          {isOrganizer && (
            <button
              onClick={() => setIsResolveModalOpen(true)}
              disabled={actionLoading}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 transition shadow-lg shadow-amber-600/30 min-h-[44px] shrink-0 cursor-pointer"
            >
              <Shield className="h-4 w-4" />
              <span>Resolve Board Result</span>
            </button>
          )}
        </div>
      )}

      {/* Match Readiness Breakdown Panel (Prior to start) */}
      {['DRAFT', 'LINEUP', 'READY'].includes(match.status) && (
        <MatchReadinessPanel match={match} boards={boards} />
      )}

      {/* Captain UX: Dedicated Lineup Management Workspace */}
      {isCaptain && activeCaptainTeam && ['DRAFT', 'LINEUP', 'READY'].includes(match.status) && (
        <TeamLineupManager
          team={activeCaptainTeam}
          boards={boards}
          boardCount={match.boardCount}
          teamSide={userTeamSide}
          isLocked={activeCaptainLocked}
          lockedAt={activeCaptainLockedAt}
          activeMembers={teamMembers}
          onSaveLineup={handleSaveLineup}
          onLockLineup={handleLockLineup}
          onUnlockLineup={handleUnlockLineup}
          onTogglePlayerReady={handleTogglePlayerReady}
          loading={actionLoading}
          matchStatus={match.status}
        />
      )}

      {/* Assigned Player Experience Quick Banner */}
      {isPlayer && assignedPlayerBoard && (
        <div className="p-5 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-md">
              #{assignedPlayerBoard.boardNumber}
            </div>
            <div>
              <div className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
                <span>You are on Board {assignedPlayerBoard.boardNumber}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  {userTeamSide === 'A'
                    ? (assignedPlayerBoard.boardNumber % 2 === 1 ? 'White' : 'Black')
                    : (assignedPlayerBoard.boardNumber % 2 === 1 ? 'Black' : 'White')}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Opponent:{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {userTeamSide === 'A'
                    ? assignedPlayerBoard.teamBPlayer?.name || 'Pending'
                    : assignedPlayerBoard.teamAPlayer?.name || 'Pending'}
                </span>
                {assignedPlayerBoard.lichessStatus && (
                  <span className="ml-2 font-medium text-indigo-600 dark:text-indigo-400">
                    • Status: {assignedPlayerBoard.lichessStatus}
                  </span>
                )}
              </p>
            </div>
          </div>

          {assignedPlayerBoard.lichessUrl && (
            <a
              href={assignedPlayerBoard.lichessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/30 shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {assignedPlayerBoard.lichessStatus === 'FINISHED'
                  ? 'View Finished Game'
                  : 'Play on Lichess'}
              </span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* Board-by-Board Lineup Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Board Lineups & Execution ({boards.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Individual board pairings, alternating colors, live Lichess games, and board results.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {boards.map((board) => (
            <TeamMatchBoard
              key={board._id || board.boardNumber}
              board={board}
              teamAName={match.teamA?.name}
              teamBName={match.teamB?.name}
              currentUserId={user?._id?.toString()}
              onToggleReady={handleTogglePlayerReady}
              actionLoading={actionLoading}
              isLocked={
                ['READY', 'STARTING', 'IN_PROGRESS', 'COMPLETED'].includes(match.status) ||
                (userTeamSide === 'A' ? match.teamALineupLocked : match.teamBLineupLocked)
              }
            />
          ))}
        </div>
      </div>

      {/* Start Match Confirmation Modal (Organizer) */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400 mb-3">
              <Play className="h-6 w-6 fill-current" />
              <h4 className="text-lg font-black text-slate-900 dark:text-white">
                Start Team Match?
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Starting this match will create live Lichess games for all {match.boardCount} boards between{' '}
              <strong className="text-slate-900 dark:text-white">{match.teamA?.name}</strong> and{' '}
              <strong className="text-slate-900 dark:text-white">{match.teamB?.name}</strong>.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2 mb-6">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>Total Boards:</span>
                <span className="font-bold text-slate-900 dark:text-white">{match.boardCount}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>Lineups:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Both Confirmed & Locked</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>Color Policy:</span>
                <span className="font-bold text-slate-900 dark:text-white">Alternating (Odd A=White, Even B=White)</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>Lichess Integration:</span>
                <span className="font-bold text-slate-900 dark:text-white">Standard Realtime Game Pairing</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowStartModal(false)}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleStartMatch}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center space-x-2 min-h-[44px] shadow-lg shadow-emerald-600/30"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{actionLoading ? 'Starting Games...' : 'Confirm & Start Match'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Cancel Match?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to cancel the match between {match.teamA?.name} and {match.teamB?.name}? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px]"
              >
                No, Keep Match
              </button>
              <button
                onClick={handleCancelMatch}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition flex items-center space-x-2 min-h-[44px]"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Yes, Cancel Match</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Board Result Modal (Organizer Only) */}
      {isResolveModalOpen && isOrganizer && (
        <ResolveResultModal
          isOpen={isResolveModalOpen}
          onClose={() => setIsResolveModalOpen(false)}
          boards={boards}
          teamAName={match?.teamA?.name}
          teamBName={match?.teamB?.name}
          onResolve={handleResolveResult}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

export default TeamMatchDetailsPage;
