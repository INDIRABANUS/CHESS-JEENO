import api from './api';

/**
 * Fetch paginated notifications for current authenticated user.
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {boolean} [params.unreadOnly=false]
 * @returns {Promise<{ notifications: Array, pagination: Object, unreadCount: number }>}
 */
export const getNotifications = async ({ page = 1, limit = 20, unreadOnly = false } = {}) => {
  const params = { page, limit };
  if (unreadOnly) {
    params.unreadOnly = true;
  }
  const response = await api.get('/notifications', { params });
  return response.data?.data;
};

/**
 * Fetch unread notification count for current authenticated user.
 *
 * @returns {Promise<{ unreadCount: number }>}
 */
export const getUnreadCount = async () => {
  const response = await api.get('/notifications/unread-count');
  return response.data?.data;
};

/**
 * Mark a single notification as read.
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
export const markAsRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data?.data?.notification;
};

/**
 * Mark all notifications as read.
 *
 * @returns {Promise<{ success: boolean, modifiedCount: number }>}
 */
export const markAllAsRead = async () => {
  const response = await api.patch('/notifications/read-all');
  return response.data?.data;
};

/**
 * Delete a notification by ID.
 *
 * @param {string} id
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const deleteNotification = async (id) => {
  const response = await api.delete(`/notifications/${id}`);
  return response.data;
};

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
