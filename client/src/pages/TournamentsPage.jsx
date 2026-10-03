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
  ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTournaments } from '../services/tournamentService';
import { formatTimeControl, formatDate } from '../utils/formatters';
import { FORMAT_LABELS, STATUS_BADGES } from '../utils/constants';

const TournamentsPage = () => {
  const { isAuthenticated } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [statusFilter, setStatusFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  // If user logs out while on 'my' view, safely fallback to 'all'
  useEffect(() => {
    if (!isAuthenticated && view === 'my') {
      setView('all');
    }
  }, [isAuthenticated, view]);

  const fetchTournamentList = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeView = isAuthenticated ? view : 'all';
      const filters = {
        view: activeView,
        sort: sortBy,
      };
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
  }, [view, sortBy, statusFilter, formatFilter, isAuthenticated]);

  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Chess Tournaments</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
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

      {/* View Selector (ALL / MY TOURNAMENTS) */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setView('all')}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
            view === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          ALL
        </button>
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => setView('my')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
              view === 'my'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            MY TOURNAMENTS
          </button>
        )}
      </div>

      {/* Filters and Sort Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center justify-between sm:justify-start space-x-2 text-slate-500 dark:text-slate-400 text-sm font-medium shrink-0">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span>Filters:</span>
          </div>
          {(statusFilter || formatFilter || sortBy !== 'relevance') && (
            <button
              onClick={() => {
                setStatusFilter('');
                setFormatFilter('');
                setSortBy('relevance');
              }}
              className="sm:hidden text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline font-medium inline-flex items-center min-h-[40px] px-2 py-2 -my-2"
            >
              Reset
            </button>
          )}
        </div>

        {/* Filter and Sort Dropdowns */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
            className="w-full sm:w-auto min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Formats</option>
            <option value="SWISS">Swiss System</option>
            <option value="ROUND_ROBIN">Round Robin</option>
            <option value="KNOCKOUT">Single Elimination</option>
          </select>

          {/* Sort Selector */}
          <div className="flex items-center space-x-2 w-full sm:w-auto sm:ml-auto">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 hidden sm:inline" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:w-auto min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="relevance">Most Relevant</option>
              <option value="startingSoon">Starting Soon</option>
              <option value="newest">Newest</option>
              <option value="recentlyCompleted">Recently Completed</option>
            </select>
          </div>
        </div>

        {(statusFilter || formatFilter || sortBy !== 'relevance') && (
          <button
            onClick={() => {
              setStatusFilter('');
              setFormatFilter('');
              setSortBy('relevance');
            }}
            className="hidden sm:inline-block text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline font-medium ml-auto shrink-0"
          >
            Reset
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 text-center">
          <Loader2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300 text-sm">Loading tournaments...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-rose-200 dark:border-rose-900/50 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
          <h3 className="text-slate-800 dark:text-slate-100 font-semibold mb-1">Failed to Load Tournaments</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <button
            onClick={fetchTournamentList}
            className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg text-sm font-medium transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && tournaments.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 text-center">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full inline-flex mb-3">
            <Trophy className="h-8 w-8 text-indigo-500" />
          </div>
          {view === 'my' ? (
            <>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">No Tournaments Yet</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto mb-6">
                You haven't joined or created any tournaments yet.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setView('all')}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
                >
                  <span>Browse Tournaments</span>
                </button>
                <Link
                  to="/tournaments/create"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Tournament</span>
                </Link>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">No Tournaments Found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto mb-6">
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
            </>
          )}
        </div>
      )}

      {/* Tournament Cards Grid */}
      {!loading && !error && tournaments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((t) => (
            <Link
              key={t._id}
              to={`/tournaments/${t._id}`}
              className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition p-6 flex flex-col justify-between group"
            >
              <div>
                {/* Status, Role, and Rated Badges */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      STATUS_BADGES[t.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {t.status}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {view === 'my' && t.myRole && (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                          t.myRole === 'HOST'
                            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {t.myRole}
                      </span>
                    )}
                    {t.rated ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded">
                        <Shield className="h-3 w-3" />
                        <span>Rated</span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
                        Casual
                      </span>
                    )}
                  </div>
                </div>

                {/* Tournament Name */}
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-1 mb-1">
                  {t.name}
                </h3>

                {/* Description */}
                <p className="text-sm sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                  {t.description || 'No description provided.'}
                </p>

                {/* Details List */}
                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500">Format</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {FORMAT_LABELS[t.format] || t.format}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                      <Clock className="h-3.5 w-3.5 inline text-slate-400 dark:text-slate-500" />
                      <span>Time Control</span>
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {formatTimeControl(t.clockLimit, t.increment)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                      <Users className="h-3.5 w-3.5 inline text-slate-400 dark:text-slate-500" />
                      <span>Capacity</span>
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {t.registeredPlayers ?? 0} / {t.maxPlayers ? `${t.maxPlayers} Players` : 'Open'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                      <Calendar className="h-3.5 w-3.5 inline text-slate-400 dark:text-slate-500" />
                      <span>Starts</span>
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                      {formatDate(t.startTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Creator info */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>By {t.createdBy?.name || 'CHESS JEENO Host'}</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline">
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
