import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Trophy,
  RefreshCw,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getAdminTournaments,
  getAdminTournamentDetails,
  cancelAdminTournament,
} from '../services/adminService';
import AdminNavTabs from '../components/admin/AdminNavTabs';
import AdminTournamentFilters from '../components/admin/AdminTournamentFilters';
import AdminTournamentsTable from '../components/admin/AdminTournamentsTable';
import AdminTournamentDetailsModal from '../components/admin/AdminTournamentDetailsModal';
import AdminTournamentCancelModal from '../components/admin/AdminTournamentCancelModal';

/**
 * AdminTournamentsPage — Dedicated platform tournament administration page at /admin/tournaments.
 *
 * Capabilities:
 * - List tournaments with server-side pagination
 * - Search by tournament name, creator, or ID
 * - Filter by status and format
 * - Safe tournament inspection modal (participants, rounds, pairings)
 * - Safe tournament cancellation moderation with active match protection
 * - Responsive layout & dark/light theme support
 */
const AdminTournamentsPage = () => {
  const { user: currentUser, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Query and pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  // Data fetching state
  const [tournaments, setTournaments] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Modal states
  const [inspectTournament, setInspectTournament] = useState(null);
  const [cancelModalTournament, setCancelModalTournament] = useState(null);
  const [cancelActionLoading, setCancelActionLoading] = useState(false);
  const [cancelActionError, setCancelActionError] = useState(null);

  // Debounce ref for search input
  const searchTimeoutRef = useRef(null);

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

  // Fetch tournaments from GET /api/admin/tournaments
  const fetchTournaments = useCallback(
    async (
      currentPage = page,
      currentSearch = search,
      currentStatus = statusFilter,
      currentFormat = formatFilter,
      isSilent = false
    ) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const data = await getAdminTournaments({
          page: currentPage,
          limit,
          search: currentSearch,
          status: currentStatus,
          format: currentFormat,
        });

        setTournaments(data.tournaments || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        console.error('Failed to fetch admin tournaments:', err);
        const statusCode = err.response?.status;
        let userMessage =
          'Unable to load tournaments. Please check your network connection and try again.';

        if (statusCode === 401) {
          userMessage = 'Authentication required. Please log in as an administrator.';
        } else if (statusCode === 403) {
          userMessage = 'Access denied. Administrator privileges required.';
        } else if (err.response?.data?.message) {
          userMessage = err.response.data.message;
        }

        setError(userMessage);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, limit, search, statusFilter, formatFilter]
  );

  // Initial fetch and dependency triggers
  useEffect(() => {
    if (isAuthenticated && currentUser?.role === 'ADMIN') {
      fetchTournaments(page, search, statusFilter, formatFilter);
    }
  }, [isAuthenticated, currentUser, page, statusFilter, formatFilter, fetchTournaments]);

  // Handle search with debounce
  const handleSearchChange = (newSearch) => {
    setSearch(newSearch);
    setPage(1);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchTournaments(1, newSearch, statusFilter, formatFilter);
    }, 350);
  };

  // Handle status filter change
  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
    fetchTournaments(1, search, newStatus, formatFilter);
  };

  // Handle format filter change
  const handleFormatChange = (newFormat) => {
    setFormatFilter(newFormat);
    setPage(1);
    fetchTournaments(1, search, statusFilter, newFormat);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setFormatFilter('');
    setPage(1);
    fetchTournaments(1, '', '', '');
  };

  // Open tournament details modal
  const handleInspectTournament = async (t) => {
    try {
      // Fetch fresh inspection details from GET /api/admin/tournaments/:tournamentId
      const fullDetails = await getAdminTournamentDetails(t.id);
      setInspectTournament(fullDetails);
    } catch {
      // Fallback to table item if single-fetch fails
      setInspectTournament(t);
    }
  };

  // Open cancel confirmation modal
  const handleOpenCancelModal = (t) => {
    setCancelModalTournament(t);
    setCancelActionError(null);
  };

  // Execute tournament cancellation via PATCH /api/admin/tournaments/:tournamentId/cancel
  const handleConfirmCancelTournament = async () => {
    if (!cancelModalTournament) return;

    setCancelActionLoading(true);
    setCancelActionError(null);

    try {
      const result = await cancelAdminTournament(cancelModalTournament.id);

      // Update local state without full reload
      setTournaments((prev) =>
        prev.map((t) => (t.id === result.id ? { ...t, status: 'CANCELLED' } : t))
      );

      // Update inspect modal if viewing the same tournament
      if (inspectTournament && inspectTournament.id === result.id) {
        setInspectTournament({ ...inspectTournament, status: 'CANCELLED' });
      }

      setCancelModalTournament(null);

      // Trigger success notification
      setSuccessToast(`Tournament "${result.name}" has been successfully cancelled.`);
      setTimeout(() => setSuccessToast(null), 4500);
    } catch (err) {
      console.error('Failed to cancel tournament:', err);
      const apiMessage =
        err.response?.data?.message || 'Failed to cancel tournament. Please try again.';
      setCancelActionError(apiMessage);
    } finally {
      setCancelActionLoading(false);
    }
  };

  // If auth is resolving, show loader
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // If unauthorized, return null while navigate() executes
  if (!isAuthenticated || currentUser?.role !== 'ADMIN') {
    return null;
  }

  const isFiltered = Boolean(search.trim() || statusFilter || formatFilter);

  return (
    <div className="space-y-6 pb-12">
      {/* ──────────────── Top Header Banner ──────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-full text-amber-700 dark:text-amber-300 text-xs font-bold tracking-wider uppercase mb-1.5">
            <Shield className="h-3.5 w-3.5 text-amber-500" />
            <span>Platform Administration</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Tournament Management
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Platform-wide tournament inspection, participant auditing, and safe moderation
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => fetchTournaments(page, search, statusFilter, formatFilter, true)}
            disabled={refreshing}
            id="refresh-admin-tournaments-btn"
            title="Refresh tournaments list"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px] shadow-xs text-sm font-semibold"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin text-amber-500' : 'text-slate-500'}`}
            />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ──────────────── Admin Subnav Tabs ──────────────── */}
      <AdminNavTabs />

      {/* ──────────────── Success Toast Notification ──────────────── */}
      {successToast && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2.5 shadow-xs animate-in fade-in duration-200"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ──────────────── Search & Filter Bar ──────────────── */}
      <AdminTournamentFilters
        search={search}
        onSearchChange={handleSearchChange}
        status={statusFilter}
        onStatusChange={handleStatusChange}
        format={formatFilter}
        onFormatChange={handleFormatChange}
        onReset={handleResetFilters}
        total={total}
        loading={loading || refreshing}
      />

      {/* ──────────────── Error Banner with Retry ──────────────── */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchTournaments(page, search, statusFilter, formatFilter)}
            id="retry-fetch-tournaments-btn"
            className="self-start sm:self-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer min-h-[38px] shadow-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* ──────────────── Loading State Skeleton ──────────────── */}
      {loading && !refreshing && tournaments.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Loading tournaments...
          </p>
        </div>
      )}

      {/* ──────────────── Empty State ──────────────── */}
      {!loading && tournaments.length === 0 && !error && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
          <Trophy className="h-10 w-10 text-slate-400 dark:text-slate-500 mx-auto stroke-1" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isFiltered ? 'No matching tournaments found' : 'No tournaments created yet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {isFiltered
              ? 'Try adjusting your search criteria or resetting filters to see all tournaments.'
              : 'Tournaments created by organizers will appear here for administrative oversight.'}
          </p>
          {isFiltered && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── Tournament Table View ──────────────── */}
      {tournaments.length > 0 && (
        <div className="space-y-4">
          <AdminTournamentsTable
            tournaments={tournaments}
            onInspect={handleInspectTournament}
            onCancel={handleOpenCancelModal}
          />

          {/* ──────────────── Pagination Controls ──────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Page <strong className="text-slate-700 dark:text-slate-200">{page}</strong> of{' '}
              <strong className="text-slate-700 dark:text-slate-200">{totalPages}</strong> ({total}{' '}
              total tournaments)
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                id="tournament-pagination-prev-btn"
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer min-h-[36px]"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                id="tournament-pagination-next-btn"
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer min-h-[36px]"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── Tournament Inspection Modal ──────────────── */}
      <AdminTournamentDetailsModal
        isOpen={Boolean(inspectTournament)}
        onClose={() => setInspectTournament(null)}
        tournament={inspectTournament}
        onCancelClick={handleOpenCancelModal}
      />

      {/* ──────────────── Tournament Cancellation Confirmation Modal ──────────────── */}
      <AdminTournamentCancelModal
        isOpen={Boolean(cancelModalTournament)}
        onClose={() => {
          setCancelModalTournament(null);
          setCancelActionError(null);
        }}
        onConfirm={handleConfirmCancelTournament}
        tournament={cancelModalTournament}
        loading={cancelActionLoading}
        error={cancelActionError}
      />
    </div>
  );
};

export default AdminTournamentsPage;
