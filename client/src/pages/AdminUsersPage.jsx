import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Users,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getAdminUsers,
  getAdminUserDetails,
  updateAdminUserRole,
} from '../services/adminService';
import AdminNavTabs from '../components/admin/AdminNavTabs';
import AdminUserFilters from '../components/admin/AdminUserFilters';
import AdminUsersTable from '../components/admin/AdminUsersTable';
import AdminUserDetailsModal from '../components/admin/AdminUserDetailsModal';
import AdminRoleConfirmModal from '../components/admin/AdminRoleConfirmModal';

/**
 * AdminUsersPage — Dedicated platform user administration page at /admin/users.
 *
 * Capabilities:
 * - List users with server-side pagination
 * - Search by display name, email, or lichess username
 * - Filter by role (ALL, USER, ADMIN)
 * - Safe user inspection modal
 * - Promote to Admin / Demote to User with lockout prevention confirmation
 * - Responsive layout & dark/light theme support
 */
const AdminUsersPage = () => {
  const { user: currentUser, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Query and pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Data fetching state
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Modal states
  const [inspectUser, setInspectUser] = useState(null);
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [roleModalTargetRole, setRoleModalTargetRole] = useState(null);
  const [roleActionLoading, setRoleActionLoading] = useState(false);
  const [roleActionError, setRoleActionError] = useState(null);

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

  // Fetch users from GET /api/admin/users
  const fetchUsers = useCallback(
    async (currentPage = page, currentSearch = search, currentRole = roleFilter, isSilent = false) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const data = await getAdminUsers({
          page: currentPage,
          limit,
          search: currentSearch,
          role: currentRole,
        });

        setUsers(data.users || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        console.error('Failed to fetch admin users:', err);
        const statusCode = err.response?.status;
        let userMessage = 'Unable to load users. Please check your network connection and try again.';

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
    [page, limit, search, roleFilter]
  );

  // Initial fetch and dependency triggers
  useEffect(() => {
    if (isAuthenticated && currentUser?.role === 'ADMIN') {
      fetchUsers(page, search, roleFilter);
    }
  }, [isAuthenticated, currentUser, page, roleFilter, fetchUsers]);

  // Handle search with debounce
  const handleSearchChange = (newSearch) => {
    setSearch(newSearch);
    setPage(1);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchUsers(1, newSearch, roleFilter);
    }, 350);
  };

  // Handle role filter change
  const handleRoleChange = (newRole) => {
    setRoleFilter(newRole);
    setPage(1);
    fetchUsers(1, search, newRole);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setRoleFilter('');
    setPage(1);
    fetchUsers(1, '', '');
  };

  // Open user details modal
  const handleViewDetails = async (targetUser) => {
    try {
      // Fetch fresh details from GET /api/admin/users/:userId
      const fullDetails = await getAdminUserDetails(targetUser.id);
      setInspectUser(fullDetails);
    } catch {
      // Fallback to table item if single-fetch fails
      setInspectUser(targetUser);
    }
  };

  // Initiate role change confirmation modal
  const handleOpenRoleModal = (targetUser) => {
    const newTargetRole = targetUser.role === 'ADMIN' ? 'USER' : 'ADMIN';
    setRoleModalUser(targetUser);
    setRoleModalTargetRole(newTargetRole);
    setRoleActionError(null);
  };

  // Execute role change via PATCH /api/admin/users/:userId/role
  const handleConfirmRoleChange = async () => {
    if (!roleModalUser || !roleModalTargetRole) return;

    setRoleActionLoading(true);
    setRoleActionError(null);

    try {
      const updatedUser = await updateAdminUserRole(roleModalUser.id, roleModalTargetRole);

      // Update local state without full reload
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === updatedUser.id ? { ...u, role: updatedUser.role } : u))
      );

      // Update inspect modal if viewing the same user
      if (inspectUser && inspectUser.id === updatedUser.id) {
        setInspectUser({ ...inspectUser, role: updatedUser.role });
      }

      // Close role modal
      setRoleModalUser(null);
      setRoleModalTargetRole(null);

      // Trigger success notification
      setSuccessToast(
        `Successfully updated ${updatedUser.name}'s role to ${updatedUser.role}.`
      );
      setTimeout(() => setSuccessToast(null), 4500);
    } catch (err) {
      console.error('Failed to change user role:', err);
      const apiMessage =
        err.response?.data?.message || 'Failed to update user role. Please try again.';
      setRoleActionError(apiMessage);
    } finally {
      setRoleActionLoading(false);
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

  const isFiltered = Boolean(search.trim() || roleFilter);

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
            User Management
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Platform-level user administration, account inspection, and role assignments
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => fetchUsers(page, search, roleFilter, true)}
            disabled={refreshing}
            id="refresh-admin-users-btn"
            title="Refresh user list"
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
      <AdminUserFilters
        search={search}
        onSearchChange={handleSearchChange}
        role={roleFilter}
        onRoleChange={handleRoleChange}
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
            onClick={() => fetchUsers(page, search, roleFilter)}
            id="retry-fetch-users-btn"
            className="self-start sm:self-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer min-h-[38px] shadow-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* ──────────────── Loading State Skeleton ──────────────── */}
      {loading && !refreshing && users.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Loading user accounts...
          </p>
        </div>
      )}

      {/* ──────────────── Empty State ──────────────── */}
      {!loading && users.length === 0 && !error && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
          <UserCheck className="h-10 w-10 text-slate-400 dark:text-slate-500 mx-auto stroke-1" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isFiltered ? 'No matching users found' : 'No users registered yet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {isFiltered
              ? 'Try adjusting your search terms or clearing the active filters to see all users.'
              : 'Registered accounts will appear here once players sign up for the platform.'}
          </p>
          {isFiltered && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── User Table View ──────────────── */}
      {users.length > 0 && (
        <div className="space-y-4">
          <AdminUsersTable
            users={users}
            onViewDetails={handleViewDetails}
            onRoleClick={handleOpenRoleModal}
            currentUser={currentUser}
          />

          {/* ──────────────── Pagination Controls ──────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Page <strong className="text-slate-700 dark:text-slate-200">{page}</strong> of{' '}
              <strong className="text-slate-700 dark:text-slate-200">{totalPages}</strong> ({total}{' '}
              total users)
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                id="pagination-prev-btn"
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer min-h-[36px]"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                id="pagination-next-btn"
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer min-h-[36px]"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── User Inspection Modal ──────────────── */}
      <AdminUserDetailsModal
        isOpen={Boolean(inspectUser)}
        onClose={() => setInspectUser(null)}
        user={inspectUser}
        onRoleClick={handleOpenRoleModal}
      />

      {/* ──────────────── Role Change Confirmation Modal ──────────────── */}
      <AdminRoleConfirmModal
        isOpen={Boolean(roleModalUser)}
        onClose={() => {
          setRoleModalUser(null);
          setRoleModalTargetRole(null);
          setRoleActionError(null);
        }}
        onConfirm={handleConfirmRoleChange}
        user={roleModalUser}
        targetRole={roleModalTargetRole}
        loading={roleActionLoading}
        error={roleActionError}
      />
    </div>
  );
};

export default AdminUsersPage;
