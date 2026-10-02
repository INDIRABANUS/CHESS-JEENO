import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';

/**
 * DeleteConfirmModal — confirmation dialog before permanently deleting a tournament.
 *
 * Props:
 * @param {boolean}  isOpen         – Controls visibility of the modal
 * @param {Function} onClose        – Callback to close/dismiss the modal
 * @param {Function} onConfirm      – Callback to execute deletion
 * @param {string}   tournamentName – Name of the tournament being deleted
 * @param {boolean}  loading        – Deletion in-progress loading state
 */
const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  tournamentName = '',
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 text-center space-y-4 transition-colors">
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full inline-flex">
          <Trash2 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Delete Tournament?</h3>
          <p className="text-sm sm:text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">&quot;{tournamentName}&quot;</span>?
            This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-center space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center min-h-[44px] space-x-1 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            <span>{loading ? 'Deleting...' : 'Confirm Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
