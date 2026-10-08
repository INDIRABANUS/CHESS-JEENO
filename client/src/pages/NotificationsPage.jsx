import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Inbox,
  AlertCircle,
  Loader2,
  Trophy,
  Swords,
  UserCheck,
  UserX,
  UserPlus,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Crown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import * as notificationService from '../services/notificationService';
import { formatTimeAgo, formatDate } from '../utils/formatters';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'JOIN_REQUEST_RECEIVED':
      return <UserPlus className="h-5 w-5 text-amber-500 shrink-0" />;
    case 'JOIN_REQUEST_APPROVED':
      return <UserCheck className="h-5 w-5 text-emerald-500 shrink-0" />;
    case 'JOIN_REQUEST_REJECTED':
      return <UserX className="h-5 w-5 text-rose-500 shrink-0" />;
    case 'TOURNAMENT_STARTING':
      return <Play className="h-5 w-5 text-indigo-500 shrink-0" />;
    case 'ROUND_READY':
      return <RotateCcw className="h-5 w-5 text-sky-500 shrink-0" />;
    case 'PAIRING_CREATED':
      return <Swords className="h-5 w-5 text-violet-500 shrink-0" />;
    case 'GAME_RESULT':
      return <Trophy className="h-5 w-5 text-amber-500 shrink-0" />;
    case 'TOURNAMENT_COMPLETED':
      return <Sparkles className="h-5 w-5 text-emerald-500 shrink-0" />;
    case 'TEAM_INVITATION':
      return <Users className="h-5 w-5 text-indigo-500 shrink-0" />;
    case 'TEAM_INVITATION_ACCEPTED':
      return <UserCheck className="h-5 w-5 text-emerald-500 shrink-0" />;
    case 'TEAM_INVITATION_DECLINED':
      return <UserX className="h-5 w-5 text-rose-500 shrink-0" />;
    case 'TEAM_CAPTAIN_TRANSFERRED':
      return <Crown className="h-5 w-5 text-amber-500 shrink-0" />;
    case 'TEAM_MATCH_BOARD_ASSIGNED':
      return <Swords className="h-5 w-5 text-indigo-500 shrink-0" />;
    case 'TEAM_LINEUP_LOCKED':
      return <Crown className="h-5 w-5 text-emerald-500 shrink-0" />;
    case 'TEAM_MATCH_READY':
      return <Sparkles className="h-5 w-5 text-indigo-500 shrink-0" />;
    default:
      return <Bell className="h-5 w-5 text-slate-500 shrink-0" />;
  }
};

const NotificationsPage = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { refreshUnreadCount } = useNotifications();

  // Authentication guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Page state
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalCount: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Load paginated notifications
  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const data = await notificationService.getNotifications({
        page,
        limit,
        unreadOnly: filter === 'unread',
      });
      if (data) {
        setNotifications(data.notifications || []);
        if (data.pagination) setPagination(data.pagination);
        if (typeof data.unreadCount === 'number') setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, page, limit, filter]);

  useEffect(() => {
    document.title = 'Notifications — CHESS JEENO';
    loadNotifications();
  }, [loadNotifications]);

  // Reset to page 1 when filter changes
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  // Mark single as read
  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    setActionLoadingId(id);
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      refreshUnreadCount();
    } catch (err) {
      console.warn('Failed to mark read:', err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    setLoading(true);
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      refreshUnreadCount();
      if (filter === 'unread') {
        setNotifications([]);
      }
    } catch (err) {
      console.warn('Failed to mark all read:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete notification
  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    setActionLoadingId(id);
    try {
      await notificationService.deleteNotification(id);
      const target = notifications.find((n) => n._id === id);
      if (target && !target.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
        refreshUnreadCount();
      }
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setPagination((prev) => ({
        ...prev,
        totalCount: Math.max(0, prev.totalCount - 1),
      }));
    } catch (err) {
      console.warn('Failed to delete notification:', err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4">
      {/* Header with Title and Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Stay updated with your tournaments, pairings, and match results.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              type="button"
              id="notifications-page-mark-all-btn"
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer border border-indigo-200/80 dark:border-indigo-800/80 min-h-[44px]"
            >
              <CheckCheck className="h-4 w-4" />
              <span>Mark all read</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadNotifications}
            id="notifications-refresh-btn"
            title="Refresh notifications"
            aria-label="Refresh notifications"
            className="inline-flex items-center justify-center p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border border-slate-200 dark:border-slate-700 min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          id="notifications-tab-all"
          onClick={() => handleFilterChange('all')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer min-h-[44px] inline-flex items-center ${
            filter === 'all'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          All
        </button>
        <button
          type="button"
          id="notifications-tab-unread"
          onClick={() => handleFilterChange('unread')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer min-h-[44px] inline-flex items-center space-x-1.5 ${
            filter === 'unread'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse flex items-start space-x-4"
            >
              <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0"></div>
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={loadNotifications}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center space-y-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <div className="inline-flex p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
            <Inbox className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {filter === 'unread'
              ? "You've read all your notifications! Check the 'All' tab to see past history."
              : 'When tournaments begin, pairings are ready, or join requests update, they will appear right here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3" role="list">
          {notifications.map((notif) => {
            const isUnread = !notif.read;
            const tournamentId = notif.tournament?._id || notif.tournament;
            const tournamentName = notif.tournament?.name || notif.metadata?.tournamentName;
            const competitionId = notif.teamCompetition?._id || notif.teamCompetition || notif.metadata?.competitionId;
            const competitionName = notif.metadata?.competitionName;

            return (
              <div
                key={notif._id}
                role="listitem"
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isUnread
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Notification Left Content */}
                <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs mt-0.5 shrink-0">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <h4
                        className={`text-sm ${
                          isUnread
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-semibold text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {notif.title}
                      </h4>

                      {isUnread && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white tracking-wide uppercase">
                          New
                        </span>
                      )}

                      <span
                        className="text-xs text-slate-400 dark:text-slate-500"
                        title={formatDate(notif.createdAt)}
                      >
                        • {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                      {notif.message}
                    </p>

                    {/* Target Navigation Link */}
                    {tournamentId && (
                      <div className="pt-1">
                        <Link
                          to={`/tournaments/${tournamentId}`}
                          onClick={() => isUnread && handleMarkAsRead(notif._id)}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          <span>Go to {tournamentName || 'Tournament'}</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    )}

                    {competitionId && (
                      <div className="pt-1">
                        {notif.teamMatch || notif.metadata?.matchId ? (
                          <Link
                            to={`/team-competitions/${competitionId}/matches/${notif.teamMatch?._id || notif.teamMatch || notif.metadata?.matchId}`}
                            onClick={() => isUnread && handleMarkAsRead(notif._id)}
                            className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            <span>Go to Match Details</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <Link
                            to={`/team-competitions/${competitionId}`}
                            onClick={() => isUnread && handleMarkAsRead(notif._id)}
                            className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            <span>Go to {competitionName || 'Team Competition'}</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Item Actions (Mark Read & Delete) */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkAsRead(notif._id, e)}
                      disabled={actionLoadingId === notif._id}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px]"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Mark read</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleDelete(notif._id, e)}
                    disabled={actionLoadingId === notif._id}
                    className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[44px] min-w-[44px]"
                    title="Delete notification"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            id="notifications-prev-page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!pagination.hasPrev || loading}
            className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer min-h-[44px]"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <button
            type="button"
            id="notifications-next-page-btn"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={!pagination.hasNext || loading}
            className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer min-h-[44px]"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
