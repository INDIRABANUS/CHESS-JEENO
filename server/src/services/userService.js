import mongoose from 'mongoose';
import User from '../models/User.js';

/**
 * Validates whether a given string is a safe HTTP or HTTPS URL.
 * Rejects javascript:, data:, file:, and malformed URIs.
 *
 * @param {string} urlString
 * @returns {boolean}
 */
export const isValidAvatarUrl = (urlString) => {
  if (typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Formats a User document into a safe public profile object,
 * ensuring no sensitive hash, token, or secret is ever leaked.
 *
 * @param {Object} user
 * @returns {Object}
 */
export const sanitizeUserProfile = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role || 'USER',
  bio: user.bio || '',
  avatar: user.avatar || null,
  authProvider: user.authProvider,
  lichessUsername: user.lichessUsername || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * Retrieves the current authenticated user's safe profile.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Object>}
 */
export const getUserProfile = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return sanitizeUserProfile(user);
};

/**
 * Updates the current authenticated user's profile with validation.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Object} updates
 * @param {string} [updates.name]
 * @param {string} [updates.bio]
 * @param {string|null} [updates.avatar]
 * @returns {Promise<Object>}
 */
export const updateUserProfile = async (userId, { name, bio, avatar }) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Validate and apply display name
  if (name !== undefined) {
    if (typeof name !== 'string') {
      const error = new Error('Display name must be a string');
      error.statusCode = 400;
      throw error;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      const error = new Error('Display name cannot be empty');
      error.statusCode = 400;
      throw error;
    }
    if (trimmedName.length > 50) {
      const error = new Error('Display name cannot exceed 50 characters');
      error.statusCode = 400;
      throw error;
    }
    user.name = trimmedName;
  }

  // Validate and apply bio
  if (bio !== undefined) {
    if (typeof bio !== 'string') {
      const error = new Error('Bio must be a string');
      error.statusCode = 400;
      throw error;
    }
    const trimmedBio = bio.trim();
    if (trimmedBio.length > 500) {
      const error = new Error('Bio cannot exceed 500 characters');
      error.statusCode = 400;
      throw error;
    }
    user.bio = trimmedBio;
  }

  // Validate and apply avatar URL
  if (avatar !== undefined) {
    if (avatar === null || avatar === '') {
      user.avatar = null;
    } else if (typeof avatar === 'string') {
      const trimmedAvatar = avatar.trim();
      if (!trimmedAvatar) {
        user.avatar = null;
      } else {
        if (!isValidAvatarUrl(trimmedAvatar)) {
          const error = new Error('Avatar must be a valid HTTP or HTTPS URL');
          error.statusCode = 400;
          throw error;
        }
        if (trimmedAvatar.length > 2000) {
          const error = new Error('Avatar URL cannot exceed 2000 characters');
          error.statusCode = 400;
          throw error;
        }
        user.avatar = trimmedAvatar;
      }
    } else {
      const error = new Error('Avatar must be a valid URL string or null');
      error.statusCode = 400;
      throw error;
    }
  }

  await user.save();

  return sanitizeUserProfile(user);
};

/**
 * Searches users by name, email, or lichessUsername for invites.
 * Sanitizes input and projects only public, non-sensitive fields.
 *
 * @param {string} query
 * @param {string|mongoose.Types.ObjectId} [excludeUserId]
 * @param {number} [limit=10]
 * @returns {Promise<Array>}
 */
export const searchUsers = async (query = '', excludeUserId = null, limit = 10) => {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (!trimmed) {
    return [];
  }

  if (trimmed.length > 100) {
    const error = new Error('Search query cannot exceed 100 characters');
    error.statusCode = 400;
    throw error;
  }

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  const filter = {
    $or: [
      { name: regex },
      { email: regex },
      { lichessUsername: regex },
    ],
  };

  if (excludeUserId && mongoose.isValidObjectId(excludeUserId)) {
    filter._id = { $ne: excludeUserId };
  }

  const boundedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 25);

  const users = await User.find(filter)
    .select('_id name email avatar lichessUsername')
    .limit(boundedLimit)
    .lean();

  return users;
};

export default {
  getUserProfile,
  updateUserProfile,
  isValidAvatarUrl,
  sanitizeUserProfile,
  searchUsers,
};
