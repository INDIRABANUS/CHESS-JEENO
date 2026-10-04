import React, { useEffect } from 'react';
import { Shield, ShieldAlert, AlertTriangle, Loader2, X } from 'lucide-react';

/**
 * AdminRoleConfirmModal — Confirmation dialog before promoting or demoting a user's role.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onConfirm
 * @param {Object} props.user - Target user object
 * @param {string} props.targetRole - 'USER' or 'ADMIN'
 * @param {boolean} props.loading
 * @param {string|null} props.error
 */
const AdminRoleConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  user,
  targetRole,
  loading = false,
  error = null,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen || !user) return null;

  const isPromoting = targetRole === 'ADMIN';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-center space-y-4 transition-colors">
        {/* Header Icon */}
        <div className="flex justify-center">
          {isPromoting ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-200 dark:border-amber-800/80">
              <Shield className="h-8 w-8" />
            </div>
          ) : (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-200 dark:border-rose-800/80">
              <ShieldAlert className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Modal Title & Description */}
        <div>
          <h3 id="role-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
            {isPromoting ? 'Promote to Administrator?' : 'Remove Admin Privileges?'}
          </h3>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            {isPromoting ? (
              <>
                Are you sure you want to promote{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {user.name}
                </span>{' '}
                (<span className="font-mono text-xs">{user.email}</span>) to{' '}
                <strong className="text-amber-600 dark:text-amber-400">ADMIN</strong>? This will
                grant them full platform administration capabilities.
              </>
            ) : (
              <>
                Are you sure you want to demote{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {user.name}
                </span>{' '}
                (<span className="font-mono text-xs">{user.email}</span>) to regular{' '}
                <strong className="text-slate-700 dark:text-slate-300">USER</strong>? They will
                lose access to all administrative tools and APIs.
              </>
            )}
          </p>
        </div>

        {/* Error Notification Banner if any */}
        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs text-left flex items-start space-x-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            id="cancel-role-change-btn"
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            id="confirm-role-change-btn"
            className={`inline-flex items-center justify-center min-h-[44px] space-x-2 px-5 py-2.5 text-xs font-semibold text-white rounded-xl transition cursor-pointer shadow-xs ${
              isPromoting
                ? 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600'
                : 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600'
            }`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{loading ? 'Updating...' : isPromoting ? 'Confirm Promotion' : 'Confirm Demotion'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminRoleConfirmModal;
