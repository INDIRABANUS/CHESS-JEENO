import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Users,
  Shield,
  Crown,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlusCircle,
  Settings,
  XCircle,
  ArrowLeft,
  Loader2,
  AlertCircle,
  HelpCircle,
  Check,
  X,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as teamCompetitionService from '../services/teamCompetitionService';
import TeamCard from '../components/teamCompetition/TeamCard';
import RosterManagementModal from '../components/teamCompetition/RosterManagementModal';
import CreateTeamModal from '../components/teamCompetition/CreateTeamModal';

const TeamCompetitionDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [competition, setCompetition] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modals state
  const [selectedTeamForRoster, setSelectedTeamForRoster] = useState(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const loadCompetitionData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compData, teamsData] = await Promise.all([
        teamCompetitionService.getCompetitionById(id),
        teamCompetitionService.getTeams(id),
      ]);
      setCompetition(compData);
      setTeams(teamsData || []);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Failed to load team competition'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCompetitionData();
  }, [loadCompetitionData]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-base font-medium">Loading competition details...</p>
      </div>
    );
  }

  if (error || !competition) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Unable to Load Competition
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {error || 'Competition not found.'}
        </p>
        <Link
          to="/team-competitions"
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Team Competitions</span>
        </Link>
      </div>
    );
  }

  const isOrganizer = Boolean(
    user && competition.organizer?._id?.toString() === user._id?.toString()
  );

  const activeTeams = teams.filter((t) => t.status === 'ACTIVE');
  const userContext = competition.userContext || {};
  const pendingInvitations = userContext.pendingInvitations || [];
  const userTeams = userContext.userTeams || [];

  // Lifecycle action handlers
  const handleOpenRegistration = async () => {
    setActionLoading(true);
    setError(null);
    setActionSuccess(null);
    try {
      await teamCompetitionService.openRegistration(competition._id);
      setActionSuccess('Registration is now open for teams!');
      await loadCompetitionData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to open registration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetReady = async () => {
    setActionLoading(true);
    setError(null);
    setActionSuccess(null);
    try {
      await teamCompetitionService.setCompetitionReady(competition._id);
      setActionSuccess('Competition marked as READY! All squads confirmed.');
      await loadCompetitionData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to mark as READY');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCompetition = async () => {
    setActionLoading(true);
    setError(null);
    setActionSuccess(null);
    try {
      await teamCompetitionService.cancelCompetition(competition._id);
      setActionSuccess('Competition cancelled successfully.');
      setShowCancelConfirm(false);
      await loadCompetitionData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to cancel competition');
    } finally {
      setActionLoading(false);
    }
  };

  // Direct invitation response handlers from page banner
  const handleRespondInvitation = async (invitationId, accept = true) => {
    setActionLoading(true);
    setError(null);
    setActionSuccess(null);
    try {
      if (accept) {
        await teamCompetitionService.acceptInvitation(invitationId);
        setActionSuccess('You have joined the team!');
      } else {
        await teamCompetitionService.declineInvitation(invitationId);
        setActionSuccess('Invitation declined.');
      }
      await loadCompetitionData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to respond to invitation');
    } finally {
      setActionLoading(false);
    }
  };

  // Status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <span>DRAFT</span>
          </span>
        );
      case 'REGISTRATION':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>REGISTRATION OPEN</span>
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>READY</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <XCircle className="h-3.5 w-3.5 text-rose-600" />
            <span>CANCELLED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const isRegistrationOpen = competition.status === 'REGISTRATION';
  const canRegisterTeam =
    isAuthenticated &&
    isRegistrationOpen &&
    userTeams.length === 0 &&
    (!competition.maxTeams || activeTeams.length < competition.maxTeams);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Navigation breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
        <Link
          to="/team-competitions"
          className="hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center space-x-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Team Competitions</span>
        </Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-white font-medium truncate">
          {competition.name}
        </span>
      </div>

      {/* Hero Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              {getStatusBadge(competition.status)}
              <span className="inline-flex items-center space-x-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <Users className="h-3.5 w-3.5 text-indigo-500" />
                <span>
                  {activeTeams.length} {activeTeams.length === 1 ? 'Team' : 'Teams'} Registered
                </span>
                {competition.maxTeams && <span>(Max {competition.maxTeams})</span>}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {competition.name}
            </h1>

            {competition.description && (
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {competition.description}
              </p>
            )}

            {/* Organizer Info */}
            <div className="flex items-center space-x-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center space-x-1.5">
                <Shield className="h-3.5 w-3.5 text-amber-500" />
                <span>Organizer:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                  {competition.organizer?.name || 'Competition Host'}
                </strong>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>Created {new Date(competition.createdAt).toLocaleDateString()}</span>
              </span>
            </div>
          </div>

          {/* Quick Action Button for visitors / players */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            {canRegisterTeam && (
              <button
                type="button"
                onClick={() => setIsCreateTeamOpen(true)}
                className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition cursor-pointer min-h-[44px]"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Register a Squad / Team</span>
              </button>
            )}
          </div>
        </div>

        {/* Organizer Administration Toolbar */}
        {isOrganizer && competition.status !== 'CANCELLED' && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 p-4 sm:p-6 rounded-b-3xl">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-amber-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Organizer Controls:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {competition.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={handleOpenRegistration}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Open Registration</span>
                </button>
              )}

              {competition.status === 'REGISTRATION' && (
                <button
                  type="button"
                  onClick={handleSetReady}
                  disabled={actionLoading || activeTeams.length < 2}
                  title={
                    activeTeams.length < 2
                      ? 'Requires at least 2 active teams with captains'
                      : 'Lock registration and mark competition ready'
                  }
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition cursor-pointer inline-flex items-center space-x-1.5 shadow-xs"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Mark as READY ({activeTeams.length}/2 teams)</span>
                </button>
              )}

              {isRegistrationOpen && (
                <button
                  type="button"
                  onClick={() => setIsCreateTeamOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <PlusCircle className="h-4 w-4 text-indigo-500" />
                  <span>Add Team</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer inline-flex items-center space-x-1.5"
              >
                <XCircle className="h-4 w-4" />
                <span>Cancel Competition</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-start space-x-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Pending Invitation Notification Banner for Current User */}
      {pendingInvitations.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-indigo-900 dark:text-indigo-200 font-bold text-sm">
            <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>You have pending team invitations for this competition!</span>
          </div>

          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.invitationId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/60"
              >
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">
                    Squad: {inv.teamName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Invited by {inv.invitedBy?.name || 'Team Captain'}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleRespondInvitation(inv.invitationId, false)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[36px]"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondInvitation(inv.invitationId, true)}
                    disabled={actionLoading}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer min-h-[36px] inline-flex items-center space-x-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Accept Invitation</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Team Squads Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Users className="h-5 w-5 text-indigo-500" />
              <span>Participating Squads & Teams ({activeTeams.length})</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Each team has one dedicated captain managing their roster.
            </p>
          </div>

          {canRegisterTeam && (
            <button
              type="button"
              onClick={() => setIsCreateTeamOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add Your Squad</span>
            </button>
          )}
        </div>

        {teams.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
            <Users className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              No Teams Registered Yet
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              {isRegistrationOpen
                ? 'Team registration is currently open. Squad captains can now register their teams.'
                : 'Registration has not opened yet.'}
            </p>
            {canRegisterTeam && (
              <button
                type="button"
                onClick={() => setIsCreateTeamOpen(true)}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Register the First Squad</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teams.map((team) => (
              <TeamCard
                key={team._id}
                team={team}
                competition={competition}
                isOrganizer={isOrganizer}
                currentUserId={user?._id}
                onManageRoster={(t) => setSelectedTeamForRoster(t)}
                onRespondInvite={(t, membership) => {
                  setSelectedTeamForRoster(t);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Cancel Competition?
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to cancel <strong>{competition.name}</strong>? This action cannot be reversed. Team rosters will be locked.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelCompetition}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer inline-flex items-center space-x-1.5"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roster Management Modal */}
      {selectedTeamForRoster && (
        <RosterManagementModal
          team={selectedTeamForRoster}
          competition={competition}
          currentUserId={user?._id}
          isOrganizer={isOrganizer}
          isOpen={Boolean(selectedTeamForRoster)}
          onClose={() => setSelectedTeamForRoster(null)}
          onTeamUpdated={loadCompetitionData}
        />
      )}

      {/* Register Team Modal */}
      {isCreateTeamOpen && (
        <CreateTeamModal
          competition={competition}
          isOpen={isCreateTeamOpen}
          onClose={() => setIsCreateTeamOpen(false)}
          onTeamCreated={loadCompetitionData}
        />
      )}
    </div>
  );
};

export default TeamCompetitionDetailsPage;
