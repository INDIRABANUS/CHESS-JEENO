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
import {
  syncMatchResults,
  resolveMatchResult,
} from '../services/teamMatchService.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

const createToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: '1h' });
};

const runAuditSuite = async () => {
  console.log('🧪 Starting CHESS JEENO Team Competition V4 Deep Audit Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `audit_v4_${timestamp}`;

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, description) => {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${description}`);
      throw new Error(`Audit assertion failed: ${description}`);
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

  let mockGameCounter = 5000;
  const mockExportResults = new Map();

  setMockTransport(async () => {
    const id = `audit_game_${mockGameCounter++}`;
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
    // SETUP: Create competition, 3 teams, and captains
    // -------------------------------------------------------------------------
    const organizer = await createPlayerWithOAuth('Audit Organizer', 'organizer');
    const organizerToken = createToken(organizer._id);

    const capA = await createPlayerWithOAuth('Captain Titan', 'capA');
    const capB = await createPlayerWithOAuth('Captain Phoenix', 'capB');
    const capC = await createPlayerWithOAuth('Captain Viper', 'capC');
    const captainAToken = createToken(capA._id);
    const captainBToken = createToken(capB._id);
    const captainCToken = createToken(capC._id);

    const pA1 = await createPlayerWithOAuth('Player T1', 'pA1');
    const pA2 = await createPlayerWithOAuth('Player T2', 'pA2');
    const pB1 = await createPlayerWithOAuth('Player P1', 'pB1');
    const pB2 = await createPlayerWithOAuth('Player P2', 'pB2');
    const pC1 = await createPlayerWithOAuth('Player V1', 'pC1');
    const pC2 = await createPlayerWithOAuth('Player V2', 'pC2');

    // Create Competition
    const compRes = await apiRequest('/team-competitions', {
      method: 'POST',
      token: organizerToken,
      body: {
        name: `Audit Championship ${timestamp}`,
        format: 'TEAM_ROUND_ROBIN',
        status: 'REGISTRATION',
      },
    });
    const competitionId = compRes.data.data._id;
    createdCompIds.push(competitionId);

    // Create Teams
    const teamARes = await apiRequest(`/team-competitions/${competitionId}/teams`, {
      method: 'POST',
      token: captainAToken,
      body: { name: 'Titans Squad' },
    });
    const teamAId = teamARes.data.data._id;
    createdTeamIds.push(teamAId);

    const teamBRes = await apiRequest(`/team-competitions/${competitionId}/teams`, {
      method: 'POST',
      token: captainBToken,
      body: { name: 'Phoenix Squad' },
    });
    const teamBId = teamBRes.data.data._id;
    createdTeamIds.push(teamBId);

    const teamCRes = await apiRequest(`/team-competitions/${competitionId}/teams`, {
      method: 'POST',
      token: captainCToken,
      body: { name: 'Vipers Squad' },
    });
    const teamCId = teamCRes.data.data._id;
    createdTeamIds.push(teamCId);

    // Register active members for each team
    for (const [tId, p] of [
      [teamAId, pA1],
      [teamAId, pA2],
      [teamBId, pB1],
      [teamBId, pB2],
      [teamCId, pC1],
      [teamCId, pC2],
    ]) {
      await TeamCompetitionMember.create({
        competition: competitionId,
        team: tId,
        user: p._id,
        role: 'PLAYER',
        status: 'ACTIVE',
        joinedAt: new Date(),
      });
    }

    // Helper to setup and start a match
    const setupAndStartMatch = async (roundId, tAId, tBId, playersA, playersB, tokA, tokB) => {
      const matchRes = await apiRequest(
        `/team-competitions/${competitionId}/rounds/${roundId}/matches`,
        {
          method: 'POST',
          token: organizerToken,
          body: { teamA: tAId, teamB: tBId, boardCount: 2 },
        }
      );
      const matchId = matchRes.data.data._id;
      createdMatchIds.push(matchId);

      // Lineups
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lineup`, {
        method: 'PATCH',
        token: tokA,
        body: {
          teamId: tAId,
          assignments: [
            { boardNumber: 1, playerId: playersA[0]._id },
            { boardNumber: 2, playerId: playersA[1]._id },
          ],
        },
      });

      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lineup`, {
        method: 'PATCH',
        token: tokB,
        body: {
          teamId: tBId,
          assignments: [
            { boardNumber: 1, playerId: playersB[0]._id },
            { boardNumber: 2, playerId: playersB[1]._id },
          ],
        },
      });

      // Readiness
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
        method: 'POST',
        token: tokA,
        body: { boardNumber: 1, ready: true },
      });
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
        method: 'POST',
        token: tokA,
        body: { boardNumber: 2, ready: true },
      });
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
        method: 'POST',
        token: tokB,
        body: { boardNumber: 1, ready: true },
      });
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/ready`, {
        method: 'POST',
        token: tokB,
        body: { boardNumber: 2, ready: true },
      });

      // Lock lineups
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lock-lineup`, {
        method: 'POST',
        token: tokA,
        body: { teamId: tAId },
      });
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/lock-lineup`, {
        method: 'POST',
        token: tokB,
        body: { teamId: tBId },
      });

      // Start match
      await apiRequest(`/team-competitions/${competitionId}/matches/${matchId}/start`, {
        method: 'POST',
        token: organizerToken,
      });

      return matchId;
    };

    // =========================================================================
    // AUDIT ITEM 1: Deterministic Standings Rebuild from All FINAL Matches
    // =========================================================================
    console.log('--- AUDIT 1: Deterministic Standings Rebuild ---');
    const r1Res = await apiRequest(`/team-competitions/${competitionId}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 1, name: 'Audit Round 1' },
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
    // Match 1: Team A wins 2-0 (Board 1 White win: 1-0; Board 2 Black win: 0-1)
    mockExportResults.set(m1Boards[0].lichessGameId, {
      id: m1Boards[0].lichessGameId,
      status: 'mate',
      winner: 'white',
      players: { white: { user: { name: 'TA_White' } }, black: { user: { name: 'TB_Black' } } },
    });
    mockExportResults.set(m1Boards[1].lichessGameId, {
      id: m1Boards[1].lichessGameId,
      status: 'mate',
      winner: 'black',
      players: { white: { user: { name: 'TB_White' } }, black: { user: { name: 'TA_Black' } } },
    });

    await apiRequest(`/team-competitions/${competitionId}/matches/${match1Id}/sync`, { method: 'POST' });

    // Rebuild standings twice and verify bit-for-bit equivalence
    const rebuild1 = await rebuildCompetitionStandings(competitionId);
    const rebuild2 = await rebuildCompetitionStandings(competitionId);

    assert(
      JSON.stringify(rebuild1.standings) === JSON.stringify(rebuild2.standings),
      'Consecutive rebuildCompetitionStandings invocations produce strictly identical standings'
    );
    const sTeamA_rb1 = rebuild1.standings.find((s) => s.teamId.toString() === teamAId.toString());
    const sTeamB_rb1 = rebuild1.standings.find((s) => s.teamId.toString() === teamBId.toString());
    const sTeamC_rb1 = rebuild1.standings.find((s) => s.teamId.toString() === teamCId.toString());

    assert(sTeamA_rb1.rank === 1 && sTeamA_rb1.matchPoints === 3, 'Rank 1 is Team A with 3 match points');
    assert(sTeamA_rb1.boardPoints === 2 && sTeamA_rb1.wins === 1, 'Team A has 2 board points and 1 win');
    assert(sTeamC_rb1.rank === 2 && sTeamC_rb1.played === 0 && sTeamC_rb1.scoreDifference === 0, 'Rank 2 is unplayed Team C (0 diff ranks above -2 diff)');
    assert(sTeamB_rb1.rank === 3 && sTeamB_rb1.played === 1 && sTeamB_rb1.scoreDifference === -2, 'Rank 3 is Team B (-2 diff)');

    // =========================================================================
    // AUDIT ITEM 2: Repeated Result Sync Cannot Duplicate Points or Notifications
    // =========================================================================
    console.log('\n--- AUDIT 2: Idempotent Repeated Synchronization & Deduplication ---');
    // Call sync 5 times consecutively
    for (let i = 1; i <= 5; i++) {
      await apiRequest(`/team-competitions/${competitionId}/matches/${match1Id}/sync`, { method: 'POST' });
    }

    const standingsAfterRepeatedSync = await rebuildCompetitionStandings(competitionId);
    const teamAStanding = standingsAfterRepeatedSync.standings.find((s) => s.teamId.toString() === teamAId.toString());
    const teamBStanding = standingsAfterRepeatedSync.standings.find((s) => s.teamId.toString() === teamBId.toString());

    assert(teamAStanding.matchPoints === 3, 'Team A matchPoints strictly remain 3 after 5 repeated syncs');
    assert(teamAStanding.boardPoints === 2, 'Team A boardPoints strictly remain 2 after 5 repeated syncs');
    assert(teamAStanding.played === 1, 'Team A played count strictly remains 1 after 5 repeated syncs');
    assert(teamBStanding.matchPoints === 0, 'Team B matchPoints strictly remain 0');

    // Check notifications: each recipient must have received at most 1 completion notification
    const completionNotifsForCapA = await Notification.countDocuments({
      recipient: capA._id,
      type: 'TEAM_MATCH_COMPLETED',
      teamMatch: match1Id,
    });
    const completionNotifsForCapB = await Notification.countDocuments({
      recipient: capB._id,
      type: 'TEAM_MATCH_COMPLETED',
      teamMatch: match1Id,
    });

    assert(completionNotifsForCapA === 1, 'Captain A received exactly 1 completion notification across all syncs');
    assert(completionNotifsForCapB === 1, 'Captain B received exactly 1 completion notification across all syncs');

    // =========================================================================
    // AUDIT ITEM 3: Result Override Recalculates Standings Removing Old Contribution
    // =========================================================================
    console.log('\n--- AUDIT 3: Organizer Override on FINAL Match Cleans Old Contribution ---');
    // Match 1 was: Team A won 2.0 - 0.0 (3 MP for Team A, 0 MP for Team B)
    // Organizer now overrides Board 1 from 1-0 to 0-1 (Board 1 winner changes from Team A to Team B)
    // Now: Board 1 is 0-1 (Team B wins Board 1), Board 2 is 0-1 (Team A wins Board 2)
    // New Match 1 score: Team A 1.0 - Team B 1.0 -> DRAW!
    // Corrected Match Points: Team A = 1 MP, Team B = 1 MP (previous 3 MP removed from Team A, 1 MP applied)
    const overrideRes1 = await apiRequest(
      `/team-competitions/${competitionId}/matches/${match1Id}/resolve-result`,
      {
        method: 'POST',
        token: organizerToken,
        body: {
          boardNumber: 1,
          result: '0-1',
          reason: 'Correction: Black won Board 1 on clock forfeit',
        },
      }
    );
    assert(overrideRes1.status === 200, 'Organizer override on finalized match succeeds with 200');

    const m1AfterOverride = await TeamMatch.findById(match1Id);
    assert(m1AfterOverride.scoringStatus === 'FINAL', 'Match remains FINAL after override');
    assert(m1AfterOverride.teamAScore === 1.0, 'Team A score updated to 1.0');
    assert(m1AfterOverride.teamBScore === 1.0, 'Team B score updated to 1.0');
    assert(m1AfterOverride.teamAResult === 'DRAW', 'Team A result updated to DRAW');
    assert(m1AfterOverride.teamBResult === 'DRAW', 'Team B result updated to DRAW');
    assert(m1AfterOverride.teamAMatchPoints === 1, 'Team A match points updated from 3 to 1');
    assert(m1AfterOverride.teamBMatchPoints === 1, 'Team B match points updated from 0 to 1');
    assert(m1AfterOverride.winnerTeam === null, 'winnerTeam cleared to null for draw');

    // Verify standings accurately subtracted the old 3 MP and applied the new 1 MP
    const standingsAfterOverride1 = await apiRequest(`/team-competitions/${competitionId}/standings`);
    const sTeamA_ov1 = standingsAfterOverride1.data.data.standings.find((s) => s.teamId.toString() === teamAId.toString());
    const sTeamB_ov1 = standingsAfterOverride1.data.data.standings.find((s) => s.teamId.toString() === teamBId.toString());

    assert(sTeamA_ov1.matchPoints === 1, 'Team A standings matchPoints decreased from 3 to 1 (old points cleanly removed)');
    assert(sTeamA_ov1.boardPoints === 1.0, 'Team A standings boardPoints decreased from 2.0 to 1.0');
    assert(sTeamA_ov1.wins === 0, 'Team A wins count decremented from 1 to 0');
    assert(sTeamA_ov1.draws === 1, 'Team A draws count incremented to 1');
    assert(sTeamA_ov1.scoreDifference === 0, 'Team A scoreDifference updated from +2 to 0');

    assert(sTeamB_ov1.matchPoints === 1, 'Team B standings matchPoints increased from 0 to 1');
    assert(sTeamB_ov1.boardPoints === 1.0, 'Team B standings boardPoints increased from 0.0 to 1.0');
    assert(sTeamB_ov1.losses === 0, 'Team B losses count decremented from 1 to 0');
    assert(sTeamB_ov1.draws === 1, 'Team B draws count incremented to 1');

    // Second override: Organizer overrides Board 2 from 0-1 to 1-0 (White win, Team B is White on Board 2)
    // Board 1: Team B won (1.0). Board 2: Team B won (1.0).
    // New Match 1 score: Team A 0.0 - Team B 2.0 -> Team B WINS!
    // Expected: Team A = 0 MP, Team B = 3 MP!
    await apiRequest(
      `/team-competitions/${competitionId}/matches/${match1Id}/resolve-result`,
      {
        method: 'POST',
        token: organizerToken,
        body: {
          boardNumber: 2,
          result: '1-0',
          reason: 'Correction: White won Board 2',
        },
      }
    );

    const standingsAfterOverride2 = await apiRequest(`/team-competitions/${competitionId}/standings`);
    const sTeamA_ov2 = standingsAfterOverride2.data.data.standings.find((s) => s.teamId.toString() === teamAId.toString());
    const sTeamB_ov2 = standingsAfterOverride2.data.data.standings.find((s) => s.teamId.toString() === teamBId.toString());

    assert(sTeamA_ov2.matchPoints === 0, 'Team A matchPoints updated to 0 after second override');
    assert(sTeamA_ov2.boardPoints === 0, 'Team A boardPoints updated to 0 after second override');
    assert(sTeamA_ov2.losses === 1, 'Team A has 1 loss');
    assert(sTeamB_ov2.matchPoints === 3, 'Team B matchPoints updated to 3 (now winner)');
    assert(sTeamB_ov2.boardPoints === 2, 'Team B boardPoints updated to 2');
    assert(sTeamB_ov2.wins === 1, 'Team B has 1 win');
    assert(sTeamB_ov2.scoreDifference === 2, 'Team B scoreDifference is +2');

    // =========================================================================
    // AUDIT ITEM 4: Aborted Boards Never Contribute to Standings
    // =========================================================================
    console.log('\n--- AUDIT 4: Zero Standings Contribution from REVIEW_REQUIRED Match ---');
    const r2Res = await apiRequest(`/team-competitions/${competitionId}/rounds`, {
      method: 'POST',
      token: organizerToken,
      body: { roundNumber: 2, name: 'Audit Round 2' },
    });
    const round2Id = r2Res.data.data._id;
    createdRoundIds.push(round2Id);

    const match2Id = await setupAndStartMatch(
      round2Id,
      teamBId,
      teamCId,
      [pB1, pB2],
      [pC1, pC2],
      captainBToken,
      captainCToken
    );

    const m2Boards = await TeamMatchBoard.find({ match: match2Id }).sort({ boardNumber: 1 });
    // Board 1 finishes, Board 2 aborts
    mockExportResults.set(m2Boards[0].lichessGameId, {
      id: m2Boards[0].lichessGameId,
      status: 'mate',
      winner: 'white',
      players: { white: { user: { name: 'PB1' } }, black: { user: { name: 'PC1' } } },
    });
    mockExportResults.set(m2Boards[1].lichessGameId, {
      id: m2Boards[1].lichessGameId,
      status: 'aborted',
      winner: null,
      players: { white: { user: { name: 'PC2' } }, black: { user: { name: 'PB2' } } },
    });

    await apiRequest(`/team-competitions/${competitionId}/matches/${match2Id}/sync`, { method: 'POST' });

    const m2Doc = await TeamMatch.findById(match2Id);
    assert(m2Doc.scoringStatus === 'REVIEW_REQUIRED', 'Match 2 is strictly in REVIEW_REQUIRED status');

    // Standings should still only count Match 1 (where Team B has 3 MP, Team C has 0 MP, 0 played)
    const standingsDuringAborted = await apiRequest(`/team-competitions/${competitionId}/standings`);
    const sTeamB_aborted = standingsDuringAborted.data.data.standings.find((s) => s.teamId.toString() === teamBId.toString());
    const sTeamC_aborted = standingsDuringAborted.data.data.standings.find((s) => s.teamId.toString() === teamCId.toString());

    assert(sTeamB_aborted.played === 1, 'Team B played count remains 1 (Match 2 completely excluded)');
    assert(sTeamB_aborted.matchPoints === 3, 'Team B match points remain 3 (Match 2 completely excluded)');
    assert(sTeamC_aborted.played === 0, 'Team C played count remains 0');
    assert(sTeamC_aborted.matchPoints === 0, 'Team C match points remain 0');

    // =========================================================================
    // AUDIT ITEM 5: Concurrent Sync and Result Resolution Requests
    // =========================================================================
    console.log('\n--- AUDIT 5: Concurrency Hardening (Parallel Sync & Resolution) ---');
    // Fire 6 parallel sync operations on Match 1 and 2
    const parallelRequests = [
      syncMatchResults(competitionId, match1Id),
      syncMatchResults(competitionId, match1Id),
      syncMatchResults(competitionId, match2Id),
      rebuildCompetitionStandings(competitionId),
      rebuildCompetitionStandings(competitionId),
      syncMatchResults(competitionId, match1Id),
    ];

    await Promise.all(parallelRequests);

    // Verify exactly 3 documents exist in TeamCompetitionStanding (1 per team, no duplicates)
    const standingDocsCount = await TeamCompetitionStanding.countDocuments({ competition: competitionId });
    assert(standingDocsCount === 3, 'TeamCompetitionStanding has exactly 3 documents (1 per active team, no duplicates)');

    const finalStandingsRes = await apiRequest(`/team-competitions/${competitionId}/standings`);
    const finalStandings = finalStandingsRes.data.data.standings;

    // Verify values remain intact and no double-counting occurred
    const finalTeamB = finalStandings.find((s) => s.teamId.toString() === teamBId.toString());
    assert(finalTeamB.played === 1, 'Concurrent requests: Team B played count is strictly 1');
    assert(finalTeamB.matchPoints === 3, 'Concurrent requests: Team B match points are strictly 3 (no double-counting)');
    assert(finalTeamB.boardPoints === 2, 'Concurrent requests: Team B board points are strictly 2');

    console.log(`\n==================================================`);
    console.log(`🎉 ALL V4 AUDIT ASSERTIONS PASSED!`);
    console.log(`   Total Passed: ${passedTests} / ${totalTests}`);
    console.log(`==================================================\n`);
  } finally {
    setMockTransport(null);
    setMockExportTransport(null);

    console.log('🧹 Cleaning up audit test database records...');
    try {
      if (createdMatchIds.length) {
        await TeamMatchBoard.deleteMany({ match: { $in: createdMatchIds } });
        await TeamMatch.deleteMany({ _id: { $in: createdMatchIds } });
      }
      if (createdRoundIds.length) {
        await TeamCompetitionRound.deleteMany({ _id: { $in: createdRoundIds } });
      }
      if (createdTeamIds.length) {
        await TeamCompetitionMember.deleteMany({ team: { $in: createdTeamIds } });
        await TeamCompetitionStanding.deleteMany({ team: { $in: createdTeamIds } });
        await TeamCompetitionTeam.deleteMany({ _id: { $in: createdTeamIds } });
      }
      if (createdCompIds.length) {
        await TeamCompetitionStanding.deleteMany({ competition: { $in: createdCompIds } });
        await TeamCompetition.deleteMany({ _id: { $in: createdCompIds } });
      }
      if (createdUserIds.length) {
        await Notification.deleteMany({ recipient: { $in: createdUserIds } });
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
    } catch {
      // Ignore cleanup error
    }
    await testServer.close();
    console.log('✨ Cleanup complete.');
    process.exit(0);
  }
};

runAuditSuite().catch((err) => {
  console.error('Audit suite failed with error:', err);
  process.exit(1);
});
