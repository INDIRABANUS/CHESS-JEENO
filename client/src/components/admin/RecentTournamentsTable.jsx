import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, Clock, ExternalLink } from 'lucide-react';

/**
 * Formats ISO date string to a human-readable format.
 */
const formatDate = (dateString) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

/**
 * Maps tournament status to friendly color badges.
 */
const getStatusBadge = (status) => {
  const normalized = status?.toUpperCase() || 'UNKNOWN';

  if (['RUNNING', 'IN_PROGRESS', 'COUNTDOWN', 'READY_CHECK', 'ACTIVE'].includes(normalized)) {
    return {
      label: normalized.replace('_', ' '),
      className: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      dotColor: 'bg-emerald-500',
    };
  }

  if (['FINISHED', 'COMPLETED'].includes(normalized)) {
    return {
      label: normalized.replace('_', ' '),
      className: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      dotColor: 'bg-blue-500',
    };
  }

  if (['REGISTRATION', 'PENDING', 'DRAFT'].includes(normalized)) {
    return {
      label: normalized.replace('_', ' '),
      className: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      dotColor: 'bg-purple-500',
    };
  }

  return {
    label: normalized.replace('_', ' '),
    className: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-400',
  };
};

/**
 * RecentTournamentsTable — Displays recent platform tournaments with format, status, and participants.
 * 
 * @param {Object} props
 * @param {Array<Object>} props.tournaments - List of recent tournament objects
 */
const RecentTournamentsTable = ({ tournaments = [] }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Tournaments
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest created tournaments across all formats
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {tournaments.length} {tournaments.length === 1 ? 'tournament' : 'tournaments'}
          </span>
          <Link
            to="/admin/tournaments"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Manage All &rarr;
          </Link>
        </div>
      </div>

      {/* Empty State */}
      {tournaments.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <Trophy className="h-10 w-10 text-slate-400 mx-auto stroke-1" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No tournaments created yet
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tournaments will appear here as organizers create them.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th scope="col" className="px-5 py-3">Tournament</th>
                  <th scope="col" className="px-5 py-3">Format</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">Host</th>
                  <th scope="col" className="px-5 py-3">Players</th>
                  <th scope="col" className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tournaments.map((t) => {
                  const badge = getStatusBadge(t.status);
                  return (
                    <tr
                      key={t.id || t.name}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name with Link */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Link
                          to={`/tournaments/${t.id}`}
                          className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition inline-flex items-center space-x-1.5"
                        >
                          <span className="truncate max-w-[200px]">{t.name}</span>
                          <ExternalLink className="h-3.5 w-3.5 opacity-40 hover:opacity-100 shrink-0" />
                        </Link>
                      </td>

                      {/* Format Badge */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {t.format?.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.className}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Creator / Host */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                        {t.creator?.name || 'Organizer'}
                      </td>

                      {/* Participant Count */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center space-x-1">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {t.participantCount}
                            {t.maxPlayers ? ` / ${t.maxPlayers}` : ''}
                          </span>
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(t.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {tournaments.map((t) => {
              const badge = getStatusBadge(t.status);
              return (
                <div key={t.id || t.name} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/tournaments/${t.id}`}
                      className="font-semibold text-slate-900 dark:text-white text-sm hover:text-indigo-600 dark:hover:text-indigo-400 truncate pr-2 inline-flex items-center space-x-1"
                    >
                      <span className="truncate">{t.name}</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-50 shrink-0" />
                    </Link>

                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${badge.className}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium text-slate-700 dark:text-slate-300">
                      {t.format?.replace('_', ' ')}
                    </span>
                    <span className="inline-flex items-center space-x-1">
                      <Users className="h-3 w-3 text-slate-400" />
                      <span>
                        {t.participantCount}
                        {t.maxPlayers ? ` / ${t.maxPlayers}` : ' players'}
                      </span>
                    </span>
                    <span>{formatDate(t.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default RecentTournamentsTable;
