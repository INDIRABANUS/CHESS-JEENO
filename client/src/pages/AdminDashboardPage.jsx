import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Users,
  Trophy,
  Activity,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Loader2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAdminOverview } from '../services/adminService';
import AdminStatCard from '../components/admin/AdminStatCard';
import RecentUsersTable from '../components/admin/RecentUsersTable';
import RecentTournamentsTable from '../components/admin/RecentTournamentsTable';
import PlatformStatusCard from '../components/admin/PlatformStatusCard';
import AdminNavTabs from '../components/admin/AdminNavTabs';

/**
 * AdminDashboardPage — Dedicated, responsive platform overview for administrators at /admin.
 * 
 * Access Rules:
 * - Unauthenticated: Redirects to /login
 * - Authenticated USER: Redirects to /dashboard
 * - Authenticated ADMIN: Renders Admin Dashboard
 */
const AdminDashboardPage = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Frontend route authorization guard
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        navigate('/login', { replace: true });
      } else if (user?.role !== 'ADMIN') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Fetch real overview data from GET /api/admin/overview
  const fetchOverview = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const data = await getAdminOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to fetch admin overview:', err);
      const statusCode = err.response?.status;
      let userMessage = 'Unable to load admin dashboard right now. Please check your connection and try again.';

      if (statusCode === 401) {
        userMessage = 'Authentication required. Please log in as an administrator.';
      } else if (statusCode === 403) {
        userMessage = 'Access denied. You do not have administrator privileges to view this page.';
      }

      setError(userMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      fetchOverview();
    }
  }, [isAuthenticated, user, fetchOverview]);

  // If auth state is still resolving, show loader
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // If not authorized, return null while navigate() executes
  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return null;
  }

  const stats = overview?.stats || {};
  const recentUsers = overview?.recentUsers || [];
  const recentTournaments = overview?.recentTournaments || [];
  const platformStatus = overview?.platformStatus || {};

  return (
    <div className="space-y-8 pb-12">
      {/* ──────────────── Top Header Banner ──────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-full text-amber-700 dark:text-amber-300 text-xs font-bold tracking-wider uppercase mb-1.5">
            <Shield className="h-3.5 w-3.5 text-amber-500" />
            <span>Platform Administration</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Admin Dashboard
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            System-wide platform overview, real-time activity, and infrastructure health
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            id="refresh-admin-dashboard-btn"
            title="Refresh dashboard metrics"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px] shadow-xs text-sm font-semibold"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-amber-500' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ──────────────── Admin Subnav Tabs ──────────────── */}
      <AdminNavTabs />


      {/* ──────────────── Loading State ──────────────── */}
      {loading && !overview && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Loading platform overview statistics...
          </p>
        </div>
      )}

      {/* ──────────────── Error State Banner with Retry ──────────────── */}
      {error && (
        <div
          role="alert"
          className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-semibold text-rose-900 dark:text-rose-100">
                Unable to load admin dashboard
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchOverview()}
            id="retry-admin-overview-btn"
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs transition cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ──────────────── Main Overview Content ──────────────── */}
      {!loading && overview && (
        <>
          {/* Key Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <AdminStatCard
              title="Total Users"
              value={stats.totalUsers ?? 0}
              subtitle="Registered player accounts"
              icon={Users}
              accentColor="indigo"
            />

            <AdminStatCard
              title="Total Admins"
              value={stats.totalAdmins ?? 0}
              subtitle="Platform administrators"
              icon={Shield}
              accentColor="amber"
            />

            <AdminStatCard
              title="Total Tournaments"
              value={stats.totalTournaments ?? 0}
              subtitle="Across all formats"
              icon={Trophy}
              accentColor="purple"
            />

            <AdminStatCard
              title="Active Tournaments"
              value={stats.activeTournaments ?? 0}
              subtitle="In progress or countdown"
              icon={Activity}
              accentColor="emerald"
            />

            <AdminStatCard
              title="Completed Tournaments"
              value={stats.completedTournaments ?? 0}
              subtitle="Finished championships"
              icon={CheckCircle2}
              accentColor="blue"
            />
          </div>

          {/* Activity Tables Grid (Recent Users & Recent Tournaments) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Recent Users */}
            <RecentUsersTable users={recentUsers} />

            {/* Recent Tournaments */}
            <RecentTournamentsTable tournaments={recentTournaments} />
          </div>

          {/* Operational Platform Status */}
          <PlatformStatusCard status={platformStatus} />
        </>
      )}
    </div>
  );
};

export default AdminDashboardPage;
