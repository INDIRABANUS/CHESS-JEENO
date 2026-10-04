import React, { useEffect } from 'react';
import { Ban, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * AdminTournamentCancelModal — Confirmation dialog before an admin cancels a tournament.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onConfirm
 * @param {Object} props.tournament - Target tournament
 * @param {boolean} props.loading
 * @param {string|null} props.error
 */
const AdminTournamentCancelModal = ({
  isOpen,
  onClose,
  onConfirm,
  tournament,
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

  if (!isOpen || !tournament) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-center space-y-4 transition-colors">
        {/* Header Icon */}
        <div className="flex justify-center">
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-200 dark:border-rose-800/80">
            <Ban className="h-8 w-8" />
          </div>
        </div>

        {/* Modal Title & Description */}
        <div>
          <h3 id="cancel-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
            Cancel Tournament?
          </h3>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Are you sure you want to cancel{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              &quot;{tournament.name}&quot;
            </span>
            ? The tournament status will transition to{' '}
            <strong className="text-rose-600 dark:text-rose-400">CANCELLED</strong>. No new rounds
            will start. Historical records and participant details will be preserved.
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
            id="dismiss-cancel-tournament-btn"
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
          >
            Keep Tournament
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            id="confirm-cancel-tournament-btn"
            className="inline-flex items-center justify-center min-h-[44px] space-x-2 px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 rounded-xl transition cursor-pointer shadow-xs"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{loading ? 'Cancelling...' : 'Confirm Cancellation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminTournamentCancelModal;
