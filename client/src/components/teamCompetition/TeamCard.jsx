import React from 'react';
import {
  Shield,
  Crown,
  Users,
  UserCheck,
  Clock,
  Settings,
  UserPlus,
  Eye,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const TeamCard = ({
  team,
  competition,
  isOrganizer,
  currentUserId,
  onManageRoster,
  onRespondInvite,
}) => {
  const isCaptain = Boolean(
    currentUserId && team.captain?._id?.toString() === currentUserId.toString()
  );
  const membership = team.currentUserMembership;
  const isInvited = membership?.status === 'INVITED';
  const isActiveMember = membership?.status === 'ACTIVE';

  // Relationship tag determination
  let relationshipBadge = null;
  if (isCaptain) {
    relationshipBadge = (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
        <Crown className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        <span>Your Team (Captain)</span>
      </span>
    );
  } else if (isActiveMember) {
    relationshipBadge = (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
        <UserCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        <span>Your Team (Player)</span>
      </span>
    );
  } else if (isInvited) {
    relationshipBadge = (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
        <Clock className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
        <span>Invited Player</span>
      </span>
    );
  } else if (isOrganizer) {
    relationshipBadge = (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <span>Organizer View</span>
      </span>
    );
  }

  // Team status badge
  let statusBadge = null;
  if (team.status === 'ACTIVE') {
    statusBadge = (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3" />
        <span>ACTIVE</span>
      </span>
    );
  } else if (team.status === 'PENDING') {
    statusBadge = (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <Clock className="h-3 w-3" />
        <span>PENDING</span>
      </span>
    );
  } else if (team.status === 'REMOVED') {
    statusBadge = (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
        <AlertTriangle className="h-3 w-3" />
        <span>REMOVED</span>
      </span>
    );
  }

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between shadow-xs hover:shadow-md ${
        isCaptain || isActiveMember
          ? 'bg-gradient-to-br from-white to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/20 border-indigo-200 dark:border-indigo-900/60 ring-1 ring-indigo-300/40 dark:ring-indigo-700/30'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      <div>
        {/* Top Header: Shield + Status + Relationship */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 shadow-xs">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {team.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {statusBadge}
              </div>
            </div>
          </div>
          {relationshipBadge && <div className="shrink-0">{relationshipBadge}</div>}
        </div>

        {/* Squad Details Card */}
        <div className="space-y-2.5 my-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800/80 text-sm">
          {/* Captain */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 text-xs">
              <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Captain:</span>
            </span>
            <div className="flex items-center space-x-1.5 font-medium text-slate-800 dark:text-slate-200 truncate">
              {team.captain?.avatar ? (
                <img
                  src={team.captain.avatar}
                  alt={team.captain.name}
                  className="h-5 w-5 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[10px] flex items-center justify-center font-bold shrink-0">
                  {team.captain?.name?.[0] || 'C'}
                </div>
              )}
              <span className="truncate">{team.captain?.name || 'Assigned Captain'}</span>
            </div>
          </div>

          {/* Members Count */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 text-xs">
              <Users className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span>Active Players:</span>
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {team.activeMembersCount || 0}
              {competition?.maxPlayersPerTeam ? ` / ${competition.maxPlayersPerTeam}` : ' players'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        {/* Context-aware buttons */}
        {isCaptain ? (
          <button
            type="button"
            onClick={() => onManageRoster(team)}
            className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer min-h-[40px]"
          >
            <Settings className="h-4 w-4" />
            <span>Manage Roster</span>
          </button>
        ) : isOrganizer ? (
          <button
            type="button"
            onClick={() => onManageRoster(team)}
            className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer min-h-[40px]"
          >
            <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span>Manage Team</span>
          </button>
        ) : isInvited ? (
          <button
            type="button"
            onClick={() => onRespondInvite(team, membership)}
            className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer min-h-[40px]"
          >
            <Clock className="h-4 w-4" />
            <span>Respond to Invitation</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onManageRoster(team)}
            className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer min-h-[40px]"
          >
            <Eye className="h-4 w-4 text-slate-500" />
            <span>View Team Roster</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default TeamCard;
