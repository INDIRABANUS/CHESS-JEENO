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

export default {
  getPlatformOverview,
};
