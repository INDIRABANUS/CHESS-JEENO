import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';

const runAuthTests = async () => {
  console.log('🧪 Starting CHESS JEENO Authentication & Authorization Test Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `auth_test_${timestamp}`;

  const userAEmail = `${testPrefix}_alice@chessjeeno.local`;
  const userBEmail = `${testPrefix}_bob@chessjeeno.local`;
  const validPassword = 'SecurePassword123!';
  const invalidPassword = 'WrongPassword456!';

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

  let tokenA = null;
  let userAId = null;
  let tokenB = null;
  let userBId = null;
  let tournamentAId = null;

  try {
    // =========================================================================
    // 1. Register valid user
    // =========================================================================
    console.log('--- 1. Testing Valid User Registration ---');
    const regResA = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Wonder',
        email: userAEmail,
        password: validPassword,
        lichessUsername: 'alice_chess',
      }),
    });
    const regDataA = await regResA.json();
    assert(regResA.status === 201, 'Registration returns HTTP 201 Created');
    assert(regDataA.success === true, 'Response contains success: true');
    assert(Boolean(regDataA.data?.token), 'Response includes a JWT token');
    assert(regDataA.data?.user?.email === userAEmail.toLowerCase(), 'User email matches normalized input');
    assert(regDataA.data?.user?.name === 'Alice Wonder', 'User name matches');
    assert(regDataA.data?.user?.authProvider === 'local', 'authProvider is "local"');

    tokenA = regDataA.data.token;
    userAId = regDataA.data.user._id;
    createdUserIds.push(userAId);

    // =========================================================================
    // 2. Duplicate email rejected
    // =========================================================================
    console.log('\n--- 2. Testing Duplicate Email Rejection ---');
    const dupRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Duplicate',
        email: userAEmail.toUpperCase(), // Test case-insensitive normalization
        password: validPassword,
      }),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 400, 'Duplicate email registration returns HTTP 400');
    assert(dupData.message.includes('already exists'), 'Clear duplicate account error message');

    // =========================================================================
    // 3. Password is hashed in database
    // =========================================================================
    console.log('\n--- 3. Verifying Password Hashing ---');
    const dbUser = await User.findById(userAId).select('+passwordHash');
    assert(Boolean(dbUser.passwordHash), 'passwordHash exists in MongoDB document');
    assert(dbUser.passwordHash !== validPassword, 'Plaintext password is NOT stored');
    const isBcryptHash = await bcrypt.compare(validPassword, dbUser.passwordHash);
    assert(isBcryptHash === true, 'Stored hash successfully validates via bcryptjs');

    // =========================================================================
    // 4. passwordHash not returned in queries or responses
    // =========================================================================
    console.log('\n--- 4. Verifying Sensitive Credentials Concealment ---');
    assert(regDataA.data.user.passwordHash === undefined, 'Registration response excludes passwordHash');
    const normalQuery = await User.findById(userAId);
    assert(normalQuery.passwordHash === undefined, 'Normal Mongoose query excludes passwordHash');
    assert(JSON.parse(JSON.stringify(normalQuery)).passwordHash === undefined, 'JSON serialization excludes passwordHash');

    // =========================================================================
    // 5. Login with valid password
    // =========================================================================
    console.log('\n--- 5. Testing Login with Valid Credentials ---');
    const loginResA = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userAEmail,
        password: validPassword,
      }),
    });
    const loginDataA = await loginResA.json();
    assert(loginResA.status === 200, 'Login returns HTTP 200 OK');
    assert(loginDataA.success === true, 'Login success is true');
    assert(Boolean(loginDataA.data?.token), 'Login returns JWT');
    assert(loginDataA.data.user.passwordHash === undefined, 'Login response excludes passwordHash');

    // =========================================================================
    // 6. Login with invalid password rejected
    // =========================================================================
    console.log('\n--- 6. Testing Login with Invalid Credentials ---');
    const badLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userAEmail,
        password: invalidPassword,
      }),
    });
    const badLoginData = await badLoginRes.json();
    assert(badLoginRes.status === 401, 'Invalid password returns HTTP 401');
    assert(badLoginData.message.includes('Invalid email or password'), 'Clear invalid credentials message');

    // Nonexistent user login rejection
    const nonExistRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody_exists@chessjeeno.local',
        password: validPassword,
      }),
    });
    assert(nonExistRes.status === 401, 'Nonexistent email returns HTTP 401');

    // =========================================================================
    // 7. JWT generated & verified
    // =========================================================================
    console.log('\n--- 7. Verifying JWT Generation ---');
    assert(typeof tokenA === 'string' && tokenA.split('.').length === 3, 'JWT has valid three-segment structure');

    // =========================================================================
    // 8. /me works with valid JWT
    // =========================================================================
    console.log('\n--- 8. Testing /api/auth/me with Valid JWT ---');
    const meResA = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const meDataA = await meResA.json();
    assert(meResA.status === 200, '/me returns HTTP 200');
    assert(meDataA.data?.user?._id === userAId.toString(), '/me returns correct user ID');
    assert(meDataA.data?.user?.email === userAEmail.toLowerCase(), '/me returns correct email');
    assert(meDataA.data?.user?.passwordHash === undefined, '/me excludes passwordHash');

    // =========================================================================
    // 9. /me rejects missing JWT
    // =========================================================================
    console.log('\n--- 9. Testing /api/auth/me Rejection without JWT ---');
    const missingTokenRes = await fetch(`${API_BASE}/auth/me`);
    assert(missingTokenRes.status === 401, 'Missing token returns HTTP 401');

    // CRITICAL SECURITY TEST: Ensure ?token=<jwt> is rejected with HTTP 401
    const queryTokenMeRes = await fetch(`${API_BASE}/auth/me?token=${tokenA}`);
    assert(queryTokenMeRes.status === 401, 'Query parameter ?token=<jwt> is rejected with HTTP 401');

    // =========================================================================
    // 10. /me rejects invalid JWT
    // =========================================================================
    console.log('\n--- 10. Testing /api/auth/me Rejection with Invalid JWT ---');
    const invalidTokenRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: 'Bearer this_is_definitely_not_a_valid_jwt' },
    });
    assert(invalidTokenRes.status === 401, 'Malformed token returns HTTP 401');

    // =========================================================================
    // 11. Protected tournament creation requires authentication
    // =========================================================================
    console.log('\n--- 11. Testing Tournament Creation Requires Authentication ---');
    const unauthTourneyRes = await fetch(`${API_BASE}/tournaments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauthenticated Cup',
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 0,
      }),
    });
    assert(unauthTourneyRes.status === 401, 'Unauthenticated tournament creation returns HTTP 401');

    // =========================================================================
    // 12. Authenticated user becomes tournament creator
    // =========================================================================
    console.log('\n--- 12. Testing Authenticated Tournament Creation ---');
    const authTourneyRes = await fetch(`${API_BASE}/tournaments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: `${testPrefix} Cup`,
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 2,
        maxPlayers: 4,
      }),
    });
    const authTourneyData = await authTourneyRes.json();
    assert(authTourneyRes.status === 201, 'Authenticated tournament creation returns HTTP 201');
    assert(Boolean(authTourneyData.data?._id), 'Tournament ID returned');
    assert(
      authTourneyData.data.createdBy._id === userAId.toString() ||
        authTourneyData.data.createdBy === userAId.toString(),
      'req.user._id is the tournament createdBy source of truth'
    );
    tournamentAId = authTourneyData.data._id;
    createdTournamentIds.push(tournamentAId);

    // =========================================================================
    // Register User B for ownership separation tests
    // =========================================================================
    console.log('\n--- Registering User B ---');
    const regResB = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Challenger',
        email: userBEmail,
        password: validPassword,
        lichessUsername: 'bob_chess',
      }),
    });
    const regDataB = await regResB.json();
    tokenB = regDataB.data.token;
    userBId = regDataB.data.user._id;
    createdUserIds.push(userBId);
    assert(regResB.status === 201, 'User B registered successfully');

    // =========================================================================
    // 13. Second user cannot edit first user's tournament (403)
    // =========================================================================
    console.log('\n--- 13. Testing Unauthorized Tournament Edit (403) ---');
    const editResB = await fetch(`${API_BASE}/tournaments/${tournamentAId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ name: 'Hacked Tournament Name' }),
    });
    const editDataB = await editResB.json();
    assert(editResB.status === 403, 'Second user editing tournament returns HTTP 403 Forbidden');
    assert(editDataB.message.includes('not authorized'), 'Clear authorization rejection message');

    // Verify creator CAN edit their own tournament
    const editResA = await fetch(`${API_BASE}/tournaments/${tournamentAId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: `${testPrefix} Cup (Updated)` }),
    });
    const editDataA = await editResA.json();
    assert(editResA.status === 200, 'Creator editing their own tournament returns HTTP 200');
    assert(editDataA.data.name === `${testPrefix} Cup (Updated)`, 'Tournament name updated successfully');

    // =========================================================================
    // 14. Second user cannot delete first user's tournament (403)
    // =========================================================================
    console.log('\n--- 14. Testing Unauthorized Tournament Delete (403) ---');
    const delResB = await fetch(`${API_BASE}/tournaments/${tournamentAId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(delResB.status === 403, 'Second user deleting tournament returns HTTP 403 Forbidden');

    // Second user cannot create rounds for first user's tournament (403)
    const roundResB = await fetch(`${API_BASE}/tournaments/${tournamentAId}/rounds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(roundResB.status === 403, 'Second user creating rounds returns HTTP 403 Forbidden');

    // =========================================================================
    // 15. Authenticated user can join eligible tournament
    // =========================================================================
    console.log('\n--- 15. Testing Player Join with Authentication ---');
    // User A joins
    const joinResA = await fetch(`${API_BASE}/tournaments/${tournamentAId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const joinDataA = await joinResA.json();
    assert(joinResA.status === 200, 'User A joins tournament successfully (HTTP 200)');
    assert(joinDataA.data.userId._id === userAId.toString(), 'Player registered with User A ID');

    // User B joins
    const joinResB = await fetch(`${API_BASE}/tournaments/${tournamentAId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(joinResB.status === 200, 'User B joins tournament successfully (HTTP 200)');

    // =========================================================================
    // 16. User can leave eligible tournament
    // =========================================================================
    console.log('\n--- 16. Testing Player Leave with Authentication ---');
    const leaveResB = await fetch(`${API_BASE}/tournaments/${tournamentAId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const leaveDataB = await leaveResB.json();
    assert(leaveResB.status === 200, 'User B leaves tournament successfully (HTTP 200)');
    assert(leaveDataB.message.includes('left the tournament'), 'Confirmed left tournament');

    // User B rejoins so tournament has 2 players
    const rejoinResB = await fetch(`${API_BASE}/tournaments/${tournamentAId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(rejoinResB.status === 200, 'User B re-joined tournament successfully');

    // User A (creator) can create round
    const roundResA = await fetch(`${API_BASE}/tournaments/${tournamentAId}/rounds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const roundDataA = await roundResA.json();
    assert(roundResA.status === 201, 'Creator creates Round 1 successfully (HTTP 201)');
    assert(roundDataA.data.round.roundNumber === 1, 'Round 1 created');

    // =========================================================================
    // 17. Unauthenticated protected action returns 401
    // =========================================================================
    console.log('\n--- 17. Testing Unauthenticated Protected Mutations (401) ---');
    const unauthPatch = await fetch(`${API_BASE}/tournaments/${tournamentAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Anonymous Edit' }),
    });
    assert(unauthPatch.status === 401, 'Unauthenticated PATCH returns 401');

    const unauthDelete = await fetch(`${API_BASE}/tournaments/${tournamentAId}`, {
      method: 'DELETE',
    });
    assert(unauthDelete.status === 401, 'Unauthenticated DELETE returns 401');

    const unauthJoin = await fetch(`${API_BASE}/tournaments/${tournamentAId}/join`, {
      method: 'POST',
    });
    assert(unauthJoin.status === 401, 'Unauthenticated /join returns 401');

    const unauthLeave = await fetch(`${API_BASE}/tournaments/${tournamentAId}/leave`, {
      method: 'POST',
    });
    assert(unauthLeave.status === 401, 'Unauthenticated /leave returns 401');

    const unauthRound = await fetch(`${API_BASE}/tournaments/${tournamentAId}/rounds`, {
      method: 'POST',
    });
    assert(unauthRound.status === 401, 'Unauthenticated /rounds returns 401');

    // =========================================================================
    // 18. Unauthorized ownership action returns 403
    // =========================================================================
    console.log('\n--- 18. Testing Unauthorized Ownership Mutation (403) ---');
    const nonOwnerDelete = await fetch(`${API_BASE}/tournaments/${tournamentAId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(nonOwnerDelete.status === 403, 'Non-owner DELETE returns HTTP 403');

    // Public read endpoints remain open without authentication
    console.log('\n--- Testing Public Read Endpoints ---');
    const pubList = await fetch(`${API_BASE}/tournaments`);
    assert(pubList.status === 200, 'Public GET /tournaments is accessible without auth');

    const pubSingle = await fetch(`${API_BASE}/tournaments/${tournamentAId}`);
    assert(pubSingle.status === 200, 'Public GET /tournaments/:id is accessible without auth');

    const pubPlayers = await fetch(`${API_BASE}/tournaments/${tournamentAId}/players`);
    assert(pubPlayers.status === 200, 'Public GET /tournaments/:id/players is accessible without auth');

    const pubRounds = await fetch(`${API_BASE}/tournaments/${tournamentAId}/rounds`);
    assert(pubRounds.status === 200, 'Public GET /tournaments/:id/rounds is accessible without auth');

    const pubStandings = await fetch(`${API_BASE}/tournaments/${tournamentAId}/standings`);
    assert(pubStandings.status === 200, 'Public GET /tournaments/:id/standings is accessible without auth');

    // Delete tournament using creator A credentials
    // Note: round was created so status is REGISTRATION (can delete)
    const delResA = await fetch(`${API_BASE}/tournaments/${tournamentAId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(delResA.status === 200, 'Creator A deletes their tournament successfully (HTTP 200)');

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
  } finally {
    // Clean up test data
    console.log('🧹 Cleaning up test users and tournaments...');
    if (createdTournamentIds.length > 0) {
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Round.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Pairing.deleteMany({ tournamentId: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
};

runAuthTests().catch((err) => {
  console.error('\n❌ Uncaught error during auth tests:', err);
  process.exit(1);
});
