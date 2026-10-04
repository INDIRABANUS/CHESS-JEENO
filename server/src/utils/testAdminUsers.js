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

dotenv.config();

const runAdminUsersTests = async () => {
  console.log('🧪 Starting CHESS JEENO Platform Admin User Management Test Suite...\n');
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
  const testPrefix = `admin_usr_${timestamp}`;

  const createdUserIds = [];
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
    // Setup Test Admin and Test Users
    // =========================================================================
    console.log('--- Setting up Test Data ---');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SecretPass123!', salt);

    // Primary Admin
    const adminUser = await User.create({
      name: 'Admin Alpha',
      email: `${testPrefix}_admin1@chessjeeno.local`,
      passwordHash,
      role: 'ADMIN',
      authProvider: 'local',
    });
    createdUserIds.push(adminUser._id);
    const adminToken = generateToken(adminUser._id);

    // Secondary Admin
    const secondAdmin = await User.create({
      name: 'Admin Beta',
      email: `${testPrefix}_admin2@chessjeeno.local`,
      passwordHash,
      role: 'ADMIN',
      authProvider: 'local',
    });
    createdUserIds.push(secondAdmin._id);
    const secondAdminToken = generateToken(secondAdmin._id);

    // Normal User 1 (with Lichess username & OAuth data to verify stripping)
    const normalUser1 = await User.create({
      name: 'Magnus TestCarlsen',
      email: `${testPrefix}_magnus@chessjeeno.local`,
      passwordHash,
      role: 'USER',
      authProvider: 'lichess',
      lichessUsername: `${testPrefix}_magnus_lic`,
      lichessOAuth: {
        accessToken: 'super_secret_lichess_token_xyz',
        refreshToken: 'super_secret_refresh_token_xyz',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: 'challenge:read challenge:write',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(normalUser1._id);
    const normalUser1Token = generateToken(normalUser1._id);

    // Normal User 2
    const normalUser2 = await User.create({
      name: 'Hikaru TestNakamura',
      email: `${testPrefix}_hikaru@chessjeeno.local`,
      passwordHash,
      role: 'USER',
      authProvider: 'google',
      googleId: `google_id_${testPrefix}_hikaru`,
    });
    createdUserIds.push(normalUser2._id);

    // Normal User 3 (for search special characters test)
    const normalUser3 = await User.create({
      name: 'Special [Regex] Player',
      email: `${testPrefix}_special+regex@chessjeeno.local`,
      passwordHash,
      role: 'USER',
      authProvider: 'local',
    });
    createdUserIds.push(normalUser3._id);

    console.log(`Created 5 test users for suite.\n`);

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

    // Unauthenticated GET /users
    const unauthUsers = await apiRequest('/admin/users');
    assert(unauthUsers.status === 401, 'Unauthenticated request to GET /api/admin/users returns 401');
    assert(unauthUsers.data.success === false, 'Unauthenticated response indicates failure');

    // Normal USER GET /users
    const forbiddenUsers = await apiRequest('/admin/users', { token: normalUser1Token });
    assert(forbiddenUsers.status === 403, 'Normal USER request to GET /api/admin/users returns 403');
    assert(forbiddenUsers.data.success === false, 'Forbidden response indicates failure');

    // Unauthenticated GET /users/:id
    const unauthDetails = await apiRequest(`/admin/users/${normalUser1._id}`);
    assert(unauthDetails.status === 401, 'Unauthenticated request to GET /api/admin/users/:id returns 401');

    // Normal USER GET /users/:id
    const forbiddenDetails = await apiRequest(`/admin/users/${normalUser1._id}`, { token: normalUser1Token });
    assert(forbiddenDetails.status === 403, 'Normal USER request to GET /api/admin/users/:id returns 403');

    // Unauthenticated PATCH /users/:id/role
    const unauthPatch = await apiRequest(`/admin/users/${normalUser1._id}/role`, {
      method: 'PATCH',
      body: { role: 'ADMIN' },
    });
    assert(unauthPatch.status === 401, 'Unauthenticated request to PATCH /api/admin/users/:id/role returns 401');

    // Normal USER PATCH /users/:id/role
    const forbiddenPatch = await apiRequest(`/admin/users/${normalUser1._id}/role`, {
      method: 'PATCH',
      token: normalUser1Token,
      body: { role: 'ADMIN' },
    });
    assert(forbiddenPatch.status === 403, 'Normal USER request to PATCH /api/admin/users/:id/role returns 403');

    // ADMIN succeeds
    const adminListing = await apiRequest('/admin/users', { token: adminToken });
    assert(adminListing.status === 200, 'ADMIN request to GET /api/admin/users returns 200');
    assert(adminListing.data.success === true, 'ADMIN response indicates success');
    assert(Array.isArray(adminListing.data.users), 'ADMIN response contains users array');

    // =========================================================================
    // 2. Listing & Pagination
    // =========================================================================
    console.log('\n--- 2. Testing Pagination & Metadata ---');

    // Test default pagination
    const defaultPage = await apiRequest('/admin/users', { token: adminToken });
    assert(defaultPage.data.page === 1, 'Default page is 1');
    assert(defaultPage.data.limit === 20, 'Default limit is 20');
    assert(typeof defaultPage.data.total === 'number' && defaultPage.data.total >= 5, 'Total user count is accurate');
    assert(typeof defaultPage.data.totalPages === 'number', 'Total pages is provided');

    // Test custom limit
    const limit2Page = await apiRequest('/admin/users?page=1&limit=2', { token: adminToken });
    assert(limit2Page.status === 200, 'Custom limit request succeeds');
    assert(limit2Page.data.users.length === 2, 'Returns exactly 2 users when limit=2');
    assert(limit2Page.data.limit === 2, 'Metadata reflects limit=2');

    // Test page navigation
    const page2 = await apiRequest('/admin/users?page=2&limit=2', { token: adminToken });
    assert(page2.status === 200, 'Page 2 request succeeds');
    assert(page2.data.page === 2, 'Metadata reflects page=2');
    assert(
      page2.data.users[0]?.id !== limit2Page.data.users[0]?.id,
      'Page 2 returns different users than Page 1'
    );

    // Validation: invalid page parameter
    const invalidPage = await apiRequest('/admin/users?page=0', { token: adminToken });
    assert(invalidPage.status === 400, 'page=0 is rejected with 400');

    const negativePage = await apiRequest('/admin/users?page=-2', { token: adminToken });
    assert(negativePage.status === 400, 'page=-2 is rejected with 400');

    const nonIntPage = await apiRequest('/admin/users?page=abc', { token: adminToken });
    assert(nonIntPage.status === 400, 'page=abc is rejected with 400');

    // Validation: invalid limit parameter
    const zeroLimit = await apiRequest('/admin/users?limit=0', { token: adminToken });
    assert(zeroLimit.status === 400, 'limit=0 is rejected with 400');

    const excessiveLimit = await apiRequest('/admin/users?limit=51', { token: adminToken });
    assert(excessiveLimit.status === 400, 'limit=51 is rejected with 400');

    const nonIntLimit = await apiRequest('/admin/users?limit=xyz', { token: adminToken });
    assert(nonIntLimit.status === 400, 'limit=xyz is rejected with 400');

    // =========================================================================
    // 3. Search Capability
    // =========================================================================
    console.log('\n--- 3. Testing Search Capability ---');

    // Search by name (case-insensitive)
    const searchName = await apiRequest(`/admin/users?search=magnus`, { token: adminToken });
    assert(searchName.status === 200, 'Search by name returns 200');
    assert(
      searchName.data.users.some((u) => u.id === normalUser1._id.toString()),
      'Search by "magnus" matches Magnus TestCarlsen'
    );
    assert(
      !searchName.data.users.some((u) => u.id === normalUser2._id.toString()),
      'Search by "magnus" excludes non-matching user Hikaru'
    );

    // Search by email (case-insensitive)
    const searchEmail = await apiRequest(`/admin/users?search=${testPrefix}_hikaru`, { token: adminToken });
    assert(searchEmail.status === 200, 'Search by email returns 200');
    assert(
      searchEmail.data.users.some((u) => u.id === normalUser2._id.toString()),
      'Search by email matches Hikaru'
    );

    // Search by lichessUsername
    const searchLichess = await apiRequest(`/admin/users?search=${testPrefix}_magnus_lic`, { token: adminToken });
    assert(searchLichess.status === 200, 'Search by lichess username returns 200');
    assert(
      searchLichess.data.users.some((u) => u.id === normalUser1._id.toString()),
      'Search matches lichessUsername'
    );

    // Search with regex special characters (must not crash or throw ReDoS)
    const searchSpecial = await apiRequest(`/admin/users?search=[Regex]`, { token: adminToken });
    assert(searchSpecial.status === 200, 'Search with regex special characters safely returns 200');
    assert(
      searchSpecial.data.users.some((u) => u.id === normalUser3._id.toString()),
      'Safely escapes regex brackets and matches user'
    );

    // Search query length limit (>100 chars rejected)
    const longQuery = 'a'.repeat(101);
    const searchLong = await apiRequest(`/admin/users?search=${longQuery}`, { token: adminToken });
    assert(searchLong.status === 400, 'Search query > 100 characters rejected with 400');

    // =========================================================================
    // 4. Role Filtering
    // =========================================================================
    console.log('\n--- 4. Testing Role Filtering ---');

    // Filter by ADMIN
    const filterAdmin = await apiRequest(`/admin/users?role=ADMIN&search=${testPrefix}`, { token: adminToken });
    assert(filterAdmin.status === 200, 'Filter role=ADMIN returns 200');
    assert(
      filterAdmin.data.users.every((u) => u.role === 'ADMIN'),
      'All users returned by role=ADMIN filter have role ADMIN'
    );
    assert(
      filterAdmin.data.users.some((u) => u.id === adminUser._id.toString()),
      'Includes Admin Alpha'
    );

    // Filter by USER
    const filterUser = await apiRequest(`/admin/users?role=USER&search=${testPrefix}`, { token: adminToken });
    assert(filterUser.status === 200, 'Filter role=USER returns 200');
    assert(
      filterUser.data.users.every((u) => u.role === 'USER'),
      'All users returned by role=USER filter have role USER'
    );

    // Invalid role filter
    const filterInvalid = await apiRequest('/admin/users?role=SUPERADMIN', { token: adminToken });
    assert(filterInvalid.status === 400, 'Invalid role filter role=SUPERADMIN rejected with 400');

    // =========================================================================
    // 5. User Details Endpoint
    // =========================================================================
    console.log('\n--- 5. Testing User Details Endpoint ---');

    // Valid user details
    const detailsRes = await apiRequest(`/admin/users/${normalUser1._id}`, { token: adminToken });
    assert(detailsRes.status === 200, 'Valid user details returns 200');
    assert(detailsRes.data.user.id === normalUser1._id.toString(), 'Returns correct user id');
    assert(detailsRes.data.user.name === 'Magnus TestCarlsen', 'Returns correct name');
    assert(detailsRes.data.user.email === normalUser1.email, 'Returns correct email');
    assert(detailsRes.data.user.role === 'USER', 'Returns correct role');
    assert(detailsRes.data.user.lichessConnected === true, 'Accurately indicates lichessConnected');
    assert(detailsRes.data.user.lichessUsername === `${testPrefix}_magnus_lic`, 'Returns lichessUsername');

    // Sensitive data exclusion verification
    assert(detailsRes.data.user.passwordHash === undefined, 'passwordHash is NOT present in details');
    assert(detailsRes.data.user.password === undefined, 'password is NOT present in details');
    assert(detailsRes.data.user.lichessOAuth?.accessToken === undefined, 'OAuth accessToken is NOT present');
    assert(detailsRes.data.user.lichessOAuth?.refreshToken === undefined, 'OAuth refreshToken is NOT present');

    // Check user listing exclusion of secrets as well
    const listingUser = searchName.data.users.find((u) => u.id === normalUser1._id.toString());
    assert(listingUser.passwordHash === undefined, 'passwordHash is NOT present in user listing');
    assert(listingUser.lichessOAuth === undefined || listingUser.lichessOAuth?.accessToken === undefined, 'Tokens not present in listing');

    // Malformed ObjectId
    const malformedDetails = await apiRequest('/admin/users/not-a-valid-id', { token: adminToken });
    assert(malformedDetails.status === 400, 'Malformed ObjectId returns 400');

    // Nonexistent valid ObjectId
    const fakeId = new mongoose.Types.ObjectId();
    const notFoundDetails = await apiRequest(`/admin/users/${fakeId}`, { token: adminToken });
    assert(notFoundDetails.status === 404, 'Nonexistent ObjectId returns 404');

    // =========================================================================
    // 6. Role Changes & Lockout Protections
    // =========================================================================
    console.log('\n--- 6. Testing Role Changes & Lockout Protections ---');

    // Promote USER -> ADMIN
    const promoteRes = await apiRequest(`/admin/users/${normalUser2._id}/role`, {
      method: 'PATCH',
      token: adminToken,
      body: { role: 'ADMIN' },
    });
    assert(promoteRes.status === 200, 'Promote USER to ADMIN returns 200');
    assert(promoteRes.data.user.role === 'ADMIN', 'Response confirms new role is ADMIN');

    // Verify DB source of truth
    const dbPromoted = await User.findById(normalUser2._id);
    assert(dbPromoted.role === 'ADMIN', 'MongoDB confirms user role is ADMIN');

    // Demote ADMIN -> USER (safe because multiple admins exist)
    const demoteRes = await apiRequest(`/admin/users/${normalUser2._id}/role`, {
      method: 'PATCH',
      token: adminToken,
      body: { role: 'USER' },
    });
    assert(demoteRes.status === 200, 'Demote ADMIN to USER returns 200 when other admins exist');
    assert(demoteRes.data.user.role === 'USER', 'Response confirms new role is USER');

    const dbDemoted = await User.findById(normalUser2._id);
    assert(dbDemoted.role === 'USER', 'MongoDB confirms user role is reverted to USER');

    // Invalid role in body
    const invalidRoleBody = await apiRequest(`/admin/users/${normalUser1._id}/role`, {
      method: 'PATCH',
      token: adminToken,
      body: { role: 'MODERATOR' },
    });
    assert(invalidRoleBody.status === 400, 'Invalid role string in body returns 400');

    // Missing role in body
    const missingRoleBody = await apiRequest(`/admin/users/${normalUser1._id}/role`, {
      method: 'PATCH',
      token: adminToken,
      body: {},
    });
    assert(missingRoleBody.status === 400, 'Missing role in body returns 400');

    // Malformed ID in role change
    const malformedRolePatch = await apiRequest('/admin/users/123invalid/role', {
      method: 'PATCH',
      token: adminToken,
      body: { role: 'ADMIN' },
    });
    assert(malformedRolePatch.status === 400, 'Malformed user ID in PATCH returns 400');

    // Nonexistent ID in role change
    const fakeIdRolePatch = await apiRequest(`/admin/users/${fakeId}/role`, {
      method: 'PATCH',
      token: adminToken,
      body: { role: 'ADMIN' },
    });
    assert(fakeIdRolePatch.status === 404, 'Nonexistent user ID in PATCH returns 404');

    // ─────────────────────────────────────────────────────────────────────────
    // Final-Admin Lockout Protection Tests
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 7. Testing Final-Admin Lockout Protection ---');

    // Find all other admins currently in DB (including bootstrap admin and secondAdmin)
    const otherAdmins = await User.find({ role: 'ADMIN', _id: { $ne: adminUser._id } });
    const otherAdminIds = otherAdmins.map((a) => a._id);
    
    // Temporarily set all other admins to USER so adminUser is the sole remaining admin
    await User.updateMany({ _id: { $in: otherAdminIds } }, { role: 'USER' });

    try {
      const adminCount1 = await User.countDocuments({ role: 'ADMIN' });
      console.log(`Current DB admin count after isolation: ${adminCount1}`);
      assert(adminCount1 === 1, 'Verified exactly 1 ADMIN exists in platform');

      // Attempt to demote the final remaining admin
      const lockOutAttempt = await apiRequest(`/admin/users/${adminUser._id}/role`, {
        method: 'PATCH',
        token: adminToken,
        body: { role: 'USER' },
      });
      assert(
        lockOutAttempt.status === 409,
        'Demoting final remaining ADMIN is blocked with HTTP 409 Conflict'
      );
      assert(
        lockOutAttempt.data.message.includes('final remaining administrator'),
        'Clear explanation message returned in error'
      );

      // Verify adminUser is STILL ADMIN in database
      const dbAdminStillAdmin = await User.findById(adminUser._id);
      assert(dbAdminStillAdmin.role === 'ADMIN', 'MongoDB source of truth verifies admin role was NOT removed');
    } finally {
      // Restore other admins to ADMIN role
      if (otherAdminIds.length > 0) {
        await User.updateMany({ _id: { $in: otherAdminIds } }, { role: 'ADMIN' });
      }
    }

    // Verify restore was successful
    const finalAdminCount = await User.countDocuments({ role: 'ADMIN' });
    assert(finalAdminCount >= 2, 'Admins successfully restored after lockout test');

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n======================================================');
    console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests} assertions`);
    console.log('======================================================\n');
  } finally {
    // Clean up created test data
    console.log('🧹 Cleaning up test users...');
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await testServer.close();
    await mongoose.connection.close();
    console.log('✅ In-process test server and database connection closed.');
  }
};

runAdminUsersTests().catch((err) => {
  console.error('\n❌ Admin User Management Test Suite Failed:', err);
  process.exit(1);
});
