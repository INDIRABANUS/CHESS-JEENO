import React, { useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Shield,
  Calendar,
  Mail,
  Fingerprint,
  Link2,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

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
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/**
 * AdminUserDetailsModal — Inspects safe platform user account details.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object|null} props.user
 * @param {Function} props.onRoleClick - Trigger role change workflow
 */
const AdminUserDetailsModal = ({ isOpen, onClose, user, onRoleClick }) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const isAdmin = user.role === 'ADMIN';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-details-title"
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-6 transition-colors my-8">
        {/* Top Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || 'User avatar'}
                className="w-12 h-12 rounded-full object-cover shrink-0 border-2 border-indigo-500/20"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shrink-0 shadow-xs">
                {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-6 w-6" />}
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h3 id="user-details-title" className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {user.name || 'Unnamed User'}
                </h3>
                <span
                  className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isAdmin
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isAdmin && <Shield className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
                  <span>{user.role}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            id="close-user-details-modal-btn"
            title="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Detailed Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* User ID */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1 sm:col-span-2">
            <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <Fingerprint className="h-3.5 w-3.5" />
              <span>Platform User ID</span>
            </div>
            <p className="font-mono text-slate-800 dark:text-slate-200 text-xs select-all">
              {user.id}
            </p>
          </div>

          {/* Auth Provider */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <Mail className="h-3.5 w-3.5" />
              <span>Registration Provider</span>
            </div>
            <p className="font-semibold text-slate-900 dark:text-white capitalize">
              {user.authProvider || 'local'}
            </p>
          </div>

          {/* Lichess Integration */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <Link2 className="h-3.5 w-3.5" />
              <span>Lichess Connection</span>
            </div>
            <div className="flex items-center space-x-1.5">
              {user.lichessConnected ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="font-medium text-slate-900 dark:text-white">
                    Connected ({user.lichessUsername || 'account'})
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400">Not Connected</span>
                </>
              )}
            </div>
          </div>

          {/* Google Integration */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <Link2 className="h-3.5 w-3.5" />
              <span>Google Account</span>
            </div>
            <div className="flex items-center space-x-1.5">
              {user.googleConnected ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="font-medium text-slate-900 dark:text-white">Linked</span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400">Not Linked</span>
                </>
              )}
            </div>
          </div>

          {/* Account Created Date */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <Calendar className="h-3.5 w-3.5" />
              <span>Member Since</span>
            </div>
            <p className="font-medium text-slate-800 dark:text-slate-200">
              {formatDate(user.createdAt)}
            </p>
          </div>

          {/* Bio */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1 sm:col-span-2">
            <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <FileText className="h-3.5 w-3.5" />
              <span>Profile Bio</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 italic text-xs">
              {user.bio ? `"${user.bio}"` : 'No bio provided.'}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px]"
          >
            Close Details
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onRoleClick(user);
            }}
            id="modal-change-role-btn"
            className={`w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer min-h-[44px] shadow-xs ${
              isAdmin
                ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>{isAdmin ? 'Demote to Regular User' : 'Promote to Administrator'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetailsModal;
