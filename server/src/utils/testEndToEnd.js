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
import * as authService from '../services/authService.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import * as roundService from '../services/roundService.js';
import * as pairingService from '../services/pairingService.js';
import * as standingsService from '../services/standingsService.js';
import * as lichessOAuthService from '../services/lichessOAuthService.js';
import { initSocketServer, closeSocketServer } from '../realtime/socket.js';
import { normalizeStreamEvent } from '../realtime/eventNormalizer.js';

dotenv.config();

const runEndToEndTests = async () => {
  console.log('🧪 Starting Milestone 15: Full End-to-End Integration & Production Hardening Test Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `e2e_${timestamp}`;
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

  // Start test Socket.IO server on port 5077
  const testHttpServer = http.createServer();
  const testIo = initSocketServer(testHttpServer);
  const TEST_PORT = 5077;
  await new Promise((resolve) => testHttpServer.listen(TEST_PORT, resolve));
  const serverUrl = `http://localhost:${TEST_PORT}`;

  try {
    // =========================================================================
    // SECTION 1: Authentication E2E
    // =========================================================================
    console.log('--- SECTION 1: Authentication & Credential Security ---');

    // 1. Valid Registration
    const regResultA = await authService.registerUser({
      name: 'E2E User A',
      email: `  ${testPrefix}_userA@ChessJeeno.Local  `,
      password: 'StrongPassword123!',
    });
    createdUserIds.push(regResultA.user._id);

    assert(regResultA.token, '1. Registration returns valid JWT');
    assert(regResultA.user.email === `${testPrefix}_usera@chessjeeno.local`, '1. Email is normalized and trimmed');
    assert(regResultA.user.passwordHash === undefined, '1. Registration response never exposes passwordHash');
    assert(regResultA.user.authProvider === 'local', '1. Auth provider is local');

    // 2. Duplicate Email Rejection
    let dupRejected = false;
    try {
      await authService.registerUser({
        name: 'Duplicate User',
        email: `${testPrefix}_userA@chessjeeno.local`,
        password: 'Password123!',
      });
    } catch (err) {
      dupRejected = err.statusCode === 400;
    }
    assert(dupRejected, '2. Duplicate email registration rejected with HTTP 400');

    // 3. Password Verification & Login
    const loginResult = await authService.loginUser({
      email: `${testPrefix}_usera@chessjeeno.local`,
      password: 'StrongPassword123!',
    });
    assert(Boolean(loginResult.token), '3. Successful login returns JWT');
    assert(loginResult.user.passwordHash === undefined, '3. Login response does not expose passwordHash');

    // 4. Invalid Password Rejection
    let badPasswordRejected = false;
    try {
      await authService.loginUser({
        email: `${testPrefix}_usera@chessjeeno.local`,
        password: 'WrongPassword!',
      });
    } catch (err) {
      badPasswordRejected = err.statusCode === 401;
    }
    assert(badPasswordRejected, '4. Invalid password rejected with HTTP 401');

    // 5. User B Registration
    const regResultB = await authService.registerUser({
      name: 'E2E User B',
      email: `${testPrefix}_userb@chessjeeno.local`,
      password: 'StrongPassword123!',
    });
    createdUserIds.push(regResultB.user._id);
    assert(Boolean(regResultB.token), '5. User B registered successfully');

    // =========================================================================
    // SECTION 2: Authorization & Ownership Protection
    // =========================================================================
    console.log('\n--- SECTION 2: Authorization & Ownership Security ---');

    // User A creates a tournament
    const tourneyA = await tournamentService.createTournament(
      {
        name: `${testPrefix} A Championship`,
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 4,
      },
      regResultA.user._id
    );
    createdTournamentIds.push(tourneyA._id);
    assert(
      (tourneyA.createdBy._id || tourneyA.createdBy).toString() === regResultA.user._id.toString(),
      '6. Tournament createdBy set to User A'
    );

    // User B attempts to update User A's tournament -> must be 403 Forbidden
    let unauthorizedUpdateRejected = false;
    try {
      await tournamentService.updateTournament(
        tourneyA._id,
        { name: 'Hacked Tournament Name' },
        regResultB.user._id // User B attempting update
      );
    } catch (err) {
      unauthorizedUpdateRejected = err.statusCode === 403;
    }
    assert(unauthorizedUpdateRejected, '7. Non-creator User B cannot edit User A tournament (403)');

    // User B attempts to delete User A's tournament -> must be 403 Forbidden
    let unauthorizedDeleteRejected = false;
    try {
      await tournamentService.deleteTournament(tourneyA._id, regResultB.user._id);
    } catch (err) {
      unauthorizedDeleteRejected = err.statusCode === 403;
    }
    assert(unauthorizedDeleteRejected, '8. Non-creator User B cannot delete User A tournament (403)');

    // User B attempts to create rounds for User A's tournament -> must be 403 Forbidden
    let unauthorizedRoundRejected = false;
    try {
      await roundService.createRound(tourneyA._id, regResultB.user._id);
    } catch (err) {
      unauthorizedRoundRejected = err.statusCode === 403;
    }
    assert(unauthorizedRoundRejected, '9. Non-creator User B cannot create rounds for User A tournament (403)');

    // User B joins User A's tournament -> allowed during REGISTRATION
    const joinResultB = await tournamentPlayerService.joinTournament(tourneyA._id, regResultB.user._id);
    assert(joinResultB.userId._id.toString() === regResultB.user._id.toString(), '10. User B can join User A tournament');

    // =========================================================================
    // SECTION 3: Lichess OAuth & Credential Concealment
    // =========================================================================
    console.log('\n--- SECTION 3: Lichess OAuth Security & Lifecycle ---');

    // 11. PKCE Authorization URL & State Generation
    const authUrlData = lichessOAuthService.createAuthorizationUrl(regResultA.user._id);
    assert(authUrlData.url.includes('response_type=code'), '11. Auth URL contains response_type=code');
    assert(authUrlData.url.includes('code_challenge_method=S256'), '11. Auth URL specifies S256 PKCE');
    assert(authUrlData.state.length === 64, '11. OAuth state is a secure 64-char hex string');

    // 12. Single-Use State Consumption
    const consumedState = lichessOAuthService.consumeOAuthTransaction(authUrlData.state);
    assert(consumedState && consumedState.userId.toString() === regResultA.user._id.toString(), '12. State consumed on first use');
    const replayState = lichessOAuthService.consumeOAuthTransaction(authUrlData.state);
    assert(replayState === null, '12. Replayed/consumed OAuth state returns null');

    // 13. Storing OAuth Connection for User A & User B
    await lichessOAuthService.storeLichessConnection(regResultA.user._id, {
      account: { id: `lic_user_a_${timestamp}`, username: `LicUserA_${timestamp}` },
      tokenData: {
        access_token: 'secret_oauth_token_a_123',
        token_type: 'Bearer',
        expires_in: 31536000,
        scope: 'preference:read challenge:read challenge:write board:play',
      },
    });

    await lichessOAuthService.storeLichessConnection(regResultB.user._id, {
      account: { id: `lic_user_b_${timestamp}`, username: `LicUserB_${timestamp}` },
      tokenData: {
        access_token: 'secret_oauth_token_b_456',
        token_type: 'Bearer',
        expires_in: 31536000,
        scope: 'preference:read challenge:read challenge:write board:play',
      },
    });

    // 14. Verify Sensitive Token Concealment
    const statusDataA = await lichessOAuthService.getConnectionStatus(regResultA.user._id);
    assert(statusDataA.connected === true, '14. Lichess status reports connected: true');
    assert(statusDataA.accessToken === undefined, '14. Lichess status NEVER returns accessToken');

    const dbUserA = await User.findById(regResultA.user._id);
    assert(dbUserA.toJSON().lichessOAuth?.accessToken === undefined, '14. User JSON serialization excludes accessToken');

    // 15. Duplicate Lichess Account Protection (User C cannot link User A's lichess account)
    const userC = await User.create({
      name: 'User C',
      email: `${testPrefix}_userc@chessjeeno.local`,
      passwordHash: 'dummy',
      authProvider: 'local',
    });
    createdUserIds.push(userC._id);

    let dupLichessRejected = false;
    try {
      await lichessOAuthService.storeLichessConnection(userC._id, {
        account: { id: `lic_user_a_${timestamp}`, username: `LicUserA_${timestamp}` },
        tokenData: { access_token: 'token_c', token_type: 'Bearer' },
      });
    } catch (err) {
      dupLichessRejected = err.statusCode === 409;
    }
    assert(dupLichessRejected, '15. Duplicate Lichess account connection rejected with HTTP 409 Conflict');

    // =========================================================================
    // SECTION 4: Round Robin Tournament E2E (4 Players, Full Lifecycle)
    // =========================================================================
    console.log('\n--- SECTION 4: Round Robin Tournament Full Lifecycle ---');

    // Add Player 1 (User A) and 2 more players to reach 4 players
    await tournamentPlayerService.joinTournament(tourneyA._id, regResultA.user._id);
    await tournamentPlayerService.joinTournament(tourneyA._id, userC._id);

    const userD = await User.create({
      name: 'User D',
      email: `${testPrefix}_userd@chessjeeno.local`,
      passwordHash: 'dummy',
      authProvider: 'local',
    });
    createdUserIds.push(userD._id);
    await tournamentPlayerService.joinTournament(tourneyA._id, userD._id);

    // Create Round 1
    const rrR1 = await roundService.createRound(tourneyA._id, regResultA.user._id);
    assert(rrR1.round.roundNumber === 1, '16. Round Robin Round 1 created');
    assert(rrR1.pairings.length === 2, '16. Round Robin Round 1 has 2 pairings');

    // Next round blocked while previous round incomplete
    let nextRoundBlocked = false;
    try {
      await roundService.createRound(tourneyA._id, regResultA.user._id);
    } catch (err) {
      nextRoundBlocked = err.statusCode === 400 && err.message.includes('not complete');
    }
    assert(nextRoundBlocked, '17. Next round blocked while previous round is incomplete');

    // Complete Round 1
    await Pairing.findByIdAndUpdate(rrR1.pairings[0]._id, { status: 'FINISHED', result: '1-0' });
    await Pairing.findByIdAndUpdate(rrR1.pairings[1]._id, { status: 'FINISHED', result: '0-1' });
    await roundService.getRoundCompletionStatus(tourneyA._id, 1);

    // Create & Complete Round 2
    const rrR2 = await roundService.createRound(tourneyA._id, regResultA.user._id);
    assert(rrR2.round.roundNumber === 2, '18. Round Robin Round 2 created');
    await Pairing.findByIdAndUpdate(rrR2.pairings[0]._id, { status: 'FINISHED', result: '1/2-1/2' });
    await Pairing.findByIdAndUpdate(rrR2.pairings[1]._id, { status: 'FINISHED', result: '1-0' });
    await roundService.getRoundCompletionStatus(tourneyA._id, 2);

    // Create & Complete Round 3 (Final Round)
    const rrR3 = await roundService.createRound(tourneyA._id, regResultA.user._id);
    assert(rrR3.round.roundNumber === 3, '19. Round Robin Round 3 created');
    await Pairing.findByIdAndUpdate(rrR3.pairings[0]._id, { status: 'FINISHED', result: '1-0' });
    await Pairing.findByIdAndUpdate(rrR3.pairings[1]._id, { status: 'FINISHED', result: '0-1' });
    await roundService.getRoundCompletionStatus(tourneyA._id, 3);

    // Tournament completion
    const rrFinished = await Tournament.findById(tourneyA._id);
    assert(rrFinished.status === 'FINISHED', '20. Round Robin tournament marked FINISHED');

    // Round beyond limit blocked
    let rrExceeded = false;
    try {
      await roundService.createRound(tourneyA._id, regResultA.user._id);
    } catch (err) {
      rrExceeded = err.statusCode === 400;
    }
    assert(rrExceeded, '21. Round Robin round creation beyond total rounds rejected with 400');

    // Standings verification
    const rrStandings = await standingsService.getTournamentStandings(tourneyA._id);
    assert(rrStandings.standings.length === 4, '22. Standings contains all 4 players');
    assert(rrStandings.standings[0].rank === 1, '22. Standings correctly ranks champion #1');

    // =========================================================================
    // SECTION 5: Swiss Tournament E2E (6 Players, 3 Rounds)
    // =========================================================================
    console.log('\n--- SECTION 5: Swiss Tournament E2E Lifecycle ---');

    // Create 2 additional players (total 6: A, B, C, D, E, F)
    const userE = await User.create({
      name: 'User E',
      email: `${testPrefix}_usere@chessjeeno.local`,
      passwordHash: 'dummy',
      authProvider: 'local',
    });
    createdUserIds.push(userE._id);

    const userF = await User.create({
      name: 'User F',
      email: `${testPrefix}_userf@chessjeeno.local`,
      passwordHash: 'dummy',
      authProvider: 'local',
    });
    createdUserIds.push(userF._id);

    const swissTourney = await tournamentService.createTournament(
      {
        name: `${testPrefix} Swiss Cup`,
        format: 'SWISS',
        totalRounds: 3,
        clockLimit: 300,
        increment: 0,
      },
      regResultA.user._id
    );
    createdTournamentIds.push(swissTourney._id);

    // Join all 6 players
    for (const u of [regResultA.user, regResultB.user, userC, userD, userE, userF]) {
      await tournamentPlayerService.joinTournament(swissTourney._id, u._id);
    }

    // Swiss Round 1
    const swR1 = await roundService.createRound(swissTourney._id, regResultA.user._id);
    assert(swR1.pairings.length === 3, '23. Swiss Round 1 has 3 pairings for 6 players');
    await Pairing.findByIdAndUpdate(swR1.pairings[0]._id, { status: 'FINISHED', result: '1-0' });
    await Pairing.findByIdAndUpdate(swR1.pairings[1]._id, { status: 'FINISHED', result: '1-0' });
    await Pairing.findByIdAndUpdate(swR1.pairings[2]._id, { status: 'FINISHED', result: '0-1' });
    await roundService.getRoundCompletionStatus(swissTourney._id, 1);

    // Swiss Round 2 (Pairing based on score groups)
    const swR2 = await roundService.createRound(swissTourney._id, regResultA.user._id);
    assert(swR2.pairings.length === 3, '24. Swiss Round 2 has 3 pairings');

    // Verify no repeat matchups in Round 2
    const r1Keys = new Set(
      swR1.pairings.map((p) => `${p.whitePlayer._id}_${p.blackPlayer._id}`)
    );
    for (const p of swR2.pairings) {
      assert(!r1Keys.has(`${p.whitePlayer._id}_${p.blackPlayer._id}`), '25. Swiss Round 2 does not repeat opponents');
      assert(!r1Keys.has(`${p.blackPlayer._id}_${p.whitePlayer._id}`), '25. Swiss Round 2 does not repeat reverse opponents');
    }

    await Pairing.findByIdAndUpdate(swR2.pairings[0]._id, { status: 'FINISHED', result: '1-0' });
    await Pairing.findByIdAndUpdate(swR2.pairings[1]._id, { status: 'FINISHED', result: '1/2-1/2' });
    await Pairing.findByIdAndUpdate(swR2.pairings[2]._id, { status: 'FINISHED', result: '0-1' });
    await roundService.getRoundCompletionStatus(swissTourney._id, 2);

    // Swiss Round 3 (Final Round)
    const swR3 = await roundService.createRound(swissTourney._id, regResultA.user._id);
    assert(swR3.pairings.length === 3, '26. Swiss Round 3 created');
    await Pairing.findByIdAndUpdate(swR3.pairings[0]._id, { status: 'FINISHED', result: '1-0' });
    await Pairing.findByIdAndUpdate(swR3.pairings[1]._id, { status: 'FINISHED', result: '1-0' });
    await Pairing.findByIdAndUpdate(swR3.pairings[2]._id, { status: 'FINISHED', result: '1-0' });
    await roundService.getRoundCompletionStatus(swissTourney._id, 3);

    const swFinished = await Tournament.findById(swissTourney._id);
    assert(swFinished.status === 'FINISHED', '27. Swiss tournament marked FINISHED after totalRounds completed');

    // =========================================================================
    // SECTION 6: Knockout Tournament E2E (6 Players, BYEs + Progression)
    // =========================================================================
    console.log('\n--- SECTION 6: Knockout Tournament E2E Lifecycle ---');

    const koTourney = await tournamentService.createTournament(
      {
        name: `${testPrefix} Knockout Cup`,
        format: 'KNOCKOUT',
        clockLimit: 300,
        increment: 0,
      },
      regResultA.user._id
    );
    createdTournamentIds.push(koTourney._id);

    for (const u of [regResultA.user, regResultB.user, userC, userD, userE, userF]) {
      await tournamentPlayerService.joinTournament(koTourney._id, u._id);
    }

    // Knockout Round 1: 6 players -> 8-slot bracket, 2 BYEs, Quarterfinals
    const koR1 = await roundService.createRound(koTourney._id, regResultA.user._id);
    assert(koR1.round.stageName === 'Quarterfinals', '28. Knockout Round 1 stageName is Quarterfinals');
    assert(koR1.pairings.length === 4, '28. Quarterfinals has 4 pairings (8-slot bracket)');

    const byePairings = koR1.pairings.filter((p) => p.status === 'BYE');
    const livePairings = koR1.pairings.filter((p) => p.status !== 'BYE');
    assert(byePairings.length === 2, '29. Exactly 2 BYE pairings generated');
    assert(livePairings.length === 2, '29. Exactly 2 live matches generated');

    // Complete live Quarterfinal matches
    await Pairing.findByIdAndUpdate(livePairings[0]._id, { status: 'FINISHED', result: '1-0' });
    await Pairing.findByIdAndUpdate(livePairings[1]._id, { status: 'FINISHED', result: '0-1' });
    await roundService.getRoundCompletionStatus(koTourney._id, 1);

    // Knockout Round 2: Semifinals
    const koR2 = await roundService.createRound(koTourney._id, regResultA.user._id);
    assert(koR2.round.stageName === 'Semifinals', '30. Knockout Round 2 stageName is Semifinals');
    assert(koR2.pairings.length === 2, '30. Semifinals has 2 pairings');

    await Pairing.findByIdAndUpdate(koR2.pairings[0]._id, { status: 'FINISHED', result: '1-0' });
    await Pairing.findByIdAndUpdate(koR2.pairings[1]._id, { status: 'FINISHED', result: '0-1' });
    await roundService.getRoundCompletionStatus(koTourney._id, 2);

    // Knockout Round 3: Final
    const koR3 = await roundService.createRound(koTourney._id, regResultA.user._id);
    assert(koR3.round.stageName === 'Final', '31. Knockout Round 3 stageName is Final');
    assert(koR3.pairings.length === 1, '31. Final has 1 match');

    // Complete Final
    await Pairing.findByIdAndUpdate(koR3.pairings[0]._id, { status: 'FINISHED', result: '1-0' });
    await roundService.getRoundCompletionStatus(koTourney._id, 3);

    const koFinished = await Tournament.findById(koTourney._id).populate('winnerPlayer');
    assert(koFinished.status === 'FINISHED', '32. Knockout tournament status marked FINISHED');
    assert(Boolean(koFinished.winnerPlayer), '32. Knockout champion (winnerPlayer) stored');

    // =========================================================================
    // SECTION 7: Idempotency & Edge Case Robustness
    // =========================================================================
    console.log('\n--- SECTION 7: Idempotency & Duplicate Request Safety ---');

    // Repeated sync does NOT mutate or double score
    const targetPairing = koR3.pairings[0];
    await Pairing.findByIdAndUpdate(targetPairing._id, {
      lichessGameId: 'mock_ko_final_game_123',
    });
    const initialPairing = await Pairing.findById(targetPairing._id);
    assert(initialPairing.result === '1-0', '33. Initial pairing result is 1-0');

    // Simulate 3 repeated sync calls on already finished pairing
    const sync1 = await pairingService.syncPairingResult(koTourney._id, 3, targetPairing._id, {}, regResultA.user._id);
    const sync2 = await pairingService.syncPairingResult(koTourney._id, 3, targetPairing._id, {}, regResultA.user._id);
    const sync3 = await pairingService.syncPairingResult(koTourney._id, 3, targetPairing._id, {}, regResultA.user._id);
    assert(sync1.result === '1-0' && sync2.result === '1-0' && sync3.result === '1-0', '34. Repeated syncs preserve exact result (idempotent)');

    // Standings calculation is unaffected by multiple syncs
    const postSyncStandings = await standingsService.getTournamentStandings(koTourney._id);
    assert(postSyncStandings.standings.length === 6, '35. Standings unaffected by multiple sync calls');

    // Duplicate join rejection
    let dupJoinRejected = false;
    try {
      await tournamentPlayerService.joinTournament(koTourney._id, regResultA.user._id);
    } catch (err) {
      dupJoinRejected = err.statusCode === 400;
    }
    assert(dupJoinRejected, '36. Duplicate player join rejected with HTTP 400');

    // Tournament full rejection
    const tinyTourney = await tournamentService.createTournament(
      {
        name: 'Tiny 2 Player Cup',
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 2,
      },
      regResultA.user._id
    );
    createdTournamentIds.push(tinyTourney._id);
    await tournamentPlayerService.joinTournament(tinyTourney._id, regResultA.user._id);
    await tournamentPlayerService.joinTournament(tinyTourney._id, regResultB.user._id);

    let fullRejected = false;
    try {
      await tournamentPlayerService.joinTournament(tinyTourney._id, userC._id);
    } catch (err) {
      fullRejected = err.statusCode === 400 && err.message.includes('full');
    }
    assert(fullRejected, '37. Player join on full tournament rejected with HTTP 400');

    // =========================================================================
    // SECTION 8: Realtime Socket.IO Auth & Event Normalization
    // =========================================================================
    console.log('\n--- SECTION 8: Realtime Socket.IO Security & Live Multi-Client Delivery ---');

    // Client 1 connects with valid JWT
    const clientA = ClientIO(serverUrl, {
      auth: { token: regResultA.token },
      transports: ['websocket'],
    });
    await new Promise((resolve) => clientA.on('connect', resolve));
    assert(clientA.connected, '38. Socket client A connected with valid JWT');

    // Client 2 connects with valid JWT
    const clientB = ClientIO(serverUrl, {
      auth: { token: regResultB.token },
      transports: ['websocket'],
    });
    await new Promise((resolve) => clientB.on('connect', resolve));
    assert(clientB.connected, '39. Socket client B connected with valid JWT');

    // Client with missing JWT is rejected
    const clientNoToken = ClientIO(serverUrl, {
      auth: {},
      transports: ['websocket'],
      autoConnect: true,
    });
    const noTokenError = await new Promise((resolve) => clientNoToken.on('connect_error', resolve));
    assert(noTokenError.message.includes('Authentication required'), '40. Unauthenticated socket connection rejected');
    clientNoToken.disconnect();

    // Client with query param token (?token=...) is strictly rejected
    const clientQueryToken = ClientIO(`${serverUrl}?token=${regResultA.token}`, {
      transports: ['websocket'],
      autoConnect: true,
    });
    const queryTokenError = await new Promise((resolve) => clientQueryToken.on('connect_error', resolve));
    assert(queryTokenError.message.includes('Query-token authentication is prohibited'), '41. Query-token socket connection rejected');
    clientQueryToken.disconnect();

    // Both clients join the same tournament room
    const joinResA = await new Promise((resolve) => clientA.emit('joinTournament', { tournamentId: tourneyA._id.toString() }, resolve));
    const joinResB = await new Promise((resolve) => clientB.emit('joinTournament', { tournamentId: tourneyA._id.toString() }, resolve));
    assert(joinResA.success && joinResB.success, '42. Both authenticated clients successfully join tournament room');

    // Event broadcast test: emit STANDINGS_UPDATED to room and verify both clients receive it
    const clientAPromise = new Promise((resolve) => clientA.once('STANDINGS_UPDATED', resolve));
    const clientBPromise = new Promise((resolve) => clientB.once('STANDINGS_UPDATED', resolve));

    testIo.to(`tournament:${tourneyA._id}`).emit('STANDINGS_UPDATED', {
      tournamentId: tourneyA._id.toString(),
      standings: [{ rank: 1, name: 'Champion' }],
    });

    const [eventA, eventB] = await Promise.all([clientAPromise, clientBPromise]);
    assert(eventA.tournamentId === tourneyA._id.toString(), '43. Client A received realtime event');
    assert(eventB.tournamentId === tourneyA._id.toString(), '43. Client B received realtime event');

    // Event Normalizer security check: ensures no tokens or secrets in normalized game stream events
    const normalized = normalizeStreamEvent(
      {
        type: 'gameState',
        status: 'mate',
        winner: 'white',
        moves: 'e4 e5 Nf3 Nc6',
        wtime: 180000,
        btime: 150000,
      },
      {
        lichessGameId: 'game_123',
        whiteToken: 'secret_token_white',
        blackToken: 'secret_token_black',
      }
    );
    const jsonNormalized = JSON.stringify(normalized);
    assert(!jsonNormalized.includes('secret_token_white'), '44. Event normalizer excludes secret white token');
    assert(!jsonNormalized.includes('secret_token_black'), '44. Event normalizer excludes secret black token');
    assert(normalized.payload.result === '1-0', '44. Event normalizer correctly converts mate/white to result 1-0');

    clientA.disconnect();
    clientB.disconnect();

    // =========================================================================
    // SECTION 9: Database Consistency & Cascading Cleanup
    // =========================================================================
    console.log('\n--- SECTION 9: Database Integrity & Cascading Deletion ---');

    // Create a disposable tournament with players, a round, and pairings
    const disposableTourney = await tournamentService.createTournament(
      {
        name: 'Disposable Tournament',
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 0,
      },
      regResultA.user._id
    );
    await tournamentPlayerService.joinTournament(disposableTourney._id, regResultA.user._id);
    await tournamentPlayerService.joinTournament(disposableTourney._id, regResultB.user._id);
    const dispRound = await roundService.createRound(disposableTourney._id, regResultA.user._id);

    // Verify records exist in DB
    const playersBefore = await TournamentPlayer.countDocuments({ tournamentId: disposableTourney._id });
    const roundsBefore = await Round.countDocuments({ tournamentId: disposableTourney._id });
    const pairingsBefore = await Pairing.countDocuments({ tournamentId: disposableTourney._id });
    assert(playersBefore === 2 && roundsBefore === 1 && pairingsBefore === 1, '45. Disposable tournament records created');

    // Delete tournament as User A
    await tournamentService.deleteTournament(disposableTourney._id, regResultA.user._id);

    // Verify all associated records cascaded cleanly
    const playersAfter = await TournamentPlayer.countDocuments({ tournamentId: disposableTourney._id });
    const roundsAfter = await Round.countDocuments({ tournamentId: disposableTourney._id });
    const pairingsAfter = await Pairing.countDocuments({ tournamentId: disposableTourney._id });
    assert(playersAfter === 0, '46. Associated TournamentPlayers cascade deleted');
    assert(roundsAfter === 0, '46. Associated Rounds cascade deleted');
    assert(pairingsAfter === 0, '46. Associated Pairings cascade deleted (no orphaned records)');

    console.log(`\n🎉 All End-to-End Integration Tests Passed (${passedTests}/${totalTests})!`);
  } finally {
    console.log('\n🧹 Cleaning up test data...');
    closeSocketServer();
    testHttpServer.close();

    if (createdTournamentIds.length > 0) {
      await Pairing.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Round.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('✨ Cleanup complete.');
    await mongoose.connection.close();
  }
};

runEndToEndTests().catch((err) => {
  console.error('💥 E2E tests failed with uncaught exception:', err);
  process.exit(1);
});
