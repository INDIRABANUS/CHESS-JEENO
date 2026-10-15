import mongoose from 'mongoose';
import Notification, { NOTIFICATION_TYPES } from '../models/Notification.js';
import User from '../models/User.js';

/**
 * Sanitizes metadata to strictly prevent exposing sensitive credentials,
 * tokens, passwords, or secret hashes.
 *
 * @param {Object} metadata
 * @returns {Object}
 */
export const sanitizeMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const sanitized = {};
  const isSensitiveKey = (key) => {
    const k = key.toLowerCase();
    return (
      k.includes('password') ||
      k.includes('token') ||
      k.includes('secret') ||
      k.includes('auth') ||
      k.includes('jwt') ||
      k.includes('credential') ||
      k.includes('apikey')
    );
  };

  for (const [key, val] of Object.entries(metadata)) {
    if (isSensitiveKey(key)) {
      continue;
    }
    // Deep sanitize nested objects if needed
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) && !(val instanceof mongoose.Types.ObjectId)) {
      sanitized[key] = sanitizeMetadata(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
};

/**
 * Creates and persists a new in-app notification with deterministic duplicate prevention.
 * Emits realtime 'notification:new' event to the recipient's authenticated socket room.
 *
 * @param {Object} data
 * @param {string|mongoose.Types.ObjectId} data.recipient - Target User ID
 * @param {string} data.type - One of NOTIFICATION_TYPES
 * @param {string} data.title - Concise notification headline
 * @param {string} data.message - Notification message body
 * @param {string|mongoose.Types.ObjectId} [data.tournament] - Optional tournament ref
 * @param {string|mongoose.Types.ObjectId} [data.pairing] - Optional pairing ref
 * @param {string|mongoose.Types.ObjectId} [data.round] - Optional round ref
 * @param {Object} [data.metadata] - Optional arbitrary metadata
 * @param {string} [data.eventKey] - Deterministic identity key for deduplication
 * @returns {Promise<Notification|null>}
 */
export const createNotification = async ({
  recipient,
  type,
  title,
  message,
  tournament = null,
  pairing = null,
  round = null,
  teamCompetition = null,
  team = null,
  teamMatch = null,
  teamRound = null,
  metadata = {},
  eventKey = null,
}) => {
  // 1. Recipient validation
  const recipientId = recipient?._id || recipient;
  if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
    const error = new Error('Invalid or missing recipient ID for notification');
    error.statusCode = 400;
    throw error;
  }

  // Verify recipient exists in database
  const userExists = await User.exists({ _id: recipientId });
  if (!userExists) {
    const error = new Error('Notification recipient user does not exist');
    error.statusCode = 404;
    throw error;
  }

  // 2. Type validation
  if (!type || !NOTIFICATION_TYPES.includes(type)) {
    const error = new Error(`Invalid notification type: '${type}'`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Title & Message validation
  const cleanTitle = (title || '').trim();
  const cleanMessage = (message || '').trim();

  if (!cleanTitle) {
    const error = new Error('Notification title is required');
    error.statusCode = 400;
    throw error;
  }

  if (!cleanMessage) {
    const error = new Error('Notification message is required');
    error.statusCode = 400;
    throw error;
  }

  // 4. Sanitize references
  const cleanTournament =
    tournament && mongoose.isValidObjectId(tournament?._id || tournament)
      ? (tournament._id || tournament)
      : null;

  const cleanPairing =
    pairing && mongoose.isValidObjectId(pairing?._id || pairing)
      ? (pairing._id || pairing)
      : null;

  const cleanRound =
    round && mongoose.isValidObjectId(round?._id || round)
      ? (round._id || round)
      : null;

  const cleanTeamCompetition =
    teamCompetition && mongoose.isValidObjectId(teamCompetition?._id || teamCompetition)
      ? (teamCompetition._id || teamCompetition)
      : null;

  const cleanTeam =
    team && mongoose.isValidObjectId(team?._id || team)
      ? (team._id || team)
      : null;

  const cleanTeamMatch =
    teamMatch && mongoose.isValidObjectId(teamMatch?._id || teamMatch)
      ? (teamMatch._id || teamMatch)
      : null;

  const cleanTeamRound =
    teamRound && mongoose.isValidObjectId(teamRound?._id || teamRound)
      ? (teamRound._id || teamRound)
      : null;

  const cleanMetadata = sanitizeMetadata(metadata);
  const cleanEventKey = eventKey && typeof eventKey === 'string' ? eventKey.trim() : null;

  // 5. Deduplication check using deterministic eventKey
  if (cleanEventKey) {
    const existing = await Notification.findOne({
      recipient: recipientId,
      eventKey: cleanEventKey,
    });
    if (existing) {
      return existing;
    }
  }

  let notification = null;

  try {
    notification = await Notification.create({
      recipient: recipientId,
      type,
      title: cleanTitle.slice(0, 100),
      message: cleanMessage.slice(0, 500),
      tournament: cleanTournament,
      pairing: cleanPairing,
      round: cleanRound,
      teamCompetition: cleanTeamCompetition,
      team: cleanTeam,
      teamMatch: cleanTeamMatch,
      teamRound: cleanTeamRound,
      metadata: cleanMetadata,
      eventKey: cleanEventKey,
      read: false,
    });
  } catch (err) {
    // Gracefully handle duplicate key conflict from atomic compound index { recipient: 1, eventKey: 1 }
    if (err.code === 11000 && cleanEventKey) {
      return await Notification.findOne({
        recipient: recipientId,
        eventKey: cleanEventKey,
      });
    }
    throw err;
  }

  // 6. Realtime emission to recipient's private room
  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      io.to(`user:${recipientId.toString()}`).emit('notification:new', {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        tournament: notification.tournament,
        teamCompetition: notification.teamCompetition,
        team: notification.team,
        teamMatch: notification.teamMatch,
        teamRound: notification.teamRound,
        pairing: notification.pairing,
        round: notification.round,
        metadata: notification.metadata,
        read: notification.read,
        createdAt: notification.createdAt,
      });
    }
  } catch (socketErr) {
    // Non-fatal realtime warning
  }

  return notification;
};

/**
 * Retrieves paginated notifications for an authenticated user.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Object} [options]
 * @param {number|string} [options.page=1]
 * @param {number|string} [options.limit=20]
 * @param {boolean|string} [options.unreadOnly=false]
 * @returns {Promise<Object>}
 */
export const getUserNotifications = async (userId, options = {}) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID');
    error.statusCode = 400;
    throw error;
  }

  const rawPage = parseInt(options.page, 10);
  const rawLimit = parseInt(options.limit, 10);
  const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;
  const skip = (page - 1) * limit;

  const query = { recipient: userId };
  if (options.unreadOnly === true || options.unreadOnly === 'true') {
    query.read = false;
  }

  const [notifications, totalCount, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('tournament', 'name status format clockLimit increment')
      .populate('round', 'roundNumber status')
      .populate('pairing', 'status result lichessGameUrl')
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

/**
 * Retrieves unread notification count for an authenticated user.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{ unreadCount: number }>}
 */
export const getUnreadCount = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID');
    error.statusCode = 400;
    throw error;
  }

  const unreadCount = await Notification.countDocuments({
    recipient: userId,
    read: false,
  });

  return { unreadCount };
};

/**
 * Marks a single notification as read for the authenticated owner.
 *
 * @param {string} notificationId
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Notification>}
 */
export const markAsRead = async (notificationId, userId) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  // Cross-user ownership authorization check
  if (notification.recipient.toString() !== userId.toString()) {
    const error = new Error('Forbidden: You do not have permission to modify this notification');
    error.statusCode = 403;
    throw error;
  }

  notification.read = true;
  await notification.save();

  return notification;
};

/**
 * Marks all unread notifications as read for the authenticated user.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{ success: boolean, modifiedCount: number }>}
 */
export const markAllAsRead = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID');
    error.statusCode = 400;
    throw error;
  }

  const result = await Notification.updateMany(
    { recipient: userId, read: false },
    { $set: { read: true } }
  );

  return {
    success: true,
    modifiedCount: result.modifiedCount || 0,
  };
};

/**
 * Deletes a single notification for the authenticated owner.
 *
 * @param {string} notificationId
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const deleteNotification = async (notificationId, userId) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  // Ownership authorization check
  if (notification.recipient.toString() !== userId.toString()) {
    const error = new Error('Forbidden: You do not have permission to delete this notification');
    error.statusCode = 403;
    throw error;
  }

  await Notification.findByIdAndDelete(notificationId);

  return {
    success: true,
    message: 'Notification deleted successfully',
  };
};

export default {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sanitizeMetadata,
};
