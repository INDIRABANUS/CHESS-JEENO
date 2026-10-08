import React, { useState } from 'react';
import { X, Swords, AlertCircle, Loader2 } from 'lucide-react';

const CreateMatchModal = ({
  isOpen,
  onClose,
  onSubmit,
  rounds = [],
  teams = [],
  selectedRoundId = null,
  loading = false,
}) => {
  const [roundId, setRoundId] = useState(selectedRoundId || (rounds[0]?._id || ''));
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [boardCount, setBoardCount] = useState(4);
  const [scheduledStart, setScheduledStart] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const activeTeams = teams.filter((t) => t.status === 'ACTIVE');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!roundId) {
      setError('Please select a round');
      return;
    }

    if (!teamA || !teamB) {
      setError('Please select both Team A and Team B');
      return;
    }

    if (teamA === teamB) {
      setError('Team A and Team B must be different');
      return;
    }

    const parsedBoardCount = parseInt(boardCount, 10);
    if (isNaN(parsedBoardCount) || parsedBoardCount < 1 || parsedBoardCount > 20) {
      setError('Board count must be between 1 and 20');
      return;
    }

    try {
      await onSubmit({
        roundId,
        teamA,
        teamB,
        boardCount: parsedBoardCount,
        scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create match');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Team Match</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Schedule a head-to-head match between two teams in a round.
            </p>
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
              Round *
            </label>
            <select
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">-- Select Round --</option>
              {rounds.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name || `Round ${r.roundNumber}`} ({r.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Team A (White) *
              </label>
              <select
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Select Team A --</option>
                {activeTeams.map((t) => (
                  <option key={t._id} value={t._id} disabled={t._id === teamB}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Team B (Black) *
              </label>
              <select
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Select Team B --</option>
                {activeTeams.map((t) => (
                  <option key={t._id} value={t._id} disabled={t._id === teamA}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Board Count (1 - 20) *
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={boardCount}
                onChange={(e) => setBoardCount(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Creates {boardCount} individual board lineups.
              </p>
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
              <span>Create Match</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMatchModal;
