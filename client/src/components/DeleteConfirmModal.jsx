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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-full inline-flex">
          <Trash2 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Delete Tournament?</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Are you sure you want to delete <span className="font-semibold">"{tournamentName}"</span>?
            This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-center space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center space-x-1 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            <span>{loading ? 'Deleting...' : 'Confirm Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
