import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import * as notificationService from '../services/notificationService';
import { subscribeToNotifications, connectSocket } from '../services/socket';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentError, setRecentError] = useState(null);

  // Fetch unread count on login/mount
  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await notificationService.getUnreadCount();
      if (data && typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.warn('[NotificationContext] Failed to fetch unread count:', err.message);
    }
  }, [isAuthenticated]);

  // Fetch recent notifications (for dropdown panel)
  const fetchRecentNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingRecent(true);
    setRecentError(null);
    try {
      const data = await notificationService.getNotifications({ page: 1, limit: 6 });
      if (data && Array.isArray(data.notifications)) {
        setRecentNotifications(data.notifications);
        if (typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      }
    } catch (err) {
      setRecentError(err.response?.data?.message || err.message || 'Failed to load notifications');
    } finally {
      setLoadingRecent(false);
    }
  }, [isAuthenticated]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    if (!id) return;
    // Optimistic UI update
    setRecentNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationService.markAsRead(id);
    } catch (err) {
      console.warn('[NotificationContext] Failed to mark notification as read:', err.message);
      // Reconcile count on failure
      refreshUnreadCount();
    }
  }, [refreshUnreadCount]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setRecentNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await notificationService.markAllAsRead();
    } catch (err) {
      console.warn('[NotificationContext] Failed to mark all as read:', err.message);
      refreshUnreadCount();
    }
  }, [refreshUnreadCount]);

  // Delete a notification
  const deleteNotification = useCallback(async (id) => {
    if (!id) return;
    const target = recentNotifications.find((n) => n._id === id);
    const wasUnread = target ? !target.read : false;

    // Optimistic removal
    setRecentNotifications((prev) => prev.filter((n) => n._id !== id));
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await notificationService.deleteNotification(id);
    } catch (err) {
      console.warn('[NotificationContext] Failed to delete notification:', err.message);
      refreshUnreadCount();
    }
  }, [recentNotifications, refreshUnreadCount]);

  // Listen for realtime Socket.IO notifications
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setRecentNotifications([]);
      return;
    }

    // Initial unread count fetch on authentication
    refreshUnreadCount();

    // Ensure socket is connected with auth token
    connectSocket();

    // Subscribe to realtime notification:new events
    const unsubscribe = subscribeToNotifications((newNotif) => {
      if (!newNotif || !newNotif._id) return;

      // Increment unread count
      setUnreadCount((prev) => prev + 1);

      // Prepend to recent list if not already present
      setRecentNotifications((prev) => {
        if (prev.some((item) => item._id === newNotif._id)) {
          return prev;
        }
        return [newNotif, ...prev].slice(0, 10);
      });
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, user?._id, refreshUnreadCount]);

  const value = {
    unreadCount,
    recentNotifications,
    loadingRecent,
    recentError,
    fetchRecentNotifications,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
