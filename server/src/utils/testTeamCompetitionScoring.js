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
import TeamCompetitionStanding from '../models/TeamCompetitionStanding.js';
import Notification from '../models/Notification.js';
import { setMockTransport, setMockExportTransport } from '../services/lichessService.js';
import {
  calculateBoardScore,
  calculateMatchScore,
  rebuildCompetitionStandings,
} from '../services/teamCompetitionStandingsService.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

const createToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: '1h' });
};

const runTeamCompetitionScoringTestSuite = async () => {
  console.log('🧪 Starting CHESS JEENO Team Competition V4 Test Suite (Scoring + Match Results + Standings)...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `tc_v4_${timestamp}`;

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
  const createPlayerWithOAuth = async (name, label) => {
    const lichessUser = `${label.toLowerCase()}_lic_${timestamp}`;
    const user = await User.create({
      name,
      email: `${testPrefix}_${label.toLowerCase()}@chessjeeno.local`,
      authProvider: 'local',
      role: 'USER',
      lichessUsername: lichessUser,
      lichessUserId: lichessUser.toLowerCase(),
      lichessOAuth: {
        accessToken: `oauth_mock_tok_${label.toLowerCase()}_${timestamp}`,
        tokenType: 'Bearer',
        scope: 'preference:read challenge:read challenge:write challenge:bulk board:play',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(user._id);
    return user;
  };

  // Mock transports
  let mockGameCounter = 2000;
  const mockExportResults = new Map();

  setMockTransport(async (params) => {
    const id = `game_v4_${mockGameCounter++}`;
    const url = `https://lichess.org/${id}`;
    return { gameId: id, gameUrl: url };
  });

  setMockExportTransport(async (gameId) => {
    if (mockExportResults.has(gameId)) {
      return mockExportResults.get(gameId);
    }
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
    // TEST SECTION 1: Unit Level Board & Match Scoring Calculations
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Unit-Level Deterministic Board Scoring ---');
    const uPlayerA = new mongoose.Types.ObjectId();
    const uPlayerB = new mongoose.Types.ObjectId();

    // Odd board (Board 1): Team A is White, Team B is Black
    const b1WhiteWin = calculateBoardScore({
      boardNumber: 1,
      teamAPlayer: uPlayerA,
      teamBPlayer: uPlayerB,
      whitePlayer: uPlayerA,
      blackPlayer: uPlayerB,
      result: '1-0',
    });
    assert(b1WhiteWin.teamAPoints === 1 && b1WhiteWin.teamBPoints === 0, 'Board 1 (odd): 1-0 awards 1 pt to Team A (White), 0 to Team B');
    assert(b1WhiteWin.teamAHalfPoints === 2 && b1WhiteWin.teamBHalfPoints === 0, 'Board 1 (odd): Win = 2 half-points');

    const b1BlackWin = calculateBoardScore({
      boardNumber: 1,
      teamAPlayer: uPlayerA,
      teamBPlayer: uPlayerB,
      whitePlayer: uPlayerA,
      blackPlayer: uPlayerB,
      result: '0-1',
    });
    assert(b1BlackWin.teamAPoints === 0 && b1BlackWin.teamBPoints === 1, 'Board 1 (odd): 0-1 awards 0 to Team A, 1 pt to Team B (Black)');

    // Even board (Board 2): Team B is White, Team A is Black
    const b2WhiteWin = calculateBoardScore({
      boardNumber: 2,
      teamAPlayer: uPlayerA,
      teamBPlayer: uPlayerB,
      whitePlayer: uPlayerB,
      blackPlayer: uPlayerA,
      result: '1-0',
    });
    assert(b2WhiteWin.teamAPoints === 0 && b2WhiteWin.teamBPoints === 1, 'Board 2 (even): 1-0 awards 1 pt to Team B (White), 0 to Team A');

    const b2BlackWin = calculateBoardScore({
      boardNumber: 2,
      teamAPlayer: uPlayerA,
      teamBPlayer: uPlayerB,
      whitePlayer: uPlayerB,
      blackPlayer: uPlayerA,
      result: '0-1',
    });
    assert(b2BlackWin.teamAPoints === 1 && b2BlackWin.teamBPoints === 0, 'Board 2 (even): 0-1 awards 1 pt to Team A (Black), 0 to Team B');

    // Draw on any board
    const bDraw = calculateBoardScore({
      boardNumber: 1,
      teamAPlayer: uPlayerA,
      teamBPlayer: uPlayerB,
      whitePlayer: uPlayerA,
      blackPlayer: uPlayerB,
      result: '1/2-1/2',
    });
    assert(bDraw.teamAPoints === 0.5 && bDraw.teamBPoints === 0.5, 'Draw: awards 0.5 board point to both teams');
    assert(bDraw.teamAHalfPoints === 1 && bDraw.teamBHalfPoints === 1, 'Draw: awards 1 half-point to both teams');

    // Aborted board
    const bAborted = calculateBoardScore({
      boardNumber: 1,
      teamAPlayer: uPlayerA,
      teamBPlayer: uPlayerB,
      result: 'ABORTED',
    });
    assert(bAborted.isAborted === true, 'Aborted board is flagged isAborted: true');
    assert(bAborted.isScoreable === false, 'Aborted board is non-scoreable');
    assert(bAborted.teamAPoints === null && bAborted.teamBPoints === null, 'Aborted board does NOT invent points');

    // Override taking precedence
    const bOverridden = calculateBoardScore({
      boardNumber: 1,
      teamAPlayer: uPlayerA,
      teamBPlayer: uPlayerB,
      whitePlayer: uPlayerA,
      blackPlayer: uPlayerB,
      result: 'ABORTED',
      overrideResult: '1-0',
    });
    assert(bOverridden.isScoreable === true, 'Organizer override makes aborted board scoreable');
    assert(bOverridden.teamAPoints === 1 && bOverridden.teamBPoints === 0, 'Override takes precedence over raw result');

    // -------------------------------------------------------------------------
    // TEST SECTION 2: Match Level Calculations (Win 3, Draw 1, Loss 0)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Unit-Level Match Scoring Calculations ---');
    const dummyMatch = {
      teamA: new mongoose.Types.ObjectId(),
      teamB: new mongoose.Types.ObjectId(),
    };

    // 4 boards: A wins B1 (1), B wins B2 (0), Draw B3 (0.5), A wins B4 (1) -> Team A: 2.5, Team B: 1.5
    const matchWinBoards = [
      { boardNumber: 1, teamAPlayer: uPlayerA, teamBPlayer: uPlayerB, whitePlayer: uPlayerA, blackPlayer: uPlayerB, result: '1-0', lichessStatus: 'FINISHED' },
      { boardNumber: 2, teamAPlayer: uPlayerA, teamBPlayer: uPlayerB, whitePlayer: uPlayerB, blackPlayer: uPlayerA, result: '1-0', lichessStatus: 'FINISHED' },
      { boardNumber: 3, teamAPlayer: uPlayerA, teamBPlayer: uPlayerB, whitePlayer: uPlayerA, blackPlayer: uPlayerB, result: '1/2-1/2', lichessStatus: 'FINISHED' },
      { boardNumber: 4, teamAPlayer: uPlayerA, teamBPlayer: uPlayerB, whitePlayer: uPlayerB, blackPlayer: uPlayerA, result: '0-1', lichessStatus: 'FINISHED' },
    ];
    const matchWinCalc = calculateMatchScore(dummyMatch, matchWinBoards);
    assert(matchWinCalc.scoringStatus === 'FINAL', 'All scoreable boards produces scoringStatus = FINAL');
    assert(matchWinCalc.teamAScore === 2.5, 'Team A score is 2.5');
    assert(matchWinCalc.teamBScore === 1.5, 'Team B score is 1.5');
    assert(matchWinCalc.teamAResult === 'WIN' && matchWinCalc.teamBResult === 'LOSS', 'Team A result is WIN, Team B is LOSS');
    assert(matchWinCalc.teamAMatchPoints === 3 && matchWinCalc.teamBMatchPoints === 0, 'Win awards 3 match points to winner, 0 to loser');
    assert(matchWinCalc.winnerTeam.toString() === dummyMatch.teamA.toString(), 'winnerTeam is Team A');

    // Draw match: 2-2
    const matchDrawBoards = [
      { boardNumber: 1, teamAPlayer: uPlayerA, teamBPlayer: uPlayerB, whitePlayer: uPlayerA, blackPlayer: uPlayerB, result: '1-0', lichessStatus: 'FINISHED' },
      { boardNumber: 2, teamAPlayer: uPlayerA, teamBPlayer: uPlayerB, whitePlayer: uPlayerB, blackPlayer: uPlayerA, result: '1-0', lichessStatus: 'FINISHED' },
      { boardNumber: 3, teamAPlayer: uPlayerA, teamBPlayer: uPlayerB, whitePlayer: uPlayerA, blackPlayer: uPlayerB, result: '1/2-1/2', lichessStatus: 'FINISHED' },
      { boardNumber: 4, teamAPlayer: uPlayerA, teamBPlayer: uPlayerB, whitePlayer: uPlayerB, blackPlayer: uPlayerA, result: '1/2-1/2', lichessStatus: 'FINISHED' },
    ];
    const matchDrawCalc = calculateMatchScore(dummyMatch, matchDrawBoards);
    assert(matchDrawCalc.teamAScore === 2 && matchDrawCalc.teamBScore === 2, 'Draw match: 2 - 2 score');
    assert(matchDrawCalc.teamAResult === 'DRAW' && matchDrawCalc.teamBResult === 'DRAW', 'Draw match: both results DRAW');
    assert(matchDrawCalc.teamAMatchPoints === 1 && matchDrawCalc.teamBMatchPoints === 1, 'Draw match: awards 1 match point to each');
    assert(matchDrawCalc.winnerTeam === null, 'Draw match: winnerTeam is null');

    // Aborted board in match -> REVIEW_REQUIRED
    const matchAbortedBoards = [
      { boardNumber: 1, teamAPlayer: uPlayerA, teamBPlayer: uPlayerB, whitePlayer: uPlayerA, blackPlayer: uPlayerB, result: '1-0', lichessStatus: 'FINISHED' },
      { boardNumber: 2, teamAPlayer: uPlayerA, teamBPlayer: uPlayerB, whitePlayer: uPlayerB, blackPlayer: uPlayerA, result: 'ABORTED', lichessStatus: 'ABORTED' },
    ];
    const matchAbortedCalc = calculateMatchScore(dummyMatch, matchAbortedBoards);
    assert(matchAbortedCalc.scoringStatus === 'REVIEW_REQUIRED', 'Aborted board causes scoringStatus = REVIEW_REQUIRED');
    assert(matchAbortedCalc.hasAbortedBoard === true, 'hasAbortedBoard is true');
    assert(matchAbortedCalc.teamAMatchPoints === 0 && matchAbortedCalc.teamBMatchPoints === 0, 'No match points awarded during REVIEW_REQUIRED');
    assert(matchAbortedCalc.winnerTeam === null, 'No winner awarded during REVIEW_REQUIRED');

    // -------------------------------------------------------------------------
    // SETUP DATABASE FIXTURES FOR INTEGRATION TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- SETUP: Creating Integration Test Entities ---');
    const organizer = await createPlayerWithOAuth('Organizer Otto', 'org');
    const organizerToken = createToken(organizer._id);

    const captainA = await createPlayerWithOAuth('Captain Anand', 'capA');
    const captainAToken = createToken(captainA._id);

    const captainB = await createPlayerWithOAuth('Captain Boris', 'capB');
    const captainBToken = createToken(captainB._id);

    const captainC = await createPlayerWithOAuth('Captain Carlsen', 'capC');
    const captainCToken = createToken(captainC._id);

    const pA1 = await createPlayerWithOAuth('Alice A1', 'pA1');
    const pA2 = await createPlayerWithOAuth('Arthur A2', 'pA2');
    const pB1 = await createPlayerWithOAuth('Bob B1', 'pB1');
    const pB2 = await createPlayerWithOAuth('Bella B2', 'pB2');
    const pC1 = await createPlayerWithOAuth('Charlie C1', 'pC1');
    const pC2 = await createPlayerWithOAuth('Chloe C2', 'pC2');

    // Create Competition
    const compRes = await apiRequest('/team-competitions', {
      method: 'POST',
      token: organizerToken,
      body: {
        name: 'V4 Championship',
        description: 'Testing team scoring and standings',
        maxTeams: 8,
        maxPlayersPerTeam: 6,
      },
    });
    assert(compRes.status === 201, 'Competition created (201)');
    const competitionId = compRes.data.data._id;
    createdCompIds.push(competitionId);

    // Create 3 Teams: Team A (Alpha), Team B (Beta), Team C (Gamma)
    const tARes = await apiRequest(`/team-competitions/${competitionId}/teams`, {
      method: 'POST',
      token: captainAToken,
      body: { name: 'Alpha Knights' },
    });
    const teamAId = tARes.data.data._id;
    createdTeamIds.push(teamAId);

    const tBRes = await apiRequest(`/team-competitions/${competitionId}/teams`, {
      method: 'POST',
      token: captainBToken,
      body: { name: 'Beta Bishops' },
    });
    const teamBId = tBRes.data.data._id;
    createdTeamIds.push(teamBId);

    const tCRes = await apiRequest(`/team-competitions/${competitionId}/teams`, {
      method: 'POST',
      token: captainCToken,
      body: { name: 'Gamma Rooks' },
    });
    const teamCId = tCRes.data.data._id;
    createdTeamIds.push(teamCId);

    // Add players to teams
    for (const p of [pA1, pA2]) {
      const m = await TeamCompetitionMember.create({
        competition: competitionId,
        team: teamAId,
        user: p._id,
        role: 'PLAYER',
        status: 'ACTIVE',
      });
      createdMemberIds.push(m._id);
    }
    for (const p of [pB1, pB2]) {
      const m = await TeamCompetitionMember.create({
        competition: competitionId,
        team: teamBId,
        user: p._id,
        role: 'PLAYER',
        status: 'ACTIVE',
      });
      createdMemberIds.push(m._id);
    }
    for (const p of [pC1, pC2]) {
      const m = await TeamCompetitionMember.create({
        competition: competitionId,
        team: teamCId,
        user: p._id,
        role: 'PLAYER',
        status: 'ACTIVE',
      });
      createdMemberIds.push(m._id);
    }

    // Helper function to create, lineup, ready, lock and start a match
    const setupAndStartMatch = async (roundId, tAId, tBId, pA_list, pB_list, tokenA, tokenB) => {
      const mRes = await apiRequest(`/team-competitions/${competitionId}/rounds/${roundId}/matches`, {
        method: 'POST',
        token: organizerToken,
        body: { teamA: tAId, teamB: tBId, boardCount: 2 },
      });
      const matchId = mRes.data.data._id;
      createdMatchIds.push(matchId);

      // Lineup Team A
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lineup`, {
        method: 'PATCH',
        token: tokenA,
        body: {
          teamId: tAId,
          assignments: [
            { boardNumber: 1, playerId: pA_list[0]._id },
            { boardNumber: 2, playerId: pA_list[1]._id },
          ],
        },
      });

      // Lineup Team B
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lineup`, {
        method: 'PATCH',
        token: tokenB,
        body: {
          teamId: tBId,
          assignments: [
            { boardNumber: 1, playerId: pB_list[0]._id },
            { boardNumber: 2, playerId: pB_list[1]._id },
          ],
        },
      });

      // Mark readiness
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
        method: 'POST',
        token: tokenA,
        body: { boardNumber: 1, ready: true },
      });
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
        method: 'POST',
        token: tokenA,
        body: { boardNumber: 2, ready: true },
      });
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
        method: 'POST',
        token: tokenB,
        body: { boardNumber: 1, ready: true },
      });
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
        method: 'POST',
        token: tokenB,
        body: { boardNumber: 2, ready: true },
      });

      // Lock lineups
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lock-lineup`, {
        method: 'POST',
        token: tokenA,
        body: { teamId: tAId },
      });
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lock-lineup`, {
        method: 'POST',
        token: tokenB,
        body: { teamId: tBId },
      });

      // Start match
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/start`, {
        method: 'POST',
        token: organizerToken,
      });

      return matchId;
    };

    // -------------------------------------------------------------------------
    // TEST SECTION 3: Round 1 Match Execution & Scoring (Team A beats Team B 2-0)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Round 1 Execution & Result Synchronization ---');
    const r1Res = await apiRequest(`/team-competitions/${competitionId}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 1, name: 'Round 1' },
    });
    const round1Id = r1Res.data.data._id;
    createdRoundIds.push(round1Id);

    const match1Id = await setupAndStartMatch(
      round1Id,
      teamAId,
      teamBId,
      [pA1, pA2],
      [pB1, pB2],
      captainAToken,
      captainBToken
    );

    const m1Boards = await TeamMatchBoard.find({ match: match1Id }).sort({ boardNumber: 1 });
    // Board 1 (odd): Team A White wins ('1-0')
    mockExportResults.set(m1Boards[0].lichessGameId, {
      id: m1Boards[0].lichessGameId,
      status: 'mate',
      winner: 'white',
      players: { white: { user: { name: 'Alice' } }, black: { user: { name: 'Bob' } } },
    });
    // Board 2 (even): Team B White loses ('0-1' -> Team A Black wins)
    mockExportResults.set(m1Boards[1].lichessGameId, {
      id: m1Boards[1].lichessGameId,
      status: 'mate',
      winner: 'black',
      players: { white: { user: { name: 'Bella' } }, black: { user: { name: 'Arthur' } } },
    });

    const syncRes1 = await apiRequest(`/team-competitions/${competitionId}/matches/${match1Id}/sync`, {
      method: 'POST',
    });
    assert(syncRes1.status === 200, 'Sync Round 1 match returns 200');

    // Fetch match result via GET /result endpoint
    const resultRes1 = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match1Id}/result`
    );
    assert(resultRes1.status === 200, 'GET /result endpoint returns 200');
    assert(resultRes1.data.data.scoringStatus === 'FINAL', 'Match scoringStatus is FINAL');
    assert(resultRes1.data.data.teamAScore === 2, 'Team A score is 2.0');
    assert(resultRes1.data.data.teamBScore === 0, 'Team B score is 0.0');
    assert(resultRes1.data.data.teamAMatchPoints === 3, 'Team A receives 3 match points');
    assert(resultRes1.data.data.teamBMatchPoints === 0, 'Team B receives 0 match points');
    assert(resultRes1.data.data.teamAResult === 'WIN', 'Team A result is WIN');
    assert(resultRes1.data.data.teamBResult === 'LOSS', 'Team B result is LOSS');
    assert(resultRes1.data.data.winnerTeam._id.toString() === teamAId.toString(), 'winnerTeam is Alpha Knights');

    // -------------------------------------------------------------------------
    // TEST SECTION 4: Standings Calculation after Round 1
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Standings Calculation after Round 1 ---');
    const standingsRes1 = await apiRequest(`/team-competitions/${competitionId}/standings`);
    assert(standingsRes1.status === 200, 'GET /standings returns 200');
    const sList1 = standingsRes1.data.data.standings;
    assert(sList1.length === 3, 'Standings contains all 3 active teams');

    // Rank 1: Alpha Knights (played: 1, wins: 1, matchPoints: 3, boardPoints: 2, scoreDifference: 2)
    assert(sList1[0].teamId.toString() === teamAId.toString(), 'Rank 1 is Alpha Knights');
    assert(sList1[0].rank === 1, 'Rank 1 rank is 1');
    assert(sList1[0].played === 1, 'Team A played: 1');
    assert(sList1[0].wins === 1, 'Team A wins: 1');
    assert(sList1[0].matchPoints === 3, 'Team A matchPoints: 3');
    assert(sList1[0].boardPoints === 2, 'Team A boardPoints: 2');
    assert(sList1[0].scoreDifference === 2, 'Team A scoreDifference: +2');

    // Verify persisted TeamCompetitionStanding model
    const persistedStandings1 = await TeamCompetitionStanding.find({ competition: competitionId });
    assert(persistedStandings1.length === 3, 'TeamCompetitionStanding documents persisted in database');

    // -------------------------------------------------------------------------
    // TEST SECTION 5: Idempotency & Notification Deduplication
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Idempotency & Deduplication ---');
    // Repeated sync on same match
    const syncResDup = await apiRequest(`/team-competitions/${competitionId}/matches/${match1Id}/sync`, {
      method: 'POST',
    });
    assert(syncResDup.status === 200, 'Repeated sync returns 200');

    const standingsAfterDup = await apiRequest(`/team-competitions/${competitionId}/standings`);
    const sTeamA_dup = standingsAfterDup.data.data.standings.find((s) => s.teamId.toString() === teamAId.toString());
    assert(sTeamA_dup.matchPoints === 3, 'Idempotency: matchPoints remain 3 after repeated sync (no point duplication)');
    assert(sTeamA_dup.boardPoints === 2, 'Idempotency: boardPoints remain 2 after repeated sync');

    // Notification check
    const completionNotifs = await Notification.find({
      teamMatch: match1Id,
      type: 'TEAM_MATCH_COMPLETED',
      recipient: captainA._id,
    });
    assert(completionNotifs.length === 1, 'Captain received exactly 1 TEAM_MATCH_COMPLETED notification');
    assert(completionNotifs[0].message.includes('defeated'), 'Notification message mentions outcome');

    // -------------------------------------------------------------------------
    // TEST SECTION 6: Multi-Round Support (Round 2: Draw match)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Multi-Round Result Aggregation (Draw Match) ---');
    const r2Res = await apiRequest(`/team-competitions/${competitionId}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 2, name: 'Round 2' },
    });
    const round2Id = r2Res.data.data._id;
    createdRoundIds.push(round2Id);

    // Match between Team A and Team C -> draw 1 - 1
    const match2Id = await setupAndStartMatch(
      round2Id,
      teamAId,
      teamCId,
      [pA1, pA2],
      [pC1, pC2],
      captainAToken,
      captainCToken
    );

    const m2Boards = await TeamMatchBoard.find({ match: match2Id }).sort({ boardNumber: 1 });
    // Board 1: Team A White wins
    mockExportResults.set(m2Boards[0].lichessGameId, {
      id: m2Boards[0].lichessGameId,
      status: 'mate',
      winner: 'white',
      players: { white: { user: { name: 'Alice' } }, black: { user: { name: 'Charlie' } } },
    });
    // Board 2: Team C White wins
    mockExportResults.set(m2Boards[1].lichessGameId, {
      id: m2Boards[1].lichessGameId,
      status: 'mate',
      winner: 'white',
      players: { white: { user: { name: 'Chloe' } }, black: { user: { name: 'Arthur' } } },
    });

    await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/sync`, { method: 'POST' });

    const resultRes2 = await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/result`);
    assert(resultRes2.data.data.scoringStatus === 'FINAL', 'Round 2 match scoringStatus is FINAL');
    assert(resultRes2.data.data.teamAScore === 1 && resultRes2.data.data.teamBScore === 1, 'Match 2 is a 1 - 1 draw');
    assert(resultRes2.data.data.teamAResult === 'DRAW' && resultRes2.data.data.teamBResult === 'DRAW', 'Both results are DRAW');
    assert(resultRes2.data.data.teamAMatchPoints === 1 && resultRes2.data.data.teamBMatchPoints === 1, 'Both teams receive 1 match point');
    assert(resultRes2.data.data.winnerTeam === null, 'winnerTeam is null for draw');

    // Standings multi-round check:
    // Team A: 3 (R1) + 1 (R2) = 4 match points, board points = 2 + 1 = 3, played = 2
    const standingsRes2 = await apiRequest(`/team-competitions/${competitionId}/standings`);
    const sTeamA_r2 = standingsRes2.data.data.standings.find((s) => s.teamId.toString() === teamAId.toString());
    assert(sTeamA_r2.played === 2, 'Team A played: 2 matches across Round 1 and Round 2');
    assert(sTeamA_r2.matchPoints === 4, 'Team A aggregated match points: 4');
    assert(sTeamA_r2.boardPoints === 3, 'Team A aggregated board points: 3.0');
    assert(sTeamA_r2.wins === 1 && sTeamA_r2.draws === 1 && sTeamA_r2.losses === 0, 'Team A has 1 win, 1 draw, 0 losses');

    // -------------------------------------------------------------------------
    // TEST SECTION 7: Round Results API
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Round Results API ---');
    const roundResultsRes = await apiRequest(
      `/team-competitions/${competitionId}/rounds/${round1Id}/results`
    );
    assert(roundResultsRes.status === 200, 'GET /rounds/:roundId/results returns 200');
    assert(roundResultsRes.data.data.round.roundNumber === 1, 'Round results return round 1 metadata');
    assert(roundResultsRes.data.data.matches.length === 1, 'Round 1 contains 1 match');
    assert(roundResultsRes.data.data.matches[0].scoringStatus === 'FINAL', 'Match scoringStatus in round results is FINAL');
    assert(roundResultsRes.data.data.matches[0].teamAScore === 2, 'Round result exposes team A score');

    // -------------------------------------------------------------------------
    // TEST SECTION 8: Aborted Board Policy & REVIEW_REQUIRED
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Aborted Board Policy & REVIEW_REQUIRED ---');
    const r3Res = await apiRequest(`/team-competitions/${competitionId}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 3, name: 'Round 3 Aborted Flow' },
    });
    const round3Id = r3Res.data.data._id;
    createdRoundIds.push(round3Id);

    const match3Id = await setupAndStartMatch(
      round3Id,
      teamBId,
      teamCId,
      [pB1, pB2],
      [pC1, pC2],
      captainBToken,
      captainCToken
    );

    const m3Boards = await TeamMatchBoard.find({ match: match3Id }).sort({ boardNumber: 1 });
    // Board 1: Team B White wins ('1-0')
    mockExportResults.set(m3Boards[0].lichessGameId, {
      id: m3Boards[0].lichessGameId,
      status: 'mate',
      winner: 'white',
      players: { white: { user: { name: 'Bob' } }, black: { user: { name: 'Charlie' } } },
    });
    // Board 2: ABORTED on Lichess
    mockExportResults.set(m3Boards[1].lichessGameId, {
      id: m3Boards[1].lichessGameId,
      status: 'aborted',
      winner: null,
      players: { white: { user: { name: 'Chloe' } }, black: { user: { name: 'Bella' } } },
    });

    const syncAbortedRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match3Id}/sync`,
      { method: 'POST' }
    );
    assert(syncAbortedRes.status === 200, 'Sync aborted match returns 200');

    const m3Doc = await TeamMatch.findById(match3Id);
    assert(m3Doc.status === 'COMPLETED', 'Match status is COMPLETED (play on Lichess is finished)');
    assert(m3Doc.scoringStatus === 'REVIEW_REQUIRED', 'Match scoringStatus is REVIEW_REQUIRED');
    assert(m3Doc.teamAMatchPoints === 0 && m3Doc.teamBMatchPoints === 0, 'No match points awarded while REVIEW_REQUIRED');
    assert(m3Doc.winnerTeam === null, 'No winner awarded while REVIEW_REQUIRED');

    // Verify standings: Team B and Team C must NOT receive points from this match while unresolved!
    const standingsResUnresolved = await apiRequest(`/team-competitions/${competitionId}/standings`);
    const sTeamB_unresolved = standingsResUnresolved.data.data.standings.find((s) => s.teamId.toString() === teamBId.toString());
    assert(sTeamB_unresolved.played === 1, 'Team B played count remains 1 (unresolved match excluded from standings)');
    assert(sTeamB_unresolved.matchPoints === 0, 'Team B match points remain 0 (no premature points awarded)');

    // -------------------------------------------------------------------------
    // TEST SECTION 9: Organizer Result Resolution & Recalculation
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Testing Organizer Result Resolution ---');
    // Normal player attempts to resolve -> 403 Forbidden
    const unauthResolve = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match3Id}/resolve-result`,
      {
        method: 'POST',
        token: captainBToken,
        body: { boardNumber: 2, result: '1-0', reason: 'Captain override attempt' },
      }
    );
    assert(unauthResolve.status === 403, 'Captain attempting result resolution returns 403 Forbidden');

    // Invalid result string
    const invalidResult = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match3Id}/resolve-result`,
      {
        method: 'POST',
        token: organizerToken,
        body: { boardNumber: 2, result: '2-0' },
      }
    );
    assert(invalidResult.status === 400, 'Invalid result string returns 400 Bad Request');

    // Organizer resolves Board 2 with '1/2-1/2' (Draw)
    const resolveSuccess = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match3Id}/resolve-result`,
      {
        method: 'POST',
        token: organizerToken,
        body: {
          boardNumber: 2,
          result: '1/2-1/2',
          reason: 'Players agreed to split board due to internet drop',
        },
      }
    );
    assert(resolveSuccess.status === 200, 'Organizer resolves board result (200)');
    assert(resolveSuccess.data.data.scoringStatus === 'FINAL', 'Match recalculates and transitions to FINAL');

    const m3ResolvedDoc = await TeamMatch.findById(match3Id);
    // Board 1: Team B won (1.0). Board 2: Draw (0.5 to each). Team B = 1.5, Team C = 0.5. Team B wins!
    assert(m3ResolvedDoc.scoringStatus === 'FINAL', 'Match scoringStatus is now FINAL');
    assert(m3ResolvedDoc.teamAScore === 1.5, 'Team B (side A in match) score is 1.5');
    assert(m3ResolvedDoc.teamBScore === 0.5, 'Team C (side B in match) score is 0.5');
    assert(m3ResolvedDoc.teamAResult === 'WIN', 'Team B result is WIN');
    assert(m3ResolvedDoc.teamAMatchPoints === 3, 'Team B receives 3 match points');
    assert(m3ResolvedDoc.teamBMatchPoints === 0, 'Team C receives 0 match points');
    assert(m3ResolvedDoc.winnerTeam.toString() === teamBId.toString(), 'winnerTeam is Team B');

    // Standings check after resolution:
    // Team B played: 2, matchPoints: 3 (from match 3)
    const standingsResResolved = await apiRequest(`/team-competitions/${competitionId}/standings`);
    const sTeamB_resolved = standingsResResolved.data.data.standings.find((s) => s.teamId.toString() === teamBId.toString());
    assert(sTeamB_resolved.played === 2, 'Team B played count updated to 2 after resolution');
    assert(sTeamB_resolved.matchPoints === 3, 'Team B match points updated to 3 after resolution');
    assert(sTeamB_resolved.boardPoints === 1.5, 'Team B board points updated to 1.5');

    // -------------------------------------------------------------------------
    // TEST SECTION 10: Deterministic Ranking Order
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Testing Deterministic Basic Ranking Order ---');
    // Team A: 4 MP, 3.0 BP
    // Team B: 3 MP, 1.5 BP
    // Team C: 1 MP, 1.5 BP
    const fullStandings = standingsResResolved.data.data.standings;
    assert(fullStandings[0].teamId.toString() === teamAId.toString(), 'Rank 1 is Team A (4 MP)');
    assert(fullStandings[0].rank === 1, 'Rank 1 rank value is 1');
    assert(fullStandings[1].teamId.toString() === teamBId.toString(), 'Rank 2 is Team B (3 MP)');
    assert(fullStandings[1].rank === 2, 'Rank 2 rank value is 2');
    assert(fullStandings[2].teamId.toString() === teamCId.toString(), 'Rank 3 is Team C (1 MP)');
    assert(fullStandings[2].rank === 3, 'Rank 3 rank value is 3');

    // -------------------------------------------------------------------------
    // TEST SECTION 11: Security & Tamper Resistance
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Testing Security & Malicious Injection Resistance ---');
    // Client trying to inject custom team scores or winner in update match
    const tamperRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match1Id}`,
      {
        method: 'PATCH',
        token: organizerToken,
        body: {
          teamAScore: 999,
          winnerTeam: teamBId,
          teamAMatchPoints: 100,
        },
      }
    );
    // TeamMatch update endpoint only updates scheduling/status, ignores or forbids score injection
    const m1TamperCheck = await TeamMatch.findById(match1Id);
    assert(m1TamperCheck.teamAScore === 2, 'Malicious score injection ignored: score remains 2');
    assert(m1TamperCheck.teamAMatchPoints === 3, 'Malicious match points injection ignored: points remain 3');
    assert(m1TamperCheck.winnerTeam.toString() === teamAId.toString(), 'Malicious winner injection ignored');

    // Cross-competition access
    const fakeCompId = new mongoose.Types.ObjectId();
    const crossCompRes = await apiRequest(
      `/team-competitions/${fakeCompId}/matches/${match1Id}/result`
    );
    assert(crossCompRes.status === 404, 'Cross-competition match access returns 404');

    // Malformed ObjectId
    const malformedIdRes = await apiRequest(
      `/team-competitions/${competitionId}/matches/invalid-match-xyz/result`
    );
    assert(malformedIdRes.status === 400, 'Malformed match ID returns 400 Bad Request');

    const malformedCompRes = await apiRequest(
      `/team-competitions/invalid-comp-xyz/standings`
    );
    assert(malformedCompRes.status === 400, 'Malformed competition ID returns 400 Bad Request');

    console.log(`\n==================================================`);
    console.log(`🎉 ALL TEAM COMPETITION SCORING & STANDINGS TESTS PASSED!`);
    console.log(`   Total Passed: ${passedTests} / ${totalTests}`);
    console.log(`==================================================\n`);
  } finally {
    setMockTransport(null);
    setMockExportTransport(null);

    console.log('🧹 Cleaning up test database records...');
    try {
      if (createdMatchIds.length) {
        await TeamMatchBoard.deleteMany({ match: { $in: createdMatchIds } });
        await TeamMatch.deleteMany({ _id: { $in: createdMatchIds } });
      }
      if (createdRoundIds.length) {
        await TeamCompetitionRound.deleteMany({ _id: { $in: createdRoundIds } });
      }
      if (createdCompIds.length) {
        await TeamCompetitionStanding.deleteMany({ competition: { $in: createdCompIds } });
        await TeamCompetitionMember.deleteMany({ competition: { $in: createdCompIds } });
        await TeamCompetitionTeam.deleteMany({ competition: { $in: createdCompIds } });
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

runTeamCompetitionScoringTestSuite().catch((err) => {
  console.error('\n❌ Fatal Test Runner Error:', err);
  process.exit(1);
});
