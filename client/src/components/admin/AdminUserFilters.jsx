import React from 'react';
import { Search, X, Filter, Users, Shield } from 'lucide-react';

/**
 * AdminUserFilters — Search input and role filters for Admin User Management.
 *
 * @param {Object} props
 * @param {string} props.search - Current search query string
 * @param {Function} props.onSearchChange - Callback when search changes
 * @param {string} props.role - Active role filter ('', 'USER', 'ADMIN')
 * @param {Function} props.onRoleChange - Callback when role filter changes
 * @param {Function} props.onReset - Callback to reset all filters
 * @param {number} props.total - Total users matching current query
 * @param {boolean} props.loading - Loading indicator
 */
const AdminUserFilters = ({
  search = '',
  onSearchChange,
  role = '',
  onRoleChange,
  onReset,
  total = 0,
  loading = false,
}) => {
  const isFiltered = Boolean(search.trim() || role);

  const handleSearchInput = (e) => {
    onSearchChange(e.target.value);
  };

  const handleClearSearch = () => {
    onSearchChange('');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input Box */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={handleSearchInput}
            id="admin-user-search-input"
            placeholder="Search by name, email, or lichess username..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition"
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              id="admin-user-search-clear-btn"
              title="Clear search"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Role Segmented Filter Pills */}
        <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start md:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => onRoleChange('')}
            id="role-filter-all"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              role === ''
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>All Roles</span>
          </button>

          <button
            type="button"
            onClick={() => onRoleChange('USER')}
            id="role-filter-user"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              role === 'USER'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-indigo-500" />
            <span>Users</span>
          </button>

          <button
            type="button"
            onClick={() => onRoleChange('ADMIN')}
            id="role-filter-admin"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              role === 'ADMIN'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="h-3.5 w-3.5 text-amber-500" />
            <span>Admins</span>
          </button>
        </div>
      </div>

      {/* Sub-bar: Result counter and Reset Action */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {loading ? (
              'Updating results...'
            ) : (
              <>
                Showing <strong className="text-slate-700 dark:text-slate-200">{total}</strong>{' '}
                {total === 1 ? 'user' : 'users'}
                {isFiltered && ' matching criteria'}
              </>
            )}
          </span>
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            id="reset-all-filters-btn"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminUserFilters;
