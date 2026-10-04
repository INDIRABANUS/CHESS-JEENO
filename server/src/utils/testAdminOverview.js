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

dotenv.config();

const runAdminOverviewTests = async () => {
  console.log('🧪 Starting CHESS JEENO Admin Overview & Statistics Test Suite...\n');
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
  const testPrefix = `admin_ov_${timestamp}`;

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
    // Setup Test Admin and Test Normal User
    // =========================================================================
    console.log('--- Setting up Test Admin and Normal User ---');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('AdminSecret123!', salt);

    const adminUser = await User.create({
      name: 'Super Admin Overview',
      email: `${testPrefix}_superadmin@chessjeeno.local`,
      passwordHash: adminPasswordHash,
      authProvider: 'local',
      role: 'ADMIN',
      lichessUsername: 'admin_overview',
      lichessOAuth: {
        accessToken: 'secret_oauth_access_token_overview',
        refreshToken: 'secret_oauth_refresh_token_overview',
        scope: 'challenge:bulk board:play',
      },
      googleId: 'google_secret_overview_123',
    });
    createdUserIds.push(adminUser._id);
    const adminToken = generateToken(adminUser._id);

    const normalUser = await User.create({
      name: 'Regular Player',
      email: `${testPrefix}_regular@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(normalUser._id);
    const normalToken = generateToken(normalUser._id);

    // =========================================================================
    // 1. Admin endpoint requires authentication (401)
    // =========================================================================
    console.log('\n--- 1. Testing Unauthenticated Request Rejection (401) ---');
    const unauthRes = await fetch(`${API_BASE}/admin/overview`);
    assert(unauthRes.status === 401, 'Request without Authorization header returns HTTP 401');

    const badTokenRes = await fetch(`${API_BASE}/admin/overview`, {
      headers: { Authorization: 'Bearer invalid.token.value' },
    });
    assert(badTokenRes.status === 401, 'Request with invalid token returns HTTP 401');

    // =========================================================================
    // 2. Admin endpoint rejects USER (403)
    // =========================================================================
    console.log('\n--- 2. Testing Normal USER Rejection (403) ---');
    const userRes = await fetch(`${API_BASE}/admin/overview`, {
      headers: { Authorization: `Bearer ${normalToken}` },
    });
    const userData = await userRes.json();
    assert(userRes.status === 403, 'Normal USER receives HTTP 403 Forbidden');
    assert(userData.success === false, 'Response indicates success: false');
    assert(userData.message.includes('Administrator privileges required'), 'Clear admin required message');

    // =========================================================================
    // 3. Admin endpoint accepts ADMIN (200)
    // =========================================================================
    console.log('\n--- 3. Testing Valid ADMIN Access (200) ---');
    const adminRes = await fetch(`${API_BASE}/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminData = await adminRes.json();
    assert(adminRes.status === 200, 'Valid ADMIN receives HTTP 200 OK');
    assert(adminData.success === true, 'Response indicates success: true');
    assert(Boolean(adminData.overview), 'Response contains overview payload');

    // =========================================================================
    // 4. Create Controlled Data to Test Counts
    // =========================================================================
    console.log('\n--- 4. Creating Controlled Tournament Lifecycle Records ---');
    // Active tournament 1 (RUNNING)
    const activeT1 = await Tournament.create({
      name: `${testPrefix} Active Cup 1`,
      format: 'SWISS',
      status: 'RUNNING',
      createdBy: adminUser._id,
      clockLimit: 300,
      increment: 2,
    });
    createdTournamentIds.push(activeT1._id);

    // Active tournament 2 (IN_PROGRESS)
    const activeT2 = await Tournament.create({
      name: `${testPrefix} Active Cup 2`,
      format: 'ROUND_ROBIN',
      status: 'IN_PROGRESS',
      createdBy: normalUser._id,
      clockLimit: 600,
      increment: 5,
    });
    createdTournamentIds.push(activeT2._id);

    // Completed tournament (FINISHED)
    const completedT1 = await Tournament.create({
      name: `${testPrefix} Completed Masters`,
      format: 'KNOCKOUT',
      status: 'FINISHED',
      createdBy: adminUser._id,
      clockLimit: 180,
      increment: 0,
    });
    createdTournamentIds.push(completedT1._id);

    // Add approved players to activeT1 to test participant count aggregation
    await TournamentPlayer.create({
      tournamentId: activeT1._id,
      userId: adminUser._id,
      isApproved: true,
    });
    await TournamentPlayer.create({
      tournamentId: activeT1._id,
      userId: normalUser._id,
      isApproved: true,
    });

    // Re-fetch overview
    const statsRes = await fetch(`${API_BASE}/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statsData = await statsRes.json();
    const stats = statsData.overview.stats;

    // =========================================================================
    // 5. Total user count is correct
    // =========================================================================
    console.log('\n--- 5. Verifying Total User Count ---');
    const realTotalUsers = await User.countDocuments();
    assert(stats.totalUsers === realTotalUsers, `stats.totalUsers (${stats.totalUsers}) matches real database count (${realTotalUsers})`);
    assert(stats.totalUsers >= 2, 'Total users reflects newly created test accounts');

    // =========================================================================
    // 6. Admin count is correct
    // =========================================================================
    console.log('\n--- 6. Verifying Total Admin Count ---');
    const realTotalAdmins = await User.countDocuments({ role: 'ADMIN' });
    assert(stats.totalAdmins === realTotalAdmins, `stats.totalAdmins (${stats.totalAdmins}) matches real database count (${realTotalAdmins})`);
    assert(stats.totalAdmins >= 1, 'Total admins count is at least 1');

    // =========================================================================
    // 7. Total tournament count is correct
    // =========================================================================
    console.log('\n--- 7. Verifying Total Tournament Count ---');
    const realTotalTournaments = await Tournament.countDocuments();
    assert(stats.totalTournaments === realTotalTournaments, `stats.totalTournaments (${stats.totalTournaments}) matches real database count (${realTotalTournaments})`);

    // =========================================================================
    // 8. Active tournament count is correct
    // =========================================================================
    console.log('\n--- 8. Verifying Active Tournament Count ---');
    const realActiveTournaments = await Tournament.countDocuments({
      status: { $in: ['RUNNING', 'IN_PROGRESS', 'COUNTDOWN', 'READY_CHECK', 'ACTIVE'] },
    });
    assert(stats.activeTournaments === realActiveTournaments, `stats.activeTournaments (${stats.activeTournaments}) matches real count (${realActiveTournaments})`);

    // =========================================================================
    // 9. Completed tournament count is correct
    // =========================================================================
    console.log('\n--- 9. Verifying Completed Tournament Count ---');
    const realCompletedTournaments = await Tournament.countDocuments({
      status: { $in: ['FINISHED', 'COMPLETED'] },
    });
    assert(stats.completedTournaments === realCompletedTournaments, `stats.completedTournaments (${stats.completedTournaments}) matches real count (${realCompletedTournaments})`);

    // =========================================================================
    // 10. Recent users are sorted newest first
    // =========================================================================
    console.log('\n--- 10. Verifying Recent Users Sorting ---');
    const recentUsers = statsData.overview.recentUsers;
    assert(Array.isArray(recentUsers) && recentUsers.length > 0, 'recentUsers is a non-empty array');
    for (let i = 0; i < recentUsers.length - 1; i++) {
      const current = new Date(recentUsers[i].createdAt).getTime();
      const next = new Date(recentUsers[i + 1].createdAt).getTime();
      assert(current >= next, `User at index ${i} (${recentUsers[i].name}) was created >= index ${i + 1}`);
    }

    // =========================================================================
    // 11. Recent tournaments are sorted newest first
    // =========================================================================
    console.log('\n--- 11. Verifying Recent Tournaments Sorting ---');
    const recentTournaments = statsData.overview.recentTournaments;
    assert(Array.isArray(recentTournaments) && recentTournaments.length > 0, 'recentTournaments is a non-empty array');
    for (let i = 0; i < recentTournaments.length - 1; i++) {
      const current = new Date(recentTournaments[i].createdAt).getTime();
      const next = new Date(recentTournaments[i + 1].createdAt).getTime();
      assert(current >= next, `Tournament at index ${i} was created >= index ${i + 1}`);
    }

    // Verify participant count aggregation works on recent tournaments
    const foundActiveT1 = recentTournaments.find((t) => t.id === activeT1._id.toString());
    assert(Boolean(foundActiveT1), 'activeT1 found in recentTournaments');
    assert(foundActiveT1.participantCount === 2, 'activeT1 correctly aggregated 2 approved participants without N+1 query');

    // =========================================================================
    // 12. Recent results are limited
    // =========================================================================
    console.log('\n--- 12. Verifying Result Limits ---');
    assert(recentUsers.length <= 8, `recentUsers length (${recentUsers.length}) is within maximum bound (<= 8)`);
    assert(recentTournaments.length <= 8, `recentTournaments length (${recentTournaments.length}) is within maximum bound (<= 8)`);

    // =========================================================================
    // 13. Sensitive user fields are excluded
    // =========================================================================
    console.log('\n--- 13. Verifying Sensitive Credentials Concealment: passwordHash ---');
    for (const u of recentUsers) {
      assert(u.passwordHash === undefined, `User ${u.name} response excludes passwordHash`);
    }

    // =========================================================================
    // 14. OAuth credentials are excluded
    // =========================================================================
    console.log('\n--- 14. Verifying Sensitive Credentials Concealment: OAuth secrets ---');
    for (const u of recentUsers) {
      assert(u.lichessOAuth === undefined, `User ${u.name} response excludes lichessOAuth`);
      assert(u.googleId === undefined, `User ${u.name} response excludes googleId`);
      assert(u.accessToken === undefined, `User ${u.name} response excludes accessToken`);
      assert(u.refreshToken === undefined, `User ${u.name} response excludes refreshToken`);
    }

    // =========================================================================
    // 15. Endpoint does not accept arbitrary userId to change identity
    // =========================================================================
    console.log('\n--- 15. Testing Identity Tampering Rejection ---');
    const spoofRes = await fetch(`${API_BASE}/admin/overview?userId=${adminUser._id}&role=ADMIN`, {
      headers: { Authorization: `Bearer ${normalToken}` },
    });
    assert(spoofRes.status === 403, 'Attempting to spoof admin identity via ?userId query param returns HTTP 403');

    // =========================================================================
    // 16. Platform health status is returned accurately
    // =========================================================================
    console.log('\n--- 16. Verifying Platform Health Status ---');
    const platformStatus = statsData.overview.platformStatus;
    assert(Boolean(platformStatus), 'platformStatus is present');
    assert(platformStatus.api === 'Operational', 'API status is "Operational"');
    assert(platformStatus.database === 'Connected', 'Database status is "Connected"');
    assert(typeof platformStatus.uptimeSeconds === 'number', 'Uptime is returned as a number');

    console.log('\n==================================================');
    console.log(`📊 Admin Overview Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
  } finally {
    console.log('🧹 Cleaning up test users, tournaments, and closing server...');
    if (createdTournamentIds.length > 0) {
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await new Promise((resolve) => testServer.close(resolve));
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
};

runAdminOverviewTests().catch((err) => {
  console.error('\n❌ Uncaught error during Admin Overview tests:', err);
  process.exit(1);
});
