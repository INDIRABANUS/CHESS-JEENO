import mongoose from 'mongoose';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';

/**
 * Active tournament statuses representing tournaments currently in an active playable/ongoing state.
 */
const ACTIVE_TOURNAMENT_STATUSES = [
  'RUNNING',
  'IN_PROGRESS',
  'COUNTDOWN',
  'READY_CHECK',
  'ACTIVE',
];

/**
 * Completed tournament statuses.
 */
const COMPLETED_TOURNAMENT_STATUSES = [
  'FINISHED',
  'COMPLETED',
];

/**
 * Registration/upcoming tournament statuses.
 */
const REGISTRATION_TOURNAMENT_STATUSES = [
  'REGISTRATION',
  'PENDING',
  'DRAFT',
];

/**
 * Compiles a comprehensive, platform-level overview for administrators.
 * 
 * Uses efficient MongoDB queries (parallel countDocuments, limited projection, and aggregate)
 * to avoid N+1 queries and memory bloat.
 * 
 * Invariants:
 * - Never returns passwordHash, OAuth secrets, Lichess tokens, or private credentials
 * - Real MongoDB collection data; zero mock data
 * - Sorted newest first with fixed limits
 * 
 * @returns {Promise<Object>} Safe overview statistics and recent activity
 */
export const getPlatformOverview = async () => {
  // Execute aggregation and count queries in parallel
  const [
    totalUsers,
    totalAdmins,
    totalTournaments,
    activeTournaments,
    completedTournaments,
    registrationTournaments,
    recentUsersDocs,
    recentTournamentsDocs,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'ADMIN' }),
    Tournament.countDocuments(),
    Tournament.countDocuments({ status: { $in: ACTIVE_TOURNAMENT_STATUSES } }),
    Tournament.countDocuments({ status: { $in: COMPLETED_TOURNAMENT_STATUSES } }),
    Tournament.countDocuments({ status: { $in: REGISTRATION_TOURNAMENT_STATUSES } }),
    User.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .select('name email role authProvider createdAt'),
    Tournament.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('createdBy', 'name email')
      .select('name format status createdBy clockLimit increment maxPlayers totalRounds startTime createdAt'),
  ]);

  // Aggregate participant counts for recent tournaments in a single batch query (avoids N+1)
  const tournamentIds = recentTournamentsDocs.map((t) => t._id);
  let participantCountMap = new Map();

  if (tournamentIds.length > 0) {
    const counts = await TournamentPlayer.aggregate([
      {
        $match: {
          tournamentId: { $in: tournamentIds },
          isApproved: true,
        },
      },
      {
        $group: {
          _id: '$tournamentId',
          count: { $sum: 1 },
        },
      },
    ]);
    participantCountMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
  }

  // Format safe recent users
  const recentUsers = recentUsersDocs.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role || 'USER',
    authProvider: u.authProvider,
    createdAt: u.createdAt,
  }));

  // Format safe recent tournaments
  const recentTournaments = recentTournamentsDocs.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    format: t.format,
    status: t.status,
    creator: t.createdBy
      ? {
          id: t.createdBy._id.toString(),
          name: t.createdBy.name || 'Organizer',
          email: t.createdBy.email || '',
        }
      : null,
    participantCount: participantCountMap.get(t._id.toString()) || 0,
    maxPlayers: t.maxPlayers || null,
    clockLimit: t.clockLimit,
    increment: t.increment,
    startTime: t.startTime || null,
    createdAt: t.createdAt,
  }));

  // Application-level platform health
  const dbReadyState = mongoose.connection.readyState;
  const isDbConnected = dbReadyState === 1;

  const platformStatus = {
    api: 'Operational',
    database: isDbConnected ? 'Connected' : 'Degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  return {
    stats: {
      totalUsers,
      totalAdmins,
      totalTournaments,
      activeTournaments,
      completedTournaments,
      registrationTournaments,
    },
    recentUsers,
    recentTournaments,
    platformStatus,
  };
};

/**
 * Sanitizes a User document into a safe admin representation.
 * Explicitly excludes passwordHash, tokens, and OAuth secrets.
 *
 * @param {Object} user - Mongoose User document or plain object
 * @returns {Object} Safe admin user object
 */
export const sanitizeAdminUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role || 'USER',
  avatar: user.avatar || null,
  bio: user.bio || '',
  authProvider: user.authProvider || 'local',
  googleConnected: Boolean(user.googleId),
  lichessConnected: Boolean(user.lichessUsername || user.lichessOAuth?.connectedAt),
  lichessUsername: user.lichessUsername || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * Retrieves a paginated, searchable, and filterable list of users for platform administrators.
 *
 * Validation rules:
 * - page: must be a positive integer >= 1
 * - limit: must be an integer between 1 and 50
 * - role: if specified, must be 'USER' or 'ADMIN'
 * - search: string, case-insensitive, regex-escaped, max 100 chars
 *
 * @param {Object} options
 * @param {number|string} [options.page=1]
 * @param {number|string} [options.limit=20]
 * @param {string} [options.search='']
 * @param {string} [options.role='']
 * @returns {Promise<Object>} { users, page, limit, total, totalPages }
 */
export const getAdminUsers = async ({ page = 1, limit = 20, search = '', role = '' } = {}) => {
  // Validate page
  const parsedPage = Number(page);
  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    const error = new Error('Invalid page parameter. Page must be a positive integer greater than or equal to 1.');
    error.statusCode = 400;
    throw error;
  }

  // Validate limit
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
    const error = new Error('Invalid limit parameter. Limit must be an integer between 1 and 50.');
    error.statusCode = 400;
    throw error;
  }

  // Build query
  const query = {};

  // Validate and apply role filter
  if (role !== undefined && role !== null && String(role).trim() !== '') {
    const normalizedRole = String(role).trim().toUpperCase();
    if (normalizedRole !== 'USER' && normalizedRole !== 'ADMIN') {
      const error = new Error("Invalid role filter. Role must be 'USER' or 'ADMIN'.");
      error.statusCode = 400;
      throw error;
    }
    query.role = normalizedRole;
  }

  // Validate and apply search filter (name, email, lichessUsername)
  if (search !== undefined && search !== null && String(search).trim() !== '') {
    const trimmedSearch = String(search).trim();
    if (trimmedSearch.length > 100) {
      const error = new Error('Search query too long. Maximum 100 characters allowed.');
      error.statusCode = 400;
      throw error;
    }

    // Safely escape regex special characters to prevent ReDoS / injection
    const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
      { lichessUsername: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  const skip = (parsedPage - 1) * parsedLimit;

  // Execute count and query in parallel
  const [total, userDocs] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .select('name email role avatar bio authProvider googleId lichessUsername lichessOAuth.connectedAt createdAt updatedAt'),
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || (total === 0 ? 0 : 1);
  const users = userDocs.map(sanitizeAdminUser);

  return {
    users,
    page: parsedPage,
    limit: parsedLimit,
    total,
    totalPages,
  };
};

/**
 * Retrieves safe admin details for a single user by ID.
 *
 * @param {string} userId - Target user ObjectId string
 * @returns {Promise<Object>} Safe user details object
 */
export const getAdminUserDetails = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId).select(
    'name email role avatar bio authProvider googleId lichessUsername lichessUserId lichessOAuth.connectedAt createdAt updatedAt'
  );

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return sanitizeAdminUser(user);
};

/**
 * Updates a user's role between USER and ADMIN with lockout prevention.
 *
 * Safety Invariants:
 * - Only 'USER' and 'ADMIN' roles are valid.
 * - Cannot demote the final remaining administrator (returns 409).
 * - Prevents self-demotion if it would leave zero administrators (returns 409).
 * - Database is the authoritative source of truth.
 *
 * @param {string} userId - Target user ObjectId string
 * @param {string} newRole - Target role ('USER' or 'ADMIN')
 * @param {string} actorUserId - Authenticated admin ID performing the change
 * @returns {Promise<Object>} Safe updated user object
 */
export const updateAdminUserRole = async (userId, newRole, actorUserId) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  if (!newRole || typeof newRole !== 'string') {
    const error = new Error('Role is required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedRole = newRole.trim().toUpperCase();
  if (normalizedRole !== 'USER' && normalizedRole !== 'ADMIN') {
    const error = new Error("Invalid role. Role must be 'USER' or 'ADMIN'");
    error.statusCode = 400;
    throw error;
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // If already at requested role, return current state
  if (targetUser.role === normalizedRole) {
    return sanitizeAdminUser(targetUser);
  }

  // Prevent lockout if demoting an ADMIN to USER
  if (targetUser.role === 'ADMIN' && normalizedRole === 'USER') {
    const adminCount = await User.countDocuments({ role: 'ADMIN' });
    if (adminCount <= 1) {
      const error = new Error(
        'Cannot demote the final remaining administrator. The platform must retain at least one admin account.'
      );
      error.statusCode = 409;
      throw error;
    }
  }

  targetUser.role = normalizedRole;
  await targetUser.save();

  return sanitizeAdminUser(targetUser);
};

export default {
  getPlatformOverview,
  getAdminUsers,
  getAdminUserDetails,
  updateAdminUserRole,
  sanitizeAdminUser,
};

