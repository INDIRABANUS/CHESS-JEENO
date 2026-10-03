import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import apiRouter from '../routes/index.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import * as googleOAuthService from '../services/googleOAuthService.js';
import { GOOGLE_OAUTH_CONFIG, getGoogleClientId } from '../config/googleOAuth.js';
import { registerUser } from '../services/authService.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

const runGoogleOAuthTests = async () => {
  console.log('🧪 Starting CHESS JEENO Google OAuth 2.0 OpenID Connect Test Suite...\n');
  await connectDB();

  // Create an isolated Express server on an ephemeral port
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api', apiRouter);
  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  const testServer = http.createServer(testApp);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const API_BASE = `http://localhost:${port}/api`;
  console.log(`📡 Ephemeral test server listening on ${API_BASE}`);

  const timestamp = Date.now();
  const testPrefix = `google_test_${timestamp}`;
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
    // 1. Google OAuth Authorization URL & Parameters
    // =========================================================================
    console.log('\n--- 1. Testing Google OAuth Authorization URL & Scopes ---');
    const authUrlData = googleOAuthService.createAuthorizationUrl();
    assert(typeof authUrlData.url === 'string', 'Authorization URL is a string');
    assert(typeof authUrlData.state === 'string' && authUrlData.state.length === 64, 'State is a 64-char hex string');

    const parsedUrl = new URL(authUrlData.url);
    assert(parsedUrl.origin + parsedUrl.pathname === GOOGLE_OAUTH_CONFIG.authorizationEndpoint, 'Endpoint matches Google OAuth authorization URL');
    assert(parsedUrl.searchParams.get('response_type') === 'code', 'response_type is "code"');

    const requestedScopes = parsedUrl.searchParams.get('scope').split(' ');
    assert(requestedScopes.includes('openid'), 'Scopes include openid');
    assert(requestedScopes.includes('email'), 'Scopes include email');
    assert(requestedScopes.includes('profile'), 'Scopes include profile');
    assert(!requestedScopes.includes('https://www.googleapis.com/auth/drive'), 'No unrelated Google scopes requested');

    assert(parsedUrl.searchParams.get('state') === authUrlData.state, 'URL state matches generated state');
    assert(parsedUrl.searchParams.get('access_type') === 'online', 'access_type is online (no refresh tokens)');
    assert(parsedUrl.searchParams.get('prompt') === 'select_account', 'prompt is select_account');

    // =========================================================================
    // 2. OAuth State Management & Replay Attack Defense
    // =========================================================================
    console.log('\n--- 2. Testing State Validation & Single-Use Consumption ---');
    const testState = googleOAuthService.generateState();
    googleOAuthService.saveOAuthTransaction({ state: testState });

    assert(googleOAuthService.hasOAuthTransaction(testState) === true, 'State exists before consumption');
    const firstConsume = googleOAuthService.consumeOAuthTransaction(testState);
    assert(firstConsume === true, 'Valid state consumed successfully on first try');

    // Replay attack prevention: second consume MUST return false
    const secondConsume = googleOAuthService.consumeOAuthTransaction(testState);
    assert(secondConsume === false, 'Consumed state rejected on second try (single-use defense)');

    // Missing / invalid states rejected
    assert(googleOAuthService.consumeOAuthTransaction('invalid_bogus_state') === false, 'Invalid state rejected');
    assert(googleOAuthService.consumeOAuthTransaction('') === false, 'Empty state rejected');
    assert(googleOAuthService.consumeOAuthTransaction(null) === false, 'Null state rejected');

    // Expired state rejected
    const expiredState = googleOAuthService.generateState();
    googleOAuthService.saveOAuthTransaction({ state: expiredState, ttlMs: -1000 });
    assert(googleOAuthService.consumeOAuthTransaction(expiredState) === false, 'Expired state rejected');

    // =========================================================================
    // 3. One-Time Exchange Ticket Security (No JWT in URL)
    // =========================================================================
    console.log('\n--- 3. Testing Single-Use Session Handoff Ticket ---');
    const sampleUser = { _id: 'dummy_user_1', name: 'Test Google', email: 'test@example.com' };
    const sampleToken = 'dummy_jwt_token_12345';

    const ticket = googleOAuthService.createExchangeTicket({ user: sampleUser, token: sampleToken });
    assert(typeof ticket === 'string' && ticket.length === 64, 'Exchange ticket is a 64-char secure random hex');

    const consumedSession = googleOAuthService.consumeExchangeTicket(ticket);
    assert(consumedSession !== null, 'Ticket consumed successfully');
    assert(consumedSession.token === sampleToken, 'Session token matches');
    assert(consumedSession.user.email === sampleUser.email, 'Session user matches');

    // Replay attack prevention
    const reusedTicket = googleOAuthService.consumeExchangeTicket(ticket);
    assert(reusedTicket === null, 'Reused ticket consumption rejected (single-use defense)');

    // Expired ticket rejection
    const expiredTicket = googleOAuthService.createExchangeTicket({ user: sampleUser, token: sampleToken, ttlMs: -1000 });
    assert(googleOAuthService.consumeExchangeTicket(expiredTicket) === null, 'Expired ticket rejected');

    // =========================================================================
    // 4. Case A: New Google User Creation
    // =========================================================================
    console.log('\n--- 4. Testing Case A: New Google User Registration ---');
    const newGoogleSub = `sub_${timestamp}_001`;
    const newGoogleEmail = `${testPrefix}_newuser@gmail.com`;

    const newAuthResult = await googleOAuthService.authenticateGoogleUser({
      googleId: newGoogleSub,
      email: newGoogleEmail,
      name: 'Kasparov New',
      avatar: 'https://images.unsplash.com/photo-kasparov',
    });

    assert(newAuthResult.isNewUser === true, 'Flagged as new user');
    assert(Boolean(newAuthResult.token), 'CHESS JEENO JWT issued');
    assert(newAuthResult.user.email === newGoogleEmail, 'Email matches');
    assert(newAuthResult.user.authProvider === 'google', 'authProvider is "google"');
    assert(newAuthResult.user.name === 'Kasparov New', 'Name matches');
    createdUserIds.push(newAuthResult.user._id);

    // Verify token validity
    const decodedNewToken = jwt.verify(newAuthResult.token, JWT_SECRET);
    assert(decodedNewToken.userId === newAuthResult.user._id.toString(), 'Decoded JWT userId matches MongoDB document ID');

    // Verify in database
    const dbNewUser = await User.findById(newAuthResult.user._id).select('+passwordHash');
    assert(dbNewUser.googleId === newGoogleSub, 'MongoDB document contains Google sub in googleId');
    assert(dbNewUser.passwordHash === null, 'No password hash created for Google user (not fake password)');
    assert(dbNewUser.authProvider === 'google', 'Database authProvider is google');

    // =========================================================================
    // 5. Case B: Existing Google User Login (No Duplicates)
    // =========================================================================
    console.log('\n--- 5. Testing Case B: Existing Google User Login ---');
    const countBeforeLogin = await User.countDocuments({ googleId: newGoogleSub });
    assert(countBeforeLogin === 1, 'Exactly one user exists with googleId before second login');

    const existingAuthResult = await googleOAuthService.authenticateGoogleUser({
      googleId: newGoogleSub,
      email: newGoogleEmail,
      name: 'Kasparov New Updated',
    });

    assert(existingAuthResult.isNewUser === false, 'isNewUser is false on subsequent login');
    assert(existingAuthResult.user._id.toString() === newAuthResult.user._id.toString(), 'Returns same existing user ID');
    assert(Boolean(existingAuthResult.token), 'CHESS JEENO JWT issued for existing user');

    const countAfterLogin = await User.countDocuments({ googleId: newGoogleSub });
    assert(countAfterLogin === 1, 'No duplicate user created in database (count strictly 1)');

    // =========================================================================
    // 6. Case C: Existing Local Account with Same Email (Conflict Guard)
    // =========================================================================
    console.log('\n--- 6. Testing Case C: Existing Local Account with Same Email ---');
    const localEmail = `${testPrefix}_local@chessjeeno.com`;

    const localRegisterResult = await registerUser({
      name: 'Local Player',
      email: localEmail,
      password: 'SecureLocalPassword123!',
    });
    createdUserIds.push(localRegisterResult.user._id);
    assert(localRegisterResult.user.authProvider === 'local', 'Local account registered');

    let conflictErrorCaught = false;
    let conflictErrorMessage = '';
    try {
      await googleOAuthService.authenticateGoogleUser({
        googleId: `sub_intruder_${timestamp}`,
        email: localEmail,
        name: 'Intruder Trying Google',
      });
    } catch (err) {
      conflictErrorCaught = true;
      conflictErrorMessage = err.message;
      assert(err.statusCode === 409, 'Conflict returns HTTP 409 status');
    }

    assert(conflictErrorCaught === true, 'Google authentication with existing local email strictly rejected');
    assert(
      conflictErrorMessage.includes('An account with this email address already exists'),
      'Controlled error instructs user to sign in using existing method'
    );

    // Verify local account was NOT converted or modified
    const verifiedLocalUser = await User.findById(localRegisterResult.user._id);
    assert(verifiedLocalUser.authProvider === 'local', 'Local account provider was NOT overwritten');
    assert(verifiedLocalUser.googleId === null, 'Local account googleId was NOT set');

    const totalAccountsWithEmail = await User.countDocuments({ email: localEmail.toLowerCase() });
    assert(totalAccountsWithEmail === 1, 'No duplicate account created for conflicting email');

    // =========================================================================
    // 7. Case D: Conflicting Google Identity
    // =========================================================================
    console.log('\n--- 7. Testing Case D: Conflicting Google Identity ---');
    let identityClashCaught = false;
    try {
      await googleOAuthService.authenticateGoogleUser({
        googleId: 'clashing_different_sub_9999',
        email: newGoogleEmail,
        name: 'Clashing Account',
      });
    } catch (err) {
      identityClashCaught = true;
      assert(err.statusCode === 409, 'Identity clash returns HTTP 409');
    }
    assert(identityClashCaught === true, 'Conflicting Google identity correctly rejected');

    // =========================================================================
    // 8. Mocked Token Exchange & UserInfo Fetch
    // =========================================================================
    console.log('\n--- 8. Testing Mocked Token Exchange & UserInfo Fetch ---');
    const originalFetch = global.fetch;

    try {
      global.fetch = async (url, options = {}) => {
        if (url === GOOGLE_OAUTH_CONFIG.tokenEndpoint) {
          if (options.method === 'POST') {
            const bodyParams = new URLSearchParams(options.body);
            if (bodyParams.get('grant_type') !== 'authorization_code') {
              return {
                ok: false,
                status: 400,
                json: async () => ({ error: 'invalid_grant' }),
              };
            }
            if (!bodyParams.get('code')) {
              return {
                ok: false,
                status: 400,
                json: async () => ({ error: 'invalid_request' }),
              };
            }
            return {
              ok: true,
              status: 200,
              json: async () => ({
                access_token: 'mock_google_access_token_xyz123',
                token_type: 'Bearer',
                expires_in: 3600,
                scope: 'openid email profile',
              }),
            };
          }
        }

        if (url === GOOGLE_OAUTH_CONFIG.userInfoEndpoint) {
          const authHeader = options.headers?.Authorization;
          if (authHeader && authHeader.includes('mock_google_access_token_xyz123')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                sub: `mock_google_sub_${timestamp}`,
                name: 'Anand Viswanathan',
                email: `${testPrefix}_anand@gmail.com`,
                email_verified: true,
                picture: 'https://images.unsplash.com/photo-anand',
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

      // Set mock client ID and secret for token exchange test if not configured
      const originalClientId = process.env.GOOGLE_CLIENT_ID;
      const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
      process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock_test_client_id.apps.googleusercontent.com';
      process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock_test_client_secret_xyz';

      const tokenResult = await googleOAuthService.exchangeCodeForToken({ code: 'valid_mock_code' });
      assert(tokenResult.access_token === 'mock_google_access_token_xyz123', 'Mocked token exchange returned access_token');

      const userInfo = await googleOAuthService.fetchGoogleUserInfo(tokenResult.access_token);
      assert(userInfo.googleId === `mock_google_sub_${timestamp}`, 'UserInfo extracted Google sub');
      assert(userInfo.email === `${testPrefix}_anand@gmail.com`, 'UserInfo extracted email');
      assert(userInfo.name === 'Anand Viswanathan', 'UserInfo extracted name');
      assert(userInfo.avatar === 'https://images.unsplash.com/photo-anand', 'UserInfo extracted avatar');

      // Restore credentials
      process.env.GOOGLE_CLIENT_ID = originalClientId;
      process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    } finally {
      global.fetch = originalFetch;
    }

    // =========================================================================
    // 9. Full HTTP API Integration (/api/auth/google, /callback, /exchange)
    // =========================================================================
    console.log('\n--- 9. Testing HTTP API Endpoints ---');

    // Test GET /api/auth/google?json=true
    const origClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test_google_client_id.apps.googleusercontent.com';

    const authInitRes = await fetch(`${API_BASE}/auth/google?json=true`);
    const authInitData = await authInitRes.json();
    assert(authInitRes.status === 200, 'GET /api/auth/google?json=true returns HTTP 200');
    assert(authInitData.success === true, 'Auth init returns success: true');
    assert(typeof authInitData.data?.url === 'string', 'Returns authorization URL');
    assert(typeof authInitData.data?.state === 'string', 'Returns state parameter');

    // Test Google Error / Denial handling
    const deniedCallbackRes = await fetch(
      `${API_BASE}/auth/google/callback?error=access_denied&state=${authInitData.data.state}`,
      { redirect: 'manual' }
    );
    const deniedRedirect = deniedCallbackRes.headers.get('location');
    assert(
      deniedRedirect && deniedRedirect.includes('auth_status=error'),
      'User cancellation redirects with auth_status=error'
    );
    assert(
      deniedRedirect && deniedRedirect.includes('cancelled'),
      'Error redirect includes user cancellation notice'
    );

    // Test Invalid State handling
    const badStateRes = await fetch(
      `${API_BASE}/auth/google/callback?code=mock_code&state=nonexistent_state_xyz`,
      { redirect: 'manual' }
    );
    const badStateRedirect = badStateRes.headers.get('location');
    assert(
      badStateRedirect && badStateRedirect.includes('auth_status=error'),
      'Invalid state redirects with auth_status=error'
    );

    // Test Mocked Successful Callback & Session Handoff
    const validFlowUrl = googleOAuthService.createAuthorizationUrl();
    const validFlowState = validFlowUrl.state;

    // Use mock fetch for token exchange during HTTP callback test
    global.fetch = async (url, options = {}) => {
      if (url === GOOGLE_OAUTH_CONFIG.tokenEndpoint) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'mock_flow_access_token_999',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        };
      }
      if (url === GOOGLE_OAUTH_CONFIG.userInfoEndpoint) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sub: `flow_google_sub_${timestamp}`,
            name: 'Flow Test User',
            email: `${testPrefix}_flow@gmail.com`,
            email_verified: true,
            picture: 'https://images.unsplash.com/flow_avatar',
          }),
        };
      }
      return originalFetch(url, options);
    };

    try {
      process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock_flow_secret';

      const callbackRes = await fetch(
        `${API_BASE}/auth/google/callback?code=mock_flow_code&state=${validFlowState}`,
        { redirect: 'manual' }
      );
      const callbackRedirect = callbackRes.headers.get('location');
      assert(
        callbackRedirect && callbackRedirect.includes('auth_status=success'),
        'Successful callback redirects to frontend with auth_status=success'
      );
      assert(
        callbackRedirect && !callbackRedirect.includes('token='),
        'Callback redirect strictly avoids token= parameter (JWT not in URL)'
      );
      assert(
        callbackRedirect && callbackRedirect.includes('ticket='),
        'Callback redirect includes single-use handoff ticket'
      );

      // Extract ticket from redirect URL
      const redirectUrlObj = new URL(callbackRedirect);
      const receivedTicket = redirectUrlObj.searchParams.get('ticket');
      assert(Boolean(receivedTicket), 'Handoff ticket extracted successfully');

      // Test POST /api/auth/google/exchange
      const exchangeRes = await fetch(`${API_BASE}/auth/google/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: receivedTicket }),
      });
      const exchangeData = await exchangeRes.json();
      assert(exchangeRes.status === 200, 'POST /api/auth/google/exchange returns HTTP 200');
      assert(exchangeData.success === true, 'Exchange response success: true');
      assert(Boolean(exchangeData.data?.token), 'Exchange delivers authenticated CHESS JEENO JWT');
      assert(exchangeData.data?.user?.email === `${testPrefix}_flow@gmail.com`, 'User profile delivered via exchange');
      createdUserIds.push(exchangeData.data.user._id);

      // Verify ticket is destroyed after use
      const reusedExchangeRes = await fetch(`${API_BASE}/auth/google/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: receivedTicket }),
      });
      assert(reusedExchangeRes.status === 400, 'Reused ticket exchange rejected with HTTP 400');
    } finally {
      global.fetch = originalFetch;
      process.env.GOOGLE_CLIENT_ID = origClientId;
    }

    // =========================================================================
    // 10. Security Audit & Credential Protection
    // =========================================================================
    console.log('\n--- 10. Security Audit & Token Privacy ---');
    const testGoogleUser = await User.findOne({ email: newGoogleEmail }).select('+passwordHash +googleId');
    assert(testGoogleUser.passwordHash === null, 'Google user document does not contain password hash');
    assert(!testGoogleUser.googleAccessToken, 'Google access token is NOT stored on User document');
    assert(!testGoogleUser.googleRefreshToken, 'Google refresh token is NOT stored on User document');

    const jsonOutput = testGoogleUser.toJSON();
    assert(jsonOutput.passwordHash === undefined, 'JSON serialization strictly removes passwordHash');
    assert(jsonOutput.__v === undefined, 'JSON serialization excludes __v');

    console.log('\n==================================================');
    console.log(`🎉 ALL ${passedTests} GOOGLE OAUTH TESTS PASSED (0 failed out of ${totalTests} assertions)!`);
    console.log('==================================================\n');
  } finally {
    console.log('🧹 Cleaning up test users and closing test server...');
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await testServer.close();
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
};

runGoogleOAuthTests().catch((err) => {
  console.error('\n❌ Uncaught error during Google OAuth tests:', err);
  process.exit(1);
});
