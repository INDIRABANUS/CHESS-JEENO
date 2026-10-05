import mongoose from 'mongoose';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

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
  if (!Number.isInteger(parsedPage) || parsedPage < 1 || parsedPage > 10000) {
    const error = new Error('Invalid page parameter. Page must be a positive integer between 1 and 10000.');
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
    if (typeof role !== 'string') {
      const error = new Error("Invalid role filter. Role must be 'USER' or 'ADMIN'.");
      error.statusCode = 400;
      throw error;
    }
    const normalizedRole = role.trim().toUpperCase();
    if (normalizedRole !== 'USER' && normalizedRole !== 'ADMIN') {
      const error = new Error("Invalid role filter. Role must be 'USER' or 'ADMIN'.");
      error.statusCode = 400;
      throw error;
    }
    query.role = normalizedRole;
  }

  // Validate and apply search filter (name, email, lichessUsername)
  if (search !== undefined && search !== null && String(search).trim() !== '') {
    if (typeof search !== 'string') {
      const error = new Error('Invalid search parameter. Search must be a text string.');
      error.statusCode = 400;
      throw error;
    }
    const trimmedSearch = search.trim();
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

  if (actorUserId && !mongoose.isValidObjectId(actorUserId)) {
    const error = new Error('Invalid actor admin ID format');
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

/**
 * Valid tournament statuses supported by the Tournament schema.
 */
export const VALID_TOURNAMENT_STATUSES = [
  'DRAFT',
  'REGISTRATION',
  'READY_CHECK',
  'COUNTDOWN',
  'RUNNING',
  'IN_PROGRESS',
  'FINISHED',
  'COMPLETED',
  'CANCELLED',
];

/**
 * Valid tournament formats supported by the Tournament schema.
 */
export const VALID_TOURNAMENT_FORMATS = ['ROUND_ROBIN', 'SWISS', 'KNOCKOUT'];

/**
 * Retrieves a paginated, searchable, and filterable list of tournaments for platform administrators.
 *
 * Query params:
 * - page: positive integer >= 1
 * - limit: integer between 1 and 50
 * - search: string, case-insensitive, matches tournament name, creator handle/name/email, or tournament ID
 * - status: valid tournament lifecycle status
 * - format: valid tournament format (ROUND_ROBIN, SWISS, KNOCKOUT)
 *
 * @param {Object} [options]
 * @param {number|string} [options.page=1]
 * @param {number|string} [options.limit=20]
 * @param {string} [options.search='']
 * @param {string} [options.status='']
 * @param {string} [options.format='']
 * @returns {Promise<Object>} { tournaments, page, limit, total, totalPages }
 */
export const getAdminTournaments = async ({
  page = 1,
  limit = 20,
  search = '',
  status = '',
  format = '',
} = {}) => {
  // Validate page
  const parsedPage = Number(page);
  if (!Number.isInteger(parsedPage) || parsedPage < 1 || parsedPage > 10000) {
    const error = new Error('Invalid page parameter. Page must be a positive integer between 1 and 10000.');
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

  const query = {};

  // Validate and apply status filter
  if (status !== undefined && status !== null && String(status).trim() !== '') {
    if (typeof status !== 'string') {
      const error = new Error(
        `Invalid status filter. Allowed statuses: ${VALID_TOURNAMENT_STATUSES.join(', ')}`
      );
      error.statusCode = 400;
      throw error;
    }
    const normalizedStatus = status.trim().toUpperCase();
    if (!VALID_TOURNAMENT_STATUSES.includes(normalizedStatus)) {
      const error = new Error(
        `Invalid status filter. Allowed statuses: ${VALID_TOURNAMENT_STATUSES.join(', ')}`
      );
      error.statusCode = 400;
      throw error;
    }
    if (normalizedStatus === 'FINISHED' || normalizedStatus === 'COMPLETED') {
      query.status = { $in: ['FINISHED', 'COMPLETED'] };
    } else {
      query.status = normalizedStatus;
    }
  }

  // Validate and apply format filter
  if (format !== undefined && format !== null && String(format).trim() !== '') {
    if (typeof format !== 'string') {
      const error = new Error(
        `Invalid format filter. Allowed formats: ${VALID_TOURNAMENT_FORMATS.join(', ')}`
      );
      error.statusCode = 400;
      throw error;
    }
    const normalizedFormat = format.trim().toUpperCase();
    if (!VALID_TOURNAMENT_FORMATS.includes(normalizedFormat)) {
      const error = new Error(
        `Invalid format filter. Allowed formats: ${VALID_TOURNAMENT_FORMATS.join(', ')}`
      );
      error.statusCode = 400;
      throw error;
    }
    query.format = normalizedFormat;
  }

  // Validate and apply search filter
  if (search !== undefined && search !== null && String(search).trim() !== '') {
    if (typeof search !== 'string') {
      const error = new Error('Invalid search parameter. Search must be a text string.');
      error.statusCode = 400;
      throw error;
    }
    const trimmedSearch = search.trim();
    if (trimmedSearch.length > 100) {
      const error = new Error('Search query too long. Maximum 100 characters allowed.');
      error.statusCode = 400;
      throw error;
    }

    const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Find matching creator user IDs
    const matchingCreators = await User.find({
      $or: [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { lichessUsername: { $regex: escapedSearch, $options: 'i' } },
      ],
    }).distinct('_id');

    const searchConditions = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { createdBy: { $in: matchingCreators } },
    ];

    if (mongoose.isValidObjectId(trimmedSearch)) {
      searchConditions.push({ _id: new mongoose.Types.ObjectId(trimmedSearch) });
    }

    query.$or = searchConditions;
  }

  const skip = (parsedPage - 1) * parsedLimit;

  const [total, tournamentDocs] = await Promise.all([
    Tournament.countDocuments(query),
    Tournament.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('createdBy', 'name email avatar lichessUsername')
      .populate('winnerPlayer', 'name email avatar lichessUsername'),
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || (total === 0 ? 0 : 1);

  // Batch query participant counts (avoids N+1)
  const tournamentIds = tournamentDocs.map((t) => t._id);
  let participantCountMap = new Map();

  if (tournamentIds.length > 0) {
    const counts = await TournamentPlayer.aggregate([
      { $match: { tournamentId: { $in: tournamentIds } } },
      { $group: { _id: '$tournamentId', count: { $sum: 1 } } },
    ]);
    participantCountMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
  }

  const tournaments = tournamentDocs.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    description: t.description || '',
    format: t.format,
    status: t.status,
    rated: Boolean(t.rated),
    clockLimit: t.clockLimit,
    increment: t.increment,
    maxPlayers: t.maxPlayers || null,
    totalRounds: t.totalRounds || null,
    startTime: t.startTime || null,
    countdownStartedAt: t.countdownStartedAt || null,
    scheduledStartAt: t.scheduledStartAt || null,
    countdownSeconds: t.countdownSeconds,
    completionReason: t.completionReason || null,
    participantCount: participantCountMap.get(t._id.toString()) || 0,
    creator: t.createdBy
      ? {
          id: t.createdBy._id.toString(),
          name: t.createdBy.name || 'Organizer',
          email: t.createdBy.email || '',
          avatar: t.createdBy.avatar || null,
          lichessUsername: t.createdBy.lichessUsername || null,
        }
      : null,
    winner: t.winnerPlayer
      ? {
          id: t.winnerPlayer._id.toString(),
          name: t.winnerPlayer.name || 'Winner',
          email: t.winnerPlayer.email || '',
          avatar: t.winnerPlayer.avatar || null,
          lichessUsername: t.winnerPlayer.lichessUsername || null,
        }
      : null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  return {
    tournaments,
    page: parsedPage,
    limit: parsedLimit,
    total,
    totalPages,
  };
};

/**
 * Retrieves safe, comprehensive administrator details for a single tournament by ID.
 * Includes tournament metadata, approved participants, and rounds with pairings.
 *
 * @param {string} tournamentId
 * @returns {Promise<Object>} Safe tournament inspection details
 */
export const getAdminTournamentDetails = async (tournamentId) => {
  if (!mongoose.isValidObjectId(tournamentId)) {
    const error = new Error('Invalid tournament ID format');
    error.statusCode = 400;
    throw error;
  }

  const tournament = await Tournament.findById(tournamentId)
    .populate('createdBy', 'name email avatar lichessUsername')
    .populate('winnerPlayer', 'name email avatar lichessUsername');

  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Fetch participants, rounds, and pairings in parallel
  const [participants, rounds, pairings] = await Promise.all([
    TournamentPlayer.find({ tournamentId })
      .populate('userId', 'name email avatar lichessUsername')
      .sort({ score: -1, isReady: -1, createdAt: 1 }),
    Round.find({ tournamentId }).sort({ roundNumber: 1 }),
    Pairing.find({ tournamentId })
      .populate('whitePlayer', 'name email avatar lichessUsername')
      .populate('blackPlayer', 'name email avatar lichessUsername')
      .sort({ roundId: 1, createdAt: 1 }),
  ]);

  // Group pairings by round ID
  const pairingsByRound = new Map();
  pairings.forEach((p) => {
    const rId = p.roundId.toString();
    if (!pairingsByRound.has(rId)) pairingsByRound.set(rId, []);
    pairingsByRound.get(rId).push({
      id: p._id.toString(),
      whitePlayer: p.whitePlayer
        ? {
            id: p.whitePlayer._id.toString(),
            name: p.whitePlayer.name,
            lichessUsername: p.whitePlayer.lichessUsername || null,
          }
        : null,
      blackPlayer: p.blackPlayer
        ? {
            id: p.blackPlayer._id.toString(),
            name: p.blackPlayer.name,
            lichessUsername: p.blackPlayer.lichessUsername || null,
          }
        : null,
      status: p.status,
      result: p.result,
      lichessGameId: p.lichessGameId || null,
      lichessGameUrl: p.lichessGameUrl || null,
      lichessStatus: p.lichessStatus || null,
      rematchCount: p.rematchCount || 0,
      startedAt: p.startedAt || null,
      completedAt: p.completedAt || null,
    });
  });

  const safeRounds = rounds.map((r) => ({
    id: r._id.toString(),
    roundNumber: r.roundNumber,
    status: r.status,
    stageName: r.stageName || null,
    startedAt: r.startedAt || null,
    completedAt: r.completedAt || null,
    pairings: pairingsByRound.get(r._id.toString()) || [],
  }));

  const safeParticipants = participants.map((p) => ({
    id: p._id.toString(),
    userId: p.userId ? p.userId._id.toString() : null,
    name: p.userId?.name || 'Unknown Player',
    email: p.userId?.email || '',
    avatar: p.userId?.avatar || null,
    lichessUsername: p.userId?.lichessUsername || null,
    isReady: Boolean(p.isReady),
    isApproved: p.isApproved !== false,
    score: p.score || 0,
    joinedAt: p.createdAt,
  }));

  // Determine current round
  let currentRound = null;
  const runningRound = safeRounds.find((r) => r.status === 'RUNNING');
  if (runningRound) {
    currentRound = runningRound.roundNumber;
  } else if (safeRounds.length > 0) {
    currentRound = safeRounds[safeRounds.length - 1].roundNumber;
  }

  return {
    id: tournament._id.toString(),
    name: tournament.name,
    description: tournament.description || '',
    format: tournament.format,
    status: tournament.status,
    rated: Boolean(tournament.rated),
    clockLimit: tournament.clockLimit,
    increment: tournament.increment,
    maxPlayers: tournament.maxPlayers || null,
    totalRounds: tournament.totalRounds || null,
    currentRound,
    startTime: tournament.startTime || null,
    countdownStartedAt: tournament.countdownStartedAt || null,
    scheduledStartAt: tournament.scheduledStartAt || null,
    countdownSeconds: tournament.countdownSeconds,
    completionReason: tournament.completionReason || null,
    participantCount: safeParticipants.length,
    creator: tournament.createdBy
      ? {
          id: tournament.createdBy._id.toString(),
          name: tournament.createdBy.name || 'Organizer',
          email: tournament.createdBy.email || '',
          avatar: tournament.createdBy.avatar || null,
          lichessUsername: tournament.createdBy.lichessUsername || null,
        }
      : null,
    winner: tournament.winnerPlayer
      ? {
          id: tournament.winnerPlayer._id.toString(),
          name: tournament.winnerPlayer.name || 'Winner',
          email: tournament.winnerPlayer.email || '',
          avatar: tournament.winnerPlayer.avatar || null,
          lichessUsername: tournament.winnerPlayer.lichessUsername || null,
        }
      : null,
    participants: safeParticipants,
    rounds: safeRounds,
    createdAt: tournament.createdAt,
    updatedAt: tournament.updatedAt,
  };
};

/**
 * Safely cancels a tournament as a platform administrator.
 *
 * Safety Invariants:
 * - Cannot cancel a tournament that is already FINISHED or COMPLETED (returns 400).
 * - Cannot cancel a tournament that is already CANCELLED (returns 400).
 * - Cannot cancel a tournament with actively running Lichess matches (returns 409).
 * - Preserves historical records, participant data, and previous round history in MongoDB.
 *
 * @param {string} tournamentId
 * @param {string} actorUserId
 * @returns {Promise<Object>}
 */
export const cancelAdminTournament = async (tournamentId, actorUserId) => {
  if (!mongoose.isValidObjectId(tournamentId)) {
    const error = new Error('Invalid tournament ID format');
    error.statusCode = 400;
    throw error;
  }

  if (actorUserId && !mongoose.isValidObjectId(actorUserId)) {
    const error = new Error('Invalid actor admin ID format');
    error.statusCode = 400;
    throw error;
  }

  const tournament = await Tournament.findById(tournamentId)
    .populate('createdBy', 'name email avatar lichessUsername');

  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  if (tournament.status === 'CANCELLED') {
    const error = new Error('Tournament is already cancelled.');
    error.statusCode = 400;
    throw error;
  }

  if (tournament.status === 'FINISHED' || tournament.status === 'COMPLETED') {
    const error = new Error('Cannot cancel a tournament that has already finished.');
    error.statusCode = 400;
    throw error;
  }

  // Check for active matches currently in progress
  const activePairingsCount = await Pairing.countDocuments({
    tournamentId,
    status: { $in: ['ACTIVE', 'RUNNING', 'REMATCHING'] },
  });

  if (activePairingsCount > 0) {
    const error = new Error(
      'Cannot cancel tournament while matches are actively being played. Active games must conclude or abort first.'
    );
    error.statusCode = 409;
    throw error;
  }

  tournament.status = 'CANCELLED';
  await tournament.save();

  return {
    id: tournament._id.toString(),
    name: tournament.name,
    status: tournament.status,
    format: tournament.format,
    updatedAt: tournament.updatedAt,
  };
};

/**
 * Compiles platform analytics and business insights for administrators.
 * 
 * Aggregates:
 * 1. Overview counts: total users, admins, tournaments (by lifecycle), players, rounds, pairings.
 * 2. User metrics: role distribution and recent registration trend (last 30 days).
 * 3. Tournament metrics: status distribution, format distribution, and recent creation trend.
 * 4. Game metrics: total, completed, aborted, White wins, Black wins, draws.
 * 
 * Guarantees:
 * - Real MongoDB collections; zero mock data
 * - Parallel execution without N+1 queries
 * - Safe aggregated metrics: zero secrets, passwords, or OAuth tokens
 * 
 * @returns {Promise<Object>} Safe platform analytics
 */
export const getAdminAnalytics = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalAdmins,
    totalTournaments,
    activeTournaments,
    completedTournaments,
    cancelledTournaments,
    totalTournamentPlayers,
    totalRounds,
    totalPairings,
    completedPairings,
    roleDistributionRaw,
    recentRegistrationsRaw,
    statusDistributionRaw,
    formatDistributionRaw,
    recentCreationTrendRaw,
    gamesAggregation,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'ADMIN' }),
    Tournament.countDocuments({}),
    Tournament.countDocuments({ status: { $in: ['RUNNING', 'IN_PROGRESS', 'COUNTDOWN', 'READY_CHECK', 'ACTIVE'] } }),
    Tournament.countDocuments({ status: { $in: ['FINISHED', 'COMPLETED'] } }),
    Tournament.countDocuments({ status: 'CANCELLED' }),
    TournamentPlayer.countDocuments({}),
    Round.countDocuments({}),
    Pairing.countDocuments({}),
    Pairing.countDocuments({ status: { $in: ['FINISHED', 'COMPLETED'] } }),
    User.aggregate([
      { $group: { _id: { $ifNull: ['$role', 'USER'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Tournament.aggregate([
      { $group: { _id: { $ifNull: ['$status', 'REGISTRATION'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Tournament.aggregate([
      { $group: { _id: { $ifNull: ['$format', 'ROUND_ROBIN'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Tournament.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Pairing.aggregate([
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          completedGames: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ['$status', ['FINISHED', 'COMPLETED']] },
                    { $in: ['$result', ['1-0', '0-1', '1/2-1/2', 'WHITE_WIN', 'BLACK_WIN', 'DRAW']] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          abortedGames: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$status', 'ABORTED'] },
                    { $eq: ['$result', 'ABORTED'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          whiteWins: {
            $sum: {
              $cond: [{ $in: ['$result', ['1-0', 'WHITE_WIN']] }, 1, 0],
            },
          },
          blackWins: {
            $sum: {
              $cond: [{ $in: ['$result', ['0-1', 'BLACK_WIN']] }, 1, 0],
            },
          },
          draws: {
            $sum: {
              $cond: [{ $in: ['$result', ['1/2-1/2', 'DRAW']] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const games = gamesAggregation[0]
    ? {
        totalGames: gamesAggregation[0].totalGames || 0,
        completedGames: gamesAggregation[0].completedGames || 0,
        abortedGames: gamesAggregation[0].abortedGames || 0,
        whiteWins: gamesAggregation[0].whiteWins || 0,
        blackWins: gamesAggregation[0].blackWins || 0,
        draws: gamesAggregation[0].draws || 0,
      }
    : {
        totalGames: 0,
        completedGames: 0,
        abortedGames: 0,
        whiteWins: 0,
        blackWins: 0,
        draws: 0,
      };

  const roleDistribution = (roleDistributionRaw || []).map((item) => ({
    role: item._id || 'UNKNOWN',
    count: item.count || 0,
  }));

  const recentRegistrations = (recentRegistrationsRaw || []).map((item) => ({
    date: item._id,
    count: item.count || 0,
  }));

  const statusDistribution = (statusDistributionRaw || []).map((item) => ({
    status: item._id || 'UNKNOWN',
    count: item.count || 0,
  }));

  const formatDistribution = (formatDistributionRaw || []).map((item) => ({
    format: item._id || 'UNKNOWN',
    count: item.count || 0,
  }));

  const recentCreationTrend = (recentCreationTrendRaw || []).map((item) => ({
    date: item._id,
    count: item.count || 0,
  }));

  return {
    overview: {
      totalUsers,
      totalAdmins,
      totalTournaments,
      activeTournaments,
      completedTournaments,
      cancelledTournaments,
      totalTournamentPlayers,
      totalRounds,
      totalPairings,
      completedPairings,
    },
    users: {
      recentRegistrations,
      roleDistribution,
    },
    tournaments: {
      statusDistribution,
      formatDistribution,
      recentCreationTrend,
    },
    games,
  };
};

export default {
  getPlatformOverview,
  getAdminUsers,
  getAdminUserDetails,
  updateAdminUserRole,
  sanitizeAdminUser,
  getAdminTournaments,
  getAdminTournamentDetails,
  cancelAdminTournament,
  getAdminAnalytics,
  VALID_TOURNAMENT_STATUSES,
  VALID_TOURNAMENT_FORMATS,
};


