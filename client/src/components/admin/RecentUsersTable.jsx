import React from 'react';
import { Users, Shield, Calendar, Mail, UserCheck } from 'lucide-react';

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
 * RecentUsersTable — Displays recent platform registrations with roles and auth providers.
 * 
 * @param {Object} props
 * @param {Array<Object>} props.users - List of recent user objects
 */
const RecentUsersTable = ({ users = [] }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Users
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest registrations across all auth providers
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {users.length} {users.length === 1 ? 'user' : 'users'}
        </span>
      </div>

      {/* Empty State */}
      {users.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <UserCheck className="h-10 w-10 text-slate-400 mx-auto stroke-1" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No users registered yet
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            New accounts will appear here as users register.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th scope="col" className="px-5 py-3">User</th>
                  <th scope="col" className="px-5 py-3">Email</th>
                  <th scope="col" className="px-5 py-3">Role</th>
                  <th scope="col" className="px-5 py-3">Provider</th>
                  <th scope="col" className="px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => {
                  const isAdmin = u.role === 'ADMIN';
                  return (
                    <tr
                      key={u.id || u.email}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name / Avatar */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {u.name || 'Unnamed User'}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-xs">
                        {u.email}
                      </td>

                      {/* Role Badge */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
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

                      {/* Provider */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="capitalize text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                          {u.authProvider || 'local'}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(u.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (Visible on small screens) */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => {
              const isAdmin = u.role === 'ADMIN';
              return (
                <div key={u.id || u.email} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                          {u.name || 'Unnamed User'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
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

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <span className="capitalize bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      Provider: {u.authProvider || 'local'}
                    </span>
                    <span>Joined: {formatDate(u.createdAt)}</span>
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

export default RecentUsersTable;
