import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import * as lichessOAuthService from '../services/lichessOAuthService.js';
import { generateToken } from '../services/authService.js';
import { LICHESS_OAUTH_CONFIG } from '../config/lichessOAuth.js';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';

const runOAuthTests = async () => {
  console.log('🧪 Starting Lichess OAuth 2.0 PKCE Automated Test Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `oauth_test_${timestamp}`;
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
    // 1. PKCE Verifier Generation
    // =========================================================================
    console.log('--- 1. Testing PKCE Verifier Generation ---');
    const verifierDefault = lichessOAuthService.generateCodeVerifier();
    assert(typeof verifierDefault === 'string', 'Verifier is a string');
    assert(verifierDefault.length === 64, 'Default verifier length is 64 characters');
    assert(/^[A-Za-z0-9_-]+$/.test(verifierDefault), 'Verifier contains only RFC 7636 unreserved base64url characters');

    const verifierMin = lichessOAuthService.generateCodeVerifier(43);
    assert(verifierMin.length === 43, 'Verifier enforces minimum length of 43');

    const verifierMax = lichessOAuthService.generateCodeVerifier(128);
    assert(verifierMax.length === 128, 'Verifier enforces maximum length of 128');

    // =========================================================================
    // 2. PKCE Challenge Generation (S256)
    // =========================================================================
    console.log('\n--- 2. Testing PKCE Challenge Generation (S256) ---');
    const challenge = lichessOAuthService.generateCodeChallenge(verifierDefault);
    assert(typeof challenge === 'string', 'Challenge is a string');
    assert(/^[A-Za-z0-9_-]+$/.test(challenge), 'Challenge is Base64URL-encoded (no padding)');
    assert(challenge.length === 43, 'SHA-256 base64url digest is 43 characters');

    // Determinism test
    const challenge2 = lichessOAuthService.generateCodeChallenge(verifierDefault);
    assert(challenge === challenge2, 'Same verifier produces identical challenge');

    // =========================================================================
    // 3. State Generation & Uniqueness
    // =========================================================================
    console.log('\n--- 3. Testing State Generation & Uniqueness ---');
    const state1 = lichessOAuthService.generateState();
    const state2 = lichessOAuthService.generateState();
    assert(typeof state1 === 'string' && state1.length === 64, 'State is a 64-char hex string (32 bytes)');
    assert(state1 !== state2, 'Generated states are distinct');

    const stateSet = new Set();
    for (let i = 0; i < 100; i++) {
      stateSet.add(lichessOAuthService.generateState());
    }
    assert(stateSet.size === 100, '100 generated states are all unique');

    // =========================================================================
    // 4. State Expiration & Single-Use Behavior
    // =========================================================================
    console.log('\n--- 4. Testing State Expiration & Single-Use Consumption ---');
    const dummyUserId = new mongoose.Types.ObjectId().toString();
    const testState = lichessOAuthService.generateState();
    const testVerifier = lichessOAuthService.generateCodeVerifier();

    // Test saving and single-use
    lichessOAuthService.saveOAuthTransaction({
      state: testState,
      userId: dummyUserId,
      codeVerifier: testVerifier,
      ttlMs: 5000,
    });
    assert(lichessOAuthService.hasOAuthTransaction(testState) === true, 'Transaction exists before consumption');

    const consumed = lichessOAuthService.consumeOAuthTransaction(testState);
    assert(consumed !== null, 'Transaction consumed successfully on first try');
    assert(consumed.userId === dummyUserId, 'Consumed transaction has correct userId');
    assert(consumed.codeVerifier === testVerifier, 'Consumed transaction has correct codeVerifier');

    // Replay attack prevention: second consume MUST return null
    const replayed = lichessOAuthService.consumeOAuthTransaction(testState);
    assert(replayed === null, 'Second consumption of the same state returns null (replayed state rejected)');

    // Test expiration
    const expState = lichessOAuthService.generateState();
    lichessOAuthService.saveOAuthTransaction({
      state: expState,
      userId: dummyUserId,
      codeVerifier: testVerifier,
      ttlMs: 15, // 15 ms TTL
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const expiredConsume = lichessOAuthService.consumeOAuthTransaction(expState);
    assert(expiredConsume === null, 'Expired state transaction returns null');

    // =========================================================================
    // 5. Authorization URL Generation
    // =========================================================================
    console.log('\n--- 5. Testing Authorization URL Generation ---');
    const authResult = lichessOAuthService.createAuthorizationUrl(dummyUserId);
    assert(typeof authResult.url === 'string', 'Authorization URL returned');
    assert(authResult.url.startsWith(LICHESS_OAUTH_CONFIG.authorizationEndpoint), 'URL targets official Lichess authorization endpoint');

    const parsedUrl = new URL(authResult.url);
    assert(parsedUrl.searchParams.get('response_type') === 'code', 'Query includes response_type=code');
    assert(Boolean(parsedUrl.searchParams.get('client_id')), 'Query includes client_id');
    assert(Boolean(parsedUrl.searchParams.get('redirect_uri')), 'Query includes redirect_uri');
    assert(parsedUrl.searchParams.get('code_challenge_method') === 'S256', 'Query specifies code_challenge_method=S256');
    assert(Boolean(parsedUrl.searchParams.get('code_challenge')), 'Query includes code_challenge');
    assert(Boolean(parsedUrl.searchParams.get('state')), 'Query includes state');

    const scopesParam = parsedUrl.searchParams.get('scope');
    assert(scopesParam.includes('preference:read'), 'Scope includes preference:read');
    assert(scopesParam.includes('challenge:read'), 'Scope includes challenge:read');
    assert(scopesParam.includes('challenge:write'), 'Scope includes challenge:write');
    assert(scopesParam.includes('challenge:bulk'), 'Scope includes challenge:bulk');
    assert(scopesParam.includes('board:play'), 'Scope includes board:play');
    assert(
      scopesParam === 'preference:read challenge:read challenge:write challenge:bulk board:play',
      'Scope parameter contains exact 5 required scopes in order'
    );

    assert(lichessOAuthService.hasOAuthTransaction(authResult.state) === true, 'Authorization URL generation stored state transaction');

    // =========================================================================
    // 6. Authenticated User Required for Connect Endpoint & Query-Token Rejection
    // =========================================================================
    console.log('\n--- 6. Testing /api/lichess/connect Auth Requirement & Query-Token Rejection ---');
    const unauthConnectRes = await fetch(`${API_BASE}/lichess/connect`, {
      headers: { Accept: 'application/json' },
    });
    assert(unauthConnectRes.status === 401, 'Unauthenticated /api/lichess/connect returns HTTP 401');

    // Create test user A in DB
    const userA = await User.create({
      name: 'Alice OAuth Tester',
      email: `${testPrefix}_alice@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
    });
    createdUserIds.push(userA._id);
    const tokenA = generateToken(userA._id);

    // CRITICAL SECURITY TEST: Verify ?token=<jwt> is REJECTED without Authorization header
    const queryTokenConnectRes = await fetch(`${API_BASE}/lichess/connect?token=${tokenA}&json=true`, {
      headers: { Accept: 'application/json' },
    });
    assert(
      queryTokenConnectRes.status === 401,
      'Query param ?token=<jwt> is strictly rejected with HTTP 401 on /api/lichess/connect'
    );

    // Call /api/lichess/connect with standard Authorization: Bearer <token>
    const authConnectRes = await fetch(`${API_BASE}/lichess/connect?json=true`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        Accept: 'application/json',
      },
    });
    const authConnectData = await authConnectRes.json();
    assert(authConnectRes.status === 200, 'Authenticated /api/lichess/connect with Bearer header returns HTTP 200 JSON');
    assert(authConnectData.success === true, 'Response success is true');
    assert(Boolean(authConnectData.data?.url), 'Returns generated Lichess auth URL');
    assert(Boolean(authConnectData.data?.state), 'Returns generated state');

    // =========================================================================
    // 7. Callback Rejects Invalid or Reused State
    // =========================================================================
    console.log('\n--- 7. Testing Callback Rejects Invalid or Reused State ---');
    const invalidStateRes = await fetch(`${API_BASE}/lichess/callback?code=mock_code&state=nonexistent_state`, {
      redirect: 'manual',
    });
    const invalidRedirect = invalidStateRes.headers.get('location');
    assert(
      invalidRedirect && invalidRedirect.includes('lichess_status=error'),
      'Callback with nonexistent state redirects with lichess_status=error'
    );

    // Consume state then attempt callback with it
    const reusableState = authConnectData.data.state;
    // Consume state manually
    lichessOAuthService.consumeOAuthTransaction(reusableState);
    const reusedStateRes = await fetch(`${API_BASE}/lichess/callback?code=mock_code&state=${reusableState}`, {
      redirect: 'manual',
    });
    const reusedRedirect = reusedStateRes.headers.get('location');
    assert(
      reusedRedirect && reusedRedirect.includes('lichess_status=error'),
      'Callback with consumed/reused state redirects with lichess_status=error'
    );

    // =========================================================================
    // 8. Mocked Token Exchange & Account Fetch
    // =========================================================================
    console.log('\n--- 8. Testing Mocked Token Exchange & Account Fetch ---');
    const originalFetch = global.fetch;

    try {
      // Mock fetch for token exchange and account fetch
      global.fetch = async (url, options = {}) => {
        if (url === LICHESS_OAUTH_CONFIG.tokenEndpoint) {
          // Verify request method and form content
          if (options.method === 'POST') {
            const bodyParams = new URLSearchParams(options.body);
            if (bodyParams.get('grant_type') !== 'authorization_code') {
              return {
                ok: false,
                status: 400,
                json: async () => ({ error: 'invalid_grant' }),
              };
            }
            if (!bodyParams.get('code_verifier')) {
              return {
                ok: false,
                status: 400,
                json: async () => ({ error: 'code_verifier_required' }),
              };
            }
            return {
              ok: true,
              status: 200,
              json: async () => ({
                access_token: 'mock_lichess_oauth_access_token_xyz987',
                token_type: 'Bearer',
                expires_in: 31536000,
                scope: 'preference:read challenge:read challenge:write challenge:bulk board:play',
              }),
            };
          }
        }

        if (url === LICHESS_OAUTH_CONFIG.accountEndpoint) {
          const authHeader = options.headers?.Authorization;
          if (authHeader && authHeader.includes('mock_lichess_oauth_access_token_xyz987')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                id: 'alice_grandmaster',
                username: 'Alice_Grandmaster',
                title: 'WGM',
              }),
            };
          }
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
          };
        }

        return originalFetch(url, options);
      };

      // Test exchangeCodeForToken unit
      const tokenResult = await lichessOAuthService.exchangeCodeForToken({
        code: 'valid_test_code_123',
        codeVerifier: 'valid_verifier_abc_123',
      });
      assert(tokenResult.access_token === 'mock_lichess_oauth_access_token_xyz987', 'Mocked token exchange returned access_token');
      assert(tokenResult.token_type === 'Bearer', 'Token type is Bearer');

      // Test fetchLichessAccount unit
      const accountResult = await lichessOAuthService.fetchLichessAccount(tokenResult.access_token);
      assert(accountResult.id === 'alice_grandmaster', 'Lichess account ID fetched');
      assert(accountResult.username === 'Alice_Grandmaster', 'Lichess username fetched');

      // =========================================================================
      // 9. Store Connection & Sensitive Credential Concealment
      // =========================================================================
      console.log('\n--- 9. Testing Store Connection & Credential Concealment ---');
      await lichessOAuthService.storeLichessConnection(userA._id, {
        account: accountResult,
        tokenData: tokenResult,
      });

      // Verify DB persistence
      const updatedUserA = await User.findById(userA._id).select('+lichessOAuth.accessToken');
      assert(updatedUserA.lichessUsername === 'Alice_Grandmaster', 'User document stores Lichess username');
      assert(updatedUserA.lichessUserId === 'alice_grandmaster', 'User document stores Lichess user ID');
      assert(Boolean(updatedUserA.lichessOAuth?.accessToken), 'Access token stored in backend DB field');
      assert(Boolean(updatedUserA.lichessOAuth?.connectedAt), 'Connection timestamp recorded');

      // Verify sensitive token NOT exposed in toJSON or normal query
      const normalUserA = await User.findById(userA._id);
      const jsonOutput = JSON.parse(JSON.stringify(normalUserA));
      assert(jsonOutput.lichessOAuth?.accessToken === undefined, 'Normal user JSON serialization excludes accessToken');
      assert(jsonOutput.lichessOAuth?.refreshToken === undefined, 'Normal user JSON serialization excludes refreshToken');
      assert(normalUserA.lichessOAuth?.accessToken === undefined, 'Normal Mongoose query excludes accessToken');

      // =========================================================================
      // 10. Duplicate Lichess Account Connection Rejected (409)
      // =========================================================================
      console.log('\n--- 10. Testing Duplicate Lichess Account Connection Rejection ---');
      const userB = await User.create({
        name: 'Bob OAuth Impersonator',
        email: `${testPrefix}_bob@chessjeeno.local`,
        passwordHash: 'dummy_hash',
        authProvider: 'local',
      });
      createdUserIds.push(userB._id);

      let duplicateErrorCaught = false;
      try {
        await lichessOAuthService.storeLichessConnection(userB._id, {
          account: accountResult, // Same Lichess account
          tokenData: tokenResult,
        });
      } catch (err) {
        duplicateErrorCaught = true;
        assert(err.statusCode === 409, 'Duplicate connection throws HTTP 409 Conflict');
        assert(err.message.includes('already connected'), 'Clear duplicate account message');
      }
      assert(duplicateErrorCaught === true, 'Duplicate Lichess account was rejected');

      // Verify User A connection remains intact
      const verifyUserA = await User.findById(userA._id);
      assert(verifyUserA.lichessUsername === 'Alice_Grandmaster', 'Original user connection remained intact');

      // Verify User B was NOT connected
      const verifyUserB = await User.findById(userB._id);
      assert(verifyUserB.lichessUsername === null, 'Second user was not connected');
    } finally {
      global.fetch = originalFetch;
    }

    // =========================================================================
    // 11. Status API Endpoint (/api/lichess/status)
    // =========================================================================
    console.log('\n--- 11. Testing /api/lichess/status Endpoint ---');
    // Status when connected
    const statusResA = await fetch(`${API_BASE}/lichess/status`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const statusDataA = await statusResA.json();
    assert(statusResA.status === 200, 'Status returns HTTP 200');
    assert(statusDataA.success === true, 'Status success is true');
    assert(statusDataA.data.connected === true, 'Reports connected: true');
    assert(statusDataA.data.username === 'Alice_Grandmaster', 'Reports connected username');
    assert(statusDataA.data.lichessUserId === 'alice_grandmaster', 'Reports connected user ID');
    assert(Boolean(statusDataA.data.connectedAt), 'Reports connectedAt timestamp');

    // CRITICAL SECURITY ASSERTIONS: No tokens in status response
    assert(statusDataA.data.accessToken === undefined, 'Status response excludes accessToken');
    assert(statusDataA.data.refreshToken === undefined, 'Status response excludes refreshToken');
    assert(statusDataA.data.token === undefined, 'Status response excludes token');
    assert(JSON.stringify(statusDataA).includes('mock_lichess_oauth_access_token_xyz987') === false, 'No token in JSON string');

    // Status for unconnected user B
    const tokenB = generateToken(createdUserIds[1]);
    const statusResB = await fetch(`${API_BASE}/lichess/status`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const statusDataB = await statusResB.json();
    assert(statusResB.status === 200, 'User B status returns HTTP 200');
    assert(statusDataB.data.connected === false, 'User B reports connected: false');
    assert(statusDataB.data.username === null, 'User B username is null');

    // =========================================================================
    // 12. Disconnect Endpoint (/api/lichess/disconnect)
    // =========================================================================
    console.log('\n--- 12. Testing /api/lichess/disconnect Endpoint ---');
    const disconnectResA = await fetch(`${API_BASE}/lichess/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const disconnectDataA = await disconnectResA.json();
    assert(disconnectResA.status === 200, 'Disconnect returns HTTP 200');
    assert(disconnectDataA.success === true, 'Disconnect success is true');
    assert(disconnectDataA.message.includes('disconnected successfully'), 'Clear disconnection message');

    // Verify status is now disconnected
    const postDisconnectStatusRes = await fetch(`${API_BASE}/lichess/status`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const postDisconnectStatusData = await postDisconnectStatusRes.json();
    assert(postDisconnectStatusData.data.connected === false, 'Status reports connected: false after disconnect');
    assert(postDisconnectStatusData.data.username === null, 'Username is null after disconnect');

    // Verify DB cleared
    const postDisconnectUserA = await User.findById(userA._id).select('+lichessOAuth.accessToken');
    assert(postDisconnectUserA.lichessUsername === null, 'DB lichessUsername is null');
    assert(postDisconnectUserA.lichessUserId === null, 'DB lichessUserId is null');
    assert(postDisconnectUserA.lichessOAuth.accessToken === null, 'DB accessToken is null');

    // Disconnecting when already disconnected returns 400
    const alreadyDisconnectedRes = await fetch(`${API_BASE}/lichess/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(alreadyDisconnectedRes.status === 400, 'Disconnecting when not connected returns HTTP 400');

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
  } finally {
    console.log('🧹 Cleaning up test users...');
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
};

runOAuthTests().catch((err) => {
  console.error('\n❌ Uncaught error during OAuth tests:', err);
  process.exit(1);
});
