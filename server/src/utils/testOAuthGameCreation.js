import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import { generateToken } from '../services/authService.js';
import * as lichessOAuthService from '../services/lichessOAuthService.js';
import lichessService, { setMockTransport } from '../services/lichessService.js';
import * as pairingService from '../services/pairingService.js';
import * as roundService from '../services/roundService.js';
import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import * as tournamentService from '../services/tournamentService.js';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';

const runOAuthGameCreationTests = async () => {
  console.log('🧪 Starting Milestone 11: OAuth Game Creation Test Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `oauth_game_test_${timestamp}`;
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
    // Setup Test Users
    // =========================================================================
    console.log('--- Setting Up Test Users ---');

    // User A: Host, connected via OAuth
    const userA = await User.create({
      name: 'Alice Host',
      email: `${testPrefix}_alice@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'alice_oauth_lic',
      lichessUserId: 'alice_oauth_lic',
      lichessOAuth: {
        accessToken: 'oauth_access_token_alice_secret_999',
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(userA._id);
    const tokenA = generateToken(userA._id);

    // User B: Player, connected via OAuth
    const userB = await User.create({
      name: 'Bob Participant',
      email: `${testPrefix}_bob@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'bob_oauth_lic',
      lichessUserId: 'bob_oauth_lic',
      lichessOAuth: {
        accessToken: 'oauth_access_token_bob_secret_888',
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(userB._id);
    const tokenB = generateToken(userB._id);

    // User C: Player without Lichess connection
    const userC = await User.create({
      name: 'Charlie Unconnected',
      email: `${testPrefix}_charlie@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: null,
      lichessUserId: null,
    });
    createdUserIds.push(userC._id);
    const tokenC = generateToken(userC._id);

    // User D: Player with username but incomplete OAuth (missing token)
    const userD = await User.create({
      name: 'Dan Incomplete',
      email: `${testPrefix}_dan@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'dan_lic_no_token',
      lichessUserId: 'dan_lic_no_token',
      lichessOAuth: {
        accessToken: null,
      },
    });
    createdUserIds.push(userD._id);

    // User E: Non-owner / unauthorized user
    const userE = await User.create({
      name: 'Eve Unauthorized',
      email: `${testPrefix}_eve@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
    });
    createdUserIds.push(userE._id);
    const tokenE = generateToken(userE._id);

    console.log('  -> Test users created successfully.');

    // =========================================================================
    // SECTION 1: OAuth Credential Resolution Tests (Steps 1-5)
    // =========================================================================
    console.log('\n--- SECTION 1: OAuth Credential Resolution ---');

    // 1. User with OAuth connection resolves successfully
    const credsA = await lichessOAuthService.resolveLichessPlayerCredentials(userA._id);
    assert(credsA.userId === userA._id.toString(), '1. User with OAuth connection resolves user ID');
    assert(credsA.lichessUsername === 'alice_oauth_lic', '1. Resolved correct Lichess username');
    assert(credsA.accessToken === 'oauth_access_token_alice_secret_999', '1. Resolved correct OAuth access token');
    assert(credsA.source === 'oauth', '1. Source is verified as "oauth"');

    // 2. User without OAuth connection fails with clear error
    let unconnErrorCaught = false;
    try {
      await lichessOAuthService.resolveLichessPlayerCredentials(userC._id);
    } catch (err) {
      unconnErrorCaught = true;
      assert(err.statusCode === 400, '2. User without OAuth connection returns HTTP 400');
      assert(err.message.includes('Player has not connected a Lichess account'), '2. Safe clear error message');
    }
    assert(unconnErrorCaught, '2. Unconnected player resolution was rejected');

    // 3. User with missing access token fails
    let missingTokenErrorCaught = false;
    try {
      await lichessOAuthService.resolveLichessPlayerCredentials(userD._id);
    } catch (err) {
      missingTokenErrorCaught = true;
      assert(err.statusCode === 400, '3. User with missing access token returns HTTP 400');
      assert(err.message.includes('Lichess connection is incomplete') || err.message.includes('Player has not connected'), '3. Incomplete connection message');
    }
    assert(missingTokenErrorCaught, '3. Missing token was rejected');

    // 4. Lichess username is resolved directly from the database
    assert(credsA.lichessUsername === userA.lichessUsername, '4. Lichess username resolved from DB');
    assert(credsA.lichessUserId === userA.lichessUserId, '4. Lichess userId resolved from DB');

    // 5. OAuth token is never included in User JSON / API serialization
    const normalUserA = await User.findById(userA._id);
    const serializedUser = JSON.parse(JSON.stringify(normalUserA));
    assert(serializedUser.lichessOAuth?.accessToken === undefined, '5. Access token excluded from JSON serialization');
    assert(normalUserA.lichessOAuth?.accessToken === undefined, '5. Access token excluded from default Mongoose query');

    // =========================================================================
    // SECTION 2: Game Creation via OAuth Credentials (Steps 6-13)
    // =========================================================================
    console.log('\n--- SECTION 2: Tournament & Game Creation via OAuth ---');

    // Create tournament owned by User A
    const tourney1 = await tournamentService.createTournament(
      {
        name: `${testPrefix} Championship`,
        description: 'Testing OAuth Game Creation',
        format: 'ROUND_ROBIN',
        rated: false,
        clockLimit: 300,
        increment: 2,
        maxPlayers: 2,
      },
      userA._id
    );
    createdTournamentIds.push(tourney1._id);

    // Register User A and User B
    await tournamentPlayerService.joinTournament(tourney1._id, userA._id);
    await tournamentPlayerService.joinTournament(tourney1._id, userB._id);

    // Create Round 1
    const roundResult1 = await roundService.createRound(tourney1._id, userA._id);
    const pairing1 = roundResult1.pairings[0];
    assert(Boolean(pairing1?._id), 'Round 1 created with pairing');

    // Mock transport to capture API parameters sent to Lichess
    let capturedLichessCall = null;
    setMockTransport(async (params) => {
      capturedLichessCall = params;
      return {
        gameId: 'lic_oauth_game_123',
        gameUrl: 'https://lichess.org/lic_oauth_game_123',
      };
    });

    // 6. Authenticated host can create a game using OAuth credentials
    const updatedPairing1 = await pairingService.createLichessGameForPairing(
      tourney1._id,
      1,
      pairing1._id,
      {},
      userA._id
    );
    assert(Boolean(updatedPairing1), '6. Game creation succeeded');
    assert(updatedPairing1.lichessGameId === 'lic_oauth_game_123', '6. Stored lichessGameId');
    assert(
      updatedPairing1.lichessGameUrl === 'https://lichess.org/lic_oauth_game_123',
      '6. Stored lichessGameUrl'
    );

    // Verify mock transport received both players' OAuth tokens
    assert(Boolean(capturedLichessCall), '6. Lichess API was invoked');
    const expectedTokens = new Set([
      'oauth_access_token_alice_secret_999',
      'oauth_access_token_bob_secret_888',
    ]);
    assert(
      expectedTokens.has(capturedLichessCall.whiteToken) &&
        expectedTokens.has(capturedLichessCall.blackToken),
      '6. Captured call received both players OAuth access tokens'
    );
    assert(
      capturedLichessCall.playersPayload.includes('oauth_access_token_alice_secret_999') &&
        capturedLichessCall.playersPayload.includes('oauth_access_token_bob_secret_888'),
      '6. Payload format uses token:token OAuth credentials'
    );

    // 7. Unauthenticated user receives 401
    const unauthRes = await fetch(
      `${API_BASE}/tournaments/${tourney1._id}/rounds/1/pairings/${pairing1._id}/lichess`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    assert(unauthRes.status === 401, '7. Unauthenticated request receives HTTP 401');

    // 8. Unauthorized user receives 403
    const unauthzRes = await fetch(
      `${API_BASE}/tournaments/${tourney1._id}/rounds/1/pairings/${pairing1._id}/lichess`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenE}`, // User E is not tournament creator
          'Content-Type': 'application/json',
        },
      }
    );
    assert(unauthzRes.status === 403, '8. Unauthorized user receives HTTP 403');

    // 9. Missing player OAuth connection returns safe 400
    // Create second tournament with User A and User C (unconnected)
    const tourneyUnconn = await tournamentService.createTournament(
      {
        name: `${testPrefix} Unconnected Tourney`,
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 2,
      },
      userA._id
    );
    createdTournamentIds.push(tourneyUnconn._id);
    await tournamentPlayerService.joinTournament(tourneyUnconn._id, userA._id);
    await tournamentPlayerService.joinTournament(tourneyUnconn._id, userC._id);
    const roundUnconn = await roundService.createRound(tourneyUnconn._id, userA._id);
    const pairingUnconn = roundUnconn.pairings[0];

    const unconnGameRes = await fetch(
      `${API_BASE}/tournaments/${tourneyUnconn._id}/rounds/1/pairings/${pairingUnconn._id}/lichess`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const unconnGameData = await unconnGameRes.json();
    assert(unconnGameRes.status === 400, '9. Missing player OAuth connection returns HTTP 400');
    assert(
      unconnGameData.message.includes('Player has not connected a Lichess account') ||
        unconnGameData.message.includes('Both players must have linked Lichess usernames'),
      '9. Safe error message for unconnected player'
    );

    // 10. Duplicate game remains blocked
    const dupGameRes = await fetch(
      `${API_BASE}/tournaments/${tourney1._id}/rounds/1/pairings/${pairing1._id}/lichess`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
      }
    );
    assert(dupGameRes.status === 400, '10. Duplicate game creation rejected with HTTP 400');

    // 11. Pairing state transitions remain correct
    const dbPairing1 = await Pairing.findById(pairing1._id);
    assert(dbPairing1.status === 'ACTIVE', '11. Pairing status transitioned to ACTIVE');
    assert(dbPairing1.result === 'PENDING', '11. Pairing result remained PENDING');

    // 12. Lichess response is stored correctly
    assert(dbPairing1.lichessGameId === 'lic_oauth_game_123', '12. Lichess gameId stored correctly');
    assert(
      dbPairing1.lichessGameUrl === 'https://lichess.org/lic_oauth_game_123',
      '12. Lichess gameUrl stored correctly'
    );

    // 13. OAuth tokens are never stored in Pairing
    assert(dbPairing1.accessToken === undefined, '13. No accessToken field in Pairing document');
    assert(dbPairing1.token === undefined, '13. No token field in Pairing document');
    const rawPairingJson = JSON.stringify(dbPairing1);
    assert(!rawPairingJson.includes('oauth_access_token'), '13. No token values in serialized Pairing JSON');

    // =========================================================================
    // SECTION 3: Security & Concealment (Steps 14-16)
    // =========================================================================
    console.log('\n--- SECTION 3: Security & Concealment ---');

    // 14. Confirm tokens are not printed in API responses or errors
    assert(!JSON.stringify(updatedPairing1).includes('oauth_access_token'), '14. No tokens in game creation response');
    assert(!JSON.stringify(unconnGameData).includes('oauth_access_token'), '14. No tokens in error response');

    // 15. /api/auth/me still excludes OAuth credentials
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, '15. /api/auth/me returns 200');
    assert(meData.data?.user?.lichessOAuth?.accessToken === undefined, '15. /api/auth/me excludes accessToken');
    assert(!JSON.stringify(meData).includes('oauth_access_token'), '15. /api/auth/me JSON contains zero tokens');

    // 16. /api/lichess/status still excludes OAuth credentials
    const statusRes = await fetch(`${API_BASE}/lichess/status`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const statusData = await statusRes.json();
    assert(statusRes.status === 200, '16. /api/lichess/status returns 200');
    assert(statusData.data?.connected === true, '16. Status reports connected: true');
    assert(statusData.data?.username === 'alice_oauth_lic', '16. Status reports correct username');
    assert(statusData.data?.accessToken === undefined, '16. Status excludes accessToken');
    assert(!JSON.stringify(statusData).includes('oauth_access_token'), '16. /api/lichess/status JSON contains zero tokens');

    // =========================================================================
    // SECTION 4: Round-Level Game Creation
    // =========================================================================
    console.log('\n--- SECTION 4: Round-Level Game Creation ---');
    const bulkRoundData = await pairingService.createAllLichessGamesForRound(
      tourney1._id,
      1,
      {},
      userA._id
    );
    assert(bulkRoundData.skipped === 1, 'Round-level creation skips already-created game');
    assert(bulkRoundData.created === 0, 'No new games created when all already exist');

    // Reset mock transport to null
    setMockTransport(null);

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up test data...');
    if (createdTournamentIds.length > 0) {
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Round.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Pairing.deleteMany({ tournamentId: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    setMockTransport(null);
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
};

runOAuthGameCreationTests().catch((err) => {
  console.error('\n❌ Uncaught error during OAuth game creation tests:', err);
  process.exit(1);
});
