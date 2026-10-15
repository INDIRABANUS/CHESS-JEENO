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
import { setMockTransport, setMockExportTransport } from '../services/lichessService.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

const createToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: '1h' });
};

const runTeamCompetitionExecutionTestSuite = async () => {
  console.log('🧪 Starting CHESS JEENO Team Competition V3 Test Suite (Match Execution + Lichess Games)...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `tc_v3_${timestamp}`;

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

  // Helper to create users with Lichess OAuth credentials
  const createPlayerWithOAuth = async (name, label, hasLichess = true, hasScopes = true) => {
    const lichessUser = `${label.toLowerCase()}_lic_${timestamp}`;
    const userData = {
      name,
      email: `${testPrefix}_${label.toLowerCase()}@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
    };

    if (hasLichess) {
      userData.lichessUsername = lichessUser;
      userData.lichessUserId = lichessUser.toLowerCase();
      userData.lichessOAuth = {
        accessToken: `oauth_mock_tok_${label.toLowerCase()}_${timestamp}`,
        tokenType: 'Bearer',
        scope: hasScopes
          ? 'preference:read challenge:read challenge:write challenge:bulk board:play'
          : 'preference:read',
        connectedAt: new Date(),
      };
    }

    const user = await User.create(userData);
    createdUserIds.push(user._id);
    return user;
  };

  // Mock Lichess Game Creation Transport
  let mockGameCounter = 1000;
  const mockCreatedGames = new Map();
  setMockTransport(async (params) => {
    const id = `game${mockGameCounter++}`;
    const url = `https://lichess.org/${id}`;
    mockCreatedGames.set(id, {
      ...params,
      id,
      url,
      status: 'started',
    });
    return { gameId: id, gameUrl: url };
  });

  // Mock Lichess Game Export / Sync Transport
  const mockExportResults = new Map();
  setMockExportTransport(async (gameId) => {
    if (mockExportResults.has(gameId)) {
      return mockExportResults.get(gameId);
    }
    // Default active game
    return {
      id: gameId,
      status: 'started',
      players: {
        white: { user: { name: 'WhitePlayer' } },
        black: { user: { name: 'BlackPlayer' } },
      },
    };
  });

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create Users, Competitions, Teams, Rosters
    // -------------------------------------------------------------------------
    console.log('--- SETUP: Creating Test Entities ---');
    const organizer = await createPlayerWithOAuth('Organizer Oscar', 'org');
    const organizerToken = createToken(organizer._id);

    const captainA = await createPlayerWithOAuth('Captain Anand', 'capA');
    const captainAToken = createToken(captainA._id);

    const captainB = await createPlayerWithOAuth('Captain Boris', 'capB');
    const captainBToken = createToken(captainB._id);

    const playerA1 = await createPlayerWithOAuth('Player Alice (A1)', 'pA1');
    const playerA1Token = createToken(playerA1._id);

    const playerA2 = await createPlayerWithOAuth('Player Arthur (A2)', 'pA2');
    const playerB1 = await createPlayerWithOAuth('Player Bob (B1)', 'pB1');
    const playerB2 = await createPlayerWithOAuth('Player Bella (B2)', 'pB2');

    // Unlinked player for missing OAuth testing
    const unlinkedPlayer = await createPlayerWithOAuth('Player Unlinked', 'unlinked', false);

    console.log('  Entities created successfully.\n');

    // Create Competition
    const compRes = await apiRequest('/team-competitions', {
      method: 'POST',
      token: organizerToken,
      body: {
        name: 'V3 Execution Championship',
        description: 'Test competition for match execution',
        maxTeams: 8,
        maxPlayersPerTeam: 6,
      },
    });
    assert(compRes.status === 201, 'Organizer creates competition (201)');
    const competitionId = compRes.data.data._id;
    createdCompIds.push(competitionId);

    // Create Team A and Team B
    const teamARes = await apiRequest(`/team-competitions/${competitionId}/teams`, {
      method: 'POST',
      token: captainAToken,
      body: { name: 'Alpha Knights' },
    });
    assert(teamARes.status === 201, 'Team A created (201)');
    const teamAId = teamARes.data.data._id;
    createdTeamIds.push(teamAId);

    const teamBRes = await apiRequest(`/team-competitions/${competitionId}/teams`, {
      method: 'POST',
      token: captainBToken,
      body: { name: 'Beta Bishops' },
    });
    assert(teamBRes.status === 201, 'Team B created (201)');
    const teamBId = teamBRes.data.data._id;
    createdTeamIds.push(teamBId);

    // Add players to teams
    for (const p of [playerA1, playerA2]) {
      const m = await TeamCompetitionMember.create({
        competition: competitionId,
        team: teamAId,
        user: p._id,
        role: 'PLAYER',
        status: 'ACTIVE',
      });
      createdMemberIds.push(m._id);
    }
    for (const p of [playerB1, playerB2]) {
      const m = await TeamCompetitionMember.create({
        competition: competitionId,
        team: teamBId,
        user: p._id,
        role: 'PLAYER',
        status: 'ACTIVE',
      });
      createdMemberIds.push(m._id);
    }

    // Create Round
    const roundRes = await apiRequest(`/team-competitions/${competitionId}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 1, name: 'Round 1 Execution' },
    });
    assert(roundRes.status === 201, 'Round 1 created (201)');
    const roundId = roundRes.data.data._id;
    createdRoundIds.push(roundId);

    // Create 2-Board Match
    const matchRes = await apiRequest(`/team-competitions/${competitionId}/rounds/${roundId}/matches`, {
      method: 'POST',
      token: organizerToken,
      body: {
        teamA: teamAId,
        teamB: teamBId,
        boardCount: 2,
      },
    });
    assert(matchRes.status === 201, '2-board match created (201)');
    const matchId = matchRes.data.data._id;
    createdMatchIds.push(matchId);

    // -------------------------------------------------------------------------
    // TEST 2: Non-READY match rejected from starting
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Non-READY Match Rejected ---');
    const startDraftRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}/start`,
      { method: 'POST', token: organizerToken }
    );
    assert(startDraftRes.status === 400, 'Starting a DRAFT match is rejected with 400');

    // -------------------------------------------------------------------------
    // Set Lineups & Lock to make match READY
    // -------------------------------------------------------------------------
    console.log('\n--- Setting Lineups and Confirming Readiness ---');
    // Team A lineup: Board 1 = playerA1, Board 2 = playerA2
    await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainAToken,
      body: {
        teamId: teamAId,
        assignments: [
          { boardNumber: 1, playerId: playerA1._id },
          { boardNumber: 2, playerId: playerA2._id },
        ],
      },
    });

    // Team B lineup: Board 1 = playerB1, Board 2 = playerB2
    await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lineup`, {
      method: 'PATCH',
      token: captainBToken,
      body: {
        teamId: teamBId,
        assignments: [
          { boardNumber: 1, playerId: playerB1._id },
          { boardNumber: 2, playerId: playerB2._id },
        ],
      },
    });

    // Mark players ready
    await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
      method: 'POST',
      token: playerA1Token,
      body: { boardNumber: 1, ready: true },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
      method: 'POST',
      token: captainAToken,
      body: { boardNumber: 2, ready: true },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
      method: 'POST',
      token: captainBToken,
      body: { boardNumber: 1, ready: true },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
      method: 'POST',
      token: captainBToken,
      body: { boardNumber: 2, ready: true },
    });

    // Lock both lineups -> transitions match to READY
    await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lock-lineup`, {
      method: 'POST',
      token: captainAToken,
      body: { teamId: teamAId },
    });
    const lockBRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}/lock-lineup`,
      {
        method: 'POST',
        token: captainBToken,
        body: { teamId: teamBId },
      }
    );
    assert(lockBRes.data.data.status === 'READY', 'Match transitions to READY after both captains lock');

    // -------------------------------------------------------------------------
    // TEST 4 & 5: Captain & Player Authorization Rejected (403), Unauthenticated (401)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4 & 5: Authorization Security Controls ---');
    const unauthStart = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}/start`,
      { method: 'POST', token: null }
    );
    assert(unauthStart.status === 401, 'Unauthenticated start request rejected with 401');

    const captainStart = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}/start`,
      { method: 'POST', token: captainAToken }
    );
    assert(captainStart.status === 403, 'Team captain start request rejected with 403');

    const playerStart = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}/start`,
      { method: 'POST', token: playerA1Token }
    );
    assert(playerStart.status === 403, 'Normal player start request rejected with 403');

    // -------------------------------------------------------------------------
    // TEST 1, 3, 6, 7, 8: READY match start by Organizer, All Boards Created, URLs & Colors
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1, 3, 6, 7, 8: Organizer Starts READY Match ---');
    const startRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}/start`,
      { method: 'POST', token: organizerToken }
    );
    assert(startRes.status === 200, 'Organizer successfully starts match (200)');
    assert(startRes.data.data.status === 'IN_PROGRESS', 'Match status becomes IN_PROGRESS');
    assert(startRes.data.data.successfulBoards.length === 2, 'All 2 boards successfully created');
    assert(startRes.data.data.failedBoards.length === 0, 'No failed boards returned');
    assert(startRes.data.data.createdLichessGameIds.length === 2, '2 Lichess game IDs returned');

    // Fetch match boards from database
    const boardsAfterStart = await TeamMatchBoard.find({ match: matchId }).sort({ boardNumber: 1 });
    assert(boardsAfterStart.length === 2, '2 boards found in database');

    // Board 1: Odd -> Team A = White, Team B = Black
    const b1 = boardsAfterStart[0];
    assert(b1.lichessStatus === 'ACTIVE', 'Board 1 lichessStatus is ACTIVE');
    assert(Boolean(b1.lichessGameId), 'Board 1 has lichessGameId');
    assert(b1.lichessUrl.includes(b1.lichessGameId), 'Board 1 has valid Lichess URL');
    assert(b1.whitePlayer.toString() === playerA1._id.toString(), 'Board 1 (odd): Team A player is White');
    assert(b1.blackPlayer.toString() === playerB1._id.toString(), 'Board 1 (odd): Team B player is Black');

    // Board 2: Even -> Team B = White, Team A = Black (Alternating color policy)
    const b2 = boardsAfterStart[1];
    assert(b2.lichessStatus === 'ACTIVE', 'Board 2 lichessStatus is ACTIVE');
    assert(Boolean(b2.lichessGameId), 'Board 2 has lichessGameId');
    assert(b2.lichessUrl.includes(b2.lichessGameId), 'Board 2 has valid Lichess URL');
    assert(b2.whitePlayer.toString() === playerB2._id.toString(), 'Board 2 (even): Team B player is White');
    assert(b2.blackPlayer.toString() === playerA2._id.toString(), 'Board 2 (even): Team A player is Black');

    // -------------------------------------------------------------------------
    // TEST 13: Duplicate Start Protection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 13: Duplicate Start Protection ---');
    const dupStartRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}/start`,
      { method: 'POST', token: organizerToken }
    );
    assert(dupStartRes.status === 400, 'Duplicate start request rejected with 400 (not READY)');
    const boardsAfterDup = await TeamMatchBoard.find({ match: matchId }).sort({ boardNumber: 1 });
    assert(
      boardsAfterDup[0].lichessGameId === b1.lichessGameId &&
      boardsAfterDup[1].lichessGameId === b2.lichessGameId,
      'Duplicate start did not recreate or overwrite existing games'
    );

    // -------------------------------------------------------------------------
    // TEST 21: Sensitive Data Protection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 21: Sensitive Data Concealment ---');
    const getMatchRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}`,
      { method: 'GET', token: playerA1Token }
    );
    const matchJson = JSON.stringify(getMatchRes.data);
    assert(!matchJson.includes('oauth_mock_tok_'), 'OAuth accessToken is never exposed in match response');
    assert(!matchJson.includes('refreshToken'), 'OAuth refreshToken is never exposed in match response');

    // -------------------------------------------------------------------------
    // TEST 22: Notifications for Match Start
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 22: Notification Deduplication ---');
    const notifs = await Notification.find({
      recipient: playerA1._id,
      type: 'TEAM_MATCH_STARTED',
    });
    assert(notifs.length === 1, 'Assigned player received exactly 1 TEAM_MATCH_STARTED notification');
    assert(notifs[0].message.includes('Board 1 is ready'), 'Notification message specifies board number');

    // -------------------------------------------------------------------------
    // TEST 15 & 16: Result Synchronization & Idempotency
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 15 & 16: Result Synchronization & Idempotency ---');
    // Set Board 1 as terminal 'mate' (White wins -> '1-0')
    mockExportResults.set(b1.lichessGameId, {
      id: b1.lichessGameId,
      status: 'mate',
      winner: 'white',
      players: {
        white: { user: { name: 'PlayerA1' } },
        black: { user: { name: 'PlayerB1' } },
      },
    });

    const sync1Res = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}/sync`,
      { method: 'POST', token: organizerToken }
    );
    assert(sync1Res.status === 200, 'Result sync succeeds (200)');
    const b1AfterSync = await TeamMatchBoard.findById(b1._id);
    assert(b1AfterSync.lichessStatus === 'FINISHED', 'Board 1 status transitioned to FINISHED');
    assert(b1AfterSync.result === '1-0', 'Board 1 result updated to 1-0');
    assert(Boolean(b1AfterSync.lastSyncedAt), 'Board 1 lastSyncedAt recorded');

    // TEST 18: Incomplete match does not complete while Board 2 is still ACTIVE
    const matchMidSync = await TeamMatch.findById(matchId);
    assert(matchMidSync.status === 'IN_PROGRESS', 'Match remains IN_PROGRESS while Board 2 is active');

    // Idempotent sync check on Board 1
    const sync2Res = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}/sync`,
      { method: 'POST', token: organizerToken }
    );
    const b1AfterSync2 = await TeamMatchBoard.findById(b1._id);
    assert(b1AfterSync2.result === '1-0' && b1AfterSync2.lichessStatus === 'FINISHED', 'Repeated sync maintains exact result');

    // -------------------------------------------------------------------------
    // TEST 17: Match Completion & Round Completion
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 17: Match Completion When All Boards Terminal ---');
    // Set Board 2 as terminal 'draw' -> '1/2-1/2'
    mockExportResults.set(b2.lichessGameId, {
      id: b2.lichessGameId,
      status: 'draw',
      winner: null,
      players: {
        white: { user: { name: 'PlayerB2' } },
        black: { user: { name: 'PlayerA2' } },
      },
    });

    const syncFinalRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${matchId}/sync`,
      { method: 'POST', token: organizerToken }
    );
    assert(syncFinalRes.data.data.completed === true, 'Sync response indicates match completed');
    const finalMatch = await TeamMatch.findById(matchId);
    assert(finalMatch.status === 'COMPLETED', 'Match status transitioned to COMPLETED');

    const finalRound = await TeamCompetitionRound.findById(roundId);
    assert(finalRound.status === 'COMPLETED', 'Round transitions to COMPLETED when all matches finished');

    // -------------------------------------------------------------------------
    // SETUP FOR MATCH 2: Test Partial Failure & Retry
    // -------------------------------------------------------------------------
    console.log('\n--- SETUP FOR MATCH 2: Partial Board Failure & Retry ---');
    const round2Res = await apiRequest(`/team-competitions/${competitionId}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 2, name: 'Round 2 Partial Failure' },
    });
    assert(round2Res.status === 201, 'Round 2 created (201)');
    const round2Id = round2Res.data.data._id;
    createdRoundIds.push(round2Id);

    const match2Res = await apiRequest(`/team-competitions/${competitionId}/rounds/${round2Id}/matches`, {
      method: 'POST',
      token: organizerToken,
      body: {
        teamA: teamAId,
        teamB: teamBId,
        boardCount: 2,
      },
    });
    const match2Id = match2Res.data.data._id;
    createdMatchIds.push(match2Id);

    // Set lineups and locks for Match 2
    await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/lineup`, {
      method: 'PATCH',
      token: captainAToken,
      body: {
        teamId: teamAId,
        assignments: [
          { boardNumber: 1, playerId: playerA1._id },
          { boardNumber: 2, playerId: playerA2._id },
        ],
      },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/lineup`, {
      method: 'PATCH',
      token: captainBToken,
      body: {
        teamId: teamBId,
        assignments: [
          { boardNumber: 1, playerId: playerB1._id },
          { boardNumber: 2, playerId: playerB2._id },
        ],
      },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/ready`, {
      method: 'POST',
      token: captainAToken,
      body: { boardNumber: 1, ready: true },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/ready`, {
      method: 'POST',
      token: captainAToken,
      body: { boardNumber: 2, ready: true },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/ready`, {
      method: 'POST',
      token: captainBToken,
      body: { boardNumber: 1, ready: true },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/ready`, {
      method: 'POST',
      token: captainBToken,
      body: { boardNumber: 2, ready: true },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/lock-lineup`, {
      method: 'POST',
      token: captainAToken,
      body: { teamId: teamAId },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/lock-lineup`, {
      method: 'POST',
      token: captainBToken,
      body: { teamId: teamBId },
    });

    // -------------------------------------------------------------------------
    // TEST 10: Partial Board Creation Failure
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Partial Board Creation Failure ---');
    // Start match with simulated failure on Board 2
    const partialStartRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match2Id}/start`,
      {
        method: 'POST',
        token: organizerToken,
        body: { failBoards: [2] },
      }
    );
    assert(partialStartRes.status === 200, 'Partial start returns 200 with summary');
    assert(partialStartRes.data.data.status === 'IN_PROGRESS', 'Match status becomes IN_PROGRESS despite partial failure');
    assert(partialStartRes.data.data.successfulBoards.includes(1), 'Board 1 successfully created');
    assert(partialStartRes.data.data.failedBoards.some((f) => f.boardNumber === 2), 'Board 2 recorded in failedBoards');
    assert(partialStartRes.data.data.retryableBoards.includes(2), 'Board 2 listed in retryableBoards');

    const m2Boards = await TeamMatchBoard.find({ match: match2Id }).sort({ boardNumber: 1 });
    const m2B1GameId = m2Boards[0].lichessGameId;
    assert(m2Boards[0].lichessStatus === 'ACTIVE', 'Match 2 Board 1 is ACTIVE');
    assert(m2Boards[1].lichessStatus === 'ERROR', 'Match 2 Board 2 is ERROR');
    assert(Boolean(m2Boards[1].resultReason), 'Match 2 Board 2 records resultReason');

    // -------------------------------------------------------------------------
    // TEST 11 & 12: Retry Failed Boards & Preserve Successful Games
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11 & 12: Retry Failed Boards Only ---');
    // Retry without failBoards -> Board 2 should succeed
    const retryRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match2Id}/retry`,
      { method: 'POST', token: organizerToken }
    );
    assert(retryRes.status === 200, 'Retry returns 200');
    assert(retryRes.data.data.successfulBoards.includes(2), 'Board 2 succeeded on retry');
    assert(retryRes.data.data.failedBoards.length === 0, 'No remaining failed boards');

    const m2BoardsAfterRetry = await TeamMatchBoard.find({ match: match2Id }).sort({ boardNumber: 1 });
    assert(m2BoardsAfterRetry[0].lichessGameId === m2B1GameId, 'Board 1 game ID unchanged (not recreated)');
    assert(m2BoardsAfterRetry[1].lichessStatus === 'ACTIVE', 'Board 2 now ACTIVE with game');
    assert(Boolean(m2BoardsAfterRetry[1].lichessGameId), 'Board 2 now has lichessGameId');

    // -------------------------------------------------------------------------
    // TEST 14: Duplicate Retry Protection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 14: Duplicate Retry Protection ---');
    const dupRetryRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match2Id}/retry`,
      { method: 'POST', token: organizerToken }
    );
    assert(dupRetryRes.status === 200, 'Duplicate retry returns 200');
    assert(dupRetryRes.data.data.retried === 0, 'No boards retried (all already valid)');

    // -------------------------------------------------------------------------
    // TEST 9: Missing Lichess Authorization Validation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Missing Lichess Authorization Validation ---');
    // Add unlinked player to team A
    const mUnlinked = await TeamCompetitionMember.create({
      competition: competitionId,
      team: teamAId,
      user: unlinkedPlayer._id,
      role: 'PLAYER',
      status: 'ACTIVE',
    });
    createdMemberIds.push(mUnlinked._id);

    // Create Round 3 for Match 3 with unlinked player
    const round3Res = await apiRequest(`/team-competitions/${competitionId}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 3, name: 'Round 3 Unlinked Player' },
    });
    assert(round3Res.status === 201, 'Round 3 created (201)');
    const round3Id = round3Res.data.data._id;
    createdRoundIds.push(round3Id);

    const match3Res = await apiRequest(`/team-competitions/${competitionId}/rounds/${round3Id}/matches`, {
      method: 'POST',
      token: organizerToken,
      body: { teamA: teamAId, teamB: teamBId, boardCount: 1 },
    });
    const match3Id = match3Res.data.data._id;
    createdMatchIds.push(match3Id);

    await apiRequest(`/team-competitions/${competitionId}/matches/${match3Id}/lineup`, {
      method: 'PATCH',
      token: captainAToken,
      body: {
        teamId: teamAId,
        assignments: [{ boardNumber: 1, playerId: unlinkedPlayer._id }],
      },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match3Id}/lineup`, {
      method: 'PATCH',
      token: captainBToken,
      body: {
        teamId: teamBId,
        assignments: [{ boardNumber: 1, playerId: playerB1._id }],
      },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match3Id}/ready`, {
      method: 'POST',
      token: captainAToken,
      body: { boardNumber: 1, ready: true },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match3Id}/ready`, {
      method: 'POST',
      token: captainBToken,
      body: { boardNumber: 1, ready: true },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match3Id}/lock-lineup`, {
      method: 'POST',
      token: captainAToken,
      body: { teamId: teamAId },
    });
    await apiRequest(`/team-competitions/${competitionId}/matches/${match3Id}/lock-lineup`, {
      method: 'POST',
      token: captainBToken,
      body: { teamId: teamBId },
    });

    // Try to start match with unlinked player -> should fail with 400
    const startUnlinkedRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match3Id}/start`,
      { method: 'POST', token: organizerToken }
    );
    assert(startUnlinkedRes.status === 400, 'Start match rejected with 400 due to unlinked player');
    assert(
      startUnlinkedRes.data.message.toLowerCase().includes('lichess connection required'),
      'Helpful error message specifying Lichess connection requirement'
    );
    const m3Doc = await TeamMatch.findById(match3Id);
    assert(m3Doc.status === 'READY', 'Match remains safe in READY status');

    // -------------------------------------------------------------------------
    // TEST 19 & 20: Cross-Competition & Invalid ObjectId Validation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 19 & 20: Cross-Competition & ObjectId Validation ---');
    const fakeCompId = new mongoose.Types.ObjectId();
    const crossCompRes = await apiRequest(
      `/team-competitions/${fakeCompId}/matches/${matchId}/start`,
      { method: 'POST', token: organizerToken }
    );
    assert(crossCompRes.status === 404, 'Non-existent competition returns 404');

    const invalidIdRes = await apiRequest(
      `/team-competitions/invalid-id/matches/${matchId}/start`,
      { method: 'POST', token: organizerToken }
    );
    assert(invalidIdRes.status === 400, 'Invalid ObjectId format returns controlled 400');

    // -------------------------------------------------------------------------
    // TEST 24 & 25: V1 & V2 Regressions
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 24 & 25: V1 & V2 Regression Verification ---');
    const compCheck = await apiRequest(`/team-competitions/${competitionId}`, { method: 'GET' });
    assert(compCheck.status === 200, 'V1: Competition details fetch works normally');

    const teamsCheck = await apiRequest(`/team-competitions/${competitionId}/teams`, { method: 'GET' });
    assert(teamsCheck.status === 200 && teamsCheck.data.data.length >= 2, 'V1: Teams list works normally');

    const roundsCheck = await apiRequest(`/team-competitions/${competitionId}/rounds`, { method: 'GET' });
    assert(roundsCheck.status === 200 && roundsCheck.data.data.length >= 1, 'V2: Rounds list works normally');

    console.log(`\n==================================================`);
    console.log(`🎉 ALL TEAM COMPETITION EXECUTION TESTS PASSED!`);
    console.log(`   Total Passed: ${passedTests} / ${totalTests}`);
    console.log(`==================================================\n`);
  } finally {
    // Restore mock transports
    setMockTransport(null);
    setMockExportTransport(null);

    // Cleanup created test records
    console.log('🧹 Cleaning up test database records...');
    try {
      if (createdMatchIds.length) {
        await TeamMatchBoard.deleteMany({ match: { $in: createdMatchIds } });
        await TeamMatch.deleteMany({ _id: { $in: createdMatchIds } });
      }
      if (createdRoundIds.length) {
        await TeamCompetitionRound.deleteMany({ _id: { $in: createdRoundIds } });
      }
      if (createdMemberIds.length) {
        await TeamCompetitionMember.deleteMany({ _id: { $in: createdMemberIds } });
      }
      if (createdTeamIds.length) {
        await TeamCompetitionTeam.deleteMany({ _id: { $in: createdTeamIds } });
      }
      if (createdCompIds.length) {
        await TeamCompetition.deleteMany({ _id: { $in: createdCompIds } });
      }
      if (createdUserIds.length) {
        await Notification.deleteMany({ recipient: { $in: createdUserIds } });
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      console.log('✨ Cleanup complete.');
    } catch (cleanupErr) {
      console.warn('⚠️ Cleanup warning:', cleanupErr.message);
    }

    testServer.close();
    await mongoose.disconnect();
  }
};

runTeamCompetitionExecutionTestSuite().catch((err) => {
  console.error('\n❌ Fatal Test Runner Error:', err);
  process.exit(1);
});
