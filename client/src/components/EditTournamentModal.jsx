import React from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';

/**
 * EditTournamentModal — renders the modal dialog for editing tournament details.
 *
 * Props:
 * @param {boolean}  isOpen   – Controls visibility of the modal
 * @param {Function} onClose  – Callback when modal is closed / canceled
 * @param {Object}   formData – Form fields (name, description, format, maxPlayers, clockLimit, increment, startTime, rated)
 * @param {Function} onChange – Callback to update form data
 * @param {boolean}  loading  – Indicates whether the save operation is in progress
 * @param {string}   error    – Error message string, if any
 * @param {Function} onSubmit – Callback when form is submitted
 */
const EditTournamentModal = ({
  isOpen,
  onClose,
  formData = {},
  onChange,
  loading = false,
  error = null,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-lg">Edit Tournament</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tournament Name
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) =>
                onChange && onChange({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={formData.description || ''}
              onChange={(e) =>
                onChange && onChange({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Format
              </label>
              <select
                value={formData.format || 'SWISS'}
                onChange={(e) =>
                  onChange && onChange({ ...formData, format: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="SWISS">Swiss System</option>
                <option value="ROUND_ROBIN">Round Robin</option>
                <option value="KNOCKOUT">Single Elimination</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Players
              </label>
              <input
                type="number"
                min="2"
                value={formData.maxPlayers ?? ''}
                onChange={(e) =>
                  onChange && onChange({ ...formData, maxPlayers: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clock Limit (Sec)
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.clockLimit ?? ''}
                onChange={(e) =>
                  onChange && onChange({ ...formData, clockLimit: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Increment (Sec)
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.increment ?? ''}
                onChange={(e) =>
                  onChange && onChange({ ...formData, increment: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Start Time
            </label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={(e) =>
                onChange && onChange({ ...formData, startTime: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="ratedCheck"
              checked={Boolean(formData.rated)}
              onChange={(e) =>
                onChange && onChange({ ...formData, rated: e.target.checked })
              }
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="ratedCheck" className="text-xs font-medium text-slate-700">
              Rated Tournament
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTournamentModal;
