import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import * as lichessOAuthService from '../services/lichessOAuthService.js';
import lichessService, { setMockTransport } from '../services/lichessService.js';
import * as pairingService from '../services/pairingService.js';
import * as roundService from '../services/roundService.js';
import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import * as tournamentService from '../services/tournamentService.js';
import { getTokenForUser } from '../config/lichess.js';

dotenv.config();

const runPlayOnLichessTests = async () => {
  console.log('🧪 Starting Phase 1: Play On Lichess End-to-End Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `phase1_test_${timestamp}`;
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
    // -------------------------------------------------------------------------
    // Setup Users: Host, Player White, Player Black, Third-Party Spectator
    // -------------------------------------------------------------------------
    console.log('--- Setting Up Test Accounts ---');

    const hostUser = await User.create({
      name: 'Tournament Host',
      email: `${testPrefix}_host@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'host_organizer_lic',
      lichessUserId: 'host_organizer_lic',
      lichessOAuth: {
        accessToken: 'oauth_token_host_organizer_secret',
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(hostUser._id);

    const whitePlayerUser = await User.create({
      name: 'Player White Grandmaster',
      email: `${testPrefix}_white@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'white_gm_player',
      lichessUserId: 'white_gm_player',
      lichessOAuth: {
        accessToken: 'oauth_token_white_gm_player_secret',
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(whitePlayerUser._id);

    const blackPlayerUser = await User.create({
      name: 'Player Black Master',
      email: `${testPrefix}_black@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'black_master_player',
      lichessUserId: 'black_master_player',
      lichessOAuth: {
        accessToken: 'oauth_token_black_master_player_secret',
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(blackPlayerUser._id);

    const spectatorUser = await User.create({
      name: 'Random Spectator',
      email: `${testPrefix}_spectator@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'spectator_user_lic',
      lichessUserId: 'spectator_user_lic',
      lichessOAuth: {
        accessToken: 'oauth_token_spectator_secret',
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(spectatorUser._id);

    console.log('  -> Accounts created.\n');

    // -------------------------------------------------------------------------
    // TEST 1: Production Mode Blocks Dev Bridge & Token Map Fallbacks
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Strict Production Isolation ---');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      // 1a. getTokenForUser must return null in production
      const devTokenResult = getTokenForUser('pavakka_ib');
      assert(devTokenResult === null, '1a. getTokenForUser returns null in production');

      // 1b. resolveLichessPlayerCredentials must reject users without OAuth tokens even if allowDevBridge is set
      const unlinkedUser = await User.create({
        name: 'Unlinked Dev Player',
        email: `${testPrefix}_unlinked@chessjeeno.local`,
        passwordHash: 'dummy_hash',
        authProvider: 'local',
        lichessUsername: 'pavakka_ib',
      });
      createdUserIds.push(unlinkedUser._id);

      let bridgeBlocked = false;
      try {
        await lichessOAuthService.resolveLichessPlayerCredentials(unlinkedUser._id, {
          allowDevBridge: true,
        });
      } catch (err) {
        bridgeBlocked = true;
        assert(err.statusCode === 400, '1b. Dev bridge blocked in production returns HTTP 400');
        assert(
          err.message.includes('has not connected a valid Lichess account via OAuth'),
          '1b. Error indicates OAuth requirement'
        );
      }
      assert(bridgeBlocked, '1b. Fallback to dev bridge strictly forbidden in production');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }

    // -------------------------------------------------------------------------
    // Setup Tournament & Pairing: White vs Black
    // -------------------------------------------------------------------------
    console.log('\n--- Setting Up Tournament & Round 1 Pairing ---');

    const tournament = await tournamentService.createTournament(
      {
        name: `${testPrefix} Championship`,
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 2,
        rated: false,
        maxPlayers: 2,
      },
      hostUser._id
    );
    createdTournamentIds.push(tournament._id);

    await tournamentPlayerService.joinTournament(tournament._id, whitePlayerUser._id);
    await tournamentPlayerService.joinTournament(tournament._id, blackPlayerUser._id);

    const roundData = await roundService.createRound(tournament._id, hostUser._id);
    const pairing = roundData.pairings[0];
    assert(Boolean(pairing), 'Round 1 pairing created');

    // Ensure whitePlayer is whitePlayerUser and blackPlayer is blackPlayerUser
    // If round robin inverted them, swap references to be precise
    let actualWhiteId = pairing.whitePlayer?._id || pairing.whitePlayer;
    let actualBlackId = pairing.blackPlayer?._id || pairing.blackPlayer;
    let whiteExpectedUsername = actualWhiteId.toString() === whitePlayerUser._id.toString()
      ? 'white_gm_player'
      : 'black_master_player';
    let blackExpectedUsername = actualBlackId.toString() === blackPlayerUser._id.toString()
      ? 'black_master_player'
      : 'white_gm_player';
    let whiteExpectedToken = actualWhiteId.toString() === whitePlayerUser._id.toString()
      ? 'oauth_token_white_gm_player_secret'
      : 'oauth_token_black_master_player_secret';
    let blackExpectedToken = actualBlackId.toString() === blackPlayerUser._id.toString()
      ? 'oauth_token_black_master_player_secret'
      : 'oauth_token_white_gm_player_secret';

    // -------------------------------------------------------------------------
    // TEST 2: Host Identity Cannot Replace Paired Player's Identity
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Host Cannot Accidentally Replace Paired Player Identity ---');

    let capturedLichessCall = null;
    setMockTransport(async (params) => {
      capturedLichessCall = params;
      return {
        gameId: 'lichess_match_phase1_456',
        gameUrl: 'https://lichess.org/lichess_match_phase1_456',
      };
    });

    // The HOST initiates the game creation for the pairing
    const updatedPairing = await pairingService.createLichessGameForPairing(
      tournament._id,
      1,
      pairing._id,
      {},
      hostUser._id // Host creates the game
    );

    assert(Boolean(updatedPairing), '2a. Game creation succeeded');
    assert(Boolean(capturedLichessCall), '2b. Lichess API was invoked');

    // Verify player identities: MUST be White and Black, NOT the host!
    assert(
      capturedLichessCall.whiteUsername === whiteExpectedUsername,
      `2c. Correct White identity preserved: ${capturedLichessCall.whiteUsername}`
    );
    assert(
      capturedLichessCall.blackUsername === blackExpectedUsername,
      `2d. Correct Black identity preserved: ${capturedLichessCall.blackUsername}`
    );
    assert(
      capturedLichessCall.whiteUsername !== 'host_organizer_lic' &&
        capturedLichessCall.blackUsername !== 'host_organizer_lic',
      '2e. Host Lichess identity was NOT substituted into the match'
    );

    // Verify colors: White player token is FIRST, Black player token is SECOND
    assert(
      capturedLichessCall.whiteToken === whiteExpectedToken,
      '2f. Correct White player OAuth token provided'
    );
    assert(
      capturedLichessCall.blackToken === blackExpectedToken,
      '2g. Correct Black player OAuth token provided'
    );
    assert(
      capturedLichessCall.playersPayload === `${whiteExpectedToken}:${blackExpectedToken}`,
      '2h. Lichess bulk-pairing payload enforces White:Black token order'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Correct Game ID and Game URL Persistence
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Correct Game ID & URL Persistence ---');

    assert(
      updatedPairing.lichessGameId === 'lichess_match_phase1_456',
      '3a. Correct game ID persisted on pairing'
    );
    assert(
      updatedPairing.lichessGameUrl === 'https://lichess.org/lichess_match_phase1_456',
      '3b. Correct game URL persisted on pairing'
    );
    assert(
      updatedPairing.status === 'ACTIVE',
      '3c. Pairing status transitioned to ACTIVE'
    );
    assert(
      updatedPairing.result === 'PENDING',
      '3d. Pairing result remained PENDING'
    );

    // -------------------------------------------------------------------------
    // TEST 4: No Lichess Tokens Stored in Pairing Document
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Security Audit - Zero Tokens in Pairing Documents ---');

    const rawPairingDoc = await Pairing.findById(pairing._id).lean();
    assert(rawPairingDoc.accessToken === undefined, '4a. No accessToken in pairing document');
    assert(rawPairingDoc.token === undefined, '4b. No token in pairing document');
    assert(rawPairingDoc.whiteToken === undefined, '4c. No whiteToken in pairing document');
    assert(rawPairingDoc.blackToken === undefined, '4d. No blackToken in pairing document');

    const pairingString = JSON.stringify(rawPairingDoc);
    assert(
      !pairingString.includes('oauth_token_white') &&
        !pairingString.includes('oauth_token_black') &&
        !pairingString.includes('oauth_token_host'),
      '4e. Serialized pairing JSON contains zero OAuth credentials'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Paired Players Can Create Their Own Match & Unauthorized Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Player Self-Creation & Spectator Rejection ---');

    // Create a 2nd tournament with fresh pairing to test player self-creation
    const tourney2 = await tournamentService.createTournament(
      {
        name: `${testPrefix} Player Launch Tourney`,
        format: 'ROUND_ROBIN',
        clockLimit: 600,
        increment: 0,
        maxPlayers: 2,
      },
      hostUser._id
    );
    createdTournamentIds.push(tourney2._id);

    await tournamentPlayerService.joinTournament(tourney2._id, whitePlayerUser._id);
    await tournamentPlayerService.joinTournament(tourney2._id, blackPlayerUser._id);

    const roundData2 = await roundService.createRound(tourney2._id, hostUser._id);
    const pairing2 = roundData2.pairings[0];

    // 5a. Unauthorized third-party spectator receives 403 Forbidden
    let spectatorBlocked = false;
    try {
      await pairingService.createLichessGameForPairing(
        tourney2._id,
        1,
        pairing2._id,
        {},
        spectatorUser._id // Spectator is neither Host, nor White, nor Black
      );
    } catch (err) {
      spectatorBlocked = true;
      assert(err.statusCode === 403, '5a. Spectator rejected with HTTP 403');
      assert(
        err.message.includes('You are not authorized to create a Lichess game for this pairing'),
        '5a. Correct authorization error message'
      );
    }
    assert(spectatorBlocked, '5a. Third-party spectator successfully blocked from creating game');

    // 5b. Paired White player CAN create their own match
    const p2WhiteId = pairing2.whitePlayer?._id || pairing2.whitePlayer;
    setMockTransport(async (params) => {
      return {
        gameId: 'lichess_player_created_789',
        gameUrl: 'https://lichess.org/lichess_player_created_789',
      };
    });

    const playerCreatedPairing = await pairingService.createLichessGameForPairing(
      tourney2._id,
      1,
      pairing2._id,
      {},
      p2WhiteId // White player creates their own match!
    );
    assert(Boolean(playerCreatedPairing), '5b. Paired player successfully created match');
    assert(
      playerCreatedPairing.lichessGameId === 'lichess_player_created_789',
      '5b. Correct game ID persisted when player initiated game creation'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Prevent Identical Players / Token Collisions
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Token Collision & Self-Pairing Prevention ---');

    let collisionBlocked = false;
    try {
      await lichessService.createGame({
        whiteUsername: 'same_player',
        blackUsername: 'same_player',
        clockLimit: 300,
        increment: 0,
        whiteToken: 'same_token_123',
        blackToken: 'same_token_123',
      });
    } catch (err) {
      collisionBlocked = true;
      assert(err.statusCode === 400, '6a. Identical tokens rejected with HTTP 400');
      assert(
        err.message.includes('White and Black tokens cannot be identical'),
        '6b. Clear token collision error'
      );
    }
    assert(collisionBlocked, '6. Identical tokens prevented');

    console.log('\n==================================================');
    console.log(`📊 Phase 1 Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
  } finally {
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

runPlayOnLichessTests().catch((err) => {
  console.error('\n❌ Uncaught error during Phase 1 test suite:', err);
  process.exit(1);
});
