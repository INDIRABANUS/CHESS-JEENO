import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Trophy,
  Users,
  Shield,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as teamCompetitionService from '../services/teamCompetitionService';

const CreateTeamCompetitionPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxTeams: '8',
    maxPlayersPerTeam: '6',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Authentication guard
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
        <Shield className="h-12 w-12 text-indigo-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Authentication Required
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Please log in to create and organize team chess competitions.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setError('Competition name is required');
      return;
    }

    if (trimmedName.length > 100) {
      setError('Competition name cannot exceed 100 characters');
      return;
    }

    const payload = {
      name: trimmedName,
      description: formData.description.trim(),
      maxTeams: formData.maxTeams ? parseInt(formData.maxTeams, 10) : null,
      maxPlayersPerTeam: formData.maxPlayersPerTeam ? parseInt(formData.maxPlayersPerTeam, 10) : null,
      status: 'REGISTRATION',
    };

    setLoading(true);
    try {
      const competition = await teamCompetitionService.createCompetition(payload);
      if (competition?._id) {
        navigate(`/team-competitions/${competition._id}`);
      } else {
        navigate('/team-competitions');
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Failed to create team competition'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Back button */}
      <div className="mb-6">
        <Link
          to="/team-competitions"
          className="inline-flex items-center space-x-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Team Competitions</span>
        </Link>
      </div>

      {/* Main card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 p-6 sm:p-8 text-white">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs">
              <Users className="h-6 w-6 text-amber-300" />
            </div>
            <span className="text-xs uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full">
              Team Competition V1
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Create Team Competition
          </h1>
          <p className="mt-2 text-indigo-100 text-sm max-w-xl">
            Set up a multi-team collegiate or club chess competition. You will be the competition organizer and oversee team registration.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Competition Name */}
          <div>
            <label
              htmlFor="comp-name"
              className="block text-sm font-semibold text-slate-900 dark:text-white mb-1.5"
            >
              Competition Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="comp-name"
              name="name"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. Tamil Nadu College Chess Championship 2026"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Max 100 characters. Choose a descriptive title for all teams.
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="comp-description"
              className="block text-sm font-semibold text-slate-900 dark:text-white mb-1.5"
            >
              Description & Rules
            </label>
            <textarea
              id="comp-description"
              name="description"
              rows={4}
              maxLength={1000}
              placeholder="Provide information regarding competition schedule, eligibility, requirements, or squad rules..."
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Optional details for participants and captains</span>
              <span>{formData.description.length}/1000</span>
            </div>
          </div>

          {/* Grid Settings: Max Teams & Max Players Per Team */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <div>
              <label
                htmlFor="comp-max-teams"
                className="block text-sm font-semibold text-slate-900 dark:text-white mb-1.5"
              >
                Maximum Teams Capacity
              </label>
              <select
                id="comp-max-teams"
                name="maxTeams"
                value={formData.maxTeams}
                onChange={handleChange}
                className="w-full px-3.5 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="2">2 Teams (Match)</option>
                <option value="4">4 Teams (Quadrangular)</option>
                <option value="8">8 Teams (Standard Bracket/Division)</option>
                <option value="16">16 Teams (Championship)</option>
                <option value="32">32 Teams (Large League)</option>
                <option value="">Unlimited Teams</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Minimum 2 teams required to mark competition as ready.
              </p>
            </div>

            <div>
              <label
                htmlFor="comp-max-players"
                className="block text-sm font-semibold text-slate-900 dark:text-white mb-1.5"
              >
                Max Players per Team (Roster Cap)
              </label>
              <select
                id="comp-max-players"
                name="maxPlayersPerTeam"
                value={formData.maxPlayersPerTeam}
                onChange={handleChange}
                className="w-full px-3.5 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="4">4 Players</option>
                <option value="6">6 Players (Standard)</option>
                <option value="8">8 Players</option>
                <option value="10">10 Players</option>
                <option value="12">12 Players</option>
                <option value="">No Roster Limit</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Optional bounded roster maximum per team squad.
              </p>
            </div>
          </div>

          {/* Scope notice */}
          <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 p-4 text-xs text-indigo-900 dark:text-indigo-200 flex items-start space-x-3">
            <HelpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Team Competition Architecture</p>
              <p className="mt-0.5 text-indigo-800 dark:text-indigo-300">
                This competition will support multiple teams, squad captains, and roster invitations. Team vs Team pairings, board assignments, and round scheduling will follow in subsequent tournament milestones.
              </p>
            </div>
          </div>

          {/* Submit button */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
            <Link
              to="/team-competitions"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px] inline-flex items-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 shadow-md shadow-indigo-600/20 transition cursor-pointer min-h-[44px] inline-flex items-center space-x-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>Create Competition</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTeamCompetitionPage;
