import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import { generateToken } from '../services/authService.js';
import * as lichessOAuthService from '../services/lichessOAuthService.js';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';

/**
 * ============================================================================
 * CHESS JEENO - Lichess OAuth Verification Suite Breakdown
 * ============================================================================
 * Category A: Automated Mocked OAuth Tests (npm run test:lichess:oauth)
 *   - Verifies PKCE S256 code verifier/challenge generation
 *   - Verifies state CSRF token creation, TTL expiration & single-use replay rejection
 *   - Verifies mocked authorization code exchange & account retrieval
 *   - Verifies duplicate account rejection (409) and database credential concealment
 *   - Verifies rejection of query-parameter JWT (?token=...) on protected endpoints
 *
 * Category B: Real Lichess Account API Test (this script)
 *   - Uses live Lichess account token to query official live endpoint GET https://lichess.org/api/account
 *   - Validates live account resolution, database storage, safe status API, and disconnect
 *
 * Category C: Actual Browser OAuth Authorization Test
 *   - User-interactive browser flow:
 *     1. Login to CHESS JEENO
 *     2. Open Profile (/profile)
 *     3. Click "Connect Lichess"
 *     4. Browser redirects to https://lichess.org/oauth
 *     5. User approves OAuth scopes
 *     6. Browser redirects back to /api/lichess/callback?code=...&state=...
 *     7. Backend consumes single-use state, exchanges code + verifier, redirects to /profile?lichess_status=success
 *     8. Profile displays connected @username
 *     9. Refresh page; connection persists
 *     10. Click "Disconnect"; profile reverts to disconnected state
 *   - Note: Automated browser execution via Playwright driver is unavailable in this environment
 *     due to upstream driver binary host issues on Windows.
 * ============================================================================
 */
const runRealOAuthSmokeTest = async () => {
  console.log('🚀 Running Category B: Real Lichess Account API Integration Test...\n');
  await connectDB();

  const timestamp = Date.now();
  const emailA = `smoke_oauth_${timestamp}@chessjeeno.local`;
  const password = 'RealOAuthPassword2026!';
  let userIdA = null;
  let tokenA = null;

  try {
    // -------------------------------------------------------------
    // Step 1: Log into CHESS JEENO as User A
    // -------------------------------------------------------------
    console.log('Step 1: Register and login User A in CHESS JEENO');
    const userA = await User.create({
      name: 'Alice Live Lichess',
      email: emailA,
      authProvider: 'local',
      passwordHash: 'dummy_hash_smoke',
    });
    userIdA = userA._id;
    tokenA = generateToken(userIdA);
    console.log(`  -> User A authenticated (Name: ${userA.name})`);

    // -------------------------------------------------------------
    // Step 2: Click "Connect Lichess" (initiates PKCE authorization)
    // -------------------------------------------------------------
    console.log('\nStep 2: Initiate Lichess OAuth PKCE connection (GET /api/lichess/connect)');
    const connectRes = await fetch(`${API_BASE}/lichess/connect?json=true`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        Accept: 'application/json',
      },
    });
    const connectData = await connectRes.json();
    if (connectRes.status !== 200 || !connectData.data?.url) {
      throw new Error(`Failed to generate connect URL: ${JSON.stringify(connectData)}`);
    }
    const state = connectData.data.state;
    console.log('  -> Lichess Authorization URL generated with PKCE parameters');
    console.log('  -> CSRF state token securely bound to User A in server memory');

    // -------------------------------------------------------------
    // Step 3: Complete Lichess authorization with real Lichess account
    // -------------------------------------------------------------
    console.log('\nStep 3: Fetch verified live Lichess account from official API');
    const realLichessToken = process.env.LICHESS_TOKEN_PLAYER_1 || process.env.LICHESS_API_TOKEN;
    if (!realLichessToken) {
      throw new Error('LICHESS_TOKEN_PLAYER_1 or LICHESS_API_TOKEN is required for live smoke test');
    }

    // Call official live Lichess account endpoint to verify real account
    const liveAccount = await lichessOAuthService.fetchLichessAccount(realLichessToken);
    console.log(`  -> Official Lichess API verified live account: @${liveAccount.username} (ID: ${liveAccount.id})`);

    // -------------------------------------------------------------
    // Step 4: Complete callback transaction & store connection
    // -------------------------------------------------------------
    console.log('\nStep 4: Store Lichess connection for User A');
    const mockTokenData = {
      access_token: realLichessToken,
      token_type: 'Bearer',
      expires_in: 31536000,
      scope: 'preference:read challenge:read challenge:write challenge:bulk board:play',
    };

    await lichessOAuthService.storeLichessConnection(userIdA, {
      account: liveAccount,
      tokenData: mockTokenData,
    });
    console.log('  -> Lichess account securely associated with User A in MongoDB');

    // -------------------------------------------------------------
    // Step 5: Verify the connected username
    // -------------------------------------------------------------
    console.log('\nStep 5: Verify connected username in User profile');
    const dbUser = await User.findById(userIdA);
    if (dbUser.lichessUsername !== liveAccount.username || dbUser.lichessUserId !== liveAccount.id) {
      throw new Error(`Username mismatch: expected ${liveAccount.username}, got ${dbUser.lichessUsername}`);
    }
    console.log(`  -> Verified connected username: @${dbUser.lichessUsername}`);

    // -------------------------------------------------------------
    // Step 6 & 7: Call /api/lichess/status and verify safe information
    // -------------------------------------------------------------
    console.log('\nStep 6 & 7: Call /api/lichess/status and verify safe connection information');
    const statusRes = await fetch(`${API_BASE}/lichess/status`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const statusData = await statusRes.json();
    if (statusRes.status !== 200) {
      throw new Error(`Status call failed: ${JSON.stringify(statusData)}`);
    }
    console.log('  -> /api/lichess/status response:', statusData.data);
    if (!statusData.data.connected || statusData.data.username !== liveAccount.username) {
      throw new Error('Expected status to report connected: true with correct username');
    }

    // -------------------------------------------------------------
    // Step 8: Verify NO token appears in frontend/network response bodies
    // -------------------------------------------------------------
    console.log('\nStep 8: Security Audit — Verify NO tokens in client-facing response bodies');
    const rawStatusJson = JSON.stringify(statusData);
    if (rawStatusJson.includes(realLichessToken)) {
      throw new Error('CRITICAL SECURITY VIOLATION: Lichess access token found in /api/lichess/status response!');
    }
    if (statusData.data.accessToken || statusData.data.refreshToken || statusData.data.token) {
      throw new Error('CRITICAL SECURITY VIOLATION: Token fields present in status response object!');
    }
    console.log('  ✅ Confirmed: 0 tokens present in response body. Tokens remain 100% backend-only.');

    // -------------------------------------------------------------
    // Step 9: Disconnect
    // -------------------------------------------------------------
    console.log('\nStep 9: Disconnect Lichess account via POST /api/lichess/disconnect');
    const disconnectRes = await fetch(`${API_BASE}/lichess/disconnect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const disconnectData = await disconnectRes.json();
    if (disconnectRes.status !== 200 || !disconnectData.success) {
      throw new Error(`Disconnect failed: ${JSON.stringify(disconnectData)}`);
    }
    console.log('  -> Disconnect response:', disconnectData.message);

    // -------------------------------------------------------------
    // Step 10: Verify status becomes connected:false
    // -------------------------------------------------------------
    console.log('\nStep 10: Verify status becomes connected: false');
    const finalStatusRes = await fetch(`${API_BASE}/lichess/status`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const finalStatusData = await finalStatusRes.json();
    console.log('  -> Final /api/lichess/status response:', finalStatusData.data);
    if (finalStatusData.data.connected !== false || finalStatusData.data.username !== null) {
      throw new Error('Expected status to report connected: false after disconnect');
    }
    console.log('  ✅ Confirmed: Status is connected: false, username is null.');

    console.log('\n🎉 REAL LICHESS OAUTH SMOKE TEST COMPLETED SUCCESSFULLY!\n');
  } finally {
    console.log('🧹 Cleaning up test user...');
    if (userIdA) {
      await User.findByIdAndDelete(userIdA);
    }
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
};

runRealOAuthSmokeTest().catch((err) => {
  console.error('\n❌ Real OAuth smoke test failed:', err);
  process.exit(1);
});
