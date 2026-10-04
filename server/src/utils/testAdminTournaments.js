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

const runAdminTournamentsTests = async () => {
  console.log('🧪 Starting CHESS JEENO Platform Admin Tournament Management Test Suite...\n');
  await connectDB();

  // Create an isolated Express instance for testing
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
  const testPrefix = `admin_tourn_${timestamp}`;

  const createdUserIds = [];
  const createdTournamentIds = [];
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
    // Setup Test Admin, Normal User, and Test Tournaments
    // =========================================================================
    console.log('--- Setting up Test Data ---');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('TournamentAdminPass123!', salt);

    // Admin user
    const adminUser = await User.create({
      name: 'Tournament Admin Master',
      email: `${testPrefix}_admin@chessjeeno.local`,
      passwordHash,
      role: 'ADMIN',
      authProvider: 'local',
    });
    createdUserIds.push(adminUser._id);
    const adminToken = generateToken(adminUser._id);

    // Normal user
    const normalUser = await User.create({
      name: 'Regular Tournament Player',
      email: `${testPrefix}_player@chessjeeno.local`,
      passwordHash,
      role: 'USER',
      authProvider: 'lichess',
      lichessUsername: `${testPrefix}_player_lic`,
    });
    createdUserIds.push(normalUser._id);
    const normalUserToken = generateToken(normalUser._id);

    // Tournament Host User
    const hostUser = await User.create({
      name: 'Tournament Host Organizer',
      email: `${testPrefix}_host@chessjeeno.local`,
      passwordHash,
      role: 'USER',
      authProvider: 'local',
    });
    createdUserIds.push(hostUser._id);

    // Tournament 1: Registration (Swiss)
    const t1 = await Tournament.create({
      name: `${testPrefix} Summer Swiss Open`,
      description: 'Annual summer swiss tournament',
      createdBy: hostUser._id,
      format: 'SWISS',
      status: 'REGISTRATION',
      clockLimit: 600,
      increment: 5,
      totalRounds: 3,
      maxPlayers: 16,
    });
    createdTournamentIds.push(t1._id);

    // Add players to t1
    await TournamentPlayer.create({
      tournamentId: t1._id,
      userId: normalUser._id,
      isApproved: true,
      isReady: true,
    });

    // Tournament 2: Round Robin (Registration)
    const t2 = await Tournament.create({
      name: `${testPrefix} Rapid Round Robin`,
      description: 'Rapid round robin championship',
      createdBy: adminUser._id,
      format: 'ROUND_ROBIN',
      status: 'REGISTRATION',
      clockLimit: 300,
      increment: 0,
      maxPlayers: 8,
    });
    createdTournamentIds.push(t2._id);

    // Tournament 3: Knockout (Completed)
    const t3 = await Tournament.create({
      name: `${testPrefix} Winter Knockout Cup`,
      description: 'Single elimination cup',
      createdBy: hostUser._id,
      format: 'KNOCKOUT',
      status: 'FINISHED',
      clockLimit: 180,
      increment: 2,
      maxPlayers: 4,
      winnerPlayer: normalUser._id,
    });
    createdTournamentIds.push(t3._id);

    // Tournament 4: Active tournament with live match in progress
    const t4 = await Tournament.create({
      name: `${testPrefix} Live Blitz Arena`,
      description: 'Active live blitz matches',
      createdBy: hostUser._id,
      format: 'ROUND_ROBIN',
      status: 'RUNNING',
      clockLimit: 180,
      increment: 0,
    });
    createdTournamentIds.push(t4._id);

    const round1 = await Round.create({
      tournamentId: t4._id,
      roundNumber: 1,
      status: 'RUNNING',
    });

    // Live match in progress on t4
    const livePairing = await Pairing.create({
      tournamentId: t4._id,
      roundId: round1._id,
      whitePlayer: normalUser._id,
      blackPlayer: hostUser._id,
      status: 'ACTIVE',
      result: 'PENDING',
      lichessGameId: 'livegame123',
    });

    console.log(`Created test users and 4 tournaments.\n`);

    // Helper fetch wrapper
    const apiRequest = async (path, options = {}) => {
      const url = `${API_BASE}${path}`;
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...options.headers,
        },
        method: options.method || 'GET',
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    };

    // =========================================================================
    // 1. Authorization Controls
    // =========================================================================
    console.log('--- 1. Testing Authorization Controls ---');

    // Unauthenticated GET /tournaments
    const unauthList = await apiRequest('/admin/tournaments');
    assert(unauthList.status === 401, 'Unauthenticated GET /api/admin/tournaments returns 401');

    // Normal USER GET /tournaments
    const forbiddenList = await apiRequest('/admin/tournaments', { token: normalUserToken });
    assert(forbiddenList.status === 403, 'Normal USER GET /api/admin/tournaments returns 403');

    // Unauthenticated GET /tournaments/:id
    const unauthDetails = await apiRequest(`/admin/tournaments/${t1._id}`);
    assert(unauthDetails.status === 401, 'Unauthenticated GET /api/admin/tournaments/:id returns 401');

    // Normal USER GET /tournaments/:id
    const forbiddenDetails = await apiRequest(`/admin/tournaments/${t1._id}`, { token: normalUserToken });
    assert(forbiddenDetails.status === 403, 'Normal USER GET /api/admin/tournaments/:id returns 403');

    // Unauthenticated PATCH /tournaments/:id/cancel
    const unauthCancel = await apiRequest(`/admin/tournaments/${t1._id}/cancel`, { method: 'PATCH' });
    assert(unauthCancel.status === 401, 'Unauthenticated PATCH /api/admin/tournaments/:id/cancel returns 401');

    // Normal USER PATCH /tournaments/:id/cancel
    const forbiddenCancel = await apiRequest(`/admin/tournaments/${t1._id}/cancel`, {
      method: 'PATCH',
      token: normalUserToken,
    });
    assert(forbiddenCancel.status === 403, 'Normal USER PATCH /api/admin/tournaments/:id/cancel returns 403');

    // ADMIN succeeds
    const adminList = await apiRequest('/admin/tournaments', { token: adminToken });
    assert(adminList.status === 200, 'ADMIN GET /api/admin/tournaments returns 200');
    assert(adminList.data.success === true, 'ADMIN response indicates success: true');
    assert(Array.isArray(adminList.data.tournaments), 'ADMIN response contains tournaments array');

    // =========================================================================
    // 2. Listing & Pagination
    // =========================================================================
    console.log('\n--- 2. Testing Pagination & Metadata ---');

    // Default pagination metadata
    assert(adminList.data.page === 1, 'Default page is 1');
    assert(adminList.data.limit === 20, 'Default limit is 20');
    assert(typeof adminList.data.total === 'number' && adminList.data.total >= 4, 'Total tournaments count is accurate');
    assert(typeof adminList.data.totalPages === 'number', 'Total pages is provided');

    // Custom limit
    const limit2Page = await apiRequest('/admin/tournaments?page=1&limit=2', { token: adminToken });
    assert(limit2Page.status === 200, 'Custom limit=2 succeeds');
    assert(limit2Page.data.tournaments.length === 2, 'Returns exactly 2 tournaments when limit=2');
    assert(limit2Page.data.limit === 2, 'Metadata reflects limit=2');

    // Page navigation
    const page2 = await apiRequest('/admin/tournaments?page=2&limit=2', { token: adminToken });
    assert(page2.status === 200, 'Page 2 succeeds');
    assert(page2.data.page === 2, 'Metadata reflects page=2');
    assert(
      page2.data.tournaments[0]?.id !== limit2Page.data.tournaments[0]?.id,
      'Page 2 returns different tournaments than Page 1'
    );

    // Invalid page validation
    const invalidPage0 = await apiRequest('/admin/tournaments?page=0', { token: adminToken });
    assert(invalidPage0.status === 400, 'page=0 is rejected with 400');

    const invalidPageNeg = await apiRequest('/admin/tournaments?page=-1', { token: adminToken });
    assert(invalidPageNeg.status === 400, 'page=-1 is rejected with 400');

    const invalidPageStr = await apiRequest('/admin/tournaments?page=xyz', { token: adminToken });
    assert(invalidPageStr.status === 400, 'page=xyz is rejected with 400');

    // Invalid limit validation
    const invalidLimit0 = await apiRequest('/admin/tournaments?limit=0', { token: adminToken });
    assert(invalidLimit0.status === 400, 'limit=0 is rejected with 400');

    const invalidLimit51 = await apiRequest('/admin/tournaments?limit=51', { token: adminToken });
    assert(invalidLimit51.status === 400, 'limit=51 is rejected with 400');

    const invalidLimitStr = await apiRequest('/admin/tournaments?limit=abc', { token: adminToken });
    assert(invalidLimitStr.status === 400, 'limit=abc is rejected with 400');

    // Batch query participant counts (avoids N+1)
    const t1FromList = adminList.data.tournaments.find((t) => t.id === t1._id.toString());
    assert(t1FromList !== undefined, 't1 found in tournaments list');
    assert(t1FromList.participantCount === 1, 'participantCount accurately aggregated in list');

    // =========================================================================
    // 3. Search Capability
    // =========================================================================
    console.log('\n--- 3. Testing Search Capability ---');

    // Search by tournament name (case-insensitive)
    const searchByName = await apiRequest(`/admin/tournaments?search=summer+swiss`, { token: adminToken });
    assert(searchByName.status === 200, 'Search by name returns 200');
    assert(
      searchByName.data.tournaments.some((t) => t.id === t1._id.toString()),
      'Matches "Summer Swiss Open"'
    );
    assert(
      !searchByName.data.tournaments.some((t) => t.id === t3._id.toString()),
      'Excludes non-matching tournament "Winter Knockout"'
    );

    // Search by creator name
    const searchByCreator = await apiRequest(`/admin/tournaments?search=Tournament+Host`, { token: adminToken });
    assert(searchByCreator.status === 200, 'Search by creator name returns 200');
    assert(
      searchByCreator.data.tournaments.some((t) => t.id === t1._id.toString()),
      'Matches tournaments created by Tournament Host'
    );

    // Search by tournament ID
    const searchById = await apiRequest(`/admin/tournaments?search=${t3._id.toString()}`, { token: adminToken });
    assert(searchById.status === 200, 'Search by tournament ID returns 200');
    assert(
      searchById.data.tournaments.some((t) => t.id === t3._id.toString()),
      'Matches tournament by exact ObjectId'
    );

    // Search regex safety
    const searchSpecial = await apiRequest('/admin/tournaments?search=[regex]+test', { token: adminToken });
    assert(searchSpecial.status === 200, 'Search with regex special characters safely returns 200 without error');

    // Search length limit
    const longSearch = 'x'.repeat(101);
    const searchTooLong = await apiRequest(`/admin/tournaments?search=${longSearch}`, { token: adminToken });
    assert(searchTooLong.status === 400, 'Search query > 100 characters rejected with 400');

    // =========================================================================
    // 4. Filtering (Status and Format)
    // =========================================================================
    console.log('\n--- 4. Testing Status and Format Filtering ---');

    // Filter by format=SWISS
    const filterSwiss = await apiRequest(`/admin/tournaments?format=SWISS&search=${testPrefix}`, { token: adminToken });
    assert(filterSwiss.status === 200, 'Filter format=SWISS returns 200');
    assert(
      filterSwiss.data.tournaments.every((t) => t.format === 'SWISS'),
      'All returned tournaments have format SWISS'
    );
    assert(
      filterSwiss.data.tournaments.some((t) => t.id === t1._id.toString()),
      'Includes t1 Swiss tournament'
    );

    // Filter by format=KNOCKOUT
    const filterKnockout = await apiRequest(`/admin/tournaments?format=KNOCKOUT&search=${testPrefix}`, { token: adminToken });
    assert(filterKnockout.status === 200, 'Filter format=KNOCKOUT returns 200');
    assert(
      filterKnockout.data.tournaments.every((t) => t.format === 'KNOCKOUT'),
      'All returned tournaments have format KNOCKOUT'
    );

    // Filter by format=ROUND_ROBIN
    const filterRR = await apiRequest(`/admin/tournaments?format=ROUND_ROBIN&search=${testPrefix}`, { token: adminToken });
    assert(filterRR.status === 200, 'Filter format=ROUND_ROBIN returns 200');
    assert(
      filterRR.data.tournaments.every((t) => t.format === 'ROUND_ROBIN'),
      'All returned tournaments have format ROUND_ROBIN'
    );

    // Filter by invalid format
    const filterInvalidFormat = await apiRequest('/admin/tournaments?format=TRIPLE_ELIMINATION', { token: adminToken });
    assert(filterInvalidFormat.status === 400, 'Invalid format filter rejected with 400');

    // Filter by status=REGISTRATION
    const filterReg = await apiRequest(`/admin/tournaments?status=REGISTRATION&search=${testPrefix}`, { token: adminToken });
    assert(filterReg.status === 200, 'Filter status=REGISTRATION returns 200');
    assert(
      filterReg.data.tournaments.every((t) => t.status === 'REGISTRATION'),
      'All returned tournaments have status REGISTRATION'
    );

    // Filter by status=FINISHED
    const filterFin = await apiRequest(`/admin/tournaments?status=FINISHED&search=${testPrefix}`, { token: adminToken });
    assert(filterFin.status === 200, 'Filter status=FINISHED returns 200');
    assert(
      filterFin.data.tournaments.every((t) => t.status === 'FINISHED' || t.status === 'COMPLETED'),
      'All returned tournaments have finished status'
    );

    // Filter by invalid status
    const filterInvalidStatus = await apiRequest('/admin/tournaments?status=PAUSED_NOT_REAL', { token: adminToken });
    assert(filterInvalidStatus.status === 400, 'Invalid status filter rejected with 400');

    // =========================================================================
    // 5. Tournament Inspection / Details
    // =========================================================================
    console.log('\n--- 5. Testing Tournament Inspection / Details ---');

    // Valid inspection
    const detailsRes = await apiRequest(`/admin/tournaments/${t4._id}`, { token: adminToken });
    assert(detailsRes.status === 200, 'Valid tournament inspection returns 200');
    assert(detailsRes.data.success === true, 'Inspection response indicates success: true');
    assert(detailsRes.data.tournament.id === t4._id.toString(), 'Returns correct tournament id');
    assert(detailsRes.data.tournament.name === `${testPrefix} Live Blitz Arena`, 'Returns correct name');
    assert(detailsRes.data.tournament.format === 'ROUND_ROBIN', 'Returns correct format');
    assert(detailsRes.data.tournament.status === 'RUNNING', 'Returns correct status');
    assert(detailsRes.data.tournament.currentRound === 1, 'Accurately computes currentRound=1');
    assert(detailsRes.data.tournament.creator.id === hostUser._id.toString(), 'Returns correct creator ID');
    assert(Array.isArray(detailsRes.data.tournament.rounds), 'Rounds array returned');
    assert(detailsRes.data.tournament.rounds.length === 1, 'Contains round 1');
    assert(Array.isArray(detailsRes.data.tournament.rounds[0].pairings), 'Round contains pairings array');
    assert(detailsRes.data.tournament.rounds[0].pairings[0].id === livePairing._id.toString(), 'Pairing matches live match');
    assert(detailsRes.data.tournament.rounds[0].pairings[0].status === 'ACTIVE', 'Pairing status is ACTIVE');

    // Sensitive data exclusion verification
    assert(detailsRes.data.tournament.creator.passwordHash === undefined, 'creator excludes passwordHash');
    assert(detailsRes.data.tournament.creator.password === undefined, 'creator excludes password');
    assert(detailsRes.data.tournament.creator.lichessOAuth === undefined, 'creator excludes OAuth tokens');
    assert(detailsRes.data.tournament.participants.every((p) => p.passwordHash === undefined), 'participants exclude passwordHash');

    // Malformed tournament ID
    const malformedIdRes = await apiRequest('/admin/tournaments/invalid-id-xyz', { token: adminToken });
    assert(malformedIdRes.status === 400, 'Malformed tournament ID returns 400');

    // Nonexistent tournament ID
    const fakeId = new mongoose.Types.ObjectId();
    const notFoundRes = await apiRequest(`/admin/tournaments/${fakeId}`, { token: adminToken });
    assert(notFoundRes.status === 404, 'Nonexistent tournament ID returns 404');

    // =========================================================================
    // 6. Tournament Moderation (Cancellation)
    // =========================================================================
    console.log('\n--- 6. Testing Tournament Moderation / Cancellation ---');

    // A. Active matches protection: Attempt to cancel tournament with live game in progress
    const cancelLiveRes = await apiRequest(`/admin/tournaments/${t4._id}/cancel`, {
      method: 'PATCH',
      token: adminToken,
    });
    assert(
      cancelLiveRes.status === 409,
      'Cancelling tournament with live active match is blocked with HTTP 409 Conflict'
    );
    assert(
      cancelLiveRes.data.message.includes('actively being played'),
      'Clear error message explaining active matches must conclude first'
    );

    // Verify tournament t4 is STILL RUNNING in database
    const dbT4 = await Tournament.findById(t4._id);
    assert(dbT4.status === 'RUNNING', 'MongoDB confirms t4 status was NOT changed to CANCELLED');

    // B. Finished tournament protection: Cannot cancel a finished tournament
    const cancelFinishedRes = await apiRequest(`/admin/tournaments/${t3._id}/cancel`, {
      method: 'PATCH',
      token: adminToken,
    });
    assert(
      cancelFinishedRes.status === 400,
      'Cancelling an already finished tournament is rejected with HTTP 400'
    );

    // C. Safe cancellation: Cancel tournament in REGISTRATION phase
    const cancelSafeRes = await apiRequest(`/admin/tournaments/${t1._id}/cancel`, {
      method: 'PATCH',
      token: adminToken,
    });
    assert(cancelSafeRes.status === 200, 'Safe cancellation of REGISTRATION tournament returns 200');
    assert(cancelSafeRes.data.tournament.status === 'CANCELLED', 'Response confirms status is CANCELLED');

    // Verify in database
    const dbT1 = await Tournament.findById(t1._id);
    assert(dbT1.status === 'CANCELLED', 'MongoDB source of truth confirms status is CANCELLED');

    // Verify records are preserved (not deleted)
    const t1Players = await TournamentPlayer.find({ tournamentId: t1._id });
    assert(t1Players.length === 1, 'TournamentPlayer records are preserved in MongoDB for audit history');

    // D. Already cancelled tournament protection
    const cancelAgainRes = await apiRequest(`/admin/tournaments/${t1._id}/cancel`, {
      method: 'PATCH',
      token: adminToken,
    });
    assert(
      cancelAgainRes.status === 400,
      'Attempting to cancel an already cancelled tournament is rejected with HTTP 400'
    );

    // Nonexistent tournament cancellation
    const cancelNonexistent = await apiRequest(`/admin/tournaments/${fakeId}/cancel`, {
      method: 'PATCH',
      token: adminToken,
    });
    assert(cancelNonexistent.status === 404, 'Cancelling nonexistent tournament returns 404');

    // Malformed ID cancellation
    const cancelMalformed = await apiRequest('/admin/tournaments/bad-id-123/cancel', {
      method: 'PATCH',
      token: adminToken,
    });
    assert(cancelMalformed.status === 400, 'Cancelling malformed tournament ID returns 400');

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n======================================================');
    console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests} assertions`);
    console.log('======================================================\n');
  } finally {
    // Clean up created test data
    console.log('🧹 Cleaning up test tournaments and users...');
    if (createdTournamentIds.length > 0) {
      await Pairing.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Round.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await testServer.close();
    await mongoose.connection.close();
    console.log('✅ In-process test server and database connection closed.');
  }
};

runAdminTournamentsTests().catch((err) => {
  console.error('\n❌ Admin Tournament Management Test Suite Failed:', err);
  process.exit(1);
});
