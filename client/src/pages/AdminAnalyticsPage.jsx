import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Loader2,
  Users,
  Trophy,
  Swords,
  Play,
  CheckCircle2,
  UserCheck,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAdminAnalytics } from '../services/adminService';
import AdminNavTabs from '../components/admin/AdminNavTabs';
import AdminAnalyticsStatCard from '../components/admin/AdminAnalyticsStatCard';
import AdminDistributionCard from '../components/admin/AdminDistributionCard';
import AdminActivityChart from '../components/admin/AdminActivityChart';
import AdminGameResultsCard from '../components/admin/AdminGameResultsCard';

/**
 * AdminAnalyticsPage — Dedicated platform analytics & business insights at /admin/analytics.
 * 
 * Sections:
 * - Section A: Platform Overview (Total users, admins, tournaments, active, completed, players, pairings)
 * - Section B: User Insights (Role breakdown and 30-day registration trend)
 * - Section C: Tournament Insights (Status and format distributions, 30-day tournament creation trend)
 * - Section D: Game Insights (Completed vs aborted games, White vs Black win rates, draws)
 */
const AdminAnalyticsPage = () => {
  const { user: currentUser, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Frontend route authorization guard
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        navigate('/login', { replace: true });
      } else if (currentUser?.role !== 'ADMIN') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [authLoading, isAuthenticated, currentUser, navigate]);

  // Fetch analytics data from backend
  const fetchAnalytics = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await getAdminAnalytics();
      setAnalytics(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to load analytics data. Please verify network and server status.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentUser?.role === 'ADMIN') {
      fetchAnalytics();
    }
  }, [isAuthenticated, currentUser, fetchAnalytics]);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Verifying administrative privileges...
          </p>
        </div>
      </div>
    );
  }

  // Deny render if not admin
  if (!isAuthenticated || currentUser?.role !== 'ADMIN') {
    return null;
  }

  const overview = analytics?.overview || {};
  const users = analytics?.users || {};
  const tournaments = analytics?.tournaments || {};
  const games = analytics?.games || {};

  // Color mappings for distribution cards
  const formatColorMap = {
    SWISS: 'bg-indigo-500',
    ROUND_ROBIN: 'bg-emerald-500',
    KNOCKOUT: 'bg-amber-500',
  };

  const statusColorMap = {
    RUNNING: 'bg-emerald-500',
    IN_PROGRESS: 'bg-emerald-500',
    COUNTDOWN: 'bg-emerald-400',
    READY_CHECK: 'bg-emerald-400',
    FINISHED: 'bg-blue-500',
    COMPLETED: 'bg-blue-500',
    REGISTRATION: 'bg-purple-500',
    DRAFT: 'bg-slate-400',
    CANCELLED: 'bg-rose-500',
  };

  const roleColorMap = {
    USER: 'bg-blue-500',
    ADMIN: 'bg-amber-500',
  };

  const formatDistributionItems = (tournaments.formatDistribution || []).map((f) => ({
    label: (f.format || 'UNKNOWN').replace('_', ' '),
    count: f.count || 0,
    color: formatColorMap[f.format] || 'bg-slate-400',
  }));

  const statusDistributionItems = (tournaments.statusDistribution || []).map((s) => ({
    label: (s.status || 'UNKNOWN').replace('_', ' '),
    count: s.count || 0,
    color: statusColorMap[s.status] || 'bg-slate-400',
  }));

  const roleDistributionItems = (users.roleDistribution || []).map((r) => ({
    label: r.role || 'UNKNOWN',
    count: r.count || 0,
    color: roleColorMap[r.role] || 'bg-slate-400',
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <Shield className="h-3 w-3" />
              <span>ADMIN ACCESS</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 flex items-center space-x-2.5">
            <BarChart3 className="h-7 w-7 text-amber-500" />
            <span>Platform Analytics & Insights</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-data platform growth, tournament distributions, and game performance metrics.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {lastUpdated && (
            <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Admin Sub-Navigation Tabs */}
      <AdminNavTabs />

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl p-5 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
              Error Loading Platform Analytics
            </h3>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              {error}
            </p>
            <button
              onClick={() => fetchAnalytics(false)}
              className="mt-3 text-xs font-bold text-red-700 dark:text-red-300 underline hover:no-underline cursor-pointer"
            >
              Try again &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Skeleton Loading State */}
      {loading && !analytics && (
        <div className="space-y-8 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-72 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      )}

      {/* Content Rendered */}
      {analytics && (
        <div className="space-y-10">
          {/* =========================================================================
              SECTION A: PLATFORM OVERVIEW
              ========================================================================= */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Platform Overview
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <AdminAnalyticsStatCard
                title="Total Users"
                value={overview.totalUsers ?? 0}
                subtitle={`${overview.totalAdmins ?? 0} admin${overview.totalAdmins === 1 ? '' : 's'}`}
                icon={<Users className="h-5 w-5" />}
                colorScheme="blue"
              />

              <AdminAnalyticsStatCard
                title="Tournaments"
                value={overview.totalTournaments ?? 0}
                subtitle="All formats"
                icon={<Trophy className="h-5 w-5" />}
                colorScheme="amber"
              />

              <AdminAnalyticsStatCard
                title="Active Now"
                value={overview.activeTournaments ?? 0}
                subtitle="Playable state"
                icon={<Play className="h-5 w-5" />}
                colorScheme="emerald"
                badge={overview.activeTournaments > 0 ? 'Live' : null}
              />

              <AdminAnalyticsStatCard
                title="Completed"
                value={overview.completedTournaments ?? 0}
                subtitle={`${overview.cancelledTournaments ?? 0} cancelled`}
                icon={<CheckCircle2 className="h-5 w-5" />}
                colorScheme="purple"
              />

              <AdminAnalyticsStatCard
                title="Tournament Players"
                value={overview.totalTournamentPlayers ?? 0}
                subtitle="Player enrollments"
                icon={<UserCheck className="h-5 w-5" />}
                colorScheme="indigo"
              />

              <AdminAnalyticsStatCard
                title="Games / Pairings"
                value={overview.totalPairings ?? 0}
                subtitle={`${overview.completedPairings ?? 0} completed`}
                icon={<Swords className="h-5 w-5" />}
                colorScheme="rose"
              />
            </div>
          </div>

          {/* =========================================================================
              SECTION B: USER INSIGHTS
              ========================================================================= */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Users className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                User Insights
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AdminDistributionCard
                title="Role Distribution"
                subtitle="Platform account permission breakdown"
                icon={<Users className="h-4 w-4" />}
                items={roleDistributionItems}
                emptyMessage="No user accounts registered yet"
              />

              <AdminActivityChart
                title="User Registrations"
                subtitle="Daily new player registrations"
                data={users.recentRegistrations || []}
                barColor="bg-blue-500 hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-400"
                emptyMessage="No new registrations in the last 30 days"
              />
            </div>
          </div>

          {/* =========================================================================
              SECTION C: TOURNAMENT INSIGHTS
              ========================================================================= */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Layers className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Tournament Insights
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AdminDistributionCard
                title="Tournament Formats"
                subtitle="Breakdown across supported formats"
                icon={<Trophy className="h-4 w-4" />}
                items={formatDistributionItems}
                emptyMessage="No tournaments created yet"
              />

              <AdminDistributionCard
                title="Tournament Status"
                subtitle="Current lifecycle progression"
                icon={<Play className="h-4 w-4" />}
                items={statusDistributionItems}
                emptyMessage="No tournament statuses recorded"
              />

              <div className="md:col-span-2 lg:col-span-1">
                <AdminActivityChart
                  title="Tournaments Created"
                  subtitle="Daily creation frequency"
                  data={tournaments.recentCreationTrend || []}
                  barColor="bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400"
                  emptyMessage="No tournaments created in the last 30 days"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION D: GAME & PAIRING INSIGHTS
              ========================================================================= */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Swords className="h-5 w-5 text-rose-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Game & Pairing Insights
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AdminGameResultsCard games={games} />

              {/* Tournament Pipeline Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Platform Competition Volume
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total competition stages, rounds, and player engagements
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Total Rounds Conducted
                      </span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        {(overview.totalRounds ?? 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Total Pairings Generated
                      </span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        {(overview.totalPairings ?? 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Player Registrations in Tournaments
                      </span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        {(overview.totalTournamentPlayers ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                  <span>Data Integrity Source</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Live Database Aggregations
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;
