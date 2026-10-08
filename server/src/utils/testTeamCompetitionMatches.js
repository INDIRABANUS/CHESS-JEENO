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
import TeamCompetitionRound from '../models/TeamCompetitionRound.js';
import TeamMatch from '../models/TeamMatch.js';
import TeamMatchBoard from '../models/TeamMatchBoard.js';
import Notification from '../models/Notification.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

const createToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: '1h' });
};

const runTeamCompetitionMatchesTestSuite = async () => {
  console.log('🧪 Starting CHESS JEENO Team Competition V2 Test Suite (Match Engine + Lineups)...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `tc_v2_${timestamp}`;

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

  // Start in-process Express server
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
  const createdRoundIds = [];
  const createdMatchIds = [];

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
    // SETUP: Create Users, Competitions, Teams, and Members
    // -------------------------------------------------------------------------
    console.log('--- SETUP: Creating Test Entities ---');
    const organizer = await User.create({
      name: 'Organizer Omkar',
      email: `${testPrefix}_organizer@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(organizer._id);
    const organizerToken = createToken(organizer._id);

    const captainA = await User.create({
      name: 'Captain Anand',
      email: `${testPrefix}_capA@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(captainA._id);
    const captainAToken = createToken(captainA._id);

    const playerA1 = await User.create({
      name: 'Player Arjun',
      email: `${testPrefix}_plyA1@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(playerA1._id);
    const playerA1Token = createToken(playerA1._id);

    const playerA2 = await User.create({
      name: 'Player Ashwin',
      email: `${testPrefix}_plyA2@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(playerA2._id);
    const playerA2Token = createToken(playerA2._id);

    const captainB = await User.create({
      name: 'Captain Bala',
      email: `${testPrefix}_capB@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(captainB._id);
    const captainBToken = createToken(captainB._id);

    const playerB1 = await User.create({
      name: 'Player Bhuvan',
      email: `${testPrefix}_plyB1@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(playerB1._id);
    const playerB1Token = createToken(playerB1._id);

    const playerB2 = await User.create({
      name: 'Player Bindu',
      email: `${testPrefix}_plyB2@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(playerB2._id);
    const playerB2Token = createToken(playerB2._id);

    const outsider = await User.create({
      name: 'Outsider Chetan',
      email: `${testPrefix}_outsider@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(outsider._id);
    const outsiderToken = createToken(outsider._id);

    // Main Competition
    const comp1 = await TeamCompetition.create({
      name: `Championship ${timestamp}`,
      description: 'College Team Championship',
      organizer: organizer._id,
      status: 'REGISTRATION',
    });
    createdCompIds.push(comp1._id);

    // Secondary Competition (for cross-competition testing)
    const comp2 = await TeamCompetition.create({
      name: `Cross Comp ${timestamp}`,
      description: 'Secondary Competition',
      organizer: organizer._id,
      status: 'REGISTRATION',
    });
    createdCompIds.push(comp2._id);

    // Team A under comp1
    const teamA = await TeamCompetitionTeam.create({
      competition: comp1._id,
      name: `BIT A ${timestamp}`,
      captain: captainA._id,
      status: 'ACTIVE',
    });
    createdTeamIds.push(teamA._id);

    // Team B under comp1
    const teamB = await TeamCompetitionTeam.create({
      competition: comp1._id,
      name: `PSG ${timestamp}`,
      captain: captainB._id,
      status: 'ACTIVE',
    });
    createdTeamIds.push(teamB._id);

    // Inactive Team under comp1
    const teamInactive = await TeamCompetitionTeam.create({
      competition: comp1._id,
      name: `Removed Team ${timestamp}`,
      captain: outsider._id,
      status: 'REMOVED',
    });
    createdTeamIds.push(teamInactive._id);

    // Team C under comp2 (Cross-competition)
    const teamC = await TeamCompetitionTeam.create({
      competition: comp2._id,
      name: `Foreign Team ${timestamp}`,
      captain: outsider._id,
      status: 'ACTIVE',
    });
    createdTeamIds.push(teamC._id);

    // Memberships for Team A
    const memA_cap = await TeamCompetitionMember.create({
      competition: comp1._id,
      team: teamA._id,
      user: captainA._id,
      role: 'CAPTAIN',
      status: 'ACTIVE',
      joinedAt: new Date(),
    });
    const memA_1 = await TeamCompetitionMember.create({
      competition: comp1._id,
      team: teamA._id,
      user: playerA1._id,
      role: 'PLAYER',
      status: 'ACTIVE',
      joinedAt: new Date(),
    });
    const memA_2 = await TeamCompetitionMember.create({
      competition: comp1._id,
      team: teamA._id,
      user: playerA2._id,
      role: 'PLAYER',
      status: 'ACTIVE',
      joinedAt: new Date(),
    });
    createdMemberIds.push(memA_cap._id, memA_1._id, memA_2._id);

    // Memberships for Team B
    const memB_cap = await TeamCompetitionMember.create({
      competition: comp1._id,
      team: teamB._id,
      user: captainB._id,
      role: 'CAPTAIN',
      status: 'ACTIVE',
      joinedAt: new Date(),
    });
    const memB_1 = await TeamCompetitionMember.create({
      competition: comp1._id,
      team: teamB._id,
      user: playerB1._id,
      role: 'PLAYER',
      status: 'ACTIVE',
      joinedAt: new Date(),
    });
    const memB_2 = await TeamCompetitionMember.create({
      competition: comp1._id,
      team: teamB._id,
      user: playerB2._id,
      role: 'PLAYER',
      status: 'ACTIVE',
      joinedAt: new Date(),
    });
    createdMemberIds.push(memB_cap._id, memB_1._id, memB_2._id);

    console.log('Setup complete.\n');

    // -------------------------------------------------------------------------
    // 1. Unauthenticated Request Rejection (401)
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Unauthenticated Access Rejection ---');
    const unauthRoundRes = await apiRequest(`/team-competitions/${comp1._id}/rounds`, {
      method: 'POST',
      body: { roundNumber: 1 },
    });
    assert(unauthRoundRes.status === 401, 'Unauthenticated round creation returns 401');

    const unauthMatchRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/507f1f77bcf86cd799439011/matches`, {
      method: 'POST',
      body: { teamA: teamA._id, teamB: teamB._id },
    });
    assert(unauthMatchRes.status === 401, 'Unauthenticated match creation returns 401');

    // -------------------------------------------------------------------------
    // 2. Malformed ObjectIds Rejection (400)
    // -------------------------------------------------------------------------
    console.log('--- 2. Testing Malformed ObjectId Handling ---');
    const malformedCompRes = await apiRequest('/team-competitions/invalid-comp-id/rounds', {
      token: organizerToken,
    });
    assert(malformedCompRes.status === 400, 'Malformed competition ID returns 400 Bad Request');

    const malformedRoundRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/invalid-round-id`, {
      token: organizerToken,
    });
    assert(malformedRoundRes.status === 400, 'Malformed round ID returns 400 Bad Request');

    const malformedMatchRes = await apiRequest(`/team-competitions/${comp1._id}/matches/invalid-match-id`, {
      token: organizerToken,
    });
    assert(malformedMatchRes.status === 400, 'Malformed match ID returns 400 Bad Request');

    // -------------------------------------------------------------------------
    // 3. Round Creation & Organizer Authorization
    // -------------------------------------------------------------------------
    console.log('--- 3. Testing Round Creation ---');
    // Non-organizer attempt returns 403
    const forbiddenRoundRes = await apiRequest(`/team-competitions/${comp1._id}/rounds`, {
      method: 'POST',
      token: captainAToken,
      body: { roundNumber: 1, name: 'Round 1' },
    });
    assert(forbiddenRoundRes.status === 403, 'Non-organizer creating round returns 403 Forbidden');

    // Valid organizer round creation
    const createRound1Res = await apiRequest(`/team-competitions/${comp1._id}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 1, name: 'Round 1 - Prelims' },
    });
    assert(createRound1Res.status === 201, 'Organizer creates Round 1 successfully (201)');
    assert(createRound1Res.data.data.roundNumber === 1, 'Round number is 1');
    assert(createRound1Res.data.data.status === 'DRAFT', 'Default round status is DRAFT');
    const round1Id = createRound1Res.data.data._id;
    createdRoundIds.push(round1Id);

    // -------------------------------------------------------------------------
    // 4. Round Uniqueness (Duplicate roundNumber rejection)
    // -------------------------------------------------------------------------
    console.log('--- 4. Testing Round Uniqueness ---');
    const dupRoundRes = await apiRequest(`/team-competitions/${comp1._id}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 1, name: 'Duplicate Round 1' },
    });
    assert(dupRoundRes.status === 400, 'Duplicate round number in same competition returns 400');
    assert(dupRoundRes.data.message.includes('already exists'), 'Clear duplicate round message');

    // Create Round 2 successfully
    const createRound2Res = await apiRequest(`/team-competitions/${comp1._id}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 2, name: 'Round 2 - Finals' },
    });
    assert(createRound2Res.status === 201, 'Organizer creates Round 2 successfully (201)');
    const round2Id = createRound2Res.data.data._id;
    createdRoundIds.push(round2Id);

    // -------------------------------------------------------------------------
    // 5. Match Creation: Validations & Restrictions
    // -------------------------------------------------------------------------
    console.log('--- 5. Testing Match Creation & Validations ---');
    // Non-organizer match creation rejected (403)
    const nonOrgMatchRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/${round1Id}/matches`, {
      method: 'POST',
      token: captainBToken,
      body: { teamA: teamA._id, teamB: teamB._id, boardCount: 2 },
    });
    assert(nonOrgMatchRes.status === 403, 'Non-organizer creating match returns 403 Forbidden');

    // Same team rejection (400)
    const sameTeamRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/${round1Id}/matches`, {
      method: 'POST',
      token: organizerToken,
      body: { teamA: teamA._id, teamB: teamA._id, boardCount: 2 },
    });
    assert(sameTeamRes.status === 400, 'Team playing against itself returns 400');

    // Cross-competition team rejection (400)
    const crossCompRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/${round1Id}/matches`, {
      method: 'POST',
      token: organizerToken,
      body: { teamA: teamA._id, teamB: teamC._id, boardCount: 2 },
    });
    assert(crossCompRes.status === 400, 'Cross-competition team injection returns 400');

    // Inactive team rejection (400)
    const inactiveTeamRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/${round1Id}/matches`, {
      method: 'POST',
      token: organizerToken,
      body: { teamA: teamA._id, teamB: teamInactive._id, boardCount: 2 },
    });
    assert(inactiveTeamRes.status === 400, 'Inactive team match creation returns 400');

    // Invalid board count rejection (e.g. boardCount = 0 or 25)
    const invalidBoardRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/${round1Id}/matches`, {
      method: 'POST',
      token: organizerToken,
      body: { teamA: teamA._id, teamB: teamB._id, boardCount: 0 },
    });
    assert(invalidBoardRes.status === 400, 'boardCount < 1 returns 400');

    // Valid Match Creation (boardCount = 2)
    const validMatchRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/${round1Id}/matches`, {
      method: 'POST',
      token: organizerToken,
      body: { teamA: teamA._id, teamB: teamB._id, boardCount: 2 },
    });
    assert(validMatchRes.status === 201, 'Valid match created successfully (201)');
    assert(validMatchRes.data.data.boardCount === 2, 'Match boardCount is 2');
    assert(validMatchRes.data.data.status === 'DRAFT', 'Initial match status is DRAFT');
    const matchId = validMatchRes.data.data._id;
    createdMatchIds.push(matchId);

    // Duplicate team-vs-team match in same round rejection (400)
    const dupMatchRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/${round1Id}/matches`, {
      method: 'POST',
      token: organizerToken,
      body: { teamA: teamB._id, teamB: teamA._id, boardCount: 2 },
    });
    assert(dupMatchRes.status === 400, 'Duplicate team-vs-team match in same round rejected (400)');

    // -------------------------------------------------------------------------
    // 6. Board Creation Verification
    // -------------------------------------------------------------------------
    console.log('--- 6. Testing Board Creation ---');
    const boardsRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/boards`, {
      token: organizerToken,
    });
    assert(boardsRes.status === 200, 'GET match boards returns 200');
    assert(Array.isArray(boardsRes.data.data), 'Boards returned as array');
    assert(boardsRes.data.data.length === 2, 'Exactly 2 boards created for boardCount=2');
    assert(boardsRes.data.data[0].boardNumber === 1, 'First board is boardNumber 1');
    assert(boardsRes.data.data[1].boardNumber === 2, 'Second board is boardNumber 2');
    assert(boardsRes.data.data[0].teamAPlayer === null, 'Initial Board 1 teamAPlayer is null');
    assert(boardsRes.data.data[0].teamBPlayer === null, 'Initial Board 1 teamBPlayer is null');

    // -------------------------------------------------------------------------
    // 7. Lineup Management & Captain Authorization Isolation
    // -------------------------------------------------------------------------
    console.log('--- 7. Testing Lineup Management & Captain Isolation ---');
    // Captain B attempting to assign Team A lineup returns 403
    const crossCaptainRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainBToken,
      body: {
        teamId: teamA._id,
        assignments: [{ boardNumber: 1, playerId: playerA1._id }],
      },
    });
    assert(crossCaptainRes.status === 403, 'Opponent captain editing Team A lineup returns 403 Forbidden');

    // Normal player attempting to edit lineup returns 403
    const playerLineupRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: playerA1Token,
      body: {
        teamId: teamA._id,
        assignments: [{ boardNumber: 1, playerId: playerA1._id }],
      },
    });
    assert(playerLineupRes.status === 403, 'Regular player editing lineup returns 403 Forbidden');

    // Captain A attempting to assign an outsider/non-member returns 400
    const nonMemberAssignRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainAToken,
      body: {
        teamId: teamA._id,
        assignments: [{ boardNumber: 1, playerId: outsider._id }],
      },
    });
    assert(nonMemberAssignRes.status === 400, 'Assigning non-team member to board returns 400');

    // Duplicate player on multiple boards in same team returns 400
    const dupPlayerAssignRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainAToken,
      body: {
        teamId: teamA._id,
        assignments: [
          { boardNumber: 1, playerId: playerA1._id },
          { boardNumber: 2, playerId: playerA1._id },
        ],
      },
    });
    assert(dupPlayerAssignRes.status === 400, 'Assigning same player to multiple boards returns 400');

    // Valid lineup assignment by Captain A: Board 1 -> Player A1, Board 2 -> Player A2
    const validAssignARes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainAToken,
      body: {
        teamId: teamA._id,
        assignments: [
          { boardNumber: 1, playerId: playerA1._id },
          { boardNumber: 2, playerId: playerA2._id },
        ],
      },
    });
    assert(validAssignARes.status === 200, 'Captain A saves valid lineup (200)');
    assert(validAssignARes.data.data.boards[0].teamAPlayer._id === playerA1._id.toString(), 'Board 1 teamAPlayer is Player A1');
    assert(validAssignARes.data.data.boards[1].teamAPlayer._id === playerA2._id.toString(), 'Board 2 teamAPlayer is Player A2');
    assert(validAssignARes.data.data.match.status === 'LINEUP', 'Match status automatically transitioned to LINEUP');

    // Verify Player A1 received TEAM_MATCH_BOARD_ASSIGNED in-app notification
    const notifA1 = await Notification.findOne({
      recipient: playerA1._id,
      type: 'TEAM_MATCH_BOARD_ASSIGNED',
    });
    assert(Boolean(notifA1), 'Player A1 received TEAM_MATCH_BOARD_ASSIGNED notification');
    assert(notifA1.title.includes('Board 1'), 'Notification title specifies Board 1');

    // Cross-side assignment conflict: Captain B attempting to assign Player A1 to Team B returns 400
    const crossSideAssignRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainBToken,
      body: {
        teamId: teamB._id,
        assignments: [{ boardNumber: 1, playerId: playerA1._id }],
      },
    });
    assert(crossSideAssignRes.status === 400, 'Assigning player already on opposing side returns 400');

    // -------------------------------------------------------------------------
    // 8. Player-Level Readiness & Isolation
    // -------------------------------------------------------------------------
    console.log('--- 8. Testing Player Readiness & Security Isolation ---');
    // Player B1 attempting to set Player A1 readiness on Board 1 returns 403
    const crossPlayerReadyRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/ready`, {
      method: 'POST',
      token: playerB1Token,
      body: { boardNumber: 1, ready: true },
    });
    assert(crossPlayerReadyRes.status === 403, 'Opponent player toggling Player A1 readiness returns 403 Forbidden');

    // Player A1 marks own readiness on Board 1
    const playerA1ReadyRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/ready`, {
      method: 'POST',
      token: playerA1Token,
      body: { boardNumber: 1, ready: true },
    });
    assert(playerA1ReadyRes.status === 200, 'Player A1 marks self ready (200)');
    assert(playerA1ReadyRes.data.data.teamAReady === true, 'Board 1 teamAReady is true');

    // Duplicate readiness safety (idempotent call)
    const dupReadyRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/ready`, {
      method: 'POST',
      token: playerA1Token,
      body: { boardNumber: 1, ready: true },
    });
    assert(dupReadyRes.status === 200, 'Repeated readiness call is safe and idempotent (200)');

    // Captain A can also mark readiness for unready player on Team A
    const captainSetReadyRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/ready`, {
      method: 'POST',
      token: captainAToken,
      body: { boardNumber: 2, ready: true },
    });
    assert(captainSetReadyRes.status === 200, 'Captain A marks Player A2 ready on Board 2 (200)');
    assert(captainSetReadyRes.data.data.teamAReady === true, 'Board 2 teamAReady is true');

    // -------------------------------------------------------------------------
    // 9. Captain Lineup Lock & Incomplete/Unready Lineup Rejection
    // -------------------------------------------------------------------------
    console.log('--- 9. Testing Captain Lineup Lock & Guards ---');
    // Captain B attempts to lock lineup when boards are still empty -> 400
    const lockEmptyBRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lock-lineup`, {
      method: 'POST',
      token: captainBToken,
      body: { teamId: teamB._id },
    });
    assert(lockEmptyBRes.status === 400, 'Locking unfilled lineup returns 400');
    assert(lockEmptyBRes.data.message.includes('filled before locking'), 'Clear error message on unfilled boards');

    // Captain B assigns Player B1 to Board 1, leaves Board 2 empty
    await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainBToken,
      body: {
        teamId: teamB._id,
        assignments: [{ boardNumber: 1, playerId: playerB1._id }],
      },
    });

    const lockPartialBRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lock-lineup`, {
      method: 'POST',
      token: captainBToken,
      body: { teamId: teamB._id },
    });
    assert(lockPartialBRes.status === 400, 'Locking partially filled lineup returns 400');

    // Captain B assigns Player B2 to Board 2, but players are not yet marked ready
    await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainBToken,
      body: {
        teamId: teamB._id,
        assignments: [{ boardNumber: 2, playerId: playerB2._id }],
      },
    });

    const lockUnreadyBRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lock-lineup`, {
      method: 'POST',
      token: captainBToken,
      body: { teamId: teamB._id },
    });
    assert(lockUnreadyBRes.status === 400, 'Locking when team players are not ready returns 400');

    // Outsider attempting to lock Team A lineup returns 403
    const outsiderLockRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lock-lineup`, {
      method: 'POST',
      token: outsiderToken,
      body: { teamId: teamA._id },
    });
    assert(outsiderLockRes.status === 403, 'Unauthorized user locking lineup returns 403 Forbidden');

    // Valid Captain A Lock: All boards filled, all active, all ready
    const lockARes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lock-lineup`, {
      method: 'POST',
      token: captainAToken,
      body: { teamId: teamA._id },
    });
    assert(lockARes.status === 200, 'Captain A locks lineup successfully (200)');
    assert(lockARes.data.data.teamALineupLocked === true, 'teamALineupLocked is true');
    assert(lockARes.data.data.status === 'LINEUP', 'Match remains LINEUP while Team B is unlocked');

    // Verify TEAM_LINEUP_LOCKED notification sent to Captain B and Organizer
    const lockNotifCapB = await Notification.findOne({
      recipient: captainB._id,
      type: 'TEAM_LINEUP_LOCKED',
    });
    assert(Boolean(lockNotifCapB), 'Captain B received TEAM_LINEUP_LOCKED notification');

    // Modifying locked lineup rejected (400)
    const editLockedRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainAToken,
      body: {
        teamId: teamA._id,
        assignments: [{ boardNumber: 1, playerId: playerA2._id }],
      },
    });
    assert(editLockedRes.status === 400, 'Editing locked lineup rejected with 400');

    // -------------------------------------------------------------------------
    // 10. Team B Readiness & Two-Level Match READY Transition
    // -------------------------------------------------------------------------
    console.log('--- 10. Testing Team B Readiness & Match READY Transition ---');
    // Player B1 and Player B2 mark themselves ready
    const readyB1Res = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/ready`, {
      method: 'POST',
      token: playerB1Token,
      body: { boardNumber: 1, ready: true },
    });
    assert(readyB1Res.status === 200, 'Player B1 marks self ready (200)');

    const readyB2Res = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/ready`, {
      method: 'POST',
      token: playerB2Token,
      body: { boardNumber: 2, ready: true },
    });
    assert(readyB2Res.status === 200, 'Player B2 marks self ready (200)');

    // Captain B locks lineup
    const lockBRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lock-lineup`, {
      method: 'POST',
      token: captainBToken,
      body: { teamId: teamB._id },
    });
    assert(lockBRes.status === 200, 'Captain B locks lineup successfully (200)');
    assert(lockBRes.data.data.teamBLineupLocked === true, 'teamBLineupLocked is true');
    assert(lockBRes.data.data.status === 'READY', 'Match automatically transitions to READY when both sides locked');

    // Verify TEAM_MATCH_READY notification received by Captain A, Captain B, and Players
    const matchReadyNotif = await Notification.findOne({
      recipient: captainA._id,
      type: 'TEAM_MATCH_READY',
    });
    assert(Boolean(matchReadyNotif), 'Captain A received TEAM_MATCH_READY notification');

    const matchReadyPlayerA1 = await Notification.findOne({
      recipient: playerA1._id,
      type: 'TEAM_MATCH_READY',
    });
    assert(Boolean(matchReadyPlayerA1), 'Player A1 received TEAM_MATCH_READY notification');

    // Modifying lineup when match is READY returns 400
    const editMatchReadyRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainBToken,
      body: {
        teamId: teamB._id,
        assignments: [{ boardNumber: 1, playerId: playerB1._id }],
      },
    });
    assert(editMatchReadyRes.status === 400, 'Editing lineup when match is READY returns 400');

    // -------------------------------------------------------------------------
    // 11. Captain Lineup Unlock & State Reversion
    // -------------------------------------------------------------------------
    console.log('--- 11. Testing Captain Unlock & Reversion ---');
    const unlockARes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/unlock-lineup`, {
      method: 'POST',
      token: captainAToken,
      body: { teamId: teamA._id },
    });
    assert(unlockARes.status === 200, 'Captain A unlocks lineup (200)');
    assert(unlockARes.data.data.teamALineupLocked === false, 'teamALineupLocked is false');
    assert(unlockARes.data.data.status === 'LINEUP', 'Match status reverted to LINEUP upon unlock');

    // Relock Team A to restore READY state for round lifecycle test
    const relockARes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}/lock-lineup`, {
      method: 'POST',
      token: captainAToken,
      body: { teamId: teamA._id },
    });
    assert(relockARes.status === 200, 'Captain A relocks lineup (200)');
    assert(relockARes.data.data.status === 'READY', 'Match status returns to READY');

    // -------------------------------------------------------------------------
    // 12. Round READY Transition Rules
    // -------------------------------------------------------------------------
    console.log('--- 12. Testing Round State Transitions ---');
    // Round 2 has no matches, setting it to READY returns 400
    const emptyRoundReadyRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/${round2Id}`, {
      method: 'PATCH',
      token: organizerToken,
      body: { status: 'READY' },
    });
    assert(emptyRoundReadyRes.status === 400, 'Advancing empty round to READY returns 400');

    // Round 1 has 1 match and it is READY -> advancing Round 1 to READY succeeds
    const round1ReadyRes = await apiRequest(`/team-competitions/${comp1._id}/rounds/${round1Id}`, {
      method: 'PATCH',
      token: organizerToken,
      body: { status: 'READY' },
    });
    assert(round1ReadyRes.status === 200, 'Advancing Round 1 with all ready matches to READY succeeds (200)');
    assert(round1ReadyRes.data.data.status === 'READY', 'Round 1 status is READY');

    // -------------------------------------------------------------------------
    // 13. Match & Round Cancellation Rules
    // -------------------------------------------------------------------------
    console.log('--- 13. Testing Cancellation Rules ---');
    // Create a 2nd match in Round 2 to test cancellation
    const match2Res = await apiRequest(`/team-competitions/${comp1._id}/rounds/${round2Id}/matches`, {
      method: 'POST',
      token: organizerToken,
      body: { teamA: teamA._id, teamB: teamB._id, boardCount: 2 },
    });
    assert(match2Res.status === 201, 'Match 2 created in Round 2 (201)');
    const match2Id = match2Res.data.data._id;
    createdMatchIds.push(match2Id);

    // Non-organizer cancelling match returns 403
    const unauthorizedCancelRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${match2Id}/cancel`, {
      method: 'POST',
      token: captainAToken,
    });
    assert(unauthorizedCancelRes.status === 403, 'Non-organizer cancelling match returns 403 Forbidden');

    // Organizer cancels match
    const cancelMatch2Res = await apiRequest(`/team-competitions/${comp1._id}/matches/${match2Id}/cancel`, {
      method: 'POST',
      token: organizerToken,
    });
    assert(cancelMatch2Res.status === 200, 'Organizer cancels match (200)');
    assert(cancelMatch2Res.data.data.status === 'CANCELLED', 'Match status is CANCELLED');

    // Cancelling already cancelled match returns 400
    const reCancelRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${match2Id}/cancel`, {
      method: 'POST',
      token: organizerToken,
    });
    assert(reCancelRes.status === 400, 'Cancelling already cancelled match returns 400');

    // -------------------------------------------------------------------------
    // 14. Verification of GET APIs & Sensitive Credential Safety
    // -------------------------------------------------------------------------
    console.log('--- 14. Testing Details API & Credential Safety ---');
    const getMatchDetailsRes = await apiRequest(`/team-competitions/${comp1._id}/matches/${matchId}`, {
      token: captainAToken,
    });
    assert(getMatchDetailsRes.status === 200, 'GET /matches/:matchId returns 200');
    assert(getMatchDetailsRes.data.data.userContext.isCaptainA === true, 'userContext correctly identifies Captain A');
    assert(getMatchDetailsRes.data.data.userContext.userTeamSide === 'A', 'userContext assigns side A');
    assert(!JSON.stringify(getMatchDetailsRes.data).includes('passwordHash'), 'passwordHash never leaked in match details');

    const getRoundsRes = await apiRequest(`/team-competitions/${comp1._id}/rounds`);
    assert(getRoundsRes.status === 200, 'Public GET /rounds returns 200');
    assert(getRoundsRes.data.data.length >= 2, 'Returns multiple rounds');

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');

  } finally {
    console.log('🧹 Cleaning up test fixtures...');
    await TeamMatchBoard.deleteMany({ match: { $in: createdMatchIds } });
    await TeamMatch.deleteMany({ _id: { $in: createdMatchIds } });
    await TeamCompetitionRound.deleteMany({ _id: { $in: createdRoundIds } });
    await TeamCompetitionMember.deleteMany({ _id: { $in: createdMemberIds } });
    await TeamCompetitionTeam.deleteMany({ _id: { $in: createdTeamIds } });
    await TeamCompetition.deleteMany({ _id: { $in: createdCompIds } });
    await Notification.deleteMany({ recipient: { $in: createdUserIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await new Promise((resolve) => testServer.close(resolve));
    console.log('✨ Cleanup complete.');
  }

  console.log('🎉 Team Competition V2 Test Suite Passed!\n');
};

runTeamCompetitionMatchesTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Test Suite Failed:', err);
    process.exit(1);
  });
