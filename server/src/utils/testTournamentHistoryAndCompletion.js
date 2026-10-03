import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import * as tournamentService from '../services/tournamentService.js';
import * as standingsService from '../services/standingsService.js';
import { getTournaments as tournamentControllerGetTournaments } from '../controllers/tournamentController.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import TournamentJoinRequest from '../models/TournamentJoinRequest.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

dotenv.config();

const createMockReq = ({ query = {}, user = null } = {}) => ({
  query,
  user,
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

const runTests = async () => {
  console.log('🧪 Starting Milestone 2 Test Suite: Tournament History & Post-Tournament Experience...\n');
  await connectDB();

  const testSuffix = `m2_test_${Date.now()}`;
  const createdUserIds = [];
  const createdTournamentIds = [];
  const createdRoundIds = [];
  const createdPairingIds = [];

  try {
    // ----------------------------------------------------
    // Setup test users
    // ----------------------------------------------------
    const hostUser = await User.create({
      name: 'M2 Host User',
      email: `${testSuffix}_host@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `m2host_${Date.now()}`,
    });
    createdUserIds.push(hostUser._id);

    const player1 = await User.create({
      name: 'M2 Player One (Champion)',
      email: `${testSuffix}_p1@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `m2p1_${Date.now()}`,
    });
    createdUserIds.push(player1._id);

    const player2 = await User.create({
      name: 'M2 Player Two (Runner-up)',
      email: `${testSuffix}_p2@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `m2p2_${Date.now()}`,
    });
    createdUserIds.push(player2._id);

    const nonParticipantUser = await User.create({
      name: 'M2 Non-Participant',
      email: `${testSuffix}_nonpart@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `m2nonpart_${Date.now()}`,
    });
    createdUserIds.push(nonParticipantUser._id);

    const pendingUser = await User.create({
      name: 'M2 Pending Requester',
      email: `${testSuffix}_pend@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `m2pend_${Date.now()}`,
    });
    createdUserIds.push(pendingUser._id);

    const rejectedUser = await User.create({
      name: 'M2 Rejected Requester',
      email: `${testSuffix}_rej@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `m2rej_${Date.now()}`,
    });
    createdUserIds.push(rejectedUser._id);

    console.log('✅ Created test users.');

    // ----------------------------------------------------
    // Test 1: Completed Tournament with Winner & Standings
    // ----------------------------------------------------
    console.log('\n--- Test 1: Completed Tournament exposes final standings & winner ---');
    const completedTourney = await Tournament.create({
      name: `Completed Championship ${testSuffix}`,
      description: 'A completed test tournament',
      createdBy: hostUser._id,
      format: 'ROUND_ROBIN',
      status: 'FINISHED',
      clockLimit: 300,
      increment: 0,
      winnerPlayer: player1._id,
      completionReason: 'TOTAL_ROUNDS_REACHED',
      updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
    });
    createdTournamentIds.push(completedTourney._id);

    // Register Player 1 and Player 2
    await TournamentPlayer.create({
      tournamentId: completedTourney._id,
      userId: player1._id,
      score: 1.0,
      isApproved: true,
      isReady: true,
    });
    await TournamentPlayer.create({
      tournamentId: completedTourney._id,
      userId: player2._id,
      score: 0.0,
      isApproved: true,
      isReady: true,
    });

    // Create completed Round 1 with pairing: player1 vs player2 (result: 1-0)
    const round1 = await Round.create({
      tournamentId: completedTourney._id,
      roundNumber: 1,
      status: 'COMPLETED',
    });
    createdRoundIds.push(round1._id);

    const pairing1 = await Pairing.create({
      tournamentId: completedTourney._id,
      roundId: round1._id,
      roundNumber: 1,
      whitePlayer: player1._id,
      blackPlayer: player2._id,
      status: 'FINISHED',
      result: '1-0',
    });
    createdPairingIds.push(pairing1._id);

    await standingsService.syncTournamentPlayerScores(completedTourney._id);

    // Also simulate pending and rejected join requests on this tournament
    await TournamentJoinRequest.create({
      tournament: completedTourney._id,
      user: pendingUser._id,
      status: 'PENDING',
    });
    await TournamentJoinRequest.create({
      tournament: completedTourney._id,
      user: rejectedUser._id,
      status: 'REJECTED',
    });

    // Fetch tournament via getTournamentById
    const fetchedTourney = await tournamentService.getTournamentById(completedTourney._id);
    if (!fetchedTourney) throw new Error('Failed to retrieve completed tournament');
    if (fetchedTourney.status !== 'FINISHED') throw new Error(`Expected FINISHED status, got ${fetchedTourney.status}`);
    if (!fetchedTourney.winnerPlayer || String(fetchedTourney.winnerPlayer._id) !== String(player1._id)) {
      throw new Error('Winner player was not properly populated or matched');
    }
    if (fetchedTourney.completionReason !== 'TOTAL_ROUNDS_REACHED') {
      throw new Error(`Expected TOTAL_ROUNDS_REACHED completionReason, got ${fetchedTourney.completionReason}`);
    }
    console.log('  ✓ Completed tournament properly populated with winner and completionReason');

    // Standings check
    const { standings } = await standingsService.getTournamentStandings(completedTourney._id);
    if (!Array.isArray(standings) || standings.length !== 2) {
      throw new Error(`Expected 2 players in standings, got ${standings.length}`);
    }
    if (String(standings[0].playerId) !== String(player1._id) || standings[0].score !== 1) {
      throw new Error('Top standing should be Player 1 with 1 score');
    }
    if (String(standings[1].playerId) !== String(player2._id) || standings[1].score !== 0) {
      throw new Error('Second standing should be Player 2 with 0 score');
    }
    console.log('  ✓ Standings correctly returned in rank order for completed tournament');

    // ----------------------------------------------------
    // Test 2: Edge Case: Completed tournament without a winner
    // ----------------------------------------------------
    console.log('\n--- Test 2: Missing winner edge case does not crash data handling ---');
    const noWinnerTourney = await Tournament.create({
      name: `Tied Unresolved Tourney ${testSuffix}`,
      description: 'Tournament completed with no winner',
      createdBy: hostUser._id,
      format: 'ROUND_ROBIN',
      status: 'FINISHED',
      clockLimit: 180,
      increment: 2,
      winnerPlayer: null,
      updatedAt: new Date(Date.now() - 1800000), // 30 mins ago
    });
    createdTournamentIds.push(noWinnerTourney._id);

    const fetchedNoWinner = await tournamentService.getTournamentById(noWinnerTourney._id);
    if (fetchedNoWinner.winnerPlayer !== null && fetchedNoWinner.winnerPlayer !== undefined) {
      throw new Error('Expected winnerPlayer to be null');
    }
    const { standings: noWinnerStandings } = await standingsService.getTournamentStandings(noWinnerTourney._id);
    if (!Array.isArray(noWinnerStandings)) {
      throw new Error('Standings should be an array even when no players or winner exist');
    }
    console.log('  ✓ Handled completed tournament with no winner gracefully without crashes');

    // ----------------------------------------------------
    // Test 3: Personal Result logic for participant vs non-participant
    // ----------------------------------------------------
    console.log('\n--- Test 3: Personal Result section logic (participant vs non-participant) ---');
    // Simulate helper function used by MyTournamentResultCard
    const computePersonalResult = (standingsList, userId) => {
      if (!standingsList || !userId) return null;
      const rankIndex = standingsList.findIndex(
        (s) => String(s.playerId) === String(userId) || String(s.user?._id) === String(userId)
      );
      if (rankIndex === -1) return null;
      return {
        rank: rankIndex + 1,
        stats: standingsList[rankIndex],
      };
    };

    const p1Result = computePersonalResult(standings, player1._id);
    if (!p1Result || p1Result.rank !== 1 || p1Result.stats.score !== 1) {
      throw new Error('Failed to compute participant result for Player 1 (rank 1)');
    }
    console.log('  ✓ Participant Player 1 receives Rank #1 result card data');

    const p2Result = computePersonalResult(standings, player2._id);
    if (!p2Result || p2Result.rank !== 2 || p2Result.stats.score !== 0) {
      throw new Error('Failed to compute participant result for Player 2 (rank 2)');
    }
    console.log('  ✓ Participant Player 2 receives Rank #2 result card data');

    // Host who did not participate
    const hostResult = computePersonalResult(standings, hostUser._id);
    if (hostResult !== null) {
      throw new Error('Non-playing host should NOT receive a personal result card');
    }
    console.log('  ✓ Non-playing host correctly receives null (no personal result card)');

    // Non-participant outside user
    const nonPartResult = computePersonalResult(standings, nonParticipantUser._id);
    if (nonPartResult !== null) {
      throw new Error('Non-participant user should NOT receive a personal result card');
    }
    console.log('  ✓ Non-participant user correctly receives null');

    // ----------------------------------------------------
    // Test 4: My Tournaments - Host & Participant visibility
    // ----------------------------------------------------
    console.log('\n--- Test 4: Completed tournaments appear under My Tournaments ---');
    // Host view: should contain completedTourney with myRole='HOST'
    const hostReq = createMockReq({
      query: { view: 'my' },
      user: { _id: hostUser._id },
    });
    const hostRes = createMockRes();
    await tournamentControllerGetTournaments(hostReq, hostRes);
    const hostTourneys = hostRes.body.data || [];
    const hostFoundCompleted = hostTourneys.find((t) => String(t._id) === String(completedTourney._id));
    if (!hostFoundCompleted) {
      throw new Error('Host failed to see completed tournament in My Tournaments');
    }
    if (hostFoundCompleted.myRole !== 'HOST') {
      throw new Error(`Expected myRole='HOST', got ${hostFoundCompleted.myRole}`);
    }
    console.log('  ✓ Host sees completed tournament with myRole=HOST');

    // Participant view: should contain completedTourney with myRole='PLAYER'
    const partReq = createMockReq({
      query: { view: 'my' },
      user: { _id: player1._id },
    });
    const partRes = createMockRes();
    await tournamentControllerGetTournaments(partReq, partRes);
    const partTourneys = partRes.body.data || [];
    const partFoundCompleted = partTourneys.find((t) => String(t._id) === String(completedTourney._id));
    if (!partFoundCompleted) {
      throw new Error('Participant Player 1 failed to see completed tournament in My Tournaments');
    }
    if (partFoundCompleted.myRole !== 'PARTICIPANT') {
      throw new Error(`Expected myRole='PARTICIPANT', got ${partFoundCompleted.myRole}`);
    }
    console.log('  ✓ Participant sees completed tournament with myRole=PARTICIPANT');

    // ----------------------------------------------------
    // Test 5: Pending & Rejected users remain excluded
    // ----------------------------------------------------
    console.log('\n--- Test 5: Pending/Rejected users remain excluded from My Tournaments ---');
    const pendReq = createMockReq({
      query: { view: 'my' },
      user: { _id: pendingUser._id },
    });
    const pendRes = createMockRes();
    await tournamentControllerGetTournaments(pendReq, pendRes);
    const pendTourneys = pendRes.body.data || [];
    if (pendTourneys.some((t) => String(t._id) === String(completedTourney._id))) {
      throw new Error('Pending requester saw completed tournament in My Tournaments');
    }
    console.log('  ✓ Pending user is correctly excluded from My Tournaments');

    const rejReq = createMockReq({
      query: { view: 'my' },
      user: { _id: rejectedUser._id },
    });
    const rejRes = createMockRes();
    await tournamentControllerGetTournaments(rejReq, rejRes);
    const rejTourneys = rejRes.body.data || [];
    if (rejTourneys.some((t) => String(t._id) === String(completedTourney._id))) {
      throw new Error('Rejected requester saw completed tournament in My Tournaments');
    }
    console.log('  ✓ Rejected user is correctly excluded from My Tournaments');

    // ----------------------------------------------------
    // Test 6: recentlyCompleted sorting & status filtering
    // ----------------------------------------------------
    console.log('\n--- Test 6: recentlyCompleted sorting & status filtering ---');
    // Create an active tournament
    const activeTourney = await Tournament.create({
      name: `Active Tourney ${testSuffix}`,
      createdBy: hostUser._id,
      format: 'SWISS',
      status: 'RUNNING',
      clockLimit: 600,
      increment: 5,
    });
    createdTournamentIds.push(activeTourney._id);

    // Test status filter: status=FINISHED should return completed tournaments but NOT activeTourney
    const statusFilterReq = createMockReq({
      query: { status: 'FINISHED' },
    });
    const statusFilterRes = createMockRes();
    await tournamentControllerGetTournaments(statusFilterReq, statusFilterRes);
    const filteredTourneys = statusFilterRes.body.data || [];
    if (filteredTourneys.some((t) => String(t._id) === String(activeTourney._id))) {
      throw new Error('Active tournament appeared when filtering for status=FINISHED');
    }
    if (!filteredTourneys.some((t) => String(t._id) === String(completedTourney._id))) {
      throw new Error('Completed tournament did not appear when filtering for status=FINISHED');
    }
    console.log('  ✓ status=FINISHED properly filters completed tournaments');

    // Test sort=recentlyCompleted
    const recentSortReq = createMockReq({
      query: { sort: 'recentlyCompleted' },
    });
    const recentSortRes = createMockRes();
    await tournamentControllerGetTournaments(recentSortReq, recentSortRes);
    const sortedTourneys = recentSortRes.body.data || [];
    const completedIdx = sortedTourneys.findIndex((t) => String(t._id) === String(completedTourney._id));
    const activeIdx = sortedTourneys.findIndex((t) => String(t._id) === String(activeTourney._id));
    if (completedIdx === -1 || activeIdx === -1 || completedIdx > activeIdx) {
      throw new Error('recentlyCompleted sort did not place completed tournament before active tournament');
    }
    console.log('  ✓ recentlyCompleted sort prioritizes completed tournaments');

    console.log('\n🎉 ALL MILESTONE 2 TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    // Teardown
    console.log('🧹 Cleaning up test artifacts...');
    if (createdPairingIds.length > 0) {
      await Pairing.deleteMany({ _id: { $in: createdPairingIds } });
    }
    if (createdRoundIds.length > 0) {
      await Round.deleteMany({ _id: { $in: createdRoundIds } });
    }
    if (createdTournamentIds.length > 0) {
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await TournamentJoinRequest.deleteMany({ tournament: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await mongoose.connection.close();
    console.log('✅ Cleanup complete.');
  }
};

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
