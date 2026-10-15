import React, { useState } from 'react';
import { Shield, X, Loader2, AlertCircle } from 'lucide-react';
import * as teamCompetitionService from '../../services/teamCompetitionService';

const CreateTeamModal = ({
  competition,
  isOpen,
  onClose,
  onTeamCreated,
}) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Team name is required');
      return;
    }

    if (trimmed.length > 60) {
      setError('Team name cannot exceed 60 characters');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await teamCompetitionService.createTeam(competition._id, { name: trimmed });
      setName('');
      if (onTeamCreated) onTeamCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Register Team
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="team-name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Team / Squad Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="team-name"
              type="text"
              placeholder="e.g. BIT Chess Club, PSG Knights..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              You will automatically become this team's captain and manage its roster.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 shadow-xs transition cursor-pointer min-h-[40px] inline-flex items-center space-x-1.5"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              <span>Create Team</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTeamModal;
