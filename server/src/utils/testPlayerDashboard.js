import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import apiRouter from '../routes/index.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../services/authService.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import TournamentJoinRequest from '../models/TournamentJoinRequest.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import { getUserDashboardData } from '../services/dashboardService.js';

dotenv.config();

const runDashboardTests = async () => {
  console.log('🧪 Starting CHESS JEENO Player Dashboard Test Suite...\n');
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
  const testPrefix = `dash_test_${timestamp}`;

  const createdUserIds = [];
  const createdTournamentIds = [];
  const createdRoundIds = [];
  const createdPairingIds = [];
  const createdPlayerIds = [];
  const createdRequestIds = [];

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, description) => {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${description}`);
      throw new Error(`Test assertion failed: ${description}`);
    }
    passedTests++;
    console.log(`  ✅ Passed [${totalTests}]: ${description}`);
  };

  try {
    // -------------------------------------------------------------------------
    // Setup Test Users
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Setting up Test Users ---');
    const user1 = await User.create({
      name: 'Player One',
      email: `${testPrefix}_p1@chessjeeno.local`,
      passwordHash: 'fake_hash_1',
      authProvider: 'local',
      lichessUsername: 'player_one_lichess',
      avatar: 'https://example.com/avatar1.jpg',
    });
    createdUserIds.push(user1._id);

    const user2 = await User.create({
      name: 'Player Two',
      email: `${testPrefix}_p2@chessjeeno.local`,
      passwordHash: 'fake_hash_2',
      authProvider: 'local',
      lichessUsername: 'player_two_lichess',
    });
    createdUserIds.push(user2._id);

    const newUser = await User.create({
      name: 'Brand New Player',
      email: `${testPrefix}_new@chessjeeno.local`,
      passwordHash: 'fake_hash_new',
      authProvider: 'local',
    });
    createdUserIds.push(newUser._id);

    const tokenUser1 = generateToken(user1._id);
    const tokenUser2 = generateToken(user2._id);
    const tokenNewUser = generateToken(newUser._id);

    // -------------------------------------------------------------------------
    // 1. Authenticated Dashboard Access
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Authenticated Dashboard Access ---');
    const resAuth = await fetch(`${API_BASE}/users/dashboard`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const dataAuth = await resAuth.json();
    assert(resAuth.status === 200, 'Authenticated request returns 200 OK');
    assert(dataAuth.success === true, 'Response has success: true');
    assert(dataAuth.data && typeof dataAuth.data === 'object', 'Response returns data object');

    // -------------------------------------------------------------------------
    // 2. Unauthenticated Access
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Unauthenticated Access ---');
    const resUnauth = await fetch(`${API_BASE}/users/dashboard`);
    assert(resUnauth.status === 401, 'Unauthenticated request returns 401 Unauthorized');
    const dataUnauth = await resUnauth.json();
    assert(dataUnauth.success === false, 'Unauthenticated response returns success: false');

    // -------------------------------------------------------------------------
    // 3. Own-User Authorization & Query Param Tampering Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Own-User Authorization ---');
    // Attempt to pass another user's id in query parameter
    const resTamper = await fetch(`${API_BASE}/users/dashboard?userId=${user2._id}`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const dataTamper = await resTamper.json();
    assert(resTamper.status === 200, 'Tampered query request still returns 200 for authenticated user');
    assert(dataTamper.data.user._id.toString() === user1._id.toString(), 'Dashboard strictly belongs to authenticated user 1, ignoring userId query param');

    // -------------------------------------------------------------------------
    // 19. Sensitive-Data Exclusion
    // -------------------------------------------------------------------------
    console.log('\n--- Test 19: Sensitive-Data Exclusion ---');
    assert(!dataAuth.data.user.passwordHash, 'passwordHash is never exposed in dashboard');
    assert(!dataAuth.data.user.googleAccessToken, 'googleAccessToken is never exposed');
    assert(!dataAuth.data.user.googleRefreshToken, 'googleRefreshToken is never exposed');
    assert(!dataAuth.data.user.lichessAccessToken, 'lichessAccessToken is never exposed');
    assert(!dataAuth.data.token, 'JWT token is not echoed in response');

    // -------------------------------------------------------------------------
    // 16 & 17. No-Tournament Empty State & New-User Dashboard
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 16 & 17: New-User Dashboard & Empty States ---');
    const resNew = await fetch(`${API_BASE}/users/dashboard`, {
      headers: { Authorization: `Bearer ${tokenNewUser}` },
    });
    const dataNew = await resNew.json();
    assert(resNew.status === 200, 'New user dashboard returns 200');
    assert(dataNew.data.currentTournament === null, 'New user has currentTournament = null');
    assert(dataNew.data.myTournaments.activeCount === 0, 'New user activeCount = 0');
    assert(dataNew.data.myTournaments.upcomingCount === 0, 'New user upcomingCount = 0');
    assert(dataNew.data.myTournaments.completedCount === 0, 'New user completedCount = 0');
    assert(dataNew.data.myTournaments.hostedCount === 0, 'New user hostedCount = 0');
    assert(Array.isArray(dataNew.data.recentResults) && dataNew.data.recentResults.length === 0, 'New user recentResults is empty array');

    // -------------------------------------------------------------------------
    // Setup Tournaments for Priority, Approval, Standings, and Pairings
    // -------------------------------------------------------------------------
    console.log('\n--- Setting up Tournaments & Scenarios ---');

    // T1: IN_PROGRESS with active pairing
    const tActiveMatch = await Tournament.create({
      name: `${testPrefix} Live Championship`,
      format: 'SWISS',
      status: 'IN_PROGRESS',
      createdBy: user2._id,
      clockLimit: 3,
      increment: 2,
      totalRounds: 3,
    });
    createdTournamentIds.push(tActiveMatch._id);

    const tp1Active = await TournamentPlayer.create({
      tournamentId: tActiveMatch._id,
      userId: user1._id,
      isApproved: true,
    });
    createdPlayerIds.push(tp1Active._id);

    const tp2Active = await TournamentPlayer.create({
      tournamentId: tActiveMatch._id,
      userId: user2._id,
      isApproved: true,
    });
    createdPlayerIds.push(tp2Active._id);

    const roundActive = await Round.create({
      tournamentId: tActiveMatch._id,
      roundNumber: 1,
      status: 'RUNNING',
    });
    createdRoundIds.push(roundActive._id);

    const pairingLive = await Pairing.create({
      roundId: roundActive._id,
      tournamentId: tActiveMatch._id,
      whitePlayer: user1._id,
      blackPlayer: user2._id,
      status: 'ACTIVE',
      result: 'PENDING',
      lichessGameId: 'livegame123',
      lichessGameUrl: 'https://lichess.org/livegame123',
    });
    createdPairingIds.push(pairingLive._id);

    // T2: READY_CHECK tournament
    const tReadyCheck = await Tournament.create({
      name: `${testPrefix} Ready Check Open`,
      format: 'ROUND_ROBIN',
      status: 'READY_CHECK',
      createdBy: user2._id,
      clockLimit: 5,
      increment: 0,
    });
    createdTournamentIds.push(tReadyCheck._id);

    const tp1Ready = await TournamentPlayer.create({
      tournamentId: tReadyCheck._id,
      userId: user1._id,
      isApproved: true,
    });
    createdPlayerIds.push(tp1Ready._id);

    // T3: COUNTDOWN tournament
    const tCountdown = await Tournament.create({
      name: `${testPrefix} Countdown Blitz`,
      format: 'SWISS',
      status: 'COUNTDOWN',
      createdBy: user2._id,
      clockLimit: 3,
      increment: 0,
    });
    createdTournamentIds.push(tCountdown._id);

    const tp1Countdown = await TournamentPlayer.create({
      tournamentId: tCountdown._id,
      userId: user1._id,
      isApproved: true,
    });
    createdPlayerIds.push(tp1Countdown._id);

    // T4: Active tournament awaiting next round (all games in round completed)
    const tAwaitingNext = await Tournament.create({
      name: `${testPrefix} Awaiting Round 2`,
      format: 'SWISS',
      status: 'RUNNING',
      createdBy: user2._id,
      clockLimit: 10,
      increment: 0,
    });
    createdTournamentIds.push(tAwaitingNext._id);

    const tp1Awaiting = await TournamentPlayer.create({
      tournamentId: tAwaitingNext._id,
      userId: user1._id,
      isApproved: true,
    });
    createdPlayerIds.push(tp1Awaiting._id);

    const roundCompletedR1 = await Round.create({
      tournamentId: tAwaitingNext._id,
      roundNumber: 1,
      status: 'COMPLETED',
    });
    createdRoundIds.push(roundCompletedR1._id);

    const pairingFinished = await Pairing.create({
      roundId: roundCompletedR1._id,
      tournamentId: tAwaitingNext._id,
      whitePlayer: user1._id,
      blackPlayer: user2._id,
      status: 'FINISHED',
      result: '1-0',
      completedAt: new Date(),
    });
    createdPairingIds.push(pairingFinished._id);

    // T5: Upcoming approved tournament (REGISTRATION)
    const tUpcoming = await Tournament.create({
      name: `${testPrefix} Upcoming Classic`,
      format: 'ROUND_ROBIN',
      status: 'REGISTRATION',
      createdBy: user2._id,
      clockLimit: 15,
      increment: 10,
      startTime: new Date(Date.now() + 86400000), // tomorrow
    });
    createdTournamentIds.push(tUpcoming._id);

    const tp1Upcoming = await TournamentPlayer.create({
      tournamentId: tUpcoming._id,
      userId: user1._id,
      isApproved: true,
    });
    createdPlayerIds.push(tp1Upcoming._id);

    // T6: Pending join request tournament (MUST BE EXCLUDED)
    const tPendingReq = await Tournament.create({
      name: `${testPrefix} Pending Join Tournament`,
      format: 'SWISS',
      status: 'REGISTRATION',
      createdBy: user2._id,
      clockLimit: 5,
    });
    createdTournamentIds.push(tPendingReq._id);

    const reqPending = await TournamentJoinRequest.create({
      tournament: tPendingReq._id,
      user: user1._id,
      status: 'PENDING',
    });
    createdRequestIds.push(reqPending._id);

    // T7: Rejected join request tournament (MUST BE EXCLUDED)
    const tRejectedReq = await Tournament.create({
      name: `${testPrefix} Rejected Join Tournament`,
      format: 'SWISS',
      status: 'REGISTRATION',
      createdBy: user2._id,
      clockLimit: 5,
    });
    createdTournamentIds.push(tRejectedReq._id);

    const reqRejected = await TournamentJoinRequest.create({
      tournament: tRejectedReq._id,
      user: user1._id,
      status: 'REJECTED',
    });
    createdRequestIds.push(reqRejected._id);

    // T8: Completed tournament
    const tCompleted = await Tournament.create({
      name: `${testPrefix} Finished Cup`,
      format: 'SWISS',
      status: 'FINISHED',
      createdBy: user2._id,
      clockLimit: 5,
      totalRounds: 1,
    });
    createdTournamentIds.push(tCompleted._id);

    const tp1Completed = await TournamentPlayer.create({
      tournamentId: tCompleted._id,
      userId: user1._id,
      isApproved: true,
    });
    createdPlayerIds.push(tp1Completed._id);

    // T9: Hosted tournament by user1
    const tHosted = await Tournament.create({
      name: `${testPrefix} User1 Hosted Cup`,
      format: 'SWISS',
      status: 'REGISTRATION',
      createdBy: user1._id,
      clockLimit: 5,
    });
    createdTournamentIds.push(tHosted._id);

    // -------------------------------------------------------------------------
    // 4. Current Tournament Detection & 5. Priority Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 4 & 5: Current Tournament Detection & Priority Hierarchy ---');
    const resLive1 = await fetch(`${API_BASE}/users/dashboard`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const dataLive1 = await resLive1.json();
    const curr = dataLive1.data.currentTournament;

    assert(curr !== null, 'Current tournament detected');
    assert(
      curr._id.toString() === tActiveMatch._id.toString(),
      'Priority 1: IN_PROGRESS with active pairing selected as current tournament'
    );
    assert(curr.priorityLevel === 1, 'priorityLevel is recorded as 1');

    // -------------------------------------------------------------------------
    // 15. Current Pairing Correctness
    // -------------------------------------------------------------------------
    console.log('\n--- Test 15: Current Pairing Correctness ---');
    assert(curr.nextMatch !== null, 'Current pairing / nextMatch is populated');
    assert(curr.nextMatch.isWhite === true, 'User1 is correctly identified as playing White');
    assert(curr.nextMatch.playerColor === 'white', 'playerColor is white');
    assert(curr.nextMatch.opponent.name === 'Player Two', 'Opponent is correctly identified as Player Two');
    assert(curr.nextMatch.opponent.lichessUsername === 'player_two_lichess', 'Opponent lichess handle is correct');
    assert(curr.nextMatch.lichessGameUrl === 'https://lichess.org/livegame123', 'Play on Lichess game URL is correct');
    assert(curr.currentRoundNumber === 1, 'Current round number is 1');

    // -------------------------------------------------------------------------
    // Test Priority 2: When Priority 1 finishes, READY_CHECK takes priority
    // -------------------------------------------------------------------------
    console.log('\n--- Test Priority 2: READY_CHECK Priority ---');
    await Tournament.findByIdAndUpdate(tActiveMatch._id, { status: 'FINISHED' });

    const resP2 = await fetch(`${API_BASE}/users/dashboard`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const dataP2 = await resP2.json();
    assert(
      dataP2.data.currentTournament?._id.toString() === tReadyCheck._id.toString(),
      'Priority 2: READY_CHECK tournament takes priority over COUNTDOWN and upcoming'
    );
    assert(dataP2.data.currentTournament?.priorityLevel === 2, 'priorityLevel is 2');

    // -------------------------------------------------------------------------
    // Test Priority 3: When READY_CHECK finishes, COUNTDOWN takes priority
    // -------------------------------------------------------------------------
    console.log('\n--- Test Priority 3: COUNTDOWN Priority ---');
    await Tournament.findByIdAndUpdate(tReadyCheck._id, { status: 'CANCELLED' });

    const resP3 = await fetch(`${API_BASE}/users/dashboard`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const dataP3 = await resP3.json();
    assert(
      dataP3.data.currentTournament?._id.toString() === tCountdown._id.toString(),
      'Priority 3: COUNTDOWN tournament takes priority over awaiting round and upcoming'
    );
    assert(dataP3.data.currentTournament?.priorityLevel === 3, 'priorityLevel is 3');

    // -------------------------------------------------------------------------
    // Test Priority 4: Active tournament awaiting next round takes priority over upcoming
    // -------------------------------------------------------------------------
    console.log('\n--- Test Priority 4: Active Awaiting Next Round ---');
    await Tournament.findByIdAndUpdate(tCountdown._id, { status: 'CANCELLED' });

    const resP4 = await fetch(`${API_BASE}/users/dashboard`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const dataP4 = await resP4.json();
    assert(
      dataP4.data.currentTournament?._id.toString() === tAwaitingNext._id.toString(),
      'Priority 4: Active tournament awaiting next round takes priority over upcoming'
    );
    assert(dataP4.data.currentTournament?.priorityLevel === 4, 'priorityLevel is 4');

    // -------------------------------------------------------------------------
    // Test Priority 5: Upcoming approved tournament
    // -------------------------------------------------------------------------
    console.log('\n--- Test Priority 5: Upcoming Approved Tournament ---');
    await Tournament.findByIdAndUpdate(tAwaitingNext._id, { status: 'FINISHED' });

    const resP5 = await fetch(`${API_BASE}/users/dashboard`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const dataP5 = await resP5.json();
    assert(
      dataP5.data.currentTournament?._id.toString() === tUpcoming._id.toString(),
      'Priority 5: Upcoming approved tournament is selected when no active tournaments exist'
    );
    assert(dataP5.data.currentTournament?.priorityLevel === 5, 'priorityLevel is 5');

    // -------------------------------------------------------------------------
    // 10 & 11. Pending & Rejected Join Request Exclusion
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 10 & 11: Pending & Rejected Join Request Exclusion ---');
    // Ensure tPendingReq and tRejectedReq are NOT in user1's myTournaments list
    const myTournamentsListAll = [
      ...dataP5.data.myTournaments.active,
      ...dataP5.data.myTournaments.upcoming,
      ...dataP5.data.myTournaments.completed,
    ];
    const pendingFound = myTournamentsListAll.some(
      (t) => t._id.toString() === tPendingReq._id.toString()
    );
    const rejectedFound = myTournamentsListAll.some(
      (t) => t._id.toString() === tRejectedReq._id.toString()
    );
    assert(!pendingFound, 'Pending join request tournaments are excluded from dashboard');
    assert(!rejectedFound, 'Rejected join request tournaments are excluded from dashboard');

    // -------------------------------------------------------------------------
    // 12. Approved Participant Inclusion
    // -------------------------------------------------------------------------
    console.log('\n--- Test 12: Approved Participant Inclusion ---');
    const upcomingApprovedFound = dataP5.data.myTournaments.upcoming.some(
      (t) => t._id.toString() === tUpcoming._id.toString()
    );
    assert(upcomingApprovedFound, 'Approved participant tournament is included in upcoming tournaments');

    // -------------------------------------------------------------------------
    // 6, 7, 8, 9. Active, Upcoming, Completed, Hosted Tournaments
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 6, 7, 8, 9: Tournament Categories & Hosted Count ---');
    assert(typeof dataP5.data.myTournaments.activeCount === 'number', 'activeCount is a valid number');
    assert(typeof dataP5.data.myTournaments.upcomingCount === 'number', 'upcomingCount is a valid number');
    assert(dataP5.data.myTournaments.completedCount >= 1, 'completedCount reflects finished tournaments');
    assert(dataP5.data.myTournaments.hostedCount >= 1, 'hostedCount reflects tournaments created by user1');
    const hostedFound = dataP5.data.myTournaments.hosted.some(
      (t) => t._id.toString() === tHosted._id.toString()
    );
    assert(hostedFound, 'Hosted tournament is included in hosted list');

    // -------------------------------------------------------------------------
    // 13 & 14. Authoritative Score & Rank Correctness
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 13 & 14: Score & Rank Correctness ---');
    // In tAwaitingNext, user1 won pairingFinished (1-0), so user1 must have score 1.0 and rank 1
    // Re-check dashboard for user1 with tAwaitingNext set to IN_PROGRESS
    await Tournament.findByIdAndUpdate(tAwaitingNext._id, { status: 'IN_PROGRESS' });
    const resScore = await fetch(`${API_BASE}/users/dashboard`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const dataScore = await resScore.json();
    assert(dataScore.data.currentTournament.userScore === 1, 'Authoritative score is 1.0 from standingsService');
    assert(dataScore.data.currentTournament.userRank === 1, 'Authoritative rank is 1 from standingsService');
    assert(dataScore.data.currentTournament.totalPlayers === 1, 'totalPlayers is 1');

    // -------------------------------------------------------------------------
    // 18. Dashboard Error Handling
    // -------------------------------------------------------------------------
    console.log('\n--- Test 18: Dashboard Error Handling ---');
    // Test invalid ObjectId in service directly
    let errorCaught = false;
    try {
      await getUserDashboardData('invalid-mongo-id');
    } catch (err) {
      errorCaught = true;
      assert(err.statusCode === 400, 'Invalid user ID throws error with status 400');
    }
    assert(errorCaught, 'Service handles invalid user ID safely');

    // Test non-existent user ID
    let notFoundCaught = false;
    try {
      await getUserDashboardData(new mongoose.Types.ObjectId());
    } catch (err) {
      notFoundCaught = true;
      assert(err.statusCode === 404, 'Non-existent user throws error with status 404');
    }
    assert(notFoundCaught, 'Service handles missing user safely');

    console.log('\n==================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} DASHBOARD AUDIT TESTS PASSED!`);
    console.log('==================================================\n');
  } catch (error) {
    console.error('\n❌ Dashboard Test Suite failed:', error);
    process.exit(1);
  } finally {
    // Cleanup test records
    console.log('🧹 Cleaning up test records...');
    await TournamentJoinRequest.deleteMany({ _id: { $in: createdRequestIds } });
    await Pairing.deleteMany({ _id: { $in: createdPairingIds } });
    await Round.deleteMany({ _id: { $in: createdRoundIds } });
    await TournamentPlayer.deleteMany({ _id: { $in: createdPlayerIds } });
    await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    testServer.close();
  }
};

runDashboardTests()
  .then(() => {
    console.log('✨ Dashboard test suite run complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
