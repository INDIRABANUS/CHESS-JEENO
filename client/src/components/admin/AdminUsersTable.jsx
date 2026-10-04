import React from 'react';
import { Users, Shield, Calendar, Mail, Eye, ShieldAlert, ShieldCheck } from 'lucide-react';

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
 * AdminUsersTable — Responsive desktop table and mobile card representation of platform users.
 *
 * @param {Object} props
 * @param {Array<Object>} props.users - List of user objects
 * @param {Function} props.onViewDetails - Callback to open details modal
 * @param {Function} props.onRoleClick - Callback to initiate role change
 * @param {Object} [props.currentUser] - Authenticated admin object for self-identification
 */
const AdminUsersTable = ({
  users = [],
  onViewDetails,
  onRoleClick,
  currentUser,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-colors">
      {/* ──────────────── Desktop Table View (Hidden on mobile) ──────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" className="px-5 py-3.5">User</th>
              <th scope="col" className="px-5 py-3.5">Email</th>
              <th scope="col" className="px-5 py-3.5">Role</th>
              <th scope="col" className="px-5 py-3.5">Provider & Integrations</th>
              <th scope="col" className="px-5 py-3.5">Joined</th>
              <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => {
              const isAdmin = u.role === 'ADMIN';
              const isSelf = currentUser && (currentUser._id === u.id || currentUser.id === u.id);

              return (
                <tr
                  key={u.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* User Name & Avatar */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.name || 'User avatar'}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {u.name || 'Unnamed User'}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded">
                              You
                            </span>
                          )}
                        </div>
                        {u.lichessUsername && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            @{u.lichessUsername}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-5 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-xs">
                    {u.email}
                  </td>

                  {/* Role Badge */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isAdmin
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isAdmin && <Shield className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
                      <span>{u.role}</span>
                    </span>
                  </td>

                  {/* Provider & Integrations */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      <span className="capitalize text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {u.authProvider || 'local'}
                      </span>
                      {u.lichessConnected && (
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/80">
                          Lichess
                        </span>
                      )}
                      {u.googleConnected && (
                        <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/80">
                          Google
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Joined Date */}
                  <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(u.createdAt)}
                  </td>

                  {/* Actions Column */}
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => onViewDetails(u)}
                        id={`user-details-btn-${u.id}`}
                        title="View user details"
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[36px]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRoleClick(u)}
                        id={`user-change-role-btn-${u.id}`}
                        title={isAdmin ? 'Demote to regular user' : 'Promote to administrator'}
                        className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer min-h-[36px] ${
                          isAdmin
                            ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                        }`}
                      >
                        {isAdmin ? (
                          <>
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span>Demote</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Promote</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ──────────────── Mobile Card List View (Visible on small screens) ──────────────── */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {users.map((u) => {
          const isAdmin = u.role === 'ADMIN';
          const isSelf = currentUser && (currentUser._id === u.id || currentUser.id === u.id);

          return (
            <div key={u.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-3 min-w-0">
                  {u.avatar ? (
                    <img
                      src={u.avatar}
                      alt={u.name || 'User avatar'}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <div className="truncate">
                    <div className="flex items-center space-x-1.5">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                        {u.name || 'Unnamed User'}
                      </p>
                      {isSelf && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                      {u.email}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                    isAdmin
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isAdmin && <Shield className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
                  <span>{u.role}</span>
                </span>
              </div>

              {/* Integrations and Joined date */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 gap-2">
                <div className="flex items-center space-x-1.5">
                  <span className="capitalize bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {u.authProvider || 'local'}
                  </span>
                  {u.lichessConnected && (
                    <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80">
                      Lichess
                    </span>
                  )}
                  {u.googleConnected && (
                    <span className="text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/80">
                      Google
                    </span>
                  )}
                </div>
                <span>Joined {formatDate(u.createdAt)}</span>
              </div>

              {/* Action Buttons for Mobile */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onViewDetails(u)}
                  className="w-full inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer min-h-[40px]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>View Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => onRoleClick(u)}
                  className={`w-full inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[40px] ${
                    isAdmin
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {isAdmin ? (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span>Demote</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Promote</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminUsersTable;
