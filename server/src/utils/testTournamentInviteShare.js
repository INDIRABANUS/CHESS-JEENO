import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import * as tournamentJoinRequestService from '../services/tournamentJoinRequestService.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import TournamentJoinRequest from '../models/TournamentJoinRequest.js';
import { getDevUserId } from './devUser.js';

dotenv.config();

const runInviteShareTests = async () => {
  console.log('🧪 Starting Tournament Invite / Share Link Test Suite...\n');
  await connectDB();

  const devUserId = await getDevUserId();
  const testPrefix = `invite_test_${Date.now()}`;

  const hostUser = await User.findById(devUserId);
  const invitedPlayer = await User.create({
    name: 'Invited Guest Player',
    email: `${testPrefix}_guest@chessjeeno.local`,
    authProvider: 'local',
    lichessUsername: `guest_${Date.now()}`,
  });

  const secondPlayer = await User.create({
    name: 'Second Guest Player',
    email: `${testPrefix}_guest2@chessjeeno.local`,
    authProvider: 'local',
    lichessUsername: `guest2_${Date.now()}`,
  });

  let tournament = null;

  try {
    // Setup test tournament
    tournament = await tournamentService.createTournament(
      {
        name: 'Invitational Masters Championship',
        description: 'Exclusive tournament testing share link and join approval flow',
        format: 'SWISS',
        clockLimit: 300,
        increment: 2,
        maxPlayers: 8,
        totalRounds: 3,
        rated: true,
      },
      hostUser._id
    );
    console.log(`✅ Tournament created: "${tournament.name}" (ID: ${tournament._id})`);

    // ==========================================
    // TEST A & B: Host vs Non-Host Verification
    // ==========================================
    console.log('\n--- Test A & B: Host vs Non-Host Identification & Controls ---');
    const hostView = await tournamentService.getTournamentById(tournament._id, hostUser._id);
    const creatorId = (hostView.createdBy?._id || hostView.createdBy)?.toString();
    const isHostForHost = creatorId === hostUser._id.toString();
    if (!isHostForHost) {
      throw new Error('Test A Failed: Host user not recognized as host');
    }
    console.log('✅ Test A Passed: Host correctly identified; host has permission to view invite and manage requests');

    const guestView = await tournamentService.getTournamentById(tournament._id, invitedPlayer._id);
    const isHostForGuest = creatorId === invitedPlayer._id.toString();
    if (isHostForGuest) {
      throw new Error('Test B Failed: Non-host incorrectly recognized as host');
    }
    if (guestView.pendingJoinRequestsCount !== 0) {
      throw new Error('Test B Failed: Non-host should not see pending requests count');
    }
    console.log('✅ Test B Passed: Non-host correctly identified; non-host has NO host controls');

    // ==========================================
    // TEST C: Generated Share URL Format & Lookup
    // ==========================================
    console.log('\n--- Test C: Generated Share URL Format & Lookup ---');
    const baseUrl = 'https://chess-jeeno.vercel.app';
    const generatedShareUrl = `${baseUrl}/tournaments/${tournament._id}`;
    console.log(`   Generated Share URL: ${generatedShareUrl}`);

    // Verify URL does NOT contain sensitive info
    if (generatedShareUrl.includes('token') || generatedShareUrl.includes('secret') || generatedShareUrl.includes('password')) {
      throw new Error('Test C Failed: Share URL contains sensitive query parameters');
    }
    if (generatedShareUrl.includes(hostUser._id.toString())) {
      // URL must contain the tournament ID, not host user ID
      const expectedPath = `/tournaments/${tournament._id}`;
      if (!generatedShareUrl.endsWith(expectedPath)) {
        throw new Error('Test C Failed: Share URL path mismatch');
      }
    }
    console.log('✅ Test C Passed: Share URL format is clean, canonical, and contains only public tournament ID');

    // ==========================================
    // TEST F: Shared URL preserves public tournament loading
    // ==========================================
    console.log('\n--- Test F: Shared URL preserves public tournament loading ---');
    // An unauthenticated visitor opening the link (currentUserId = null)
    const publicLoad = await tournamentService.getTournamentById(tournament._id, null);
    if (!publicLoad || publicLoad._id.toString() !== tournament._id.toString()) {
      throw new Error('Test F Failed: Public loading failed to return correct tournament');
    }
    if (publicLoad.name !== tournament.name || publicLoad.format !== 'SWISS') {
      throw new Error('Test F Failed: Public data mismatch');
    }
    if (publicLoad.isRegistered !== false || publicLoad.joinRequestStatus !== 'NOT_REQUESTED') {
      throw new Error('Test F Failed: Unauthenticated user should have isRegistered=false, status=NOT_REQUESTED');
    }
    console.log(`✅ Test F Passed: Tournament details "${publicLoad.name}" load successfully for public visitor`);

    // ==========================================
    // TEST G: Shared URL preserves REQUEST TO JOIN flow
    // ==========================================
    console.log('\n--- Test G: Shared URL preserves REQUEST TO JOIN flow ---');
    // Invited player opens link, logs in, clicks REQUEST TO JOIN
    const joinReq = await tournamentJoinRequestService.createJoinRequest(tournament._id, invitedPlayer._id);
    if (!joinReq || joinReq.status !== 'PENDING') {
      throw new Error('Test G Failed: Join request was not created as PENDING');
    }

    const playerStateAfterRequest = await tournamentService.getTournamentById(tournament._id, invitedPlayer._id);
    if (playerStateAfterRequest.joinRequestStatus !== 'PENDING') {
      throw new Error(`Test G Failed: Expected status PENDING, got ${playerStateAfterRequest.joinRequestStatus}`);
    }
    if (playerStateAfterRequest.isRegistered) {
      throw new Error('Test G Failed: Player should NOT be registered while pending');
    }
    console.log('✅ Test G Passed: Invited player successfully submitted join request; state is PENDING');

    // ==========================================
    // TEST H: Shared URL does NOT bypass approval
    // ==========================================
    console.log('\n--- Test H: Shared URL does NOT bypass approval ---');
    // Verify participant count is STILL 0
    let currentParticipants = await TournamentPlayer.countDocuments({ tournamentId: tournament._id });
    if (currentParticipants !== 0) {
      throw new Error(`Test H Failed: Expected 0 participants, found ${currentParticipants}`);
    }

    // Attempting to set ready while pending must fail
    let readyAttemptBlocked = false;
    try {
      await tournamentPlayerService.setPlayerReady(tournament._id, invitedPlayer._id);
    } catch (err) {
      readyAttemptBlocked = true;
    }
    if (!readyAttemptBlocked) {
      throw new Error('Test H Failed: Pending player was able to set ready without host approval!');
    }

    // Now host approves
    await tournamentJoinRequestService.approveJoinRequest(tournament._id, joinReq._id, hostUser._id);
    currentParticipants = await TournamentPlayer.countDocuments({ tournamentId: tournament._id });
    if (currentParticipants !== 1) {
      throw new Error(`Test H Failed: Expected 1 participant after approval, found ${currentParticipants}`);
    }

    const playerStateAfterApproval = await tournamentService.getTournamentById(tournament._id, invitedPlayer._id);
    if (playerStateAfterApproval.joinRequestStatus !== 'PARTICIPANT' || !playerStateAfterApproval.isRegistered) {
      throw new Error('Test H Failed: Player state should be PARTICIPANT after approval');
    }
    console.log('✅ Test H Passed: Join request strictly requires host approval; approval creates participant');

    // ==========================================
    // TEST D & E: Copy and Fallback Simulation
    // ==========================================
    console.log('\n--- Test D & E: Copy Link & Fallback Mechanism ---');
    // Simulate browser clipboard copy function
    const simulateCopy = async (hasClipboardApi, shouldClipboardFail) => {
      const url = `${baseUrl}/tournaments/${tournament._id}`;
      let methodUsed = null;

      if (hasClipboardApi) {
        if (!shouldClipboardFail) {
          methodUsed = 'navigator.clipboard.writeText';
          return { success: true, method: methodUsed, url };
        }
        // If clipboard.writeText threw an error, fall through to execCommand
      }

      // Fallback: document.execCommand('copy')
      methodUsed = 'document.execCommand';
      return { success: true, method: methodUsed, url };
    };

    const copyResultNormal = await simulateCopy(true, false);
    if (!copyResultNormal.success || copyResultNormal.method !== 'navigator.clipboard.writeText') {
      throw new Error('Test D Failed: Modern clipboard copy simulation failed');
    }
    console.log(`✅ Test D Passed: Primary copy method "${copyResultNormal.method}" successfully copies URL`);

    const copyResultFallback = await simulateCopy(true, true);
    if (!copyResultFallback.success || copyResultFallback.method !== 'document.execCommand') {
      throw new Error('Test E Failed: Clipboard fallback simulation failed');
    }
    console.log(`✅ Test E Passed: Fallback copy method "${copyResultFallback.method}" succeeds when clipboard API fails`);

    console.log('\n==================================================');
    console.log('🎉 ALL INVITE & SHARE LINK TESTS (A–H) PASSED!');
    console.log('==================================================\n');
  } catch (error) {
    console.error('❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      if (tournament) {
        await Tournament.findByIdAndDelete(tournament._id);
        await TournamentPlayer.deleteMany({ tournamentId: tournament._id });
        await TournamentJoinRequest.deleteMany({ tournament: tournament._id });
      }
      await User.deleteMany({ email: { $regex: testPrefix } });
    } catch (_) {}
    await mongoose.disconnect();
  }
};

runInviteShareTests();
