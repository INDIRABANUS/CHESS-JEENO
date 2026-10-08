import React, { useState } from 'react';
import { X, Calendar, Layers, AlertCircle, Loader2 } from 'lucide-react';

const CreateRoundModal = ({
  isOpen,
  onClose,
  onSubmit,
  nextRoundNumber = 1,
  loading = false,
}) => {
  const [roundNumber, setRoundNumber] = useState(nextRoundNumber);
  const [name, setName] = useState(`Round ${nextRoundNumber}`);
  const [scheduledStart, setScheduledStart] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedNumber = parseInt(roundNumber, 10);
    if (isNaN(parsedNumber) || parsedNumber < 1) {
      setError('Round number must be a positive integer');
      return;
    }

    try {
      await onSubmit({
        roundNumber: parsedNumber,
        name: name.trim() || `Round ${parsedNumber}`,
        scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create round');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create New Round</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Add a sequential round to this competition.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Round Number *
            </label>
            <input
              type="number"
              min="1"
              value={roundNumber}
              onChange={(e) => {
                setRoundNumber(e.target.value);
                if (!name || name.startsWith('Round ')) {
                  setName(`Round ${e.target.value}`);
                }
              }}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Round Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Round 1 - Prelims"
              maxLength={100}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Scheduled Start (Optional)
            </label>
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center space-x-2 shadow-sm min-h-[44px]"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Create Round</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoundModal;
