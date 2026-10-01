import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Plus,
  Clock,
  Users,
  Calendar,
  Filter,
  AlertCircle,
  Loader2,
  CheckCircle,
  Shield,
} from 'lucide-react';
import { getTournaments } from '../services/tournamentService';
import { formatTimeControl, formatDate } from '../utils/formatters';
import { FORMAT_LABELS, STATUS_BADGES } from '../utils/constants';

const TournamentsPage = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  const fetchTournamentList = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      if (formatFilter) filters.format = formatFilter;

      const res = await getTournaments(filters);
      setTournaments(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournamentList();
  }, [statusFilter, formatFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Chess Tournaments</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse and manage all tournaments hosted on CHESS JEENO
          </p>
        </div>
        <Link
          to="/tournaments/create"
          className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>New Tournament</span>
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2 text-slate-500 text-sm font-medium">
          <Filter className="h-4 w-4" />
          <span>Filters:</span>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="REGISTRATION">Registration Open</option>
          <option value="DRAFT">Draft</option>
          <option value="RUNNING">In Progress</option>
          <option value="FINISHED">Finished</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Format Filter */}
        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">All Formats</option>
          <option value="SWISS">Swiss System</option>
          <option value="ROUND_ROBIN">Round Robin</option>
          <option value="KNOCKOUT">Single Elimination</option>
        </select>

        {(statusFilter || formatFilter) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setFormatFilter('');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-600 text-sm">Loading tournaments...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-white rounded-xl shadow-sm border border-rose-200 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
          <h3 className="text-slate-800 font-semibold mb-1">Failed to Load Tournaments</h3>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button
            onClick={fetchTournamentList}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && tournaments.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full inline-flex mb-3">
            <Trophy className="h-8 w-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">No Tournaments Found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto mb-6">
            {statusFilter || formatFilter
              ? 'No tournaments match the selected filters. Try changing or clearing filters.'
              : 'There are no tournaments created yet. Be the first to organize a chess tournament!'}
          </p>
          <Link
            to="/tournaments/create"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Tournament</span>
          </Link>
        </div>
      )}

      {/* Tournament Cards Grid */}
      {!loading && !error && tournaments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((t) => (
            <Link
              key={t._id}
              to={`/tournaments/${t._id}`}
              className="bg-white rounded-xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition p-6 flex flex-col justify-between group"
            >
              <div>
                {/* Status and Rated Badges */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      STATUS_BADGES[t.status] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t.status}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {t.rated ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        <Shield className="h-3 w-3" />
                        <span>Rated</span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Casual
                      </span>
                    )}
                  </div>
                </div>

                {/* Tournament Name */}
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition line-clamp-1 mb-1">
                  {t.name}
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                  {t.description || 'No description provided.'}
                </p>

                {/* Details List */}
                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Format</span>
                    <span className="font-medium text-slate-700">
                      {FORMAT_LABELS[t.format] || t.format}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <Clock className="h-3.5 w-3.5 inline text-slate-400" />
                      <span>Time Control</span>
                    </span>
                    <span className="font-semibold text-slate-700">
                      {formatTimeControl(t.clockLimit, t.increment)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <Users className="h-3.5 w-3.5 inline text-slate-400" />
                      <span>Capacity</span>
                    </span>
                    <span className="font-medium text-slate-700">
                      {t.registeredPlayers ?? 0} / {t.maxPlayers ? `${t.maxPlayers} Players` : 'Open'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <Calendar className="h-3.5 w-3.5 inline text-slate-400" />
                      <span>Starts</span>
                    </span>
                    <span className="font-medium text-slate-700 truncate max-w-[150px]">
                      {formatDate(t.startTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Creator info */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>By {t.createdBy?.name || 'CHESS JEENO Host'}</span>
                <span className="text-indigo-600 font-semibold group-hover:underline">
                  View Details &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentsPage;
