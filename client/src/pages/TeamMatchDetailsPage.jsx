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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as teamCompetitionService from '../services/teamCompetitionService';
import TeamMatchBoard from '../components/teamCompetition/TeamMatchBoard';
import TeamLineupManager from '../components/teamCompetition/TeamLineupManager';
import MatchReadinessPanel from '../components/teamCompetition/MatchReadinessPanel';

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
        setSuccessMsg('Lineup locked! Both squads confirmed — MATCH IS READY!');
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
          <button
            onClick={loadMatchData}
            disabled={loading || actionLoading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Refresh Match Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isOrganizer && match?.status !== 'CANCELLED' && match?.status !== 'COMPLETED' && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition min-h-[44px]"
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
                match.status === 'READY'
                  ? 'bg-emerald-500 text-white'
                  : match.status === 'LINEUP'
                  ? 'bg-indigo-500 text-white'
                  : match.status === 'CANCELLED'
                  ? 'bg-rose-500 text-white'
                  : 'bg-amber-500 text-slate-950'
              }`}
            >
              {match.status}
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
                Team White
              </div>
              <h2 className="text-2xl font-black text-white">{match.teamA?.name}</h2>
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span>Capt: {match.teamA?.captain?.name}</span>
              </div>
            </div>
          </div>

          {/* VS Badge */}
          <div className="md:col-span-1 flex flex-col items-center justify-center">
            <span className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-base text-white tracking-widest shadow-inner">
              VS
            </span>
          </div>

          {/* Team B */}
          <div className="md:col-span-2 flex items-center space-x-4 md:justify-end">
            <div className="md:text-right order-2 md:order-1">
              <div className="text-xs font-bold text-violet-300 uppercase tracking-wider">
                Team Black
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

      {/* Match Readiness Breakdown Panel */}
      <MatchReadinessPanel match={match} boards={boards} />

      {/* Captain UX: Dedicated Lineup Management Workspace */}
      {isCaptain && activeCaptainTeam && match.status !== 'CANCELLED' && (
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

      {/* Assigned Player Quick Banner */}
      {isPlayer && userContext.assignedBoardNumber && (
        <div className="p-5 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black">
              #{userContext.assignedBoardNumber}
            </div>
            <div>
              <div className="font-extrabold text-base text-slate-900 dark:text-white">
                You are playing on Board {userContext.assignedBoardNumber}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Playing for {userTeamSide === 'A' ? match.teamA?.name : match.teamB?.name} ({userTeamSide === 'A' ? 'White' : 'Black'}). Confirm your readiness for the captain.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Board-by-Board Lineup Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Board Lineups ({boards.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Individual board pairings, player readiness, and confirmation state.
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
              isLocked={match.status === 'READY' || (userTeamSide === 'A' ? match.teamALineupLocked : match.teamBLineupLocked)}
            />
          ))}
        </div>
      </div>

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
    </div>
  );
};

export default TeamMatchDetailsPage;
