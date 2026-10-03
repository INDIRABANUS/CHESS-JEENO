import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import * as tournamentService from '../services/tournamentService.js';
import { getTournaments as tournamentControllerGetTournaments } from '../controllers/tournamentController.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import TournamentJoinRequest from '../models/TournamentJoinRequest.js';

dotenv.config();

/**
 * Mock request and response helpers for testing controller endpoints directly.
 */
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
  console.log('🧪 Starting Milestone Test Suite: My Tournaments + Relevance Sorting...\n');
  await connectDB();

  const testSuffix = `v2_test_${Date.now()}`;

  // Track created entities for clean teardown
  const createdUserIds = [];
  const createdTournamentIds = [];

  try {
    // ----------------------------------------------------
    // Setup test users
    // ----------------------------------------------------
    const hostUser = await User.create({
      name: 'V2 Test Host',
      email: `${testSuffix}_host@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `host_${Date.now()}`,
    });
    createdUserIds.push(hostUser._id);

    const participantUser = await User.create({
      name: 'V2 Test Participant',
      email: `${testSuffix}_part@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `part_${Date.now()}`,
    });
    createdUserIds.push(participantUser._id);

    const pendingUser = await User.create({
      name: 'V2 Test Pending User',
      email: `${testSuffix}_pend@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `pend_${Date.now()}`,
    });
    createdUserIds.push(pendingUser._id);

    const rejectedUser = await User.create({
      name: 'V2 Test Rejected User',
      email: `${testSuffix}_rej@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `rej_${Date.now()}`,
    });
    createdUserIds.push(rejectedUser._id);

    const emptyUser = await User.create({
      name: 'V2 Test Empty User',
      email: `${testSuffix}_empty@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `empty_${Date.now()}`,
    });
    createdUserIds.push(emptyUser._id);

    const otherHost = await User.create({
      name: 'V2 Other Host',
      email: `${testSuffix}_otherhost@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `otherhost_${Date.now()}`,
    });
    createdUserIds.push(otherHost._id);

    // ----------------------------------------------------
    // Setup test tournaments
    // ----------------------------------------------------
    const now = Date.now();

    // 1. T1: Created by hostUser, SWISS, REGISTRATION, startTime in 2 hours
    const tourney1 = await Tournament.create({
      name: `T1_Swiss_Upcoming_${testSuffix}`,
      format: 'SWISS',
      clockLimit: 300,
      increment: 0,
      totalRounds: 3,
      status: 'REGISTRATION',
      startTime: new Date(now + 2 * 3600 * 1000), // in 2 hours
      createdBy: hostUser._id,
    });
    createdTournamentIds.push(tourney1._id);

    // 2. T2: Created by hostUser, ROUND_ROBIN, RUNNING, startTime 1 hour ago
    const tourney2 = await Tournament.create({
      name: `T2_RR_Running_${testSuffix}`,
      format: 'ROUND_ROBIN',
      clockLimit: 300,
      increment: 0,
      status: 'RUNNING',
      startTime: new Date(now - 1 * 3600 * 1000), // 1 hr ago
      createdBy: hostUser._id,
    });
    createdTournamentIds.push(tourney2._id);

    // 3. T3: Created by otherHost, KNOCKOUT, FINISHED, completed 10 minutes ago
    const tourney3 = await Tournament.create({
      name: `T3_KO_Finished_${testSuffix}`,
      format: 'KNOCKOUT',
      clockLimit: 300,
      increment: 0,
      status: 'FINISHED',
      startTime: new Date(now - 3 * 3600 * 1000),
      createdBy: otherHost._id,
      updatedAt: new Date(now - 10 * 60 * 1000),
    });
    createdTournamentIds.push(tourney3._id);

    // 4. T4: Created by otherHost, SWISS, REGISTRATION, startTime in 15 minutes (soonest upcoming!)
    const tourney4 = await Tournament.create({
      name: `T4_Swiss_Soonest_${testSuffix}`,
      format: 'SWISS',
      clockLimit: 300,
      increment: 0,
      totalRounds: 3,
      status: 'REGISTRATION',
      startTime: new Date(now + 15 * 60 * 1000), // in 15 mins
      createdBy: otherHost._id,
    });
    createdTournamentIds.push(tourney4._id);

    // 5. T5: Created by otherHost, ROUND_ROBIN, REGISTRATION, no startTime (unscheduled)
    const tourney5 = await Tournament.create({
      name: `T5_RR_Unscheduled_${testSuffix}`,
      format: 'ROUND_ROBIN',
      clockLimit: 300,
      increment: 0,
      status: 'REGISTRATION',
      startTime: null,
      createdBy: otherHost._id,
    });
    createdTournamentIds.push(tourney5._id);

    // 6. T6: Created by otherHost, KNOCKOUT, COMPLETED earlier (2 hours ago)
    const tourney6 = await Tournament.create({
      name: `T6_KO_CompletedEarlier_${testSuffix}`,
      format: 'KNOCKOUT',
      clockLimit: 300,
      increment: 0,
      status: 'COMPLETED',
      startTime: new Date(now - 5 * 3600 * 1000),
      createdBy: otherHost._id,
    });
    createdTournamentIds.push(tourney6._id);

    // Explicitly set historical updatedAt timestamps avoiding Mongoose timestamps: true create-time override
    await Tournament.updateOne(
      { _id: tourney6._id },
      { $set: { updatedAt: new Date(now - 2 * 3600 * 1000) } },
      { timestamps: false }
    );
    await Tournament.updateOne(
      { _id: tourney3._id },
      { $set: { updatedAt: new Date(now - 10 * 60 * 1000) } },
      { timestamps: false }
    );

    // ----------------------------------------------------
    // Setup participations & join requests
    // ----------------------------------------------------
    // participantUser joins tourney1 (approved participant) & is ready
    await TournamentPlayer.create({
      tournamentId: tourney1._id,
      userId: participantUser._id,
      isApproved: true,
      isReady: true,
    });

    // hostUser is ALSO a registered player in tourney1 (to test host precedence)
    await TournamentPlayer.create({
      tournamentId: tourney1._id,
      userId: hostUser._id,
      isApproved: true,
      isReady: false,
    });

    // pendingUser has only a PENDING join request for tourney1
    await TournamentJoinRequest.create({
      tournament: tourney1._id,
      user: pendingUser._id,
      status: 'PENDING',
    });

    // rejectedUser has a REJECTED join request for tourney1
    await TournamentJoinRequest.create({
      tournament: tourney1._id,
      user: rejectedUser._id,
      status: 'REJECTED',
    });

    // participantUser also joins tourney4 (approved participant)
    await TournamentPlayer.create({
      tournamentId: tourney4._id,
      userId: participantUser._id,
      isApproved: true,
      isReady: true,
    });

    console.log('✅ Test data successfully seeded.\n');

    // ====================================================
    // TEST 1: GET /api/tournaments default behavior
    // ====================================================
    console.log('--- Test 1: GET /api/tournaments default behavior ---');
    const res1 = createMockRes();
    await tournamentControllerGetTournaments(createMockReq({ query: {} }), res1, (err) => {
      if (err) throw err;
    });
    if (res1.statusCode !== 200 || !res1.body.success || !Array.isArray(res1.body.data)) {
      throw new Error(`Test 1 Failed: Expected 200 with data array, got status ${res1.statusCode}`);
    }
    const defaultData = res1.body.data;
    if (defaultData.length < 6) {
      throw new Error(`Test 1 Failed: Expected at least 6 tournaments, got ${defaultData.length}`);
    }
    const sampleT1 = defaultData.find((t) => t._id.toString() === tourney1._id.toString());
    if (!sampleT1 || !('registeredPlayers' in sampleT1) || !('readyPlayers' in sampleT1)) {
      throw new Error('Test 1 Failed: registeredPlayers or readyPlayers missing from response');
    }
    if (sampleT1.myRole !== null) {
      throw new Error(`Test 1 Failed: Unauthenticated default request should have myRole=null, got ${sampleT1.myRole}`);
    }
    console.log('✅ Test 1 Passed: Default behavior returns 200, valid list, player counts, and myRole=null for unauthenticated');

    // ====================================================
    // TEST 2: view=all
    // ====================================================
    console.log('\n--- Test 2: view=all explicitly ---');
    const res2 = createMockRes();
    await tournamentControllerGetTournaments(createMockReq({ query: { view: 'all' } }), res2, (err) => {
      if (err) throw err;
    });
    if (res2.statusCode !== 200 || !res2.body.success) {
      throw new Error(`Test 2 Failed: Expected 200, got ${res2.statusCode}`);
    }
    const foundT1 = res2.body.data.find((t) => t._id.toString() === tourney1._id.toString());
    const foundT3 = res2.body.data.find((t) => t._id.toString() === tourney3._id.toString());
    if (!foundT1 || !foundT3) {
      throw new Error('Test 2 Failed: view=all missing seeded tournaments');
    }
    console.log('✅ Test 2 Passed: view=all returns all tournaments for public browsing');

    // ====================================================
    // TEST 3: view=my requires authentication
    // ====================================================
    console.log('\n--- Test 3: view=my requires authentication ---');
    let test3CaughtError = null;
    const res3 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'my' }, user: null }),
      res3,
      (err) => {
        test3CaughtError = err;
      }
    );
    if (!test3CaughtError || test3CaughtError.statusCode !== 401) {
      throw new Error(`Test 3 Failed: Expected 401 error, got ${test3CaughtError?.statusCode || res3.statusCode}`);
    }
    console.log(`✅ Test 3 Passed: Unauthenticated view=my rejected with 401 ("${test3CaughtError.message}")`);

    // ====================================================
    // TEST 4: host appears in My Tournaments
    // ====================================================
    console.log('\n--- Test 4: host appears in My Tournaments ---');
    const res4 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'my' }, user: hostUser }),
      res4,
      (err) => {
        if (err) throw err;
      }
    );
    const hostTourneys = res4.body.data;
    const t1InHost = hostTourneys.find((t) => t._id.toString() === tourney1._id.toString());
    const t2InHost = hostTourneys.find((t) => t._id.toString() === tourney2._id.toString());
    const t3InHost = hostTourneys.find((t) => t._id.toString() === tourney3._id.toString());
    if (!t1InHost || !t2InHost) {
      throw new Error('Test 4 Failed: Host tournaments not found in My Tournaments for hostUser');
    }
    if (t3InHost) {
      throw new Error('Test 4 Failed: Tournaments created by another user should not appear unless participated');
    }
    console.log(`✅ Test 4 Passed: Host tournaments correctly returned (found ${hostTourneys.length} tournament(s))`);

    // ====================================================
    // TEST 5: approved participant appears in My Tournaments
    // ====================================================
    console.log('\n--- Test 5: approved participant appears in My Tournaments ---');
    const res5 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'my' }, user: participantUser }),
      res5,
      (err) => {
        if (err) throw err;
      }
    );
    const partTourneys = res5.body.data;
    const t1InPart = partTourneys.find((t) => t._id.toString() === tourney1._id.toString());
    const t4InPart = partTourneys.find((t) => t._id.toString() === tourney4._id.toString());
    if (!t1InPart || !t4InPart) {
      throw new Error('Test 5 Failed: Approved participant tournaments not found in My Tournaments');
    }
    if (t1InPart.myRole !== 'PARTICIPANT' || t4InPart.myRole !== 'PARTICIPANT') {
      throw new Error(`Test 5 Failed: Expected myRole=PARTICIPANT, got t1=${t1InPart.myRole}, t4=${t4InPart.myRole}`);
    }
    console.log(`✅ Test 5 Passed: Approved participant tournaments returned with myRole='PARTICIPANT'`);

    // ====================================================
    // TEST 6: pending join request does NOT appear
    // ====================================================
    console.log('\n--- Test 6: pending join request does NOT appear ---');
    const res6 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'my' }, user: pendingUser }),
      res6,
      (err) => {
        if (err) throw err;
      }
    );
    const pendingTourneys = res6.body.data;
    const t1InPending = pendingTourneys.find((t) => t._id.toString() === tourney1._id.toString());
    if (t1InPending) {
      throw new Error('Test 6 Failed: Pending join request incorrectly appeared in My Tournaments');
    }
    console.log('✅ Test 6 Passed: Pending join request strictly excluded from My Tournaments');

    // ====================================================
    // TEST 7: rejected join request does NOT appear
    // ====================================================
    console.log('\n--- Test 7: rejected join request does NOT appear ---');
    const res7 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'my' }, user: rejectedUser }),
      res7,
      (err) => {
        if (err) throw err;
      }
    );
    const rejectedTourneys = res7.body.data;
    const t1InRejected = rejectedTourneys.find((t) => t._id.toString() === tourney1._id.toString());
    if (t1InRejected) {
      throw new Error('Test 7 Failed: Rejected join request incorrectly appeared in My Tournaments');
    }
    console.log('✅ Test 7 Passed: Rejected join request strictly excluded from My Tournaments');

    // ====================================================
    // TEST 8: user with no tournaments gets empty array
    // ====================================================
    console.log('\n--- Test 8: user with no tournaments gets empty array ---');
    const res8 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'my' }, user: emptyUser }),
      res8,
      (err) => {
        if (err) throw err;
      }
    );
    if (!Array.isArray(res8.body.data) || res8.body.data.length !== 0) {
      throw new Error(`Test 8 Failed: Expected empty array, got length ${res8.body.data.length}`);
    }
    console.log('✅ Test 8 Passed: User with no tournaments gets empty array []');

    // ====================================================
    // TEST 9: sort=newest
    // ====================================================
    console.log('\n--- Test 9: sort=newest ---');
    const res9 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { sort: 'newest' } }),
      res9,
      (err) => {
        if (err) throw err;
      }
    );
    const newestList = res9.body.data;
    for (let i = 0; i < newestList.length - 1; i++) {
      const timeCurrent = new Date(newestList[i].createdAt).getTime();
      const timeNext = new Date(newestList[i + 1].createdAt).getTime();
      if (timeCurrent < timeNext) {
        throw new Error(`Test 9 Failed: sort=newest out of order at index ${i}`);
      }
    }
    console.log('✅ Test 9 Passed: sort=newest correctly sorts by createdAt descending');

    // ====================================================
    // TEST 10: sort=startingSoon
    // ====================================================
    console.log('\n--- Test 10: sort=startingSoon ---');
    const res10 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { sort: 'startingSoon' } }),
      res10,
      (err) => {
        if (err) throw err;
      }
    );
    const startingSoonList = res10.body.data;
    const idxT4 = startingSoonList.findIndex((t) => t._id.toString() === tourney4._id.toString());
    const idxT1 = startingSoonList.findIndex((t) => t._id.toString() === tourney1._id.toString());
    const idxT5 = startingSoonList.findIndex((t) => t._id.toString() === tourney5._id.toString());

    if (idxT4 === -1 || idxT1 === -1 || idxT5 === -1) {
      throw new Error('Test 10 Failed: Could not locate test tournaments in sort=startingSoon results');
    }
    // T4 (in 15 mins) must come before T1 (in 2 hours)
    if (idxT4 > idxT1) {
      throw new Error(`Test 10 Failed: T4 (starts in 15 mins, idx ${idxT4}) should come before T1 (starts in 2 hrs, idx ${idxT1})`);
    }
    // T5 (no startTime) must come after scheduled upcoming tournaments (T4 and T1)
    if (idxT5 < idxT1 || idxT5 < idxT4) {
      throw new Error(`Test 10 Failed: T5 (unscheduled, idx ${idxT5}) should come after scheduled tournaments (T1 idx ${idxT1})`);
    }
    console.log('✅ Test 10 Passed: sort=startingSoon prioritizes nearest upcoming startTime and places unscheduled tournaments after scheduled');

    // ====================================================
    // TEST 11: sort=recentlyCompleted
    // ====================================================
    console.log('\n--- Test 11: sort=recentlyCompleted ---');
    const res11 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { sort: 'recentlyCompleted' } }),
      res11,
      (err) => {
        if (err) throw err;
      }
    );
    const completedList = res11.body.data;
    const idxT3 = completedList.findIndex((t) => t._id.toString() === tourney3._id.toString());
    const idxT6 = completedList.findIndex((t) => t._id.toString() === tourney6._id.toString());
    const idxUnfinished = completedList.findIndex((t) => t._id.toString() === tourney1._id.toString());

    if (idxT3 === -1 || idxT6 === -1 || idxUnfinished === -1) {
      throw new Error('Test 11 Failed: Could not locate test tournaments in sort=recentlyCompleted results');
    }
    // T3 (completed 10 mins ago) must come before T6 (completed 2 hrs ago)
    if (idxT3 > idxT6) {
      throw new Error(`Test 11 Failed: T3 (completed 10m ago, idx ${idxT3}) should come before T6 (completed 2h ago, idx ${idxT6})`);
    }
    // Both completed tournaments must come before unfinished tournaments
    if (idxT3 > idxUnfinished || idxT6 > idxUnfinished) {
      throw new Error(`Test 11 Failed: Completed tournaments (T3 idx ${idxT3}, T6 idx ${idxT6}) should come before unfinished (T1 idx ${idxUnfinished})`);
    }
    console.log('✅ Test 11 Passed: sort=recentlyCompleted puts recently completed first and unfinished after completed');

    // ====================================================
    // TEST 12: invalid view/sort handling
    // ====================================================
    console.log('\n--- Test 12: invalid view/sort handling ---');
    const res12 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'malicious_view_value', sort: 'drop_table_users' } }),
      res12,
      (err) => {
        if (err) throw err;
      }
    );
    if (res12.statusCode !== 200 || !res12.body.success) {
      throw new Error(`Test 12 Failed: Invalid view/sort should safely fall back to 200, got ${res12.statusCode}`);
    }
    console.log('✅ Test 12 Passed: Invalid view and sort parameters safely fall back to defaults without error');

    // ====================================================
    // TEST 13: existing status/format filters still work
    // ====================================================
    console.log('\n--- Test 13: existing status/format filters still work ---');
    const res13Status = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { status: 'REGISTRATION' } }),
      res13Status,
      (err) => {
        if (err) throw err;
      }
    );
    const statusFiltered = res13Status.body.data;
    if (statusFiltered.some((t) => t.status !== 'REGISTRATION')) {
      throw new Error('Test 13 Failed: status filter returned non-REGISTRATION tournaments');
    }

    const res13Format = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { format: 'SWISS' } }),
      res13Format,
      (err) => {
        if (err) throw err;
      }
    );
    const formatFiltered = res13Format.body.data;
    if (formatFiltered.some((t) => t.format !== 'SWISS')) {
      throw new Error('Test 13 Failed: format filter returned non-SWISS tournaments');
    }

    // Combine status + format + view=my
    const res13Combined = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'my', format: 'SWISS' }, user: hostUser }),
      res13Combined,
      (err) => {
        if (err) throw err;
      }
    );
    const combinedFiltered = res13Combined.body.data;
    if (combinedFiltered.some((t) => t.format !== 'SWISS')) {
      throw new Error('Test 13 Failed: combined view=my and format=SWISS returned non-SWISS');
    }
    if (!combinedFiltered.some((t) => t._id.toString() === tourney1._id.toString())) {
      throw new Error('Test 13 Failed: combined view=my and format=SWISS missing T1');
    }
    console.log('✅ Test 13 Passed: Status and format filters work in isolation and combined with view=my');

    // ====================================================
    // TEST 14: registeredPlayers and readyPlayers remain correct
    // ====================================================
    console.log('\n--- Test 14: registeredPlayers and readyPlayers remain correct ---');
    const res14 = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'my' }, user: hostUser }),
      res14,
      (err) => {
        if (err) throw err;
      }
    );
    const t1WithCounts = res14.body.data.find((t) => t._id.toString() === tourney1._id.toString());
    // In tourney1: participantUser (ready=true) and hostUser (ready=false) -> 2 registered, 1 ready
    if (t1WithCounts.registeredPlayers !== 2) {
      throw new Error(`Test 14 Failed: Expected 2 registeredPlayers in T1, got ${t1WithCounts.registeredPlayers}`);
    }
    if (t1WithCounts.readyPlayers !== 1) {
      throw new Error(`Test 14 Failed: Expected 1 readyPlayers in T1, got ${t1WithCounts.readyPlayers}`);
    }
    console.log('✅ Test 14 Passed: registeredPlayers (2) and readyPlayers (1) accurate in tournament response');

    // ====================================================
    // TEST 15: myRole is correct
    // ====================================================
    console.log('\n--- Test 15: myRole is correct ---');
    // In tourney1, hostUser is BOTH creator AND a registered player. Host role takes precedence!
    const res15Host = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'my' }, user: hostUser }),
      res15Host,
      (err) => {
        if (err) throw err;
      }
    );
    const t1ForHost = res15Host.body.data.find((t) => t._id.toString() === tourney1._id.toString());
    if (t1ForHost.myRole !== 'HOST') {
      throw new Error(`Test 15 Failed: When user is both host and participant, expected HOST, got ${t1ForHost.myRole}`);
    }

    // In tourney1, participantUser is approved participant -> myRole === 'PARTICIPANT'
    const res15Part = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'my' }, user: participantUser }),
      res15Part,
      (err) => {
        if (err) throw err;
      }
    );
    const t1ForPart = res15Part.body.data.find((t) => t._id.toString() === tourney1._id.toString());
    if (t1ForPart.myRole !== 'PARTICIPANT') {
      throw new Error(`Test 15 Failed: Participant expected myRole=PARTICIPANT, got ${t1ForPart.myRole}`);
    }

    // For view=all with unauthenticated user -> myRole === null
    const res15AllUnauth = createMockRes();
    await tournamentControllerGetTournaments(
      createMockReq({ query: { view: 'all' }, user: null }),
      res15AllUnauth,
      (err) => {
        if (err) throw err;
      }
    );
    const t1ForAllUnauth = res15AllUnauth.body.data.find((t) => t._id.toString() === tourney1._id.toString());
    if (t1ForAllUnauth.myRole !== null) {
      throw new Error(`Test 15 Failed: For view=all unauthenticated, expected myRole=null, got ${t1ForAllUnauth.myRole}`);
    }

    console.log('✅ Test 15 Passed: myRole is correct (HOST for creator, HOST for both, PARTICIPANT for player, null for unauthenticated)');

    console.log('\n==================================================');
    console.log('🎉 ALL 15 BACKEND TESTS (1–15) PASSED SUCCESSFULLY!');
    console.log('==================================================\n');
  } finally {
    // Teardown test records
    console.log('🧹 Cleaning up test artifacts...');
    if (createdTournamentIds.length > 0) {
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await TournamentJoinRequest.deleteMany({ tournament: { $in: createdTournamentIds } });
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('✅ Teardown complete.\n');
    await mongoose.disconnect();
  }
};

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
