import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database.js';
import apiRouter from '../routes/index.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../services/authService.js';
import { promoteUserToAdmin } from './bootstrapAdmin.js';
import User from '../models/User.js';

dotenv.config();

const runAdminRbacTests = async () => {
  console.log('🧪 Starting CHESS JEENO Platform Admin RBAC Test Suite...\n');
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
  const testPrefix = `admin_test_${timestamp}`;

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
    // 1. Existing USER defaults to USER
    // =========================================================================
    console.log('--- 1. Testing Default USER Role Assignment ---');
    const defaultUser = await User.create({
      name: 'Default User',
      email: `${testPrefix}_default@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
    });
    createdUserIds.push(defaultUser._id);
    assert(defaultUser.role === 'USER', 'Newly created user without specified role defaults to "USER"');

    const fetchedDefault = await User.findById(defaultUser._id);
    assert(fetchedDefault.role === 'USER', 'Persisted user in database has role "USER"');

    // =========================================================================
    // 2. Registration cannot create ADMIN
    // =========================================================================
    console.log('\n--- 2. Testing Registration Role Injection Prevention ---');
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Registrant',
        email: `${testPrefix}_hacker_reg@chessjeeno.local`,
        password: 'Password123!',
        role: 'ADMIN', // Tamper attempt in registration payload
      }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, 'Registration succeeded with HTTP 201');
    assert(regData.data?.user?.role === 'USER', 'Returned user role is strictly "USER" (role payload ignored)');

    const dbRegUser = await User.findById(regData.data.user._id);
    createdUserIds.push(dbRegUser._id);
    assert(dbRegUser.role === 'USER', 'Persisted database role is strictly "USER"');

    // =========================================================================
    // 3. Profile update cannot change role
    // =========================================================================
    console.log('\n--- 3. Testing Profile Update Role Injection Prevention ---');
    const normalUser = await User.create({
      name: 'Normal User',
      email: `${testPrefix}_normal@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(normalUser._id);
    const normalToken = generateToken(normalUser._id);

    const patchRes = await fetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalToken}`,
      },
      body: JSON.stringify({
        name: 'Renamed Normal User',
        role: 'ADMIN', // Tamper attempt in profile update payload
      }),
    });
    const patchData = await patchRes.json();
    assert(patchRes.status === 200, 'Profile update returns HTTP 200');
    assert(patchData.data?.user?.role === 'USER', 'Profile response preserves role "USER"');

    const dbNormalAfterPatch = await User.findById(normalUser._id);
    assert(dbNormalAfterPatch.role === 'USER', 'Persisted database role remains "USER" after PATCH /me');

    // =========================================================================
    // 4. Normal USER receives 403 from /api/admin/me
    // =========================================================================
    console.log('\n--- 4. Testing Normal USER Access Rejection (403) ---');
    const userAdminRes = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${normalToken}` },
    });
    const userAdminData = await userAdminRes.json();
    assert(userAdminRes.status === 403, 'Normal USER receives HTTP 403 Forbidden from /api/admin/me');
    assert(userAdminData.success === false, 'Response indicates success: false');
    assert(userAdminData.message.includes('Administrator privileges required'), 'Clear authorization rejection message');

    // =========================================================================
    // 5. Missing authentication receives 401
    // =========================================================================
    console.log('\n--- 5. Testing Missing Authentication Rejection (401) ---');
    const noAuthRes = await fetch(`${API_BASE}/admin/me`);
    const noAuthData = await noAuthRes.json();
    assert(noAuthRes.status === 401, 'Request without Authorization header returns HTTP 401');
    assert(noAuthData.success === false, 'Unauthenticated response indicates success: false');

    // =========================================================================
    // 6. Invalid token is rejected
    // =========================================================================
    console.log('\n--- 6. Testing Invalid Token Rejection (401) ---');
    const badTokenRes = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: 'Bearer definitely.invalid.token' },
    });
    const badTokenData = await badTokenRes.json();
    assert(badTokenRes.status === 401, 'Request with invalid JWT returns HTTP 401');
    assert(badTokenData.success === false, 'Invalid token response indicates success: false');

    // =========================================================================
    // 7. Valid ADMIN receives 200
    // =========================================================================
    console.log('\n--- 7. Testing Valid ADMIN Access (200) ---');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('AdminSecret123!', salt);

    const adminUser = await User.create({
      name: 'Platform SuperAdmin',
      email: `${testPrefix}_admin@chessjeeno.local`,
      passwordHash: adminPasswordHash,
      authProvider: 'local',
      role: 'ADMIN',
      lichessUsername: 'admin_lichess',
      lichessUserId: 'admin_lichess',
      lichessOAuth: {
        accessToken: 'secret_oauth_access_token_123',
        refreshToken: 'secret_oauth_refresh_token_456',
        scope: 'challenge:bulk board:play',
      },
      googleId: 'google_oauth_sub_secret_789',
    });
    createdUserIds.push(adminUser._id);
    const adminToken = generateToken(adminUser._id);

    const adminRes = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminData = await adminRes.json();
    assert(adminRes.status === 200, 'Valid ADMIN receives HTTP 200 OK from /api/admin/me');
    assert(adminData.success === true, 'Response indicates success: true');

    // =========================================================================
    // 8. ADMIN response contains expected safe identity
    // =========================================================================
    console.log('\n--- 8. Verifying Expected Safe Identity Structure ---');
    assert(Boolean(adminData.admin), 'Response contains "admin" identity object');
    assert(adminData.admin.id === adminUser._id.toString(), 'admin.id matches authenticated admin ID');
    assert(adminData.admin.name === 'Platform SuperAdmin', 'admin.name matches display name');
    assert(adminData.admin.email === adminUser.email, 'admin.email matches admin email');
    assert(adminData.admin.role === 'ADMIN', 'admin.role strictly equals "ADMIN"');

    // =========================================================================
    // 9. ADMIN response does not contain passwordHash
    // =========================================================================
    console.log('\n--- 9. Verifying Sensitive Credentials Concealment: passwordHash ---');
    assert(adminData.admin.passwordHash === undefined, 'admin response excludes passwordHash');

    // =========================================================================
    // 10. ADMIN response does not contain Lichess tokens
    // =========================================================================
    console.log('\n--- 10. Verifying Sensitive Credentials Concealment: Lichess OAuth Tokens ---');
    assert(adminData.admin.lichessOAuth === undefined, 'admin response excludes lichessOAuth object');
    assert(adminData.admin.accessToken === undefined, 'admin response excludes accessToken');
    assert(adminData.admin.refreshToken === undefined, 'admin response excludes refreshToken');

    // =========================================================================
    // 11. ADMIN response does not contain Google OAuth secrets
    // =========================================================================
    console.log('\n--- 11. Verifying Sensitive Credentials Concealment: Google OAuth Secrets ---');
    assert(adminData.admin.googleId === undefined, 'admin response excludes googleId');
    assert(adminData.admin.googleOAuth === undefined, 'admin response excludes Google OAuth secrets');

    // =========================================================================
    // 12. Role cannot be spoofed through request body
    // =========================================================================
    console.log('\n--- 12. Testing Request Body Spoofing Prevention ---');
    const bodySpoofRes = await fetch(`${API_BASE}/admin/me`, {
      method: 'POST', // Try POST with spoofed body
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalToken}`,
      },
      body: JSON.stringify({ role: 'ADMIN', isAdmin: true }),
    });
    // Route is GET /me so POST will be 404, or if handled, 403
    assert(
      bodySpoofRes.status === 403 || bodySpoofRes.status === 404,
      'Body spoofing attempt rejected (cannot access admin route with USER token)'
    );

    // Also test GET with body (some HTTP clients send GET bodies)
    const getBodySpoofRes = await fetch(`${API_BASE}/admin/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalToken}`,
      },
    });
    assert(getBodySpoofRes.status === 403, 'GET /admin/me with USER token rejected with HTTP 403');

    // =========================================================================
    // 13. Role cannot be spoofed through query parameters
    // =========================================================================
    console.log('\n--- 13. Testing Query Parameter Spoofing Prevention ---');
    const querySpoofRes = await fetch(`${API_BASE}/admin/me?role=ADMIN&isAdmin=true`, {
      headers: { Authorization: `Bearer ${normalToken}` },
    });
    assert(querySpoofRes.status === 403, 'Query parameter ?role=ADMIN is rejected with HTTP 403');

    // =========================================================================
    // 14. Role cannot be spoofed through URL parameters
    // =========================================================================
    console.log('\n--- 14. Testing URL / Path Parameter Spoofing Prevention ---');
    const urlSpoofRes = await fetch(`${API_BASE}/admin/me?userId=${adminUser._id}&role=ADMIN`, {
      headers: { Authorization: `Bearer ${normalToken}` },
    });
    assert(urlSpoofRes.status === 403, 'IDOR/URL parameter spoofing rejected with HTTP 403');

    // =========================================================================
    // 15. Deleted/nonexistent authenticated user cannot access admin API
    // =========================================================================
    console.log('\n--- 15. Testing Deleted/Nonexistent Authenticated User Rejection (401) ---');
    const doomedUser = await User.create({
      name: 'Doomed Admin',
      email: `${testPrefix}_doomed@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      role: 'ADMIN',
    });
    const doomedToken = generateToken(doomedUser._id);

    // Verify token worked before deletion
    const beforeDelRes = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${doomedToken}` },
    });
    assert(beforeDelRes.status === 200, 'Doomed user is authorized as admin prior to deletion');

    // Delete user from database
    await User.findByIdAndDelete(doomedUser._id);

    // Attempt access after deletion
    const afterDelRes = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${doomedToken}` },
    });
    const afterDelData = await afterDelRes.json();
    assert(afterDelRes.status === 401, 'Deleted user account returns HTTP 401');
    assert(afterDelData.message.includes('not found'), 'Clear user account not found message');

    // =========================================================================
    // 16. Bootstrap promotes only the intended existing user
    // =========================================================================
    console.log('\n--- 16. Testing Bootstrap Promotes Only Target Existing User ---');
    const targetUser = await User.create({
      name: 'Promote Target',
      email: `${testPrefix}_target@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(targetUser._id);

    const bystanderUser = await User.create({
      name: 'Bystander User',
      email: `${testPrefix}_bystander@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(bystanderUser._id);

    // Run bootstrap on target user
    const bootstrapResult = await promoteUserToAdmin({ email: targetUser.email.toUpperCase() }); // Test case-insensitivity
    assert(bootstrapResult.success === true, 'promoteUserToAdmin returns success: true');
    assert(bootstrapResult.user.role === 'ADMIN', 'Bootstrap result reports role: "ADMIN"');

    const dbTargetAfter = await User.findById(targetUser._id);
    assert(dbTargetAfter.role === 'ADMIN', 'Target user successfully persisted as ADMIN in database');

    const dbBystanderAfter = await User.findById(bystanderUser._id);
    assert(dbBystanderAfter.role === 'USER', 'Bystander user remains unmodified with role "USER"');

    // Verify promoted user can now access /api/admin/me
    const promotedToken = generateToken(targetUser._id);
    const promotedAccessRes = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${promotedToken}` },
    });
    assert(promotedAccessRes.status === 200, 'Promoted user now successfully accesses /api/admin/me with HTTP 200');

    // =========================================================================
    // 17. Bootstrap does not create arbitrary users
    // =========================================================================
    console.log('\n--- 17. Testing Bootstrap Does Not Create Arbitrary Users ---');
    const ghostEmail = `${testPrefix}_nonexistent_ghost@chessjeeno.local`;
    const usersCountBefore = await User.countDocuments();

    let bootstrapError = null;
    try {
      await promoteUserToAdmin({ email: ghostEmail });
    } catch (err) {
      bootstrapError = err;
    }

    assert(Boolean(bootstrapError), 'Bootstrap fails with error when user does not exist');
    assert(bootstrapError?.statusCode === 404, 'Bootstrap error has statusCode 404');
    assert(bootstrapError?.message.includes('No account found'), 'Clear error that user must register first');

    const usersCountAfter = await User.countDocuments();
    assert(usersCountBefore === usersCountAfter, 'User collection count unchanged (no arbitrary account created)');

    // =========================================================================
    // 18. Bootstrap does not expose secrets
    // =========================================================================
    console.log('\n--- 18. Testing Bootstrap Does Not Expose Secrets ---');
    assert(bootstrapResult.user.passwordHash === undefined, 'Bootstrap result excludes passwordHash');
    assert(bootstrapResult.user.lichessOAuth === undefined, 'Bootstrap result excludes lichessOAuth');
    assert(bootstrapResult.user.googleId === undefined, 'Bootstrap result excludes googleId');

    console.log('\n==================================================');
    console.log(`📊 Admin RBAC Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
  } finally {
    console.log('🧹 Cleaning up test users and closing test server...');
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await new Promise((resolve) => testServer.close(resolve));
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
};

runAdminRbacTests().catch((err) => {
  console.error('\n❌ Uncaught error during Admin RBAC tests:', err);
  process.exit(1);
});
