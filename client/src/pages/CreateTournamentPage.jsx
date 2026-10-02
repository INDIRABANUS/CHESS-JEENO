import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Trophy,
  ArrowLeft,
  Clock,
  Users,
  Calendar,
  Shield,
  Loader2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { createTournament } from '../services/tournamentService';
import { PRESET_TIME_CONTROLS } from '../utils/constants';

const CreateTournamentPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    format: 'SWISS',
    totalRounds: 5,
    rated: false,
    clockLimit: 300, // 5 minutes in seconds
    increment: 0,
    startTime: '',
    maxPlayers: 16,
  });

  const [selectedPreset, setSelectedPreset] = useState('5+0');
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset.label);
    setIsCustomTime(false);
    setCustomMinutes(preset.clockLimit / 60);
    setFormData((prev) => ({
      ...prev,
      clockLimit: preset.clockLimit,
      increment: preset.increment,
    }));
  };

  const handleCustomTimeChange = (minutes, incrementSec) => {
    setIsCustomTime(true);
    setSelectedPreset(null);
    setCustomMinutes(minutes);
    const totalSeconds = Math.max(1, Math.round(Number(minutes) * 60));
    setFormData((prev) => ({
      ...prev,
      clockLimit: totalSeconds,
      increment: Number(incrementSec) >= 0 ? Number(incrementSec) : 0,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Basic frontend validation
    if (!formData.name.trim()) {
      setError('Please enter a tournament name');
      return;
    }

    if (formData.clockLimit < 1) {
      setError('Clock limit must be at least 1 second');
      return;
    }

    if (formData.increment < 0) {
      setError('Increment cannot be negative');
      return;
    }

    if (formData.maxPlayers && Number(formData.maxPlayers) < 2) {
      setError('Maximum players must be at least 2');
      return;
    }

    if (formData.format === 'SWISS') {
      const rounds = Number(formData.totalRounds);
      if (!rounds || !Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
        setError('Total rounds for Swiss tournaments must be an integer between 1 and 20');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        format: formData.format,
        totalRounds: formData.format === 'SWISS' ? Number(formData.totalRounds) : null,
        rated: Boolean(formData.rated),
        clockLimit: Number(formData.clockLimit),
        increment: Number(formData.increment),
        maxPlayers: formData.maxPlayers ? Number(formData.maxPlayers) : null,
        startTime: formData.startTime ? new Date(formData.startTime).toISOString() : null,
      };

      const res = await createTournament(payload);
      if (res && res.data && res.data._id) {
        navigate(`/tournaments/${res.data._id}`);
      } else {
        navigate('/tournaments');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create tournament');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/tournaments"
          className="inline-flex items-center space-x-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Tournaments</span>
        </Link>
      </div>

      {/* Main Form Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Create New Tournament
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Set up format, time controls, and participant limits for your tournament.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 sm:mx-8 mt-6 p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-3 text-sm text-rose-700">
            <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {/* Tournament Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Tournament Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Saturday Night Blitz Open"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Description <span className="text-xs text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Provide tournament guidelines, prize information, or extra notes..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Tournament Format <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'SWISS',
                  title: 'Swiss System',
                  desc: 'Equal number of rounds for all players. Ideal for large groups.',
                },
                {
                  id: 'ROUND_ROBIN',
                  title: 'Round Robin',
                  desc: 'Every player plays against every other player once.',
                },
                {
                  id: 'KNOCKOUT',
                  title: 'Single Elimination',
                  desc: 'Winners advance to the next round until a champion is crowned.',
                },
              ].map((fmt) => (
                <button
                  type="button"
                  key={fmt.id}
                  onClick={() => setFormData({ ...formData, format: fmt.id })}
                  className={`p-4 rounded-lg border text-left transition flex flex-col justify-between ${
                    formData.format === fmt.id
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className={`text-sm font-bold ${
                    formData.format === fmt.id ? 'text-indigo-700' : 'text-slate-800'
                  }`}>
                    {fmt.title}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {fmt.desc}
                  </span>
                </button>
              ))}
            </div>

            {/* Swiss Total Rounds Field */}
            {formData.format === 'SWISS' && (
              <div className="mt-4 p-4 rounded-lg bg-indigo-50/60 border border-indigo-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <label htmlFor="totalRounds" className="block text-sm font-bold text-slate-800">
                      Number of Rounds <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure total Swiss rounds to be played (1 to 20).
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      id="totalRounds"
                      min="1"
                      max="20"
                      value={formData.totalRounds || ''}
                      onChange={(e) => setFormData({ ...formData, totalRounds: e.target.value })}
                      className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center"
                      placeholder="5"
                      required
                    />
                    <span className="text-xs font-medium text-slate-500">Rounds</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Time Controls Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center space-x-1.5">
                <Clock className="h-4 w-4 text-indigo-600" />
                <span>Time Control Presets</span>
              </label>
              <span className="text-xs text-indigo-600 font-mono font-medium">
                Current: {Math.floor(formData.clockLimit / 60)}m + {formData.increment}s
              </span>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESET_TIME_CONTROLS.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => handlePresetSelect(p)}
                  className={`min-h-[44px] py-2 px-2 rounded-lg text-xs font-semibold border transition text-center flex flex-col justify-center items-center ${
                    selectedPreset === p.label && !isCustomTime
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>{p.label}</div>
                  <div className={`text-[10px] font-normal ${
                    selectedPreset === p.label && !isCustomTime ? 'text-indigo-100' : 'text-slate-400'
                  }`}>
                    {p.name}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Time Control Controls */}
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Custom Time Settings
                </span>
                {isCustomTime && (
                  <span className="text-[11px] text-indigo-600 font-medium">
                    (Custom active)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Clock Limit (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={customMinutes}
                    onChange={(e) =>
                      handleCustomTimeChange(e.target.value, formData.increment)
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">
                    = {formData.clockLimit} seconds
                  </span>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Increment (Seconds per move)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.increment}
                    onChange={(e) =>
                      handleCustomTimeChange(customMinutes, e.target.value)
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rated Toggle & Player Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
            {/* Rated Toggle */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Shield className="h-4 w-4 text-indigo-600" />
                <span>Tournament Type</span>
              </label>
              <div className="flex items-center space-x-4 mt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="rated"
                    checked={!formData.rated}
                    onChange={() => setFormData({ ...formData, rated: false })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">Casual (Unrated)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="rated"
                    checked={formData.rated}
                    onChange={() => setFormData({ ...formData, rated: true })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-amber-700">Rated</span>
                </label>
              </div>
            </div>

            {/* Max Players */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Users className="h-4 w-4 text-indigo-600" />
                <span>Maximum Players</span>
              </label>
              <input
                type="number"
                min="2"
                max="512"
                value={formData.maxPlayers}
                onChange={(e) => setFormData({ ...formData, maxPlayers: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-400">
                Minimum 2 participants required
              </span>
            </div>
          </div>

          {/* Start Time */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span>Scheduled Start Time</span>
              <span className="text-xs text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full sm:w-80 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Leave blank to keep tournament open for unscheduled registration.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <Link
              to="/tournaments"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{loading ? 'Creating...' : 'Create Tournament'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTournamentPage;
