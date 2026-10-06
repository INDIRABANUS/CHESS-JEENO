import * as notificationService from '../services/notificationService.js';

/**
 * Get paginated notifications for current authenticated user.
 * @route GET /api/notifications
 */
export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, unreadOnly } = req.query;
    const result = await notificationService.getUserNotifications(req.user._id, {
      page,
      limit,
      unreadOnly,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count for current authenticated user.
 * @route GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.user._id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read for current authenticated user.
 * @route PATCH /api/notifications/:id/read
 */
export const markRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user._id);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: {
        notification,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for current authenticated user.
 * @route PATCH /api/notifications/read-all
 */
export const markAllRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user._id);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification for current authenticated user.
 * @route DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res, next) => {
  try {
    const result = await notificationService.deleteNotification(req.params.id, req.user._id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
};
