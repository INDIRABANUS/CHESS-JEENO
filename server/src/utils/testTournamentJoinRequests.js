import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import * as tournamentJoinRequestService from '../services/tournamentJoinRequestService.js';
import * as standingsService from '../services/standingsService.js';
import * as roundService from '../services/roundService.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import TournamentJoinRequest from '../models/TournamentJoinRequest.js';
import { getDevUserId } from './devUser.js';

dotenv.config();

const runJoinRequestTests = async () => {
  console.log('🧪 Starting Tournament Join Request & Host Approval Test Suite...\n');
  await connectDB();

  const devUserId = await getDevUserId();
  const testPrefix = `join_req_test_${Date.now()}`;

  // Create test users
  const hostUser = await User.findById(devUserId);
  const otherHostUser = await User.create({
    name: 'Other Host',
    email: `${testPrefix}_other_host@chessjeeno.local`,
    authProvider: 'local',
    lichessUsername: `other_host_${Date.now()}`,
  });

  const player1 = await User.create({
    name: 'Player One',
    email: `${testPrefix}_p1@chessjeeno.local`,
    authProvider: 'local',
    lichessUsername: `p1_${Date.now()}`,
  });

  const player2 = await User.create({
    name: 'Player Two',
    email: `${testPrefix}_p2@chessjeeno.local`,
    authProvider: 'local',
    lichessUsername: `p2_${Date.now()}`,
  });

  const player3 = await User.create({
    name: 'Player Three',
    email: `${testPrefix}_p3@chessjeeno.local`,
    authProvider: 'local',
    lichessUsername: `p3_${Date.now()}`,
  });

  const player4 = await User.create({
    name: 'Player Four',
    email: `${testPrefix}_p4@chessjeeno.local`,
    authProvider: 'local',
    lichessUsername: `p4_${Date.now()}`,
  });

  let tournament = null;
  let tournament2 = null;

  try {
    // Setup tournament
    tournament = await tournamentService.createTournament(
      {
        name: 'Join Request Test Championship',
        description: 'Testing player join requests and host approval flow',
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 3, // capacity limit of 3 for testing
        rated: false,
      },
      hostUser._id
    );
    console.log(`✅ Test tournament created: "${tournament.name}" (Capacity: 3, Host: ${hostUser.name})`);

    tournament2 = await tournamentService.createTournament(
      {
        name: 'Second Test Tournament',
        description: 'For testing cross-tournament security',
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 10,
        rated: false,
      },
      otherHostUser._id
    );

    // ==========================================
    // TEST A: New user requests to join
    // ==========================================
    console.log('\n--- Test A: New user requests to join ---');
    const req1 = await tournamentJoinRequestService.createJoinRequest(tournament._id, player1._id);
    if (!req1 || !req1._id) throw new Error('Test A Failed: Request was not created');
    console.log(`✅ Test A Passed: Player 1 successfully created join request ID: ${req1._id}`);

    // ==========================================
    // TEST B: Request created as PENDING
    // ==========================================
    console.log('\n--- Test B: Request created as PENDING ---');
    if (req1.status !== 'PENDING') throw new Error(`Test B Failed: Status is ${req1.status}, expected PENDING`);
    if (req1.user._id.toString() !== player1._id.toString() && req1.user.toString() !== player1._id.toString()) {
      throw new Error('Test B Failed: User ID mismatch');
    }
    if (!req1.requestedAt) throw new Error('Test B Failed: requestedAt timestamp missing');
    const statusB = await tournamentJoinRequestService.getJoinRequestStatus(tournament._id, player1._id);
    if (statusB.status !== 'PENDING' || statusB.isParticipant !== false) {
      throw new Error(`Test B Failed: getJoinRequestStatus returned ${JSON.stringify(statusB)}`);
    }
    console.log(`✅ Test B Passed: Request verified as PENDING with timestamp and getJoinRequestStatus confirms PENDING`);

    // ==========================================
    // TEST C: Duplicate pending request blocked
    // ==========================================
    console.log('\n--- Test C: Duplicate pending request blocked ---');
    let duplicateBlocked = false;
    try {
      await tournamentJoinRequestService.createJoinRequest(tournament._id, player1._id);
    } catch (err) {
      duplicateBlocked = true;
      if (err.statusCode !== 400) throw new Error(`Test C Failed: Expected 400 error, got ${err.statusCode}`);
      console.log(`✅ Test C Passed: Duplicate request blocked with message: "${err.message}"`);
    }
    if (!duplicateBlocked) throw new Error('Test C Failed: Duplicate request was allowed!');

    // ==========================================
    // TEST E: Host can view pending requests
    // ==========================================
    console.log('\n--- Test E: Host can view pending requests ---');
    const hostRequests = await tournamentJoinRequestService.getJoinRequests(tournament._id, hostUser._id);
    if (!Array.isArray(hostRequests) || hostRequests.length !== 1) {
      throw new Error(`Test E Failed: Expected 1 request, got ${hostRequests.length}`);
    }
    if (hostRequests[0]._id.toString() !== req1._id.toString()) {
      throw new Error('Test E Failed: Request ID mismatch in host view');
    }
    console.log(`✅ Test E Passed: Host successfully retrieved pending requests list (Count: ${hostRequests.length})`);

    // ==========================================
    // TEST F: Non-host cannot view/manage host requests
    // ==========================================
    console.log('\n--- Test F: Non-host cannot view/manage host requests ---');
    let nonHostViewBlocked = false;
    try {
      await tournamentJoinRequestService.getJoinRequests(tournament._id, player1._id);
    } catch (err) {
      if (err.statusCode === 403) nonHostViewBlocked = true;
    }
    if (!nonHostViewBlocked) throw new Error('Test F Failed: Non-host was allowed to view join requests!');

    let nonHostApproveBlocked = false;
    try {
      await tournamentJoinRequestService.approveJoinRequest(tournament._id, req1._id, player2._id);
    } catch (err) {
      if (err.statusCode === 403) nonHostApproveBlocked = true;
    }
    if (!nonHostApproveBlocked) throw new Error('Test F Failed: Non-host was allowed to approve join request!');

    let nonHostRejectBlocked = false;
    try {
      await tournamentJoinRequestService.rejectJoinRequest(tournament._id, req1._id, player2._id);
    } catch (err) {
      if (err.statusCode === 403) nonHostRejectBlocked = true;
    }
    if (!nonHostRejectBlocked) throw new Error('Test F Failed: Non-host was allowed to reject join request!');
    console.log('✅ Test F Passed: Non-host operations (view, approve, reject) properly rejected with 403 Forbidden');

    // ==========================================
    // TEST J: Pending request does not increase player count
    // ==========================================
    console.log('\n--- Test J: Pending request does not increase player count ---');
    let tourneyData = await tournamentService.getTournamentById(tournament._id, hostUser._id);
    if (tourneyData.registeredPlayers !== 0) {
      throw new Error(`Test J Failed: registeredPlayers is ${tourneyData.registeredPlayers}, expected 0`);
    }
    const playerCountBeforeApproval = await TournamentPlayer.countDocuments({ tournamentId: tournament._id });
    if (playerCountBeforeApproval !== 0) {
      throw new Error(`Test J Failed: TournamentPlayer count is ${playerCountBeforeApproval}, expected 0`);
    }
    console.log(`✅ Test J Passed: registeredPlayers count is ${tourneyData.registeredPlayers} while request is PENDING`);

    // ==========================================
    // TEST G: Host approves request
    // ==========================================
    console.log('\n--- Test G: Host approves request ---');
    const approvalResult = await tournamentJoinRequestService.approveJoinRequest(tournament._id, req1._id, hostUser._id);
    if (!approvalResult.request || approvalResult.request.status !== 'APPROVED') {
      throw new Error('Test G Failed: Request status is not APPROVED after approval');
    }
    if (!approvalResult.request.reviewedBy || approvalResult.request.reviewedBy.toString() !== hostUser._id.toString()) {
      throw new Error('Test G Failed: reviewedBy not properly set');
    }
    if (!approvalResult.request.reviewedAt) {
      throw new Error('Test G Failed: reviewedAt timestamp not set');
    }
    console.log(`✅ Test G Passed: Host approved request, status marked APPROVED, reviewedBy/reviewedAt recorded`);

    // ==========================================
    // TEST H: Approval creates exactly ONE TournamentPlayer
    // ==========================================
    console.log('\n--- Test H: Approval creates exactly ONE TournamentPlayer ---');
    const p1Players = await TournamentPlayer.find({ tournamentId: tournament._id, userId: player1._id });
    if (p1Players.length !== 1) {
      throw new Error(`Test H Failed: Expected exactly 1 TournamentPlayer record for player1, found ${p1Players.length}`);
    }
    console.log(`✅ Test H Passed: Exactly one TournamentPlayer record exists for player 1 (ID: ${p1Players[0]._id})`);

    // ==========================================
    // TEST I: Approved player count increases correctly
    // ==========================================
    console.log('\n--- Test I: Approved player count increases correctly ---');
    tourneyData = await tournamentService.getTournamentById(tournament._id, player1._id);
    if (tourneyData.registeredPlayers !== 1) {
      throw new Error(`Test I Failed: registeredPlayers is ${tourneyData.registeredPlayers}, expected 1`);
    }
    if (tourneyData.joinRequestStatus !== 'PARTICIPANT' || !tourneyData.isRegistered) {
      throw new Error(`Test I Failed: joinRequestStatus is ${tourneyData.joinRequestStatus}, expected PARTICIPANT`);
    }
    console.log(`✅ Test I Passed: registeredPlayers is now 1, and player status is PARTICIPANT`);

    // ==========================================
    // TEST D: Already-approved participant cannot request again
    // ==========================================
    console.log('\n--- Test D: Already-approved participant cannot request again ---');
    let approvedRejoinBlocked = false;
    try {
      await tournamentJoinRequestService.createJoinRequest(tournament._id, player1._id);
    } catch (err) {
      approvedRejoinBlocked = true;
      if (err.statusCode !== 400) throw new Error(`Test D Failed: Expected 400, got ${err.statusCode}`);
      console.log(`✅ Test D Passed: Re-request blocked: "${err.message}"`);
    }
    if (!approvedRejoinBlocked) throw new Error('Test D Failed: Approved participant was able to request again!');

    // ==========================================
    // TEST K: Host rejects request
    // ==========================================
    console.log('\n--- Test K: Host rejects request ---');
    const req2 = await tournamentJoinRequestService.createJoinRequest(tournament._id, player2._id);
    console.log(`   Player 2 created request ID: ${req2._id}`);
    const rejectResult = await tournamentJoinRequestService.rejectJoinRequest(tournament._id, req2._id, hostUser._id);
    if (rejectResult.status !== 'REJECTED') {
      throw new Error(`Test K Failed: Request status is ${rejectResult.status}, expected REJECTED`);
    }
    if (!rejectResult.reviewedBy || !rejectResult.reviewedAt) {
      throw new Error('Test K Failed: reviewedBy or reviewedAt missing after rejection');
    }
    console.log(`✅ Test K Passed: Request successfully rejected with status REJECTED`);

    // ==========================================
    // TEST L: Rejected request does not create participant
    // ==========================================
    console.log('\n--- Test L: Rejected request does not create participant ---');
    const p2Player = await TournamentPlayer.findOne({ tournamentId: tournament._id, userId: player2._id });
    if (p2Player) {
      throw new Error('Test L Failed: TournamentPlayer was created for rejected user!');
    }
    const statusL = await tournamentJoinRequestService.getJoinRequestStatus(tournament._id, player2._id);
    if (statusL.status !== 'REJECTED' || statusL.isParticipant !== false) {
      throw new Error(`Test L Failed: Status returned ${JSON.stringify(statusL)}, expected REJECTED / not participant`);
    }
    const tourneyAfterReject = await tournamentService.getTournamentById(tournament._id, player2._id);
    if (tourneyAfterReject.registeredPlayers !== 1) {
      throw new Error(`Test L Failed: Player count changed to ${tourneyAfterReject.registeredPlayers}`);
    }
    if (tourneyAfterReject.joinRequestStatus !== 'REJECTED') {
      throw new Error(`Test L Failed: joinRequestStatus is ${tourneyAfterReject.joinRequestStatus}, expected REJECTED`);
    }
    console.log('✅ Test L Passed: No TournamentPlayer record created for rejected user; status is REJECTED');

    // ==========================================
    // TEST M: Duplicate approval is blocked/idempotent
    // ==========================================
    console.log('\n--- Test M: Duplicate approval is blocked/idempotent ---');
    let dupApprovalBlocked = false;
    try {
      await tournamentJoinRequestService.approveJoinRequest(tournament._id, req1._id, hostUser._id);
    } catch (err) {
      dupApprovalBlocked = true;
      if (err.statusCode !== 400) throw new Error(`Test M Failed: Expected 400, got ${err.statusCode}`);
      console.log(`   Duplicate approval blocked with: "${err.message}"`);
    }
    if (!dupApprovalBlocked) throw new Error('Test M Failed: Duplicate approval was allowed!');

    let approveRejectedBlocked = false;
    try {
      await tournamentJoinRequestService.approveJoinRequest(tournament._id, req2._id, hostUser._id);
    } catch (err) {
      approveRejectedBlocked = true;
      if (err.statusCode !== 400) throw new Error(`Test M Failed: Expected 400, got ${err.statusCode}`);
      console.log(`   Approving already rejected request blocked with: "${err.message}"`);
    }
    if (!approveRejectedBlocked) throw new Error('Test M Failed: Approving rejected request was allowed!');
    console.log('✅ Test M Passed: Duplicate approval and approving rejected requests cleanly blocked');

    // ==========================================
    // TEST N: Tournament-full approval is rejected
    // ==========================================
    console.log('\n--- Test N: Tournament-full approval is rejected ---');
    // Tournament maxPlayers is 3. Currently 1 approved (player1).
    // Let's approve player3 and player4 to fill up to 3
    const req3 = await tournamentJoinRequestService.createJoinRequest(tournament._id, player3._id);
    await tournamentJoinRequestService.approveJoinRequest(tournament._id, req3._id, hostUser._id);
    console.log('   Player 3 approved (participants = 2/3)');

    const req4 = await tournamentJoinRequestService.createJoinRequest(tournament._id, player4._id);
    await tournamentJoinRequestService.approveJoinRequest(tournament._id, req4._id, hostUser._id);
    console.log('   Player 4 approved (participants = 3/3 - FULL)');

    // Create a 5th user to attempt requesting / approving when full
    const player5 = await User.create({
      name: 'Player Five',
      email: `${testPrefix}_p5@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `p5_${Date.now()}`,
    });

    let joinWhenFullBlocked = false;
    try {
      await tournamentJoinRequestService.createJoinRequest(tournament._id, player5._id);
    } catch (err) {
      joinWhenFullBlocked = true;
      if (err.statusCode !== 400) throw new Error(`Test N Failed: Expected 400, got ${err.statusCode}`);
      console.log(`   Join request when tournament full blocked: "${err.message}"`);
    }
    if (!joinWhenFullBlocked) throw new Error('Test N Failed: Requesting to join full tournament was allowed!');

    // Also verify approval cannot exceed capacity if capacity changed
    // Let's insert a pending request directly to simulate capacity filling between request and approval
    const orphanReq = await TournamentJoinRequest.create({
      tournament: tournament._id,
      user: player5._id,
      status: 'PENDING',
      requestedAt: new Date(),
    });
    let approveWhenFullBlocked = false;
    try {
      await tournamentJoinRequestService.approveJoinRequest(tournament._id, orphanReq._id, hostUser._id);
    } catch (err) {
      approveWhenFullBlocked = true;
      if (err.statusCode !== 400) throw new Error(`Test N Failed: Expected 400, got ${err.statusCode}`);
      console.log(`   Approving request when tournament full blocked: "${err.message}"`);
    }
    if (!approveWhenFullBlocked) throw new Error('Test N Failed: Approving request when tournament full was allowed!');
    console.log('✅ Test N Passed: Tournament full capacity strictly enforced on both request and approval');

    // ==========================================
    // TEST O: Cross-tournament request manipulation blocked
    // ==========================================
    console.log('\n--- Test O: Cross-tournament request manipulation blocked ---');
    let crossTourneyApproveBlocked = false;
    try {
      // Trying to approve req1 (which belongs to tournament 1) using tournament 2's ID
      await tournamentJoinRequestService.approveJoinRequest(tournament2._id, req1._id, otherHostUser._id);
    } catch (err) {
      crossTourneyApproveBlocked = true;
      if (err.statusCode !== 400) throw new Error(`Test O Failed: Expected 400, got ${err.statusCode}`);
      console.log(`   Cross-tournament approval blocked: "${err.message}"`);
    }
    if (!crossTourneyApproveBlocked) throw new Error('Test O Failed: Cross-tournament approval was allowed!');

    let crossTourneyRejectBlocked = false;
    try {
      await tournamentJoinRequestService.rejectJoinRequest(tournament2._id, req1._id, otherHostUser._id);
    } catch (err) {
      crossTourneyRejectBlocked = true;
      if (err.statusCode !== 400) throw new Error(`Test O Failed: Expected 400, got ${err.statusCode}`);
      console.log(`   Cross-tournament rejection blocked: "${err.message}"`);
    }
    if (!crossTourneyRejectBlocked) throw new Error('Test O Failed: Cross-tournament rejection was allowed!');
    console.log('✅ Test O Passed: Cross-tournament approval and rejection strictly blocked');

    // ==========================================
    // TEST P: Nonexistent tournament handled correctly
    // ==========================================
    console.log('\n--- Test P: Nonexistent tournament handled correctly ---');
    const fakeId = new mongoose.Types.ObjectId();
    let fakeTourneyBlocked = false;
    try {
      await tournamentJoinRequestService.createJoinRequest(fakeId, player1._id);
    } catch (err) {
      fakeTourneyBlocked = true;
      if (err.statusCode !== 404) throw new Error(`Test P Failed: Expected 404, got ${err.statusCode}`);
      console.log(`   Nonexistent tournament request rejected with 404: "${err.message}"`);
    }
    if (!fakeTourneyBlocked) throw new Error('Test P Failed: Request to nonexistent tournament did not return 404!');
    console.log('✅ Test P Passed: Nonexistent tournament returns 404');

    // ==========================================
    // TEST Q: Registration-closed request handled correctly
    // ==========================================
    console.log('\n--- Test Q: Registration-closed request handled correctly ---');
    // Change tournament2 to IN_PROGRESS
    await Tournament.findByIdAndUpdate(tournament2._id, { status: 'IN_PROGRESS' });
    let closedRegBlocked = false;
    try {
      await tournamentJoinRequestService.createJoinRequest(tournament2._id, player1._id);
    } catch (err) {
      closedRegBlocked = true;
      if (err.statusCode !== 400) throw new Error(`Test Q Failed: Expected 400, got ${err.statusCode}`);
      console.log(`   Closed registration request rejected with: "${err.message}"`);
    }
    if (!closedRegBlocked) throw new Error('Test Q Failed: Request when registration closed was allowed!');
    console.log('✅ Test Q Passed: Requests during IN_PROGRESS rejected');

    // ==========================================
    // TEST R: Existing participants still work
    // ==========================================
    console.log('\n--- Test R: Existing participants still work ---');
    // Player 1, 3, 4 are approved participants in tournament
    const playersList = await tournamentPlayerService.getTournamentPlayers(tournament._id);
    if (playersList.length !== 3) {
      throw new Error(`Test R Failed: Expected 3 participants, got ${playersList.length}`);
    }
    const tData1 = await tournamentService.getTournamentById(tournament._id, player1._id);
    if (!tData1.isRegistered || tData1.joinRequestStatus !== 'PARTICIPANT') {
      throw new Error(`Test R Failed: Player 1 isRegistered=${tData1.isRegistered}, status=${tData1.joinRequestStatus}`);
    }
    console.log(`✅ Test R Passed: Existing participants correctly reported as PARTICIPANT with isRegistered=true`);

    // ==========================================
    // TEST S: Leave behavior still works
    // ==========================================
    console.log('\n--- Test S: Leave behavior still works ---');
    const leaveResult = await tournamentPlayerService.leaveTournament(tournament._id, player4._id);
    console.log(`   Player 4 left: "${leaveResult.message}"`);
    const countAfterLeave = await TournamentPlayer.countDocuments({ tournamentId: tournament._id });
    if (countAfterLeave !== 2) {
      throw new Error(`Test S Failed: Expected 2 players after leave, got ${countAfterLeave}`);
    }
    const statusAfterLeave = await tournamentJoinRequestService.getJoinRequestStatus(tournament._id, player4._id);
    if (statusAfterLeave.status !== 'NOT_REQUESTED' || statusAfterLeave.isParticipant) {
      throw new Error(`Test S Failed: Status after leave is ${statusAfterLeave.status}, expected NOT_REQUESTED`);
    }
    // Now that player4 left and capacity is 2/3, player4 can submit a new join request
    const reReq = await tournamentJoinRequestService.createJoinRequest(tournament._id, player4._id);
    if (reReq.status !== 'PENDING') {
      throw new Error(`Test S Failed: Re-request status is ${reReq.status}, expected PENDING`);
    }
    console.log('✅ Test S Passed: Leave removes participant, cleans up join request, and allows re-requesting');

    // ==========================================
    // TEST T: Ready system ignores pending users
    // ==========================================
    console.log('\n--- Test T: Ready system ignores pending users ---');
    // Player 4 currently has a PENDING request (not approved)
    let pendingReadyBlocked = false;
    try {
      await tournamentPlayerService.setPlayerReady(tournament._id, player4._id);
    } catch (err) {
      pendingReadyBlocked = true;
      if (err.statusCode !== 400) throw new Error(`Test T Failed: Expected 400, got ${err.statusCode}`);
      console.log(`   Pending user setting ready blocked: "${err.message}"`);
    }
    if (!pendingReadyBlocked) throw new Error('Test T Failed: Pending user was able to set ready!');

    // Player 1 is an approved participant and CAN set ready
    await tournamentPlayerService.setPlayerReady(tournament._id, player1._id);
    const tourneyWithReady = await tournamentService.getTournamentById(tournament._id, player1._id);
    if (tourneyWithReady.readyPlayers !== 1) {
      throw new Error(`Test T Failed: readyPlayers is ${tourneyWithReady.readyPlayers}, expected 1`);
    }
    console.log(`✅ Test T Passed: Pending user cannot set ready; readyPlayers count (${tourneyWithReady.readyPlayers}) only counts approved players`);

    // ==========================================
    // TEST U: Round generation ignores pending users
    // ==========================================
    console.log('\n--- Test U: Round generation ignores pending users ---');
    // Currently approved participants: player1 and player3 (2 players).
    // Pending users: player4 and player5.
    // Create Round 1
    const round1 = await roundService.createRound(tournament._id, hostUser._id);
    if (!round1 || !round1.round) throw new Error('Test U Failed: Round was not created');
    const pairings = round1.pairings;
    console.log(`   Round 1 created with ${pairings.length} pairing(s)`);

    // Check that neither player4 nor player5 is in any pairing
    for (const p of pairings) {
      const whiteId = (p.whitePlayer?._id || p.whitePlayer)?.toString();
      const blackId = (p.blackPlayer?._id || p.blackPlayer)?.toString();
      if (whiteId === player4._id.toString() || blackId === player4._id.toString()) {
        throw new Error('Test U Failed: Pending player 4 was included in round pairings!');
      }
      if (whiteId === player5._id.toString() || blackId === player5._id.toString()) {
        throw new Error('Test U Failed: Pending player 5 was included in round pairings!');
      }
    }
    console.log('✅ Test U Passed: Round generation strictly ignores pending users; only approved participants paired');

    // ==========================================
    // TEST V: Standings ignore pending users
    // ==========================================
    console.log('\n--- Test V: Standings ignore pending users ---');
    const standingsData = await standingsService.getTournamentStandings(tournament._id);
    const standingsList = standingsData.standings;
    console.log(`   Standings returned ${standingsList.length} participant(s)`);

    for (const entry of standingsList) {
      const pId = entry.playerId.toString();
      if (pId === player4._id.toString()) {
        throw new Error('Test V Failed: Pending player 4 found in standings!');
      }
      if (pId === player5._id.toString()) {
        throw new Error('Test V Failed: Pending player 5 found in standings!');
      }
    }
    if (standingsList.length !== 2) {
      throw new Error(`Test V Failed: Standings count is ${standingsList.length}, expected 2 (only approved players)`);
    }
    console.log('✅ Test V Passed: Standings completely exclude pending users');

    console.log('\n==================================================');
    console.log('🎉 ALL 22 JOIN REQUEST & HOST APPROVAL TESTS (A–V) PASSED!');
    console.log('==================================================\n');
  } catch (error) {
    console.error('❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    // Cleanup test data
    try {
      if (tournament) {
        await Tournament.findByIdAndDelete(tournament._id);
        await TournamentPlayer.deleteMany({ tournamentId: tournament._id });
        await TournamentJoinRequest.deleteMany({ tournament: tournament._id });
      }
      if (tournament2) {
        await Tournament.findByIdAndDelete(tournament2._id);
        await TournamentPlayer.deleteMany({ tournamentId: tournament2._id });
        await TournamentJoinRequest.deleteMany({ tournament: tournament2._id });
      }
      await User.deleteMany({ email: { $regex: testPrefix } });
    } catch (_) {}
    await mongoose.disconnect();
  }
};

runJoinRequestTests();
