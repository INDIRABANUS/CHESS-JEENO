import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trophy,
  Swords,
  UserCheck,
  UserX,
  UserPlus,
  Play,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { formatTimeAgo } from '../utils/formatters';

/**
 * Returns an appropriate icon based on notification type.
 */
const getNotificationIcon = (type) => {
  switch (type) {
    case 'JOIN_REQUEST_RECEIVED':
      return <UserPlus className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'JOIN_REQUEST_APPROVED':
      return <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />;
    case 'JOIN_REQUEST_REJECTED':
      return <UserX className="h-4 w-4 text-rose-500 shrink-0" />;
    case 'TOURNAMENT_STARTING':
      return <Play className="h-4 w-4 text-indigo-500 shrink-0" />;
    case 'ROUND_READY':
      return <RotateCcw className="h-4 w-4 text-sky-500 shrink-0" />;
    case 'PAIRING_CREATED':
      return <Swords className="h-4 w-4 text-violet-500 shrink-0" />;
    case 'GAME_RESULT':
      return <Trophy className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'TOURNAMENT_COMPLETED':
      return <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />;
    default:
      return <Bell className="h-4 w-4 text-slate-500 shrink-0" />;
  }
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const {
    unreadCount,
    recentNotifications,
    loadingRecent,
    recentError,
    fetchRecentNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close panel on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch recent notifications whenever the dropdown opens
  const togglePanel = () => {
    if (!isOpen) {
      fetchRecentNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await markAsRead(notif._id);
    }
    setIsOpen(false);

    // Navigate to tournament details if available
    const tournamentId = notif.tournament?._id || notif.tournament;
    if (tournamentId) {
      navigate(`/tournaments/${tournamentId}`);
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    await markAllAsRead();
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Notification Bell Trigger Button */}
      <button
        type="button"
        id="notification-bell-trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : 'Notifications'
        }
        onClick={togglePanel}
        className="relative inline-flex items-center justify-center p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
        title="View Notifications"
      >
        <Bell className="h-5 w-5 shrink-0" />

        {/* Unread Badge Counter */}
        {unreadCount > 0 && (
          <span
            id="notification-unread-badge"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-pulse ring-2 ring-white dark:ring-slate-900"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          id="notification-dropdown-panel"
          role="region"
          aria-label="Recent notifications"
          className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full mt-1 sm:mt-2 w-auto sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col max-h-[80vh] sm:max-h-[520px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                id="notification-mark-all-read-btn"
                onClick={handleMarkAllRead}
                className="flex items-center space-x-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition cursor-pointer"
                title="Mark all notifications as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Panel Body: Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 min-h-0">
            {loadingRecent ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex space-x-3">
                    <div className="rounded-full bg-slate-200 dark:bg-slate-800 h-8 w-8 shrink-0"></div>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentError ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
                <AlertCircle className="h-6 w-6 text-rose-500 mx-auto" />
                <p>{recentError}</p>
                <button
                  type="button"
                  onClick={fetchRecentNotifications}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Try again
                </button>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                  <Inbox className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No notifications yet
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto">
                  You're all caught up! New tournament alerts will show up here.
                </p>
              </div>
            ) : (
              recentNotifications.map((notif) => {
                const isUnread = !notif.read;
                return (
                  <div
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNotificationClick(notif);
                      }
                    }}
                    className={`flex items-start space-x-3 p-3.5 transition cursor-pointer text-left focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800 ${
                      isUnread
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between space-x-2">
                        <p
                          className={`text-xs truncate ${
                            isUnread
                              ? 'font-bold text-slate-900 dark:text-white'
                              : 'font-medium text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      {isUnread && (
                        <div className="flex items-center space-x-1 pt-1">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>
                          <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            New
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Panel Footer */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 text-center shrink-0">
            <Link
              to="/notifications"
              id="notification-view-all-link"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer"
            >
              <span>View all notifications</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
