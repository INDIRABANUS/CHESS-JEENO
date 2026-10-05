import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database.js';
import apiRouter from '../routes/index.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../services/authService.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

dotenv.config();

const runAdminAnalyticsTests = async () => {
  console.log('🧪 Starting CHESS JEENO Admin Analytics & Platform Insights Test Suite...\n');
  await connectDB();

  // Create an isolated Express test server
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api', apiRouter);
  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  const testServer = http.createServer(testApp);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const API_BASE = `http://localhost:${port}/api`;
  console.log(`📡 In-process test server started on ${API_BASE}\n`);

  const timestamp = Date.now();
  const testPrefix = `admin_an_${timestamp}`;

  const createdUserIds = [];
  const createdTournamentIds = [];
  const createdRoundIds = [];
  const createdPairingIds = [];
  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, description) => {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${description}`);
      throw new Error(`Test assertion failed: ${description}`);
    }
    passedTests++;
    console.log(`  ✅ Passed: ${description}`);
  };

  try {
    // =========================================================================
    // 0. Setup Test Users: 1 Admin and 1 Regular User
    // =========================================================================
    console.log('--- Setting up Test Admin and Normal User ---');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('AdminSecretAnalytics123!', salt);
    const userPasswordHash = await bcrypt.hash('UserSecretAnalytics123!', salt);

    const adminUser = await User.create({
      name: 'Analytics Admin User',
      email: `${testPrefix}_admin@chessjeeno.local`,
      passwordHash: adminPasswordHash,
      authProvider: 'local',
      role: 'ADMIN',
      lichessUsername: 'admin_analytics',
      lichessOAuth: {
        accessToken: 'secret_oauth_access_token_analytics',
        refreshToken: 'secret_oauth_refresh_token_analytics',
      },
      googleId: 'google_secret_analytics_123',
    });
    createdUserIds.push(adminUser._id);
    const adminToken = generateToken(adminUser._id);

    const normalUser = await User.create({
      name: 'Regular Analytics Player',
      email: `${testPrefix}_player@chessjeeno.local`,
      passwordHash: userPasswordHash,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(normalUser._id);
    const normalUserToken = generateToken(normalUser._id);

    // =========================================================================
    // 1. Authorization Controls
    // =========================================================================
    console.log('\n--- 1. Testing Authorization Controls ---');

    // Unauthenticated request -> 401
    const resNoAuth = await fetch(`${API_BASE}/admin/analytics`);
    assert(resNoAuth.status === 401, 'Unauthenticated request to GET /api/admin/analytics returns 401');
    const bodyNoAuth = await resNoAuth.json();
    assert(bodyNoAuth.success === false, 'Unauthenticated response indicates success: false');

    // Normal USER request -> 403
    const resUserAuth = await fetch(`${API_BASE}/admin/analytics`, {
      headers: { Authorization: `Bearer ${normalUserToken}` },
    });
    assert(resUserAuth.status === 403, 'Normal USER request to GET /api/admin/analytics returns 403');
    const bodyUserAuth = await resUserAuth.json();
    assert(bodyUserAuth.success === false, 'Forbidden response indicates success: false');
    assert(
      bodyUserAuth.message && bodyUserAuth.message.includes('Administrator privileges required'),
      'Clear administrator privileges required message'
    );

    // Identity / role spoofing via query params -> 403
    const resSpoofQuery = await fetch(`${API_BASE}/admin/analytics?role=ADMIN&isAdmin=true`, {
      headers: { Authorization: `Bearer ${normalUserToken}` },
    });
    assert(resSpoofQuery.status === 403, 'Role spoofing via query param ?role=ADMIN is rejected with 403');

    // Valid ADMIN request -> 200
    const resAdmin = await fetch(`${API_BASE}/admin/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resAdmin.status === 200, 'ADMIN request to GET /api/admin/analytics returns 200 OK');
    const bodyAdmin = await resAdmin.json();
    assert(bodyAdmin.success === true, 'ADMIN response indicates success: true');

    // =========================================================================
    // 2. Response Structure Verification
    // =========================================================================
    console.log('\n--- 2. Testing Response Structure & Numeric Field Types ---');
    assert(bodyAdmin.overview && typeof bodyAdmin.overview === 'object', 'Response contains "overview" object');
    assert(bodyAdmin.users && typeof bodyAdmin.users === 'object', 'Response contains "users" object');
    assert(bodyAdmin.tournaments && typeof bodyAdmin.tournaments === 'object', 'Response contains "tournaments" object');
    assert(bodyAdmin.games && typeof bodyAdmin.games === 'object', 'Response contains "games" object');

    // Overview fields
    const { overview } = bodyAdmin;
    assert(typeof overview.totalUsers === 'number' && !isNaN(overview.totalUsers), 'overview.totalUsers is a number');
    assert(typeof overview.totalAdmins === 'number' && !isNaN(overview.totalAdmins), 'overview.totalAdmins is a number');
    assert(typeof overview.totalTournaments === 'number' && !isNaN(overview.totalTournaments), 'overview.totalTournaments is a number');
    assert(typeof overview.activeTournaments === 'number' && !isNaN(overview.activeTournaments), 'overview.activeTournaments is a number');
    assert(typeof overview.completedTournaments === 'number' && !isNaN(overview.completedTournaments), 'overview.completedTournaments is a number');
    assert(typeof overview.cancelledTournaments === 'number' && !isNaN(overview.cancelledTournaments), 'overview.cancelledTournaments is a number');
    assert(typeof overview.totalTournamentPlayers === 'number' && !isNaN(overview.totalTournamentPlayers), 'overview.totalTournamentPlayers is a number');
    assert(typeof overview.totalRounds === 'number' && !isNaN(overview.totalRounds), 'overview.totalRounds is a number');
    assert(typeof overview.totalPairings === 'number' && !isNaN(overview.totalPairings), 'overview.totalPairings is a number');
    assert(typeof overview.completedPairings === 'number' && !isNaN(overview.completedPairings), 'overview.completedPairings is a number');

    // Users fields
    const { users } = bodyAdmin;
    assert(Array.isArray(users.recentRegistrations), 'users.recentRegistrations is an array');
    assert(Array.isArray(users.roleDistribution), 'users.roleDistribution is an array');

    // Tournaments fields
    const { tournaments } = bodyAdmin;
    assert(Array.isArray(tournaments.statusDistribution), 'tournaments.statusDistribution is an array');
    assert(Array.isArray(tournaments.formatDistribution), 'tournaments.formatDistribution is an array');
    assert(Array.isArray(tournaments.recentCreationTrend), 'tournaments.recentCreationTrend is an array');

    // Games fields
    const { games } = bodyAdmin;
    assert(typeof games.totalGames === 'number' && !isNaN(games.totalGames), 'games.totalGames is a number');
    assert(typeof games.completedGames === 'number' && !isNaN(games.completedGames), 'games.completedGames is a number');
    assert(typeof games.abortedGames === 'number' && !isNaN(games.abortedGames), 'games.abortedGames is a number');
    assert(typeof games.whiteWins === 'number' && !isNaN(games.whiteWins), 'games.whiteWins is a number');
    assert(typeof games.blackWins === 'number' && !isNaN(games.blackWins), 'games.blackWins is a number');
    assert(typeof games.draws === 'number' && !isNaN(games.draws), 'games.draws is a number');

    // =========================================================================
    // 3. Controlled Fixtures & Verification
    // =========================================================================
    console.log('\n--- 3. Testing Real Metric Derivation with Controlled Fixtures ---');

    // Create a Swiss tournament, a Round Robin tournament, and a Knockout tournament
    const tSwiss = await Tournament.create({
      name: `${testPrefix} Swiss Championship`,
      createdBy: adminUser._id,
      format: 'SWISS',
      status: 'RUNNING',
      clockLimit: 600,
      increment: 5,
    });
    createdTournamentIds.push(tSwiss._id);

    const tRR = await Tournament.create({
      name: `${testPrefix} Round Robin Blitz`,
      createdBy: adminUser._id,
      format: 'ROUND_ROBIN',
      status: 'FINISHED',
      clockLimit: 300,
      increment: 2,
    });
    createdTournamentIds.push(tRR._id);

    const tKO = await Tournament.create({
      name: `${testPrefix} Knockout Cup`,
      createdBy: adminUser._id,
      format: 'KNOCKOUT',
      status: 'CANCELLED',
      clockLimit: 900,
      increment: 10,
    });
    createdTournamentIds.push(tKO._id);

    // Create TournamentPlayer records
    const tp1 = await TournamentPlayer.create({
      tournamentId: tSwiss._id,
      userId: adminUser._id,
      isApproved: true,
      score: 1,
    });
    const tp2 = await TournamentPlayer.create({
      tournamentId: tSwiss._id,
      userId: normalUser._id,
      isApproved: true,
      score: 0,
    });

    // Create Rounds
    const round1 = await Round.create({
      tournamentId: tSwiss._id,
      roundNumber: 1,
      status: 'COMPLETED',
    });
    createdRoundIds.push(round1._id);

    // Create Pairings with distinct results
    // Pairing 1: White win (1-0)
    const p1 = await Pairing.create({
      roundId: round1._id,
      tournamentId: tSwiss._id,
      whitePlayer: adminUser._id,
      blackPlayer: normalUser._id,
      status: 'FINISHED',
      result: '1-0',
    });
    createdPairingIds.push(p1._id);

    // Pairing 2: Black win (0-1)
    const p2 = await Pairing.create({
      roundId: round1._id,
      tournamentId: tSwiss._id,
      whitePlayer: normalUser._id,
      blackPlayer: adminUser._id,
      status: 'FINISHED',
      result: '0-1',
    });
    createdPairingIds.push(p2._id);

    // Pairing 3: Draw (1/2-1/2)
    const p3 = await Pairing.create({
      roundId: round1._id,
      tournamentId: tSwiss._id,
      whitePlayer: adminUser._id,
      blackPlayer: normalUser._id,
      status: 'FINISHED',
      result: '1/2-1/2',
    });
    createdPairingIds.push(p3._id);

    // Pairing 4: Aborted match
    const p4 = await Pairing.create({
      roundId: round1._id,
      tournamentId: tSwiss._id,
      whitePlayer: normalUser._id,
      blackPlayer: adminUser._id,
      status: 'ABORTED',
      result: 'ABORTED',
    });
    createdPairingIds.push(p4._id);

    // Query analytics again with the new fixtures
    const resUpdated = await fetch(`${API_BASE}/admin/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resUpdated.status === 200, 'GET /api/admin/analytics with fixtures returns 200');
    const dataUpdated = await resUpdated.json();

    // Verify overview counts reflect reality
    assert(dataUpdated.overview.totalUsers >= 2, 'totalUsers reflects created test users');
    assert(dataUpdated.overview.totalAdmins >= 1, 'totalAdmins reflects created admin user');
    assert(dataUpdated.overview.totalTournaments >= 3, 'totalTournaments reflects created tournaments');
    assert(dataUpdated.overview.activeTournaments >= 1, 'activeTournaments reflects RUNNING tournament');
    assert(dataUpdated.overview.completedTournaments >= 1, 'completedTournaments reflects FINISHED tournament');
    assert(dataUpdated.overview.cancelledTournaments >= 1, 'cancelledTournaments reflects CANCELLED tournament');
    assert(dataUpdated.overview.totalTournamentPlayers >= 2, 'totalTournamentPlayers reflects created players');
    assert(dataUpdated.overview.totalRounds >= 1, 'totalRounds reflects created round');
    assert(dataUpdated.overview.totalPairings >= 4, 'totalPairings reflects created pairings');
    assert(dataUpdated.overview.completedPairings >= 3, 'completedPairings reflects FINISHED pairings');

    // Verify format distribution
    const formats = dataUpdated.tournaments.formatDistribution.map((f) => f.format);
    assert(formats.includes('SWISS'), 'formatDistribution contains SWISS');
    assert(formats.includes('ROUND_ROBIN'), 'formatDistribution contains ROUND_ROBIN');
    assert(formats.includes('KNOCKOUT'), 'formatDistribution contains KNOCKOUT');
    dataUpdated.tournaments.formatDistribution.forEach((f) => {
      assert(['ROUND_ROBIN', 'SWISS', 'KNOCKOUT'].includes(f.format), `Format "${f.format}" is a valid existing format`);
      assert(typeof f.count === 'number' && f.count >= 1, `Format ${f.format} count is a positive number`);
    });

    // Verify status distribution
    const statuses = dataUpdated.tournaments.statusDistribution.map((s) => s.status);
    assert(statuses.includes('RUNNING'), 'statusDistribution contains RUNNING');
    assert(statuses.includes('FINISHED'), 'statusDistribution contains FINISHED');
    assert(statuses.includes('CANCELLED'), 'statusDistribution contains CANCELLED');
    dataUpdated.tournaments.statusDistribution.forEach((s) => {
      assert(typeof s.count === 'number' && s.count >= 0, `Status ${s.status} count is a non-negative number`);
    });

    // Verify role distribution
    const roles = dataUpdated.users.roleDistribution.map((r) => r.role);
    assert(roles.includes('ADMIN'), 'roleDistribution contains ADMIN');
    assert(roles.includes('USER'), 'roleDistribution contains USER');
    dataUpdated.users.roleDistribution.forEach((r) => {
      assert(['ADMIN', 'USER'].includes(r.role), `Role "${r.role}" is a valid role`);
      assert(typeof r.count === 'number' && r.count >= 1, `Role ${r.role} count is >= 1`);
    });

    // Verify games metrics
    assert(dataUpdated.games.totalGames >= 4, 'games.totalGames includes all 4 created pairings');
    assert(dataUpdated.games.completedGames >= 3, 'games.completedGames correctly counts completed matches');
    assert(dataUpdated.games.whiteWins >= 1, 'games.whiteWins correctly includes 1-0 match');
    assert(dataUpdated.games.blackWins >= 1, 'games.blackWins correctly includes 0-1 match');
    assert(dataUpdated.games.draws >= 1, 'games.draws correctly includes 1/2-1/2 match');
    assert(dataUpdated.games.abortedGames >= 1, 'games.abortedGames correctly includes ABORTED match');

    // =========================================================================
    // 4. Security Audit & Credential Concealment
    // =========================================================================
    console.log('\n--- 4. Testing Sensitive Credentials Concealment ---');
    const rawResponseBody = JSON.stringify(dataUpdated);

    assert(!rawResponseBody.includes('passwordHash'), 'Response excludes "passwordHash"');
    assert(!rawResponseBody.includes('AdminSecretAnalytics123!'), 'Response excludes plaintext passwords');
    assert(!rawResponseBody.includes('secret_oauth_access_token_analytics'), 'Response excludes OAuth access tokens');
    assert(!rawResponseBody.includes('secret_oauth_refresh_token_analytics'), 'Response excludes OAuth refresh tokens');
    assert(!rawResponseBody.includes('google_secret_analytics_123'), 'Response excludes Google OAuth identifiers/secrets');
    assert(!rawResponseBody.includes('__v'), 'Response excludes Mongoose internal __v');

    console.log('\n======================================================');
    console.log(`🎉 ALL ADMIN ANALYTICS TESTS PASSED: ${passedTests}/${totalTests} assertions`);
    console.log('======================================================\n');
  } finally {
    console.log('🧹 Cleaning up test users, tournaments, rounds, and pairings...');
    if (createdPairingIds.length > 0) {
      await Pairing.deleteMany({ _id: { $in: createdPairingIds } });
    }
    if (createdRoundIds.length > 0) {
      await Round.deleteMany({ _id: { $in: createdRoundIds } });
    }
    if (createdTournamentIds.length > 0) {
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    testServer.close();
    await mongoose.connection.close();
    console.log('✅ In-process test server and database connection closed.\n');
  }
};

runAdminAnalyticsTests().catch((err) => {
  console.error('❌ Test suite execution failed:', err);
  process.exit(1);
});
