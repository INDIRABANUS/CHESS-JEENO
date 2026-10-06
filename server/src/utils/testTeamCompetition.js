import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connectDB } from '../config/database.js';
import apiRouter from '../routes/index.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import User from '../models/User.js';
import TeamCompetition from '../models/TeamCompetition.js';
import TeamCompetitionTeam from '../models/TeamCompetitionTeam.js';
import TeamCompetitionMember from '../models/TeamCompetitionMember.js';
import Notification from '../models/Notification.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

const createToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: '1h' });
};

const runTeamCompetitionTestSuite = async () => {
  console.log('🧪 Starting CHESS JEENO Team Competition V1 Test Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `tc_test_${timestamp}`;

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

  // Start in-process express server
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api', apiRouter);
  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  const testServer = http.createServer(testApp);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const API_BASE = `http://localhost:${port}/api`;
  console.log(`📡 In-process test server running at ${API_BASE}\n`);

  const createdUserIds = [];
  const createdCompIds = [];
  const createdTeamIds = [];
  const createdMemberIds = [];
  const createdNotificationIds = [];

  const apiRequest = async (endpoint, { method = 'GET', token = null, body = null } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));
    return { status: res.status, data: json };
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create test users
    // -------------------------------------------------------------------------
    console.log('--- SETUP: Creating Test Users ---');
    const organizer = await User.create({
      name: 'Organizer Omkar',
      email: `${testPrefix}_organizer@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(organizer._id);
    const organizerToken = createToken(organizer._id);

    const playerB = await User.create({
      name: 'Player Bharat',
      email: `${testPrefix}_bharat@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(playerB._id);
    const playerBToken = createToken(playerB._id);

    const playerC = await User.create({
      name: 'Player Chitra',
      email: `${testPrefix}_chitra@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(playerC._id);
    const playerCToken = createToken(playerC._id);

    const captainD = await User.create({
      name: 'Captain Deepak',
      email: `${testPrefix}_deepak@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(captainD._id);
    const captainDToken = createToken(captainD._id);

    const playerE = await User.create({
      name: 'Player Eashwar',
      email: `${testPrefix}_eashwar@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(playerE._id);
    const playerEToken = createToken(playerE._id);

    const outsiderUser = await User.create({
      name: 'Outsider Oscar',
      email: `${testPrefix}_oscar@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(outsiderUser._id);
    const outsiderToken = createToken(outsiderUser._id);

    assert(Boolean(organizer._id && playerB._id && captainD._id), 'Test users created successfully');

    // -------------------------------------------------------------------------
    // 1. Authentication & Route Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Authentication & Route Protection ---');
    const unauthPostComp = await apiRequest('/team-competitions', {
      method: 'POST',
      body: { name: 'Illegal Comp' },
    });
    assert(unauthPostComp.status === 401, 'Unauthenticated competition creation rejected (401)');

    const unauthGetComp = await apiRequest('/team-competitions');
    assert(unauthGetComp.status === 200, 'Public read of competitions allowed (200)');

    const unauthMyComp = await apiRequest('/team-competitions?view=my');
    assert(unauthMyComp.status === 401, 'Unauthenticated view=my rejected (401)');

    // -------------------------------------------------------------------------
    // 2. Competition Creation & Data Validation
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Competition Creation & Validation ---');
    const emptyNameComp = await apiRequest('/team-competitions', {
      method: 'POST',
      token: organizerToken,
      body: { name: '   ' },
    });
    assert(emptyNameComp.status === 400, 'Empty competition name rejected (400)');

    const invalidMaxTeamsComp = await apiRequest('/team-competitions', {
      method: 'POST',
      token: organizerToken,
      body: { name: 'Valid Name', maxTeams: 1 },
    });
    assert(invalidMaxTeamsComp.status === 400, 'maxTeams < 2 rejected (400)');

    const createCompRes = await apiRequest('/team-competitions', {
      method: 'POST',
      token: organizerToken,
      body: {
        name: 'Tamil Nadu Collegiate Championship 2026',
        description: 'Multi-team collegiate competition',
        maxTeams: 8,
        maxPlayersPerTeam: 6,
      },
    });
    assert(createCompRes.status === 201, 'Competition created successfully (201)');
    const competition = createCompRes.data.data;
    createdCompIds.push(competition._id);
    assert(competition.status === 'REGISTRATION', 'Default status is REGISTRATION');
    assert(competition.maxTeams === 8, 'maxTeams set to 8');
    assert(competition.maxPlayersPerTeam === 6, 'maxPlayersPerTeam set to 6');
    assert(competition.organizer._id === organizer._id.toString(), 'Organizer ID matches User A');
    assert(!competition.organizer.passwordHash, 'Sensitive passwordHash not leaked');

    // -------------------------------------------------------------------------
    // 3. Malformed ObjectId Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Malformed ObjectId Handling ---');
    const malformedGet = await apiRequest('/team-competitions/invalid-id-xyz');
    assert(malformedGet.status === 400, 'Malformed competition ID returns 400 Bad Request');

    const nonexistentGet = await apiRequest('/team-competitions/507f1f77bcf86cd799439011');
    assert(nonexistentGet.status === 404, 'Nonexistent competition ID returns 404');

    // -------------------------------------------------------------------------
    // 4. Team Creation & Captain Assignment
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Team Creation & Captain Assignment ---');
    const emptyTeamName = await apiRequest(`/team-competitions/${competition._id}/teams`, {
      method: 'POST',
      token: organizerToken,
      body: { name: '' },
    });
    assert(emptyTeamName.status === 400, 'Empty team name rejected (400)');

    // Organizer creates BIT Team (organizer is captain)
    const createBitTeam = await apiRequest(`/team-competitions/${competition._id}/teams`, {
      method: 'POST',
      token: organizerToken,
      body: { name: 'BIT Chess Warriors' },
    });
    assert(createBitTeam.status === 201, 'BIT Team created (201)');
    const bitTeam = createBitTeam.data.data;
    createdTeamIds.push(bitTeam._id);
    assert(bitTeam.captain._id === organizer._id.toString(), 'Organizer becomes captain of BIT Team');
    assert(bitTeam.status === 'ACTIVE', 'Team status is ACTIVE');

    // Verify captain membership automatically assigned as CAPTAIN + ACTIVE
    const bitMembers = await apiRequest(`/teams/${bitTeam._id}/members`, { token: organizerToken });
    assert(bitMembers.status === 200, 'GET /teams/:teamId/members returns 200');
    assert(bitMembers.data.data.length === 1, 'BIT Team has exactly 1 member initially');
    assert(bitMembers.data.data[0].role === 'CAPTAIN', 'Captain has role CAPTAIN');
    assert(bitMembers.data.data[0].status === 'ACTIVE', 'Captain has status ACTIVE');

    // Duplicate team name in same competition rejected
    const dupTeamName = await apiRequest(`/team-competitions/${competition._id}/teams`, {
      method: 'POST',
      token: captainDToken,
      body: { name: 'bit chess warriors' }, // case-insensitive check
    });
    assert(dupTeamName.status === 400, 'Duplicate team name in competition rejected (400)');

    // Captain D creates PSG Team
    const createPsgTeam = await apiRequest(`/team-competitions/${competition._id}/teams`, {
      method: 'POST',
      token: captainDToken,
      body: { name: 'PSG Grandmasters' },
    });
    assert(createPsgTeam.status === 201, 'PSG Team created (201)');
    const psgTeam = createPsgTeam.data.data;
    createdTeamIds.push(psgTeam._id);
    assert(psgTeam.captain._id === captainD._id.toString(), 'Captain D is captain of PSG Team');

    // -------------------------------------------------------------------------
    // 5. Cross-Team Active Membership Conflict Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Cross-Team Active Membership Conflict ---');
    // Captain D tries to create a third team in the same competition
    const captainDTwice = await apiRequest(`/team-competitions/${competition._id}/teams`, {
      method: 'POST',
      token: captainDToken,
      body: { name: 'PSG Second Team' },
    });
    assert(captainDTwice.status === 400, 'User already ACTIVE on PSG cannot captain another team in same comp (400)');

    // -------------------------------------------------------------------------
    // 6. Captain Authorization & Roster Invitation Flow
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Captain Authorization & Team Invitations ---');
    // Outsider tries to invite to BIT team (Forbidden)
    const outsiderInvite = await apiRequest(`/teams/${bitTeam._id}/invitations`, {
      method: 'POST',
      token: outsiderToken,
      body: { userId: playerB._id },
    });
    assert(outsiderInvite.status === 403, 'Non-captain outsider cannot invite to team (403)');

    // Captain D tries to invite to BIT team (Forbidden)
    const captainDInviteBit = await apiRequest(`/teams/${bitTeam._id}/invitations`, {
      method: 'POST',
      token: captainDToken,
      body: { userId: playerB._id },
    });
    assert(captainDInviteBit.status === 403, 'Captain D cannot invite players to BIT team (403)');

    // BIT Captain invites Player B
    const bitInviteB = await apiRequest(`/teams/${bitTeam._id}/invitations`, {
      method: 'POST',
      token: organizerToken,
      body: { userId: playerB._id },
    });
    assert(bitInviteB.status === 201, 'Captain Omkar invites Player B (201)');
    const inviteB = bitInviteB.data.data;
    createdMemberIds.push(inviteB._id);
    assert(inviteB.status === 'INVITED', 'Invited player status is INVITED');
    assert(inviteB.role === 'PLAYER', 'Invited player role is PLAYER');

    // Verify In-App Notification created for Player B
    const notifB = await Notification.findOne({
      recipient: playerB._id,
      type: 'TEAM_INVITATION',
    });
    assert(Boolean(notifB), 'Player B received TEAM_INVITATION in-app notification');
    assert(notifB.title === 'Team Invitation', 'Notification title is "Team Invitation"');
    assert(notifB.message.includes('BIT Chess Warriors'), 'Notification message mentions team name');
    if (notifB) createdNotificationIds.push(notifB._id);

    // Duplicate invitation to same team rejected
    const dupInviteB = await apiRequest(`/teams/${bitTeam._id}/invitations`, {
      method: 'POST',
      token: organizerToken,
      body: { userId: playerB._id },
    });
    assert(dupInviteB.status === 400, 'Duplicate invitation rejected (400)');

    // -------------------------------------------------------------------------
    // 7. Invitation Response Authorization (Accept / Decline)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Invitation Response Authorization ---');
    // Outsider tries to accept Player B's invitation (Forbidden)
    const outsiderAcceptsB = await apiRequest(`/team-invitations/${inviteB._id}/accept`, {
      method: 'POST',
      token: outsiderToken,
    });
    assert(outsiderAcceptsB.status === 403, 'Outsider accepting someone else invitation rejected (403)');

    // Outsider tries to decline Player B's invitation (Forbidden)
    const outsiderDeclinesB = await apiRequest(`/team-invitations/${inviteB._id}/decline`, {
      method: 'POST',
      token: outsiderToken,
    });
    assert(outsiderDeclinesB.status === 403, 'Outsider declining someone else invitation rejected (403)');

    // Player B accepts own invitation
    const bAccepts = await apiRequest(`/team-invitations/${inviteB._id}/accept`, {
      method: 'POST',
      token: playerBToken,
    });
    assert(bAccepts.status === 200, 'Player B accepts own invitation (200)');
    assert(bAccepts.data.data.status === 'ACTIVE', 'Player B status updated to ACTIVE');
    assert(bAccepts.data.data.role === 'PLAYER', 'Player B role is PLAYER');

    // Captain Omkar received notification that Player B accepted
    const captainAcceptNotif = await Notification.findOne({
      recipient: organizer._id,
      type: 'TEAM_INVITATION_ACCEPTED',
    });
    assert(Boolean(captainAcceptNotif), 'Captain received TEAM_INVITATION_ACCEPTED notification');
    if (captainAcceptNotif) createdNotificationIds.push(captainAcceptNotif._id);

    // Accepting already accepted invitation rejected
    const bAcceptsAgain = await apiRequest(`/team-invitations/${inviteB._id}/accept`, {
      method: 'POST',
      token: playerBToken,
    });
    assert(bAcceptsAgain.status === 400, 'Re-accepting non-pending invitation rejected (400)');

    // -------------------------------------------------------------------------
    // 8. Player B cannot join another team in same competition while ACTIVE
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Active Player Joining Second Team in Same Competition ---');
    // PSG Captain invites Player B
    const psgInvitesB = await apiRequest(`/teams/${psgTeam._id}/invitations`, {
      method: 'POST',
      token: captainDToken,
      body: { userId: playerB._id },
    });
    assert(psgInvitesB.status === 400, 'Inviting user already ACTIVE in competition rejected (400)');

    // -------------------------------------------------------------------------
    // 9. Invite & Decline Flow with Player C
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Testing Invite & Decline Flow ---');
    const bitInvitesC = await apiRequest(`/teams/${bitTeam._id}/invitations`, {
      method: 'POST',
      token: organizerToken,
      body: { userId: playerC._id },
    });
    assert(bitInvitesC.status === 201, 'Captain Omkar invites Player C (201)');
    const inviteC = bitInvitesC.data.data;
    createdMemberIds.push(inviteC._id);

    // Player C declines
    const cDeclines = await apiRequest(`/team-invitations/${inviteC._id}/decline`, {
      method: 'POST',
      token: playerCToken,
    });
    assert(cDeclines.status === 200, 'Player C declines invitation (200)');
    assert(cDeclines.data.data.status === 'DECLINED', 'Player C status updated to DECLINED');

    // Captain received decline notification
    const declineNotif = await Notification.findOne({
      recipient: organizer._id,
      type: 'TEAM_INVITATION_DECLINED',
    });
    assert(Boolean(declineNotif), 'Captain received TEAM_INVITATION_DECLINED notification');
    if (declineNotif) createdNotificationIds.push(declineNotif._id);

    // Re-invite after decline works cleanly
    const bitReinvitesC = await apiRequest(`/teams/${bitTeam._id}/invitations`, {
      method: 'POST',
      token: organizerToken,
      body: { userId: playerC._id },
    });
    assert(bitReinvitesC.status === 201, 'Re-inviting declined player succeeds (201)');
    assert(bitReinvitesC.data.data.status === 'INVITED', 'Status reset to INVITED');

    // Player C accepts second invitation
    const cAccepts = await apiRequest(`/team-invitations/${bitReinvitesC.data.data._id}/accept`, {
      method: 'POST',
      token: playerCToken,
    });
    assert(cAccepts.status === 200, 'Player C accepts re-invitation (200)');
    assert(cAccepts.data.data.status === 'ACTIVE', 'Player C is now ACTIVE on BIT');

    // PSG Captain invites Player E and Player E accepts
    const psgInvitesE = await apiRequest(`/teams/${psgTeam._id}/invitations`, {
      method: 'POST',
      token: captainDToken,
      body: { userId: playerE._id },
    });
    assert(psgInvitesE.status === 201, 'PSG invites Player E (201)');
    const eAccepts = await apiRequest(`/team-invitations/${psgInvitesE.data.data._id}/accept`, {
      method: 'POST',
      token: playerEToken,
    });
    assert(eAccepts.status === 200, 'Player E accepts PSG invitation (200)');

    // -------------------------------------------------------------------------
    // 10. Member Removal & Cross-Captain Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Testing Member Removal & Cross-Captain Isolation ---');
    // Captain D tries to remove Player B from BIT Team (Forbidden)
    const capDRemovesB = await apiRequest(`/teams/${bitTeam._id}/members/${playerB._id}`, {
      method: 'DELETE',
      token: captainDToken,
    });
    assert(capDRemovesB.status === 403, 'Captain D cannot remove BIT team player (403)');

    // Player cannot remove team captain
    const removeCaptainAttempt = await apiRequest(`/teams/${bitTeam._id}/members/${organizer._id}`, {
      method: 'DELETE',
      token: organizerToken,
    });
    assert(removeCaptainAttempt.status === 400, 'Removing captain without transfer rejected (400)');

    // Captain Omkar removes Player C from BIT Team
    const omkarRemovesC = await apiRequest(`/teams/${bitTeam._id}/members/${playerC._id}`, {
      method: 'DELETE',
      token: organizerToken,
    });
    assert(omkarRemovesC.status === 200, 'Captain Omkar removes Player C (200)');
    assert(omkarRemovesC.data.data.status === 'REMOVED', 'Player C status set to REMOVED');

    // Now Player C is no longer active on BIT, can join PSG!
    const psgInvitesCNow = await apiRequest(`/teams/${psgTeam._id}/invitations`, {
      method: 'POST',
      token: captainDToken,
      body: { userId: playerC._id },
    });
    assert(psgInvitesCNow.status === 201, 'Player C can now be invited to PSG after removal from BIT (201)');

    // -------------------------------------------------------------------------
    // 11. Captain Transfer
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Testing Captain Transfer ---');
    // Outsider cannot transfer captaincy
    const outsiderTransfer = await apiRequest(`/teams/${bitTeam._id}/transfer-captain`, {
      method: 'POST',
      token: outsiderToken,
      body: { newCaptainId: playerB._id },
    });
    assert(outsiderTransfer.status === 403, 'Outsider cannot transfer captaincy (403)');

    // Cannot transfer to non-active teammate
    const transferToOutsider = await apiRequest(`/teams/${bitTeam._id}/transfer-captain`, {
      method: 'POST',
      token: organizerToken,
      body: { newCaptainId: outsiderUser._id },
    });
    assert(transferToOutsider.status === 400, 'Transferring captaincy to non-member rejected (400)');

    // Transfer captaincy from Omkar to Player B
    const transferSuccess = await apiRequest(`/teams/${bitTeam._id}/transfer-captain`, {
      method: 'POST',
      token: organizerToken,
      body: { newCaptainId: playerB._id },
    });
    assert(transferSuccess.status === 200, 'Captaincy transferred to Player B (200)');
    assert(transferSuccess.data.data.captain._id === playerB._id.toString(), 'Team captain updated to Player B');

    // Verify Omkar is now PLAYER and Player B is now CAPTAIN
    const updatedBitMembers = await apiRequest(`/teams/${bitTeam._id}/members`, { token: playerBToken });
    const omkarMember = updatedBitMembers.data.data.find((m) => m.user._id === organizer._id.toString());
    const bharatMember = updatedBitMembers.data.data.find((m) => m.user._id === playerB._id.toString());
    assert(omkarMember.role === 'PLAYER', 'Former captain Omkar is now PLAYER');
    assert(bharatMember.role === 'CAPTAIN', 'Player Bharat is now CAPTAIN');

    // Transfer captaincy back to Omkar
    await apiRequest(`/teams/${bitTeam._id}/transfer-captain`, {
      method: 'POST',
      token: playerBToken,
      body: { newCaptainId: organizer._id },
    });

    // -------------------------------------------------------------------------
    // 12. Competition Readiness Lifecycle (REGISTRATION -> READY)
    // -------------------------------------------------------------------------
    console.log('\n--- 12. Testing Competition Readiness Lifecycle ---');
    // Non-organizer tries to set READY (Forbidden)
    const capDReady = await apiRequest(`/team-competitions/${competition._id}/ready`, {
      method: 'POST',
      token: captainDToken,
    });
    assert(capDReady.status === 403, 'Non-organizer setting READY rejected (403)');

    // Create a 1-team competition and test readiness fails
    const singleTeamCompRes = await apiRequest('/team-competitions', {
      method: 'POST',
      token: organizerToken,
      body: { name: 'Single Team Test Comp' },
    });
    const singleComp = singleTeamCompRes.data.data;
    createdCompIds.push(singleComp._id);

    const singleCompReadyFail = await apiRequest(`/team-competitions/${singleComp._id}/ready`, {
      method: 'POST',
      token: organizerToken,
    });
    assert(singleCompReadyFail.status === 400, 'Readiness fails when < 2 active teams (400)');

    // Main competition has 2 active teams (BIT & PSG), both with captains!
    const mainCompReady = await apiRequest(`/team-competitions/${competition._id}/ready`, {
      method: 'POST',
      token: organizerToken,
    });
    assert(mainCompReady.status === 200, 'Competition with >= 2 valid teams transitions to READY (200)');
    assert(mainCompReady.data.data.status === 'READY', 'Status is READY');

    // Cannot add new team once READY
    const addTeamWhenReady = await apiRequest(`/team-competitions/${competition._id}/teams`, {
      method: 'POST',
      token: outsiderToken,
      body: { name: 'Late Entrant' },
    });
    assert(addTeamWhenReady.status === 400, 'Adding team rejected when competition is READY (400)');

    // -------------------------------------------------------------------------
    // 13. Cancellation
    // -------------------------------------------------------------------------
    console.log('\n--- 13. Testing Competition Cancellation ---');
    // Outsider cannot cancel competition
    const outsiderCancel = await apiRequest(`/team-competitions/${competition._id}/cancel`, {
      method: 'POST',
      token: outsiderToken,
    });
    assert(outsiderCancel.status === 403, 'Non-organizer cancelling competition rejected (403)');

    // Organizer cancels competition
    const cancelRes = await apiRequest(`/team-competitions/${competition._id}/cancel`, {
      method: 'POST',
      token: organizerToken,
    });
    assert(cancelRes.status === 200, 'Organizer cancels competition (200)');
    assert(cancelRes.data.data.status === 'CANCELLED', 'Status is CANCELLED');

    // Cannot modify cancelled competition
    const modifyCancelled = await apiRequest(`/team-competitions/${competition._id}`, {
      method: 'PATCH',
      token: organizerToken,
      body: { name: 'New Name' },
    });
    assert(modifyCancelled.status === 400, 'Modifying cancelled competition rejected (400)');

    // -------------------------------------------------------------------------
    // 14. User Search API
    // -------------------------------------------------------------------------
    console.log('\n--- 14. Testing User Search for Captain Roster Invites ---');
    const searchRes = await apiRequest(`/users/search?q=bharat`, { token: organizerToken });
    assert(searchRes.status === 200, 'User search returns 200');
    assert(Array.isArray(searchRes.data.data), 'User search returns array');
    assert(
      searchRes.data.data.some((u) => u.name.includes('Bharat')),
      'User search matches Bharat'
    );
    assert(!searchRes.data.data[0].passwordHash, 'User search does not leak passwordHash');

    // Search with regex special characters (must not crash or throw ReDoS)
    const specialSearch = await apiRequest(`/users/search?q=[Regex.*+?]`, { token: organizerToken });
    assert(specialSearch.status === 200, 'Special characters in search query handled safely (200)');

    // -------------------------------------------------------------------------
    // 15. User Pending Invitations Endpoint
    // -------------------------------------------------------------------------
    console.log('\n--- 15. Testing User Pending Invitations Endpoint ---');
    const pendingInvitesRes = await apiRequest('/team-competitions/my/invitations', {
      token: playerBToken,
    });
    assert(pendingInvitesRes.status === 200, 'GET /my/invitations returns 200');
    assert(Array.isArray(pendingInvitesRes.data.data), 'Returns invitations array');

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
  } finally {
    // Teardown
    console.log('🧹 Cleaning up test fixtures...');
    await TeamCompetitionMember.deleteMany({
      $or: [
        { _id: { $in: createdMemberIds } },
        { competition: { $in: createdCompIds } },
        { user: { $in: createdUserIds } },
      ],
    });
    await TeamCompetitionTeam.deleteMany({
      $or: [
        { _id: { $in: createdTeamIds } },
        { competition: { $in: createdCompIds } },
      ],
    });
    await TeamCompetition.deleteMany({ _id: { $in: createdCompIds } });
    await Notification.deleteMany({
      $or: [
        { _id: { $in: createdNotificationIds } },
        { recipient: { $in: createdUserIds } },
      ],
    });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await new Promise((resolve) => testServer.close(resolve));
    console.log('✨ Cleanup complete.');
  }

  console.log('🎉 Team Competition V1 Test Suite Passed!\n');
};

runTeamCompetitionTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Test Suite Failed with Error:', err);
    process.exit(1);
  });
