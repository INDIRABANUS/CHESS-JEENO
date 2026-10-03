import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Swords,
  PlusCircle,
  List,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Calendar,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDashboard } from '../../services/userService';
import { joinTournamentRoom, leaveTournamentRoom } from '../../services/socket';
import CurrentTournamentCard from './CurrentTournamentCard';
import MyTournamentsCard from './MyTournamentsCard';
import RecentResultsCard from './RecentResultsCard';

/**
 * PlayerDashboard — Dedicated production dashboard for authenticated players:
 *
 *                     CHESS JEENO
 *
 * Welcome back, {Name} 👋
 *
 * ┌─────────────────────────────────────┐
 * │ CURRENT TOURNAMENT                  │
 * │                                     │
 * │ [Live Tournament Title]             │
 * │ Round X                             │
 * │                                     │
 * │ Your Score       X.X / X            │
 * │ Current Rank     #X                  │
 * │                                     │
 * │ ───────────────────────────────      │
 * │                                     │
 * │ NEXT MATCH                           │
 * │                                     │
 * │ You  ⚔  Opponent                    │
 * │                                     │
 * │ [ PLAY ON LICHESS ]                 │
 * └─────────────────────────────────────┘
 *
 *
 * MY TOURNAMENTS
 * 🏆 X Active   📅 X Upcoming   ✓ X Completed   👑 X Hosted
 *
 *
 * RECENT RESULTS
 * ✓ Win   vs Player A
 * ✗ Loss  vs Player B
 * ½ Draw  vs Player C
 */
const PlayerDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Fetch real authenticated dashboard data from GET /api/users/dashboard
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const data = await getDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      // User-friendly error message, raw backend errors are not shown
      const message =
        err.response?.status === 401
          ? 'Authentication required. Please log in again.'
          : 'Unable to load dashboard data right now. Please check your connection and try again.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Hook into existing Socket.IO tournament room for realtime updates
  const activeTournamentId = dashboardData?.currentTournament?._id;
  useEffect(() => {
    if (!activeTournamentId) return;

    // Join tournament room using existing socket service
    joinTournamentRoom(activeTournamentId, {
      onGameFinished: () => fetchDashboardData(true),
      onStandingsUpdated: () => fetchDashboardData(true),
      onRoundCompleted: () => fetchDashboardData(true),
      onTournamentCompleted: () => fetchDashboardData(true),
      onTournamentStarted: () => fetchDashboardData(true),
    });

    return () => {
      leaveTournamentRoom(activeTournamentId);
    };
  }, [activeTournamentId, fetchDashboardData]);

  const displayName = user?.name || dashboardData?.user?.name || 'Player';
  const lichessUsername = user?.lichessUsername || dashboardData?.user?.lichessUsername;

  return (
    <div className="space-y-8 py-2 max-w-7xl mx-auto transition-colors">
      {/* ──────────────── HEADER AREA ──────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1">
          {/* Logo / Title */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/80 rounded-full text-indigo-700 dark:text-indigo-300 text-xs font-bold tracking-wider uppercase mb-1">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span>CHESS JEENO</span>
          </div>

          {/* Welcome back, {Name} 👋 */}
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <span>Welcome back, {displayName}</span>
            <span className="inline-block animate-bounce origin-bottom-right">👋</span>
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center space-x-2 flex-wrap">
            <span>Your tournament control hub</span>
            {lichessUsername && (
              <>
                <span>&bull;</span>
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center space-x-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 inline shrink-0" />
                  <span>@{lichessUsername}</span>
                </span>
              </>
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            id="refresh-dashboard-btn"
            title="Refresh dashboard"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          {/* Create Tournament CTA */}
          <Link
            to="/tournaments/create"
            id="dashboard-create-tournament-btn"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-sm font-semibold shadow-xs hover:shadow transition group min-h-[44px]"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create</span>
          </Link>

          {/* Browse Tournaments CTA */}
          <Link
            to="/tournaments"
            id="dashboard-browse-tournaments-btn"
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold transition min-h-[44px]"
          >
            <List className="h-4 w-4" />
            <span>Browse</span>
          </Link>
        </div>
      </div>

      {/* Loading state indicator banner */}
      {loading && !dashboardData && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Loading your tournament standings and matches...
          </p>
        </div>
      )}

      {/* Error notification banner if API fails */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardData()}
            id="retry-dashboard-btn"
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition cursor-pointer self-start sm:self-auto shrink-0"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ──────────────── MAIN DASHBOARD GRID ──────────────── */}
      {!loading && dashboardData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (7 cols): The Hero CURRENT TOURNAMENT Card */}
          <div className="lg:col-span-7 space-y-6">
            <CurrentTournamentCard
              tournament={dashboardData.currentTournament}
              userName={displayName}
            />
          </div>

          {/* Right Column (5 cols): MY TOURNAMENTS & RECENT RESULTS */}
          <div className="lg:col-span-5 space-y-6">
            {/* MY TOURNAMENTS */}
            <MyTournamentsCard myTournaments={dashboardData.myTournaments} />

            {/* RECENT RESULTS */}
            <RecentResultsCard results={dashboardData.recentResults} />
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerDashboard;
