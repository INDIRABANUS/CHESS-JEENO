import React from 'react';
import { Trophy, Users, Calendar, Eye, Ban, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

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
 * Returns color classes for status badges.
 */
const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'RUNNING':
    case 'IN_PROGRESS':
    case 'ACTIVE':
      return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'COUNTDOWN':
    case 'READY_CHECK':
      return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'FINISHED':
    case 'COMPLETED':
      return 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    case 'CANCELLED':
      return 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'REGISTRATION':
    case 'DRAFT':
    default:
      return 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
  }
};

/**
 * AdminTournamentsTable — Responsive desktop table and mobile card representation of tournaments.
 *
 * @param {Object} props
 * @param {Array<Object>} props.tournaments - List of tournaments
 * @param {Function} props.onInspect - Callback to inspect tournament details
 * @param {Function} props.onCancel - Callback to initiate cancellation
 */
const AdminTournamentsTable = ({
  tournaments = [],
  onInspect,
  onCancel,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-colors">
      {/* ──────────────── Desktop Table View (Hidden on mobile) ──────────────── */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" className="px-5 py-3.5">Tournament</th>
              <th scope="col" className="px-5 py-3.5">Creator</th>
              <th scope="col" className="px-5 py-3.5">Format</th>
              <th scope="col" className="px-5 py-3.5">Status</th>
              <th scope="col" className="px-5 py-3.5">Players</th>
              <th scope="col" className="px-5 py-3.5">Created</th>
              <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tournaments.map((t) => {
              const canCancel =
                t.status !== 'FINISHED' &&
                t.status !== 'COMPLETED' &&
                t.status !== 'CANCELLED';

              return (
                <tr
                  key={t.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Tournament Name & Info */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                        <Trophy className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                            {t.name}
                          </span>
                          {t.rated && (
                            <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded">
                              Rated
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                          {Math.floor(t.clockLimit / 60)}+{t.increment} min
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Creator */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {t.creator?.name || 'Organizer'}
                      </p>
                      <p className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                        {t.creator?.email || '—'}
                      </p>
                    </div>
                  </td>

                  {/* Format */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="capitalize text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {t.format?.replace('_', ' ').toLowerCase()}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(
                        t.status
                      )}`}
                    >
                      {t.status}
                    </span>
                  </td>

                  {/* Players Count */}
                  <td className="px-5 py-4 whitespace-nowrap text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <div className="flex items-center space-x-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {t.participantCount}
                        {t.maxPlayers ? ` / ${t.maxPlayers}` : ''}
                      </span>
                    </div>
                  </td>

                  {/* Created Date */}
                  <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(t.createdAt)}
                  </td>

                  {/* Actions Column */}
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => onInspect(t)}
                        id={`inspect-tournament-btn-${t.id}`}
                        title="Inspect tournament"
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[36px]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect</span>
                      </button>

                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => onCancel(t)}
                          id={`cancel-tournament-btn-${t.id}`}
                          title="Cancel tournament"
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[36px]"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ──────────────── Mobile Card List View (Visible on small & tablet screens) ──────────────── */}
      <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {tournaments.map((t) => {
          const canCancel =
            t.status !== 'FINISHED' &&
            t.status !== 'COMPLETED' &&
            t.status !== 'CANCELLED';

          return (
            <div key={t.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center space-x-1.5">
                      <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {t.name}
                      </p>
                      {t.rated && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded">
                          Rated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Host: {t.creator?.name || 'Organizer'}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${getStatusBadgeClass(
                    t.status
                  )}`}
                >
                  {t.status}
                </span>
              </div>

              {/* Specs & Info */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 gap-2">
                <div className="flex items-center space-x-2">
                  <span className="capitalize bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-semibold text-slate-700 dark:text-slate-300">
                    {t.format?.replace('_', ' ').toLowerCase()}
                  </span>
                  <span>{Math.floor(t.clockLimit / 60)}+{t.increment} min</span>
                  <span>•</span>
                  <span>{t.participantCount} {t.participantCount === 1 ? 'player' : 'players'}</span>
                </div>
                <span>Created {formatDate(t.createdAt)}</span>
              </div>

              {/* Action Buttons for Mobile */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onInspect(t)}
                  className="w-full inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer min-h-[40px]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Inspect</span>
                </button>

                {canCancel ? (
                  <button
                    type="button"
                    onClick={() => onCancel(t)}
                    className="w-full inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition cursor-pointer min-h-[40px]"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    <span>Cancel</span>
                  </button>
                ) : (
                  <Link
                    to={`/tournaments/${t.id}`}
                    target="_blank"
                    className="w-full inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[40px]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Public View</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminTournamentsTable;
