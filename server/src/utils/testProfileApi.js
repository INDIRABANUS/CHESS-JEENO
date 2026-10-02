import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import apiRouter from '../routes/index.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../services/authService.js';
import User from '../models/User.js';

dotenv.config();

const runProfileTests = async () => {
  console.log('🧪 Starting Profile + Account Settings API Test Suite...\n');
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
  console.log(`📡 Test server listening on ${API_BASE}`);

  const timestamp = Date.now();
  const testPrefix = `prof_test_${timestamp}`;

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
    // -------------------------------------------------------------------------
    // Setup Test Users
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Setting up Test Users ---');
    const userA = await User.create({
      name: 'Initial Alice',
      email: `${testPrefix}_alice@chessjeeno.local`,
      passwordHash: 'fake_hash_alice',
      authProvider: 'local',
      lichessUsername: 'alice_lichess',
      avatar: null,
      bio: '',
    });
    createdUserIds.push(userA._id);
    const tokenA = generateToken(userA._id);

    const userB = await User.create({
      name: 'Initial Bob',
      email: `${testPrefix}_bob@chessjeeno.local`,
      passwordHash: 'fake_hash_bob',
      authProvider: 'local',
      lichessUsername: 'bob_lichess',
      avatar: null,
      bio: 'Existing Bob bio',
    });
    createdUserIds.push(userB._id);
    const tokenB = generateToken(userB._id);

    assert(Boolean(tokenA) && Boolean(tokenB), 'Tokens generated for User A and User B');

    // -------------------------------------------------------------------------
    // 2. GET /api/users/me (Own Profile)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing GET /api/users/me ---');
    const getResA = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const getDataA = await getResA.json();

    assert(getResA.status === 200, 'GET /api/users/me returns HTTP 200');
    assert(getDataA.success === true, 'Response has success: true');
    assert(getDataA.data?.user?._id === userA._id.toString(), 'Returns User A ID');
    assert(getDataA.data?.user?.name === 'Initial Alice', 'Returns correct display name');
    assert(getDataA.data?.user?.email === userA.email, 'Returns correct email');
    assert(getDataA.data?.user?.bio === '', 'Returns default bio');
    assert(getDataA.data?.user?.avatar === null, 'Returns default avatar');
    assert(getDataA.data?.user?.authProvider === 'local', 'Returns authProvider');
    assert(getDataA.data?.user?.lichessUsername === 'alice_lichess', 'Returns lichessUsername');

    // Security assertions: no sensitive credentials exposed
    assert(getDataA.data?.user?.passwordHash === undefined, 'No passwordHash in response');
    assert(getDataA.data?.user?.lichessOAuth === undefined, 'No lichessOAuth secrets in response');
    assert(getDataA.data?.user?.__v === undefined, 'No mongoose internal __v in response');

    // -------------------------------------------------------------------------
    // 3. Unauthorized Requests to GET /api/users/me (401)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Unauthorized GET /api/users/me Rejections ---');
    const noTokenRes = await fetch(`${API_BASE}/users/me`);
    assert(noTokenRes.status === 401, 'Missing Authorization header returns 401');

    const queryTokenRes = await fetch(`${API_BASE}/users/me?token=${tokenA}`);
    assert(queryTokenRes.status === 401, 'Query param token returns 401 (Bearer required)');

    const badTokenRes = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: 'Bearer definitely_invalid_jwt_token' },
    });
    assert(badTokenRes.status === 401, 'Invalid Bearer token returns 401');

    // -------------------------------------------------------------------------
    // 4. PATCH /api/users/me (Update Name, Bio, Avatar)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Valid PATCH /api/users/me ---');
    const validAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    const patchResA = await fetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: '  Alice Grandmaster  ',
        bio: '  Chess enthusiast and tournament organizer. Loves 1.e4.  ',
        avatar: validAvatar,
      }),
    });
    const patchDataA = await patchResA.json();

    assert(patchResA.status === 200, 'Valid PATCH returns HTTP 200');
    assert(patchDataA.success === true, 'Response has success: true');
    assert(patchDataA.data?.user?.name === 'Alice Grandmaster', 'Display name trimmed and updated');
    assert(
      patchDataA.data?.user?.bio === 'Chess enthusiast and tournament organizer. Loves 1.e4.',
      'Bio trimmed and updated'
    );
    assert(patchDataA.data?.user?.avatar === validAvatar, 'Avatar URL updated');

    // Verify database persistence
    const dbUserA = await User.findById(userA._id);
    assert(dbUserA.name === 'Alice Grandmaster', 'Persisted name matches in database');
    assert(
      dbUserA.bio === 'Chess enthusiast and tournament organizer. Loves 1.e4.',
      'Persisted bio matches in database'
    );
    assert(dbUserA.avatar === validAvatar, 'Persisted avatar matches in database');

    // -------------------------------------------------------------------------
    // 5. PATCH /api/users/me (Clear Avatar)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Clearing Avatar via PATCH ---');
    const clearAvatarRes = await fetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        avatar: '',
      }),
    });
    const clearAvatarData = await clearAvatarRes.json();

    assert(clearAvatarRes.status === 200, 'Clearing avatar returns HTTP 200');
    assert(clearAvatarData.data?.user?.avatar === null, 'Avatar reset to null in response');
    const dbUserACleared = await User.findById(userA._id);
    assert(dbUserACleared.avatar === null, 'Avatar reset to null in database');

    // -------------------------------------------------------------------------
    // 6. Validation Rejection: Empty Name (400)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Validation Rejections: Display Name ---');
    const emptyNameRes = await fetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: '    ',
      }),
    });
    const emptyNameData = await emptyNameRes.json();
    assert(emptyNameRes.status === 400, 'Empty/whitespace name returns HTTP 400');
    assert(emptyNameData.message.includes('empty'), 'Clear error message for empty name');

    // Long name > 50 chars
    const longNameRes = await fetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'A'.repeat(51),
      }),
    });
    const longNameData = await longNameRes.json();
    assert(longNameRes.status === 400, 'Name > 50 characters returns HTTP 400');
    assert(longNameData.message.includes('50'), 'Clear error message for max length');

    // -------------------------------------------------------------------------
    // 7. Validation Rejection: Long Bio > 500 chars (400)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Validation Rejections: Bio ---');
    const longBioRes = await fetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bio: 'B'.repeat(501),
      }),
    });
    const longBioData = await longBioRes.json();
    assert(longBioRes.status === 400, 'Bio > 500 characters returns HTTP 400');
    assert(longBioData.message.includes('500'), 'Clear error message for bio max length');

    // -------------------------------------------------------------------------
    // 8. Validation Rejection: Malformed & Unsafe Avatar URLs (400)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Validation Rejections: Avatar URL ---');
    const malformedUrls = [
      'not_a_valid_url',
      'javascript:alert("hacked")',
      'ftp://example.com/avatar.png',
      'data:text/html,<script>alert(1)</script>',
      '//protocol-relative-not-http.com',
    ];

    for (const badUrl of malformedUrls) {
      const badAvatarRes = await fetch(`${API_BASE}/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          avatar: badUrl,
        }),
      });
      assert(badAvatarRes.status === 400, `Rejected invalid/unsafe avatar URL: ${badUrl}`);
    }

    // -------------------------------------------------------------------------
    // 9. Ownership Protection: Cannot Modify Another User's Profile
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Testing Ownership Protection ---');
    // User A attempts to tamper with User B's profile by injecting arbitrary userId/email
    const tamperRes = await fetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        userId: userB._id.toString(),
        _id: userB._id.toString(),
        email: 'hacked_bob@chessjeeno.local',
        name: 'Alice Impersonating Bob',
        bio: 'User A maliciously editing',
      }),
    });
    const tamperData = await tamperRes.json();

    assert(tamperRes.status === 200, 'PATCH succeeds for the authenticated user only');
    assert(tamperData.data?.user?._id === userA._id.toString(), 'Updated user is User A, NOT User B');
    assert(tamperData.data?.user?.email === userA.email, 'Email is immutable via PATCH /me');

    // Verify User B remained completely unmodified
    const dbUserBAfter = await User.findById(userB._id);
    assert(dbUserBAfter.name === 'Initial Bob', 'User B display name remains unmodified');
    assert(dbUserBAfter.bio === 'Existing Bob bio', 'User B bio remains unmodified');
    assert(dbUserBAfter.email === `${testPrefix}_bob@chessjeeno.local`, 'User B email remains unmodified');

    // -------------------------------------------------------------------------
    // 10. Unauthorized PATCH /api/users/me (401)
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Testing Unauthorized PATCH /api/users/me Rejection ---');
    const unauthPatch = await fetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Anonymous Edit' }),
    });
    assert(unauthPatch.status === 401, 'Unauthenticated PATCH returns 401');

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
  } finally {
    console.log('🧹 Cleaning up test users and closing server...');
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await new Promise((resolve) => testServer.close(resolve));
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
};

runProfileTests().catch((err) => {
  console.error('\n❌ Uncaught error during profile tests:', err);
  process.exit(1);
});
