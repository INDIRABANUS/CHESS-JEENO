import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { io as ClientIO } from 'socket.io-client';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import { generateToken } from '../services/authService.js';
import { setMockExportTransport } from '../services/lichessService.js';
import * as pairingService from '../services/pairingService.js';
import * as standingsService from '../services/standingsService.js';
import * as roundService from '../services/roundService.js';
import { initSocketServer, closeSocketServer } from '../realtime/socket.js';
import {
  startStream,
  stopStream,
  stopAllStreams,
  hasStream,
  getActiveStreamsCount,
  setMockStreamTransport,
  MAX_RECONNECT_ATTEMPTS,
} from '../realtime/gameStreamManager.js';
import { normalizeStreamEvent } from '../realtime/eventNormalizer.js';

dotenv.config();

const runRealtimeTestSuite = async () => {
  console.log('🧪 Starting Milestone 12: Realtime Lichess Game Updates Test Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `realtime_test_${timestamp}`;
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

  // Start dedicated test HTTP server for Socket.IO
  const testHttpServer = http.createServer();
  const testIo = initSocketServer(testHttpServer);
  const TEST_PORT = 5099;

  await new Promise((resolve) => {
    testHttpServer.listen(TEST_PORT, resolve);
  });
  console.log(`⚡ Test Socket.IO server running on port ${TEST_PORT}\n`);

  const serverUrl = `http://localhost:${TEST_PORT}`;

  try {
    // =========================================================================
    // Setup Test Users
    // =========================================================================
    console.log('--- Setting Up Test Users ---');

    const userAlice = await User.create({
      name: 'Alice Host',
      email: `${testPrefix}_alice@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'alice_rt_lic',
      lichessUserId: 'alice_rt_lic',
      lichessOAuth: {
        accessToken: 'oauth_token_alice_rt',
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(userAlice._id);

    const userBob = await User.create({
      name: 'Bob Player',
      email: `${testPrefix}_bob@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'bob_rt_lic',
      lichessUserId: 'bob_rt_lic',
      lichessOAuth: {
        accessToken: 'oauth_token_bob_rt',
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(userBob._id);

    const userCharlie = await User.create({
      name: 'Charlie Player',
      email: `${testPrefix}_charlie@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'charlie_rt_lic',
      lichessUserId: 'charlie_rt_lic',
      lichessOAuth: {
        accessToken: 'oauth_token_charlie_rt',
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(userCharlie._id);

    const aliceToken = generateToken(userAlice._id);
    const bobToken = generateToken(userBob._id);

    console.log('  -> Test users setup complete.\n');

    // =========================================================================
    // SECTION 1: Socket Authentication
    // =========================================================================
    console.log('--- SECTION 1: Socket Authentication ---');

    // 1. Valid CHESS JEENO JWT connects
    const socketValid = ClientIO(serverUrl, {
      auth: { token: aliceToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      socketValid.on('connect', resolve);
      socketValid.on('connect_error', reject);
    });
    assert(socketValid.connected === true, '1. Valid CHESS JEENO JWT connects successfully');

    // 2. Missing JWT rejected
    const socketMissing = ClientIO(serverUrl, {
      auth: {},
      transports: ['websocket'],
    });

    const missingError = await new Promise((resolve) => {
      socketMissing.on('connect_error', (err) => resolve(err.message));
    });
    assert(
      missingError.toLowerCase().includes('authentication required') ||
      missingError.toLowerCase().includes('missing token'),
      '2. Missing JWT is rejected with authentication error'
    );
    socketMissing.disconnect();

    // 3. Invalid JWT rejected
    const socketInvalid = ClientIO(serverUrl, {
      auth: { token: 'invalid.jwt.token' },
      transports: ['websocket'],
    });

    const invalidError = await new Promise((resolve) => {
      socketInvalid.on('connect_error', (err) => resolve(err.message));
    });
    assert(
      invalidError.toLowerCase().includes('invalid or expired'),
      '3. Invalid JWT is rejected'
    );
    socketInvalid.disconnect();

    // 4. Query-token JWT rejected
    const socketQueryToken = ClientIO(serverUrl, {
      query: { token: aliceToken },
      auth: {},
      transports: ['websocket'],
    });

    const queryTokenError = await new Promise((resolve) => {
      socketQueryToken.on('connect_error', (err) => resolve(err.message));
    });
    assert(
      queryTokenError.toLowerCase().includes('query-token') ||
      queryTokenError.toLowerCase().includes('prohibited'),
      '4. Query-token JWT ?token= is strictly rejected'
    );
    socketQueryToken.disconnect();

    // =========================================================================
    // SECTION 2: Tournament Rooms
    // =========================================================================
    console.log('\n--- SECTION 2: Tournament Rooms ---');

    // Create public tournament in REGISTRATION status
    const tourneyPublic = await Tournament.create({
      name: `${testPrefix} Public Tournament`,
      format: 'ROUND_ROBIN',
      status: 'REGISTRATION',
      clockLimit: 300,
      increment: 0,
      createdBy: userAlice._id,
    });
    createdTournamentIds.push(tourneyPublic._id);

    // Create private draft tournament owned by Alice
    const tourneyPrivate = await Tournament.create({
      name: `${testPrefix} Private Draft Tournament`,
      format: 'ROUND_ROBIN',
      status: 'DRAFT',
      clockLimit: 300,
      increment: 0,
      createdBy: userAlice._id,
    });
    createdTournamentIds.push(tourneyPrivate._id);

    // 5. Authorized user can join allowed tournament room
    const joinPublicRes = await new Promise((resolve) => {
      socketValid.emit('joinTournament', { tournamentId: tourneyPublic._id.toString() }, resolve);
    });
    assert(joinPublicRes.success === true, '5. Authorized user can join allowed tournament room');
    assert(
      joinPublicRes.room === `tournament:${tourneyPublic._id}`,
      '5. Joined room matches tournament format'
    );

    // 6. Unauthorized/private tournament access rejected
    const socketBob = ClientIO(serverUrl, {
      auth: { token: bobToken },
      transports: ['websocket'],
    });
    await new Promise((resolve, reject) => {
      socketBob.on('connect', resolve);
      socketBob.on('connect_error', reject);
    });

    const joinPrivateRes = await new Promise((resolve) => {
      socketBob.emit('joinTournament', { tournamentId: tourneyPrivate._id.toString() }, resolve);
    });
    assert(joinPrivateRes.success === false, '6. Non-owner cannot join private draft tournament room');
    assert(
      joinPrivateRes.error?.toLowerCase().includes('private') ||
      joinPrivateRes.error?.toLowerCase().includes('access denied'),
      '6. Clear access denied error returned for private room'
    );

    const joinNonexistentRes = await new Promise((resolve) => {
      socketBob.emit(
        'joinTournament',
        { tournamentId: new mongoose.Types.ObjectId().toString() },
        resolve
      );
    });
    assert(joinNonexistentRes.success === false, '6. Nonexistent tournament room join is rejected');

    // 7. Leaving room works
    const leaveRes = await new Promise((resolve) => {
      socketValid.emit('leaveTournament', { tournamentId: tourneyPublic._id.toString() }, resolve);
    });
    assert(leaveRes.success === true, '7. Leaving tournament room works cleanly');

    // 8. Duplicate joins do not create duplicate subscriptions
    const firstJoin = await new Promise((resolve) => {
      socketValid.emit('joinTournament', { tournamentId: tourneyPublic._id.toString() }, resolve);
    });
    assert(firstJoin.success === true, '8. First join succeeds');

    const duplicateJoin = await new Promise((resolve) => {
      socketValid.emit('joinTournament', { tournamentId: tourneyPublic._id.toString() }, resolve);
    });
    assert(duplicateJoin.success === true, '8. Duplicate join returns success');
    assert(duplicateJoin.alreadyJoined === true, '8. Duplicate join flags alreadyJoined without duplicate subscription');

    // Also join Bob into the public tournament room for broadcast testing
    await new Promise((resolve) => {
      socketBob.emit('joinTournament', { tournamentId: tourneyPublic._id.toString() }, resolve);
    });

    // =========================================================================
    // SECTION 3: Stream Manager
    // =========================================================================
    console.log('\n--- SECTION 3: Stream Manager ---');

    stopAllStreams();

    let mockStreamEventCallback = null;
    let mockStreamErrorCallback = null;
    let mockStreamCloseCallback = null;

    setMockStreamTransport(({ lichessGameId, onEvent, onError, onClose }) => {
      mockStreamEventCallback = onEvent;
      mockStreamErrorCallback = onError;
      mockStreamCloseCallback = onClose;
      return {
        stop: () => {},
      };
    });

    // 9. One stream per Lichess game
    const stream1 = await startStream({
      tournamentId: tourneyPublic._id.toString(),
      roundNumber: 1,
      pairingId: new mongoose.Types.ObjectId().toString(),
      lichessGameId: 'stream_test_game_1',
      token: 'fake_token',
    });
    assert(hasStream('stream_test_game_1') === true, '9. One stream created for Lichess game');
    assert(getActiveStreamsCount() === 1, '9. Active streams count is 1');

    // 10. Duplicate stream request reuses existing stream
    const stream2 = await startStream({
      tournamentId: tourneyPublic._id.toString(),
      roundNumber: 1,
      pairingId: new mongoose.Types.ObjectId().toString(),
      lichessGameId: 'stream_test_game_1',
      token: 'fake_token',
    });
    assert(stream1 === stream2, '10. Duplicate stream request reuses existing stream instance');
    assert(getActiveStreamsCount() === 1, '10. Active streams count remains 1');

    // 11. Stream cleanup works
    stopStream('stream_test_game_1');
    assert(hasStream('stream_test_game_1') === false, '11. Stream removed from registry after stop');
    assert(getActiveStreamsCount() === 0, '11. Active streams count is 0 after cleanup');

    // 12. Disconnect does not crash backend
    await startStream({
      tournamentId: tourneyPublic._id.toString(),
      roundNumber: 1,
      pairingId: new mongoose.Types.ObjectId().toString(),
      lichessGameId: 'stream_test_game_disconnect',
      token: 'fake_token',
    });

    let backendSurvived = true;
    try {
      if (mockStreamErrorCallback) {
        mockStreamErrorCallback(new Error('Simulated network disconnect'));
      }
    } catch {
      backendSurvived = false;
    }
    assert(backendSurvived === true, '12. Stream disconnect/error does not crash backend');

    // 13. Reconnect behavior is bounded/safe
    assert(MAX_RECONNECT_ATTEMPTS === 3, '13. Reconnect attempts are bounded at 3 maximum');
    stopStream('stream_test_game_disconnect');

    // =========================================================================
    // SECTION 4: Event Normalization
    // =========================================================================
    console.log('\n--- SECTION 4: Event Normalization ---');

    const testContext = {
      tournamentId: tourneyPublic._id.toString(),
      roundNumber: 1,
      pairingId: new mongoose.Types.ObjectId().toString(),
      lichessGameId: 'norm_game_123',
    };

    // 14. Active game state normalized
    const rawActive = {
      type: 'gameState',
      status: 'started',
      moves: 'e2e4 e7e5 g1f3 b8c6',
      wtime: 294000,
      btime: 297000,
      winc: 0,
      binc: 0,
    };
    const normActive = normalizeStreamEvent(rawActive, testContext);
    assert(normActive !== null, '14. Active game state normalized successfully');
    assert(normActive.eventType === 'GAME_STATE', '14. Event type is GAME_STATE');
    assert(normActive.payload.status === 'started', '14. Status is started');
    assert(normActive.payload.lastMove === 'b8c6', '14. lastMove parsed correctly');
    assert(normActive.payload.clocks.white === 294, '14. White clock converted to seconds');
    assert(normActive.payload.clocks.black === 297, '14. Black clock converted to seconds');

    // 15. Terminal result normalized
    const rawTerminal = {
      type: 'gameState',
      status: 'mate',
      winner: 'white',
      moves: 'e2e4 e7e5 d1h5 e8e7 h5e5',
      wtime: 290000,
      btime: 280000,
    };
    const normTerminal = normalizeStreamEvent(rawTerminal, testContext);
    assert(normTerminal !== null, '15. Terminal state normalized successfully');
    assert(normTerminal.eventType === 'GAME_FINISHED', '15. Event type is GAME_FINISHED');
    assert(normTerminal.payload.result === '1-0', '15. Winner white maps to result 1-0');
    assert(normTerminal.payload.status === 'mate', '15. Status is mate');

    // 16. Aborted game normalized
    const rawAborted = {
      type: 'gameState',
      status: 'aborted',
    };
    const normAborted = normalizeStreamEvent(rawAborted, testContext);
    assert(normAborted !== null, '16. Aborted state normalized successfully');
    assert(normAborted.eventType === 'GAME_ABORTED', '16. Event type is GAME_ABORTED');
    assert(normAborted.payload.result === 'ABORTED', '16. Result is ABORTED');

    // 17. Sensitive fields never appear
    const serializedPayload = JSON.stringify(normTerminal.payload);
    assert(!serializedPayload.includes('accessToken'), '17. No accessToken in normalized payload');
    assert(!serializedPayload.includes('Authorization'), '17. No Authorization header in payload');
    assert(!serializedPayload.includes('token'), '17. No token fields in normalized payload');
    assert(!serializedPayload.includes('passwordHash'), '17. No passwordHash in normalized payload');

    // =========================================================================
    // SECTION 5: Result Integration & Realtime Broadcast
    // =========================================================================
    console.log('\n--- SECTION 5: Result Integration & Broadcast ---');

    // Setup Tournament with registered players Alice and Bob
    await TournamentPlayer.create({
      tournamentId: tourneyPublic._id,
      userId: userAlice._id,
    });
    await TournamentPlayer.create({
      tournamentId: tourneyPublic._id,
      userId: userBob._id,
    });

    const round1 = await Round.create({
      tournamentId: tourneyPublic._id,
      roundNumber: 1,
      status: 'PENDING',
    });

    const pairing1 = await Pairing.create({
      roundId: round1._id,
      tournamentId: tourneyPublic._id,
      whitePlayer: userAlice._id,
      blackPlayer: userBob._id,
      lichessGameId: 'realtime_game_p1',
      lichessGameUrl: 'https://lichess.org/realtime_game_p1',
      status: 'ACTIVE',
      result: 'PENDING',
    });

    // Mock Lichess export transport to return completed game result
    setMockExportTransport(async (gameId) => {
      return {
        id: gameId,
        status: 'mate',
        winner: 'white',
        players: {
          white: { user: { name: 'alice_rt_lic' } },
          black: { user: { name: 'bob_rt_lic' } },
        },
      };
    });

    // Listen for Socket.IO events on Bob's client
    let capturedGameFinished = null;
    let capturedStandings = null;
    let capturedRoundCompleted = null;

    socketBob.on('GAME_FINISHED', (data) => {
      capturedGameFinished = data;
    });

    socketBob.on('STANDINGS_UPDATED', (data) => {
      capturedStandings = data;
    });

    socketBob.on('ROUND_COMPLETED', (data) => {
      capturedRoundCompleted = data;
    });

    // Start stream for pairing1
    await startStream({
      tournamentId: tourneyPublic._id.toString(),
      roundNumber: 1,
      pairingId: pairing1._id.toString(),
      lichessGameId: 'realtime_game_p1',
      token: 'fake_token',
    });

    // 18. Terminal event triggers existing sync logic
    // Simulate incoming terminal NDJSON event from Lichess stream
    mockStreamEventCallback({
      type: 'gameState',
      status: 'mate',
      winner: 'white',
      moves: 'e2e4 e7e5 d1h5 e8e7 h5e5',
      wtime: 290000,
      btime: 280000,
    });

    // Wait for async database synchronization and broadcast (network latency to cloud Atlas)
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const updatedPairing = await Pairing.findById(pairing1._id);
    assert(updatedPairing.status === 'FINISHED', '18. Pairing status updated to FINISHED via canonical sync logic');
    assert(updatedPairing.result === '1-0', '18. Pairing result updated to 1-0 in database');
    assert(capturedGameFinished !== null, '18. GAME_FINISHED event broadcast to room clients');
    assert(capturedGameFinished.result === '1-0', '18. Broadcast payload contains result 1-0');

    // 19. Duplicate terminal event does not double-score
    // Trigger duplicate terminal event
    const standingsBefore = await standingsService.getTournamentStandings(tourneyPublic._id);
    const aliceScoreBefore = standingsBefore.standings.find(
      (s) => s.playerId.toString() === userAlice._id.toString()
    )?.score;

    // Resend terminal event
    if (mockStreamEventCallback) {
      mockStreamEventCallback({
        type: 'gameState',
        status: 'mate',
        winner: 'white',
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const standingsAfter = await standingsService.getTournamentStandings(tourneyPublic._id);
    const aliceScoreAfter = standingsAfter.standings.find(
      (s) => s.playerId.toString() === userAlice._id.toString()
    )?.score;

    assert(aliceScoreBefore === 1, '19. Initial score for Alice is 1');
    assert(aliceScoreAfter === 1, '19. Duplicate terminal event does not double-score (Alice score remains 1)');

    // 20. Standings update emitted
    assert(capturedStandings !== null, '20. STANDINGS_UPDATED event emitted to tournament room');
    assert(Array.isArray(capturedStandings.standings), '20. Standings event contains valid standings list');
    assert(
      capturedStandings.standings[0].playerId.toString() === userAlice._id.toString(),
      '20. Top player in broadcast standings is Alice'
    );

    // 21. Round completion emitted when appropriate
    assert(capturedRoundCompleted !== null, '21. ROUND_COMPLETED emitted when all round pairings are terminal');
    assert(capturedRoundCompleted.roundNumber === 1, '21. ROUND_COMPLETED specifies correct round number');
    assert(capturedRoundCompleted.complete === true, '21. ROUND_COMPLETED indicates round is complete');

    // Clean up sockets
    socketValid.disconnect();
    socketBob.disconnect();

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
  } finally {
    // Teardown
    console.log('🧹 Cleaning up test data & stopping servers...');
    setMockStreamTransport(null);
    setMockExportTransport(null);
    stopAllStreams();

    await closeSocketServer();
    await new Promise((resolve) => testHttpServer.close(resolve));

    if (createdTournamentIds.length > 0) {
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
      await Round.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Pairing.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
    }

    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    console.log('✨ Cleanup complete.\n');
  }
};

runRealtimeTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Test suite crashed:', err);
    process.exit(1);
  });
