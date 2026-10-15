import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Trophy,
  Shield,
  Search,
  PlusCircle,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as teamCompetitionService from '../services/teamCompetitionService';

const TeamCompetitionsPage = () => {
  const { isAuthenticated } = useAuth();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [viewFilter, setViewFilter] = useState('all'); // 'all' | 'my'
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  const loadCompetitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await teamCompetitionService.getCompetitions({
        status: statusFilter || undefined,
        view: viewFilter,
        search: searchQuery.trim() || undefined,
        page,
        limit: 9,
      });
      setCompetitions(data.data || []);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Failed to load team competitions'
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, viewFilter, searchQuery, page]);

  useEffect(() => {
    loadCompetitions();
  }, [loadCompetitions]);

  const getStatusChip = (status) => {
    switch (status) {
      case 'REGISTRATION':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Registration Open</span>
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
            <CheckCircle2 className="h-3 w-3" />
            <span>Ready</span>
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span>Draft</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
            <XCircle className="h-3 w-3" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <Users className="h-4 w-4" />
            <span>Team Competition Architecture</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Team Competitions
          </h1>
          <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Multi-team chess championships, squad rosters, and captain management.
          </p>
        </div>

        {isAuthenticated && (
          <Link
            to="/team-competitions/create"
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition cursor-pointer min-h-[44px] shrink-0"
          >
            <PlusCircle className="h-5 w-5" />
            <span>Create Team Competition</span>
          </Link>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Tabs for Views */}
        <div className="flex items-center space-x-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => {
              setViewFilter('all');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Competitions
          </button>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                setViewFilter('my');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewFilter === 'my'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              My Competitions
            </button>
          )}
        </div>

        {/* Status Dropdown + Search input */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
          >
            <option value="">All Statuses</option>
            <option value="REGISTRATION">Registration Open</option>
            <option value="READY">Ready</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search competitions..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Competitions Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Loading competitions...</p>
        </div>
      ) : competitions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 sm:p-16 text-center shadow-xs">
          <Shield className="h-14 w-14 text-indigo-400 mx-auto mb-4 opacity-80" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            No Team Competitions Found
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            {viewFilter === 'my'
              ? "You haven't created or joined any team competitions yet."
              : 'Be the first organizer to establish a multi-team chess competition!'}
          </p>
          {isAuthenticated && (
            <Link
              to="/team-competitions/create"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Competition</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competitions.map((comp) => (
            <div
              key={comp._id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  {getStatusChip(comp.status)}
                  <span className="text-xs text-slate-400 flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(comp.createdAt).toLocaleDateString()}</span>
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1 hover:text-indigo-600 transition">
                  <Link to={`/team-competitions/${comp._id}`}>{comp.name}</Link>
                </h3>

                {comp.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {comp.description}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span className="flex items-center space-x-1.5">
                      <Users className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Teams Participating:</span>
                    </span>
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                      {comp.activeTeamsCount || 0}
                      {comp.maxTeams ? ` / ${comp.maxTeams}` : ' teams'}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span className="flex items-center space-x-1.5">
                      <Shield className="h-3.5 w-3.5 text-amber-500" />
                      <span>Organizer:</span>
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                      {comp.organizer?.name || 'Organizer'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800">
                <Link
                  to={`/team-competitions/${comp._id}`}
                  className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer min-h-[40px]"
                >
                  <span>View Competition</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} competitions)
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={!pagination.hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamCompetitionsPage;
