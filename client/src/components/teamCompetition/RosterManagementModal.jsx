import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Crown,
  Users,
  UserPlus,
  UserX,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ArrowRightLeft,
  Shield,
  Trash2,
} from 'lucide-react';
import * as teamCompetitionService from '../../services/teamCompetitionService';

const RosterManagementModal = ({
  team,
  competition,
  currentUserId,
  isOrganizer,
  isOpen,
  onClose,
  onTeamUpdated,
}) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Invite section state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState(null);

  // Action states
  const [removingUserId, setRemovingUserId] = useState(null);
  const [transferringToUserId, setTransferringToUserId] = useState(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(null);

  const isCaptain = Boolean(
    currentUserId && team?.captain?._id?.toString() === currentUserId.toString()
  );
  const canManage = isCaptain || isOrganizer;

  const loadMembers = useCallback(async () => {
    if (!team?._id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await teamCompetitionService.getTeamMembers(team._id);
      setMembers(data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load team roster');
    } finally {
      setLoading(false);
    }
  }, [team?._id]);

  useEffect(() => {
    if (isOpen) {
      loadMembers();
      setSearchQuery('');
      setSearchResults([]);
      setActionSuccess(null);
    }
  }, [isOpen, loadMembers]);

  // Debounced search for users
  useEffect(() => {
    if (!canManage || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await teamCompetitionService.searchUsers(searchQuery.trim());
        // Filter out users who are already in the team roster
        const existingUserIds = new Set(members.map((m) => m.user?._id?.toString()));
        const filtered = (users || []).filter((u) => !existingUserIds.has(u._id.toString()));
        setSearchResults(filtered);
      } catch (err) {
        console.warn('User search error:', err.message);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, members, canManage]);

  if (!isOpen) return null;

  // Invite player handler
  const handleInvitePlayer = async (targetUser) => {
    setInvitingUserId(targetUser._id);
    setError(null);
    setActionSuccess(null);
    try {
      await teamCompetitionService.invitePlayer(team._id, { userId: targetUser._id });
      setActionSuccess(`Invitation sent to ${targetUser.name}!`);
      setSearchQuery('');
      setSearchResults([]);
      await loadMembers();
      if (onTeamUpdated) onTeamUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to send invitation');
    } finally {
      setInvitingUserId(null);
    }
  };

  // Remove player handler
  const handleRemoveMember = async (targetUserId) => {
    if (!window.confirm('Are you sure you want to remove this member from the team?')) {
      return;
    }
    setRemovingUserId(targetUserId);
    setError(null);
    setActionSuccess(null);
    try {
      await teamCompetitionService.removeMember(team._id, targetUserId);
      setActionSuccess('Member removed successfully');
      await loadMembers();
      if (onTeamUpdated) onTeamUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to remove member');
    } finally {
      setRemovingUserId(null);
    }
  };

  // Transfer captaincy handler
  const handleTransferCaptain = async (newCaptainId) => {
    setTransferringToUserId(newCaptainId);
    setError(null);
    setActionSuccess(null);
    try {
      await teamCompetitionService.transferCaptain(team._id, { newCaptainId });
      setActionSuccess('Captaincy transferred successfully!');
      setShowTransferConfirm(null);
      await loadMembers();
      if (onTeamUpdated) onTeamUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to transfer captaincy');
    } finally {
      setTransferringToUserId(null);
    }
  };

  const activeMembers = members.filter((m) => m.status === 'ACTIVE');
  const pendingMembers = members.filter((m) => m.status === 'INVITED');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                {team.name} Roster
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {competition?.name} • {activeMembers.length} Active Players
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Alerts */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-sm flex items-start space-x-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Captain/Organizer: Player Invitation Section */}
          {canManage && competition?.status !== 'CANCELLED' && (
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <UserPlus className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span>Invite Player to Team</span>
                </span>
                {competition?.maxPlayersPerTeam && (
                  <span className="text-xs text-slate-500">
                    Max: {competition.maxPlayersPerTeam} players
                  </span>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user by name, email, or lichess username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 animate-spin" />
                )}
              </div>

              {/* Search dropdown results */}
              {searchResults.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <div
                      key={user._id}
                      className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="h-7 w-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs flex items-center justify-center font-bold shrink-0">
                            {user.name?.[0] || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {user.lichessUsername ? `@${user.lichessUsername}` : user.email}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInvitePlayer(user)}
                        disabled={invitingUserId === user._id}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition cursor-pointer min-h-[32px] inline-flex items-center space-x-1 shrink-0"
                      >
                        {invitingUserId === user._id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <UserPlus className="h-3 w-3" />
                        )}
                        <span>Invite</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Members Roster */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Users className="h-4 w-4 text-emerald-500" />
                <span>Active Roster ({activeMembers.length})</span>
              </span>
            </h3>

            {loading ? (
              <div className="py-8 flex items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading team roster...</span>
              </div>
            ) : activeMembers.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4 text-center">
                No active players in this team yet.
              </p>
            ) : (
              <div className="space-y-2">
                {activeMembers.map((member) => {
                  const isThisMemberCaptain = member.role === 'CAPTAIN';
                  const isSelf = member.user?._id?.toString() === currentUserId?.toString();

                  return (
                    <div
                      key={member._id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      {/* User Info */}
                      <div className="flex items-center space-x-3 min-w-0">
                        {member.user?.avatar ? (
                          <img
                            src={member.user.avatar}
                            alt={member.user.name}
                            className="h-8 w-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className={`h-8 w-8 rounded-full text-xs flex items-center justify-center font-bold shrink-0 ${
                              isThisMemberCaptain
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {member.user?.name?.[0] || 'P'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                              {member.user?.name}
                            </span>
                            {isThisMemberCaptain && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                                <Crown className="h-2.5 w-2.5" />
                                <span>CAPTAIN</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {member.user?.lichessUsername ? `@${member.user.lichessUsername}` : member.user?.email}
                          </p>
                        </div>
                      </div>

                      {/* Management Actions */}
                      {canManage && (
                        <div className="flex items-center space-x-1.5 shrink-0">
                          {/* Captain Transfer Button (only for non-captains) */}
                          {!isThisMemberCaptain && (
                            <button
                              type="button"
                              onClick={() => setShowTransferConfirm(member.user)}
                              title="Transfer Captaincy to this player"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </button>
                          )}

                          {/* Remove Player Button (cannot remove captain) */}
                          {!isThisMemberCaptain && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.user?._id)}
                              disabled={removingUserId === member.user?._id}
                              title="Remove player from team"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
                            >
                              {removingUserId === member.user?._id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Invitations Section (Visible to Captain & Organizer) */}
          {canManage && pendingMembers.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center space-x-1.5">
                <Clock className="h-4 w-4 text-indigo-500" />
                <span>Pending Invitations ({pendingMembers.length})</span>
              </h3>

              <div className="space-y-2">
                {pendingMembers.map((member) => (
                  <div
                    key={member._id}
                    className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {member.user?.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Invited • Pending response
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.user?._id)}
                      disabled={removingUserId === member.user?._id}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer px-2 py-1"
                    >
                      Cancel Invite
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Captain Transfer Confirmation Prompt */}
          {showTransferConfirm && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 space-y-3">
              <div className="flex items-start space-x-2.5">
                <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Transfer Team Captaincy
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                    Are you sure you want to make <strong>{showTransferConfirm.name}</strong> the new team captain? You will become a regular player.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowTransferConfirm(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleTransferCaptain(showTransferConfirm._id)}
                  disabled={transferringToUserId === showTransferConfirm._id}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition cursor-pointer inline-flex items-center space-x-1"
                >
                  {transferringToUserId === showTransferConfirm._id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Crown className="h-3 w-3" />
                  )}
                  <span>Confirm Transfer</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer min-h-[40px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RosterManagementModal;
