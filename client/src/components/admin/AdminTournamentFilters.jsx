import React from 'react';
import { Search, X, Filter, Trophy, Layers } from 'lucide-react';

/**
 * AdminTournamentFilters — Search input and lifecycle/format filters for Admin Tournament Management.
 *
 * @param {Object} props
 * @param {string} props.search - Current search query string
 * @param {Function} props.onSearchChange - Callback when search changes
 * @param {string} props.status - Active status filter
 * @param {Function} props.onStatusChange - Callback when status filter changes
 * @param {string} props.format - Active format filter
 * @param {Function} props.onFormatChange - Callback when format filter changes
 * @param {Function} props.onReset - Callback to reset all filters
 * @param {number} props.total - Total tournaments matching current query
 * @param {boolean} props.loading - Loading indicator
 */
const AdminTournamentFilters = ({
  search = '',
  onSearchChange,
  status = '',
  onStatusChange,
  format = '',
  onFormatChange,
  onReset,
  total = 0,
  loading = false,
}) => {
  const isFiltered = Boolean(search.trim() || status || format);

  const handleSearchInput = (e) => {
    onSearchChange(e.target.value);
  };

  const handleClearSearch = () => {
    onSearchChange('');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Input Box */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={handleSearchInput}
            id="admin-tournament-search-input"
            placeholder="Search by tournament name, creator, or ID..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 transition"
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              id="admin-tournament-search-clear-btn"
              title="Clear search"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dropdowns Container */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Select */}
          <div className="flex items-center space-x-1.5">
            <label htmlFor="admin-status-filter" className="sr-only">Status</label>
            <select
              id="admin-status-filter"
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition cursor-pointer min-h-[40px]"
            >
              <option value="">All Statuses</option>
              <option value="REGISTRATION">Registration</option>
              <option value="RUNNING">Active / Running</option>
              <option value="FINISHED">Completed / Finished</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="DRAFT">Draft</option>
              <option value="READY_CHECK">Ready Check</option>
              <option value="COUNTDOWN">Countdown</option>
            </select>
          </div>

          {/* Format Select */}
          <div className="flex items-center space-x-1.5">
            <label htmlFor="admin-format-filter" className="sr-only">Format</label>
            <select
              id="admin-format-filter"
              value={format}
              onChange={(e) => onFormatChange(e.target.value)}
              className="py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition cursor-pointer min-h-[40px]"
            >
              <option value="">All Formats</option>
              <option value="SWISS">Swiss</option>
              <option value="ROUND_ROBIN">Round Robin</option>
              <option value="KNOCKOUT">Knockout</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sub-bar: Result counter and Reset Action */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {loading ? (
              'Updating tournaments...'
            ) : (
              <>
                Showing <strong className="text-slate-700 dark:text-slate-200">{total}</strong>{' '}
                {total === 1 ? 'tournament' : 'tournaments'}
                {isFiltered && ' matching criteria'}
              </>
            )}
          </span>
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            id="reset-all-tournament-filters-btn"
            className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminTournamentFilters;
