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
import {
  generateTeamRoundRobinSchedule,
  normalizeTeamIds,
} from './teamRoundRobin.js';
import {
  calculateBoardScore,
  calculateMatchScore,
  rebuildCompetitionStandings,
} from '../services/teamCompetitionStandingsService.js';
import teamMatchService from '../services/teamMatchService.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

const createToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: '1h' });
};

const runTeamCompetitionRoundRobinTestSuite = async () => {
  console.log('🧪 Starting CHESS JEENO Team Competition V5 Test Suite (Round Robin Scheduling)...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `tc_v5_${timestamp}`;

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

  // Track created fixtures for cleanup
  const createdUserIds = [];
  const createdCompIds = [];
  const createdRoundIds = [];
  const createdMatchIds = [];

  const post = async (endpoint, data, token) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, data: json };
  };

  const get = async (endpoint, token) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, data: json };
  };

  try {
    // =========================================================================
    // SECTION 1: UNIT-LEVEL SCHEDULING ENGINE TESTS (Circle-Method Algorithm)
    // =========================================================================
    console.log('--- 1. Testing Circle-Method Round Robin Algorithm: Even Team Counts ---');

    const testEvenCounts = [2, 4, 6, 8];
    for (const n of testEvenCounts) {
      const mockTeams = Array.from({ length: n }, (_, i) => `team_${String.fromCharCode(65 + i)}`);
      const schedule = generateTeamRoundRobinSchedule(mockTeams);

      const expectedRounds = n - 1;
      const expectedMatchesPerRound = n / 2;
      const expectedTotalMatches = (n * (n - 1)) / 2;

      assert(schedule.totalTeams === n, `N=${n}: totalTeams is ${n}`);
      assert(schedule.totalRounds === expectedRounds, `N=${n}: totalRounds is ${expectedRounds} (N-1)`);
      assert(schedule.totalMatches === expectedTotalMatches, `N=${n}: totalMatches is ${expectedTotalMatches}`);
      assert(schedule.byesCount === 0, `N=${n}: even team count produces 0 BYEs`);
      assert(schedule.rounds.length === expectedRounds, `N=${n}: rounds array length matches totalRounds`);

      // Verify every round has exactly N/2 matches and no BYEs
      let allRoundsValidMatchesCount = true;
      let allRoundsNullBye = true;
      for (const r of schedule.rounds) {
        if (r.matches.length !== expectedMatchesPerRound) allRoundsValidMatchesCount = false;
        if (r.byeTeam !== null) allRoundsNullBye = false;
      }
      assert(allRoundsValidMatchesCount, `N=${n}: every round has exactly ${expectedMatchesPerRound} matches`);
      assert(allRoundsNullBye, `N=${n}: every round byeTeam is null`);

      // Verify:
      // 1. Every unordered team pair meets exactly once
      // 2. No team plays against itself
      // 3. No team plays more than once in the same round
      const pairSet = new Set();
      let hasSelfMatch = false;
      let hasRoundDuplicate = false;

      for (const r of schedule.rounds) {
        const teamsInRound = new Set();
        for (const m of r.matches) {
          if (m.teamA === m.teamB) hasSelfMatch = true;
          if (teamsInRound.has(m.teamA) || teamsInRound.has(m.teamB)) hasRoundDuplicate = true;
          teamsInRound.add(m.teamA);
          teamsInRound.add(m.teamB);

          const sortedPairKey = [m.teamA, m.teamB].sort().join('__vs__');
          pairSet.add(sortedPairKey);
        }
      }

      assert(!hasSelfMatch, `N=${n}: no team ever plays against itself`);
      assert(!hasRoundDuplicate, `N=${n}: no team plays more than once in the same round`);
      assert(
        pairSet.size === expectedTotalMatches,
        `N=${n}: all ${expectedTotalMatches} unordered team pairings appear exactly once`
      );
    }

    console.log('\n--- 2. Testing Circle-Method Round Robin Algorithm: Odd Team Counts ---');

    const testOddCounts = [3, 5, 7];
    for (const n of testOddCounts) {
      const mockTeams = Array.from({ length: n }, (_, i) => `team_${String.fromCharCode(65 + i)}`);
      const schedule = generateTeamRoundRobinSchedule(mockTeams);

      const expectedRounds = n;
      const expectedMatchesPerRound = (n - 1) / 2;
      const expectedTotalMatches = (n * (n - 1)) / 2;
      const expectedTotalByes = n;

      assert(schedule.totalTeams === n, `Odd N=${n}: totalTeams is ${n}`);
      assert(schedule.totalRounds === expectedRounds, `Odd N=${n}: totalRounds is ${expectedRounds} (N)`);
      assert(schedule.totalMatches === expectedTotalMatches, `Odd N=${n}: totalMatches is ${expectedTotalMatches}`);
      assert(schedule.byesCount === expectedTotalByes, `Odd N=${n}: byesCount is ${expectedTotalByes}`);

      const pairSet = new Set();
      const byeCountByTeam = {};
      mockTeams.forEach((t) => (byeCountByTeam[t] = 0));

      let hasSelfMatch = false;
      let hasRoundDuplicate = false;
      let allRoundsValidMatchesCount = true;

      for (const r of schedule.rounds) {
        if (r.matches.length !== expectedMatchesPerRound) allRoundsValidMatchesCount = false;

        assert(r.byeTeam !== null, `Odd N=${n}: Round ${r.roundNumber} has exactly one BYE assignment`);
        if (r.byeTeam) {
          byeCountByTeam[r.byeTeam]++;
        }

        const teamsInRound = new Set();
        if (r.byeTeam) teamsInRound.add(r.byeTeam);

        for (const m of r.matches) {
          if (m.teamA === m.teamB) hasSelfMatch = true;
          if (teamsInRound.has(m.teamA) || teamsInRound.has(m.teamB)) hasRoundDuplicate = true;
          teamsInRound.add(m.teamA);
          teamsInRound.add(m.teamB);

          const sortedPairKey = [m.teamA, m.teamB].sort().join('__vs__');
          pairSet.add(sortedPairKey);
        }
      }

      assert(allRoundsValidMatchesCount, `Odd N=${n}: each round has (N-1)/2 = ${expectedMatchesPerRound} matches`);
      assert(!hasSelfMatch, `Odd N=${n}: no team ever plays against itself`);
      assert(!hasRoundDuplicate, `Odd N=${n}: bye team and playing teams are strictly disjoint in each round`);
      assert(
        pairSet.size === expectedTotalMatches,
        `Odd N=${n}: all ${expectedTotalMatches} unordered pairings appear exactly once`
      );

      // Verify every team receives exactly 1 BYE across the full schedule
      const everyTeamGetsOneBye = Object.values(byeCountByTeam).every((count) => count === 1);
      assert(everyTeamGetsOneBye, `Odd N=${n}: every single team receives exactly 1 BYE across the full tournament`);
    }

    console.log('\n--- 3. Testing Algorithm Determinism & Minimum Team-Count Validation ---');

    // Deterministic ordering: different order input produces identical schedule
    const teamsListA = ['team_alpha', 'team_beta', 'team_gamma', 'team_delta'];
    const teamsListB = ['team_delta', 'team_alpha', 'team_gamma', 'team_beta'];

    const schedA = generateTeamRoundRobinSchedule(teamsListA);
    const schedB = generateTeamRoundRobinSchedule(teamsListB);

    assert(
      JSON.stringify(schedA) === JSON.stringify(schedB),
      'Algorithm is 100% deterministic: input order variation yields identical schedule'
    );

    // Minimum team-count validation
    let threwForZero = false;
    try {
      generateTeamRoundRobinSchedule([]);
    } catch {
      threwForZero = true;
    }
    assert(threwForZero, 'generateTeamRoundRobinSchedule rejects 0 teams');

    let threwForOne = false;
    try {
      generateTeamRoundRobinSchedule(['lone_team']);
    } catch {
      threwForOne = true;
    }
    assert(threwForOne, 'generateTeamRoundRobinSchedule rejects 1 team (minimum 2 teams required)');

    // =========================================================================
    // SECTION 2: INTEGRATION API & CONTROLLER TESTS
    // =========================================================================
    console.log('\n--- 4. Setting Up Integration Test Fixtures ---');

    const organizer = await User.create({
      name: 'Organizer V5',
      email: `${testPrefix}_org@chessjeeno.com`,
      passwordHash: 'dummyhash',
      authProvider: 'local',
      role: 'ADMIN',
    });
    createdUserIds.push(organizer._id);
    const orgToken = createToken(organizer._id);

    const playerA = await User.create({
      name: 'Captain A',
      email: `${testPrefix}_capA@chessjeeno.com`,
      passwordHash: 'dummyhash',
      authProvider: 'local',
    });
    createdUserIds.push(playerA._id);
    const capAToken = createToken(playerA._id);

    const playerB = await User.create({
      name: 'Captain B',
      email: `${testPrefix}_capB@chessjeeno.com`,
      passwordHash: 'dummyhash',
      authProvider: 'local',
    });
    createdUserIds.push(playerB._id);

    const playerC = await User.create({
      name: 'Captain C',
      email: `${testPrefix}_capC@chessjeeno.com`,
      passwordHash: 'dummyhash',
      authProvider: 'local',
    });
    createdUserIds.push(playerC._id);

    // Create DRAFT competition to test lifecycle guards
    const draftComp = await TeamCompetition.create({
      name: `${testPrefix} Draft Comp`,
      organizer: organizer._id,
      status: 'DRAFT',
    });
    createdCompIds.push(draftComp._id);

    // Create CANCELLED competition to test lifecycle guards
    const cancelledComp = await TeamCompetition.create({
      name: `${testPrefix} Cancelled Comp`,
      organizer: organizer._id,
      status: 'CANCELLED',
    });
    createdCompIds.push(cancelledComp._id);

    // Create Active Competition (Odd: 3 teams)
    const activeCompOdd = await TeamCompetition.create({
      name: `${testPrefix} Odd 3-Team Tournament`,
      organizer: organizer._id,
      status: 'REGISTRATION',
    });
    createdCompIds.push(activeCompOdd._id);

    // Create 3 active teams for activeCompOdd
    const team1 = await TeamCompetitionTeam.create({
      competition: activeCompOdd._id,
      name: `${testPrefix} Alpha Knights`,
      captain: playerA._id,
      status: 'ACTIVE',
    });
    const team2 = await TeamCompetitionTeam.create({
      competition: activeCompOdd._id,
      name: `${testPrefix} Beta Bishops`,
      captain: playerB._id,
      status: 'ACTIVE',
    });
    const team3 = await TeamCompetitionTeam.create({
      competition: activeCompOdd._id,
      name: `${testPrefix} Gamma Rooks`,
      captain: playerC._id,
      status: 'ACTIVE',
    });

    // Create 1 INACTIVE / REMOVED team to verify it is strictly excluded from schedule
    const removedTeam = await TeamCompetitionTeam.create({
      competition: activeCompOdd._id,
      name: `${testPrefix} Disqualified Pawns`,
      captain: playerA._id,
      status: 'REMOVED',
    });

    console.log('\n--- 5. Testing Authorization, Lifecycle & Validation Guards ---');

    // 1. Unauthenticated request rejected (401)
    const unauthRes = await post(`/team-competitions/${activeCompOdd._id}/schedule/round-robin`, {});
    assert(unauthRes.status === 401, 'Unauthenticated schedule generation rejected with 401');

    // 2. Non-organizer request rejected (403 Forbidden)
    const nonOrgRes = await post(
      `/team-competitions/${activeCompOdd._id}/schedule/round-robin`,
      {},
      capAToken
    );
    assert(nonOrgRes.status === 403, 'Non-organizer schedule generation rejected with 403 Forbidden');

    // 3. Invalid competition ID format (400)
    const malformedRes = await post('/team-competitions/invalid-comp-id/schedule/round-robin', {}, orgToken);
    assert(malformedRes.status === 400, 'Malformed competition ID returns controlled 400 Bad Request');

    // 4. Non-existent competition (404)
    const nonExistentId = new mongoose.Types.ObjectId();
    const notFoundRes = await post(`/team-competitions/${nonExistentId}/schedule/round-robin`, {}, orgToken);
    assert(notFoundRes.status === 404, 'Non-existent competition returns 404 Not Found');

    // 5. Lifecycle status DRAFT rejected (400)
    const draftRes = await post(`/team-competitions/${draftComp._id}/schedule/round-robin`, {}, orgToken);
    assert(draftRes.status === 400, 'DRAFT competition schedule generation rejected with 400');

    // 6. Lifecycle status CANCELLED rejected (400)
    const cancelRes = await post(`/team-competitions/${cancelledComp._id}/schedule/round-robin`, {}, orgToken);
    assert(cancelRes.status === 400, 'CANCELLED competition schedule generation rejected with 400');

    // 7. Competition with insufficient active teams (< 2) rejected (400)
    const emptyComp = await TeamCompetition.create({
      name: `${testPrefix} Empty Comp`,
      organizer: organizer._id,
      status: 'REGISTRATION',
    });
    createdCompIds.push(emptyComp._id);
    const emptyRes = await post(`/team-competitions/${emptyComp._id}/schedule/round-robin`, {}, orgToken);
    assert(emptyRes.status === 400, 'Competition with 0 active teams rejected with 400');

    // 8. BoardCount validation (min 1, max 20)
    const invalidBoardCountRes = await post(
      `/team-competitions/${activeCompOdd._id}/schedule/round-robin`,
      { boardCount: 99 },
      orgToken
    );
    assert(invalidBoardCountRes.status === 400, 'boardCount > 20 rejected with 400');

    console.log('\n--- 6. Testing Schedule Preview Endpoint ---');

    const previewRes = await get(`/team-competitions/${activeCompOdd._id}/schedule/round-robin/preview`, orgToken);
    assert(previewRes.status === 200, 'GET /schedule/round-robin/preview returns 200 OK');
    assert(previewRes.data.data.eligibleTeamsCount === 3, 'Preview identifies exactly 3 eligible active teams');
    assert(previewRes.data.data.roundsCount === 3, 'Preview calculates exactly 3 rounds for 3 teams');
    assert(previewRes.data.data.matchesCount === 3, 'Preview calculates exactly 3 matches');
    assert(previewRes.data.data.byesPerRound === 1, 'Preview calculates 1 BYE per round');
    assert(previewRes.data.data.totalByes === 3, 'Preview calculates 3 total BYEs');
    assert(previewRes.data.data.hasExistingSchedule === false, 'Preview indicates no existing schedule yet');
    assert(previewRes.data.data.canGenerate === true, 'Preview indicates organizer can generate schedule');

    console.log('\n--- 7. Testing Successful Odd Team Count Schedule Generation (N=3) ---');

    const genRes = await post(
      `/team-competitions/${activeCompOdd._id}/schedule/round-robin`,
      { boardCount: 2 },
      orgToken
    );

    assert(genRes.status === 201, 'POST /schedule/round-robin returns 201 Created');
    assert(genRes.data.success === true, 'Response success is true');
    assert(genRes.data.data.totalTeams === 3, 'Response summary totalTeams is 3');
    assert(genRes.data.data.totalRounds === 3, 'Response summary totalRounds is 3');
    assert(genRes.data.data.totalMatches === 3, 'Response summary totalMatches is 3');
    assert(genRes.data.data.byesCount === 3, 'Response summary byesCount is 3');
    assert(genRes.data.data.boardCount === 2, 'Response summary boardCount is 2');

    // Verify DB state for generated rounds
    const dbRounds = await TeamCompetitionRound.find({ competition: activeCompOdd._id })
      .populate('byeTeam', '_id name')
      .sort({ roundNumber: 1 });
    dbRounds.forEach((r) => createdRoundIds.push(r._id));

    assert(dbRounds.length === 3, 'Exactly 3 TeamCompetitionRound records created in MongoDB');
    assert(dbRounds[0].roundNumber === 1, 'First round has roundNumber 1');
    assert(dbRounds[1].roundNumber === 2, 'Second round has roundNumber 2');
    assert(dbRounds[2].roundNumber === 3, 'Third round has roundNumber 3');

    // Verify BYE assignments in MongoDB
    const byeTeamsInDb = dbRounds.map((r) => r.byeTeam?._id?.toString()).filter(Boolean);
    assert(byeTeamsInDb.length === 3, 'Every round has a valid byeTeam assigned in MongoDB');

    const uniqueByeTeams = new Set(byeTeamsInDb);
    assert(uniqueByeTeams.size === 3, 'All 3 teams receive exactly 1 BYE across the 3 rounds');
    assert(!uniqueByeTeams.has(removedTeam._id.toString()), 'REMOVED team was NEVER assigned a BYE');

    // Verify DB state for generated matches
    const dbMatches = await TeamMatch.find({ competition: activeCompOdd._id })
      .populate('teamA', '_id name status')
      .populate('teamB', '_id name status');
    dbMatches.forEach((m) => createdMatchIds.push(m._id));

    assert(dbMatches.length === 3, 'Exactly 3 TeamMatch records created (1 match per round)');

    // Verify each match has exactly 2 boards
    const dbBoards = await TeamMatchBoard.find({ match: { $in: createdMatchIds } });
    assert(dbBoards.length === 6, 'Exactly 6 boards created (3 matches × 2 boards/match)');

    // Verify board sequence
    for (const match of dbMatches) {
      const matchBoards = dbBoards.filter((b) => b.match.toString() === match._id.toString());
      assert(matchBoards.length === 2, `Match ${match._id} has exactly 2 boards`);
      assert(
        matchBoards.some((b) => b.boardNumber === 1) && matchBoards.some((b) => b.boardNumber === 2),
        `Match ${match._id} has sequential board numbers 1 and 2`
      );
    }

    // Verify competition lifecycle transition
    const updatedComp = await TeamCompetition.findById(activeCompOdd._id);
    assert(updatedComp.status === 'READY', 'Competition transitioned from REGISTRATION to READY upon scheduling');

    console.log('\n--- 8. Testing Duplicate Generation Rejection & Safe Regeneration ---');

    // Duplicate call rejected
    const dupRes = await post(
      `/team-competitions/${activeCompOdd._id}/schedule/round-robin`,
      { boardCount: 2 },
      orgToken
    );
    assert(dupRes.status === 400, 'Duplicate schedule generation rejected with 400');
    assert(
      dupRes.data.message.includes('A schedule already exists'),
      'Clear error message on duplicate schedule generation'
    );

    // Safe regeneration (regenerate: true) while matches are still in DRAFT
    const regenRes = await post(
      `/team-competitions/${activeCompOdd._id}/schedule/round-robin`,
      { boardCount: 4, regenerate: true },
      orgToken
    );
    assert(regenRes.status === 201, 'Regenerating schedule with regenerate: true succeeds (201 Created)');
    assert(regenRes.data.data.boardCount === 4, 'Regenerated fixtures use updated boardCount=4');

    const regenRounds = await TeamCompetitionRound.find({ competition: activeCompOdd._id });
    assert(regenRounds.length === 3, 'Regeneration maintains exact total rounds count (3)');

    const regenMatches = await TeamMatch.find({ competition: activeCompOdd._id });
    assert(regenMatches.length === 3, 'Regeneration maintains exact total matches count (3)');
    regenMatches.forEach((m) => createdMatchIds.push(m._id));

    const regenBoards = await TeamMatchBoard.find({ match: { $in: regenMatches.map((m) => m._id) } });
    assert(regenBoards.length === 12, 'Regenerated boards count is 12 (3 matches × 4 boards)');

    console.log('\n--- 9. Testing BYE Safety: No Invalid Matches, Zero Points, No Unintended Lichess Games ---');

    // Inspect matches: ensure no match exists where teamA or teamB is missing or null
    for (const match of regenMatches) {
      assert(match.teamA && match.teamB, 'No match has null or missing opponent');
      assert(match.teamA.toString() !== match.teamB.toString(), 'No match is against same team');
    }

    // Verify Standings Calculation: BYE team gets 0 points and 0 played matches from BYE
    const standingsData = await rebuildCompetitionStandings(activeCompOdd._id);
    const standings = standingsData.standings;
    assert(standings.length === 3, 'Standings contains all 3 active teams');
    for (const st of standings) {
      assert(st.played === 0, 'Initial team played matches is 0 (BYE does not count as played match)');
      assert(st.matchPoints === 0, 'BYE does not award match points');
      assert(st.boardPoints === 0, 'BYE does not award board points');
    }

    console.log('\n--- 10. Testing Even Team Count Integration (N=4) ---');

    // Create a 4-team competition
    const evenComp = await TeamCompetition.create({
      name: `${testPrefix} Even 4-Team Tournament`,
      organizer: organizer._id,
      status: 'READY',
    });
    createdCompIds.push(evenComp._id);

    const playerD = await User.create({
      name: 'Captain D',
      email: `${testPrefix}_capD@chessjeeno.com`,
      passwordHash: 'dummyhash',
      authProvider: 'local',
    });
    createdUserIds.push(playerD._id);

    const evenTeams = await Promise.all([
      TeamCompetitionTeam.create({ competition: evenComp._id, name: `${testPrefix} E1`, captain: playerA._id, status: 'ACTIVE' }),
      TeamCompetitionTeam.create({ competition: evenComp._id, name: `${testPrefix} E2`, captain: playerB._id, status: 'ACTIVE' }),
      TeamCompetitionTeam.create({ competition: evenComp._id, name: `${testPrefix} E3`, captain: playerC._id, status: 'ACTIVE' }),
      TeamCompetitionTeam.create({ competition: evenComp._id, name: `${testPrefix} E4`, captain: playerD._id, status: 'ACTIVE' }),
    ]);

    const evenGenRes = await post(
      `/team-competitions/${evenComp._id}/schedule/round-robin`,
      { boardCount: 2 },
      orgToken
    );

    assert(evenGenRes.status === 201, '4-team competition schedule generation succeeds (201)');
    assert(evenGenRes.data.data.totalTeams === 4, '4-team totalTeams is 4');
    assert(evenGenRes.data.data.totalRounds === 3, '4-team totalRounds is 3 (N-1)');
    assert(evenGenRes.data.data.totalMatches === 6, '4-team totalMatches is 6 (N*(N-1)/2)');
    assert(evenGenRes.data.data.byesCount === 0, '4-team byesCount is 0');

    const evenDbRounds = await TeamCompetitionRound.find({ competition: evenComp._id });
    evenDbRounds.forEach((r) => createdRoundIds.push(r._id));
    assert(evenDbRounds.length === 3, 'Exactly 3 rounds created for 4 teams');

    const evenDbMatches = await TeamMatch.find({ competition: evenComp._id });
    evenDbMatches.forEach((m) => createdMatchIds.push(m._id));
    assert(evenDbMatches.length === 6, 'Exactly 6 matches created for 4 teams');

    // Verify every round has exactly 2 matches
    for (const r of evenDbRounds) {
      const rMatches = evenDbMatches.filter((m) => m.round.toString() === r._id.toString());
      assert(rMatches.length === 2, `Round ${r.roundNumber} has exactly 2 matches`);
      assert(r.byeTeam === null, `Round ${r.roundNumber} byeTeam is null for even teams`);
    }

    console.log('\n--- 11. Testing V1–V4 Compatibility with Generated Match Fixtures ---');

    // Take one generated match from evenComp and verify V2 lineup assignment & lock
    const testMatch = evenDbMatches.find((m) => m.teamA.toString() === evenTeams[0]._id.toString()) || evenDbMatches[0];
    const targetTeamId = testMatch.teamA.toString();
    const isTargetE1 = targetTeamId === evenTeams[0]._id.toString();
    const targetCapToken = isTargetE1 ? capAToken : orgToken;

    const memberA1 = await User.create({
      name: 'Member A1',
      email: `${testPrefix}_mA1@chessjeeno.com`,
      passwordHash: 'dummyhash',
      authProvider: 'local',
    });
    createdUserIds.push(memberA1._id);

    await TeamCompetitionMember.create({
      competition: evenComp._id,
      team: testMatch.teamA,
      user: memberA1._id,
      role: 'PLAYER',
      status: 'ACTIVE',
    });

    const testMatchBoards = await TeamMatchBoard.find({ match: testMatch._id }).sort({ boardNumber: 1 });
    assert(testMatchBoards.length === 2, 'Generated match has 2 boards');

    // Captain sets lineup on Board 1
    const lineupRes = await fetch(
      `${API_BASE}/team-competitions/${evenComp._id}/matches/${testMatch._id}/lineup`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${targetCapToken}`,
        },
        body: JSON.stringify({
          teamId: targetTeamId,
          assignments: [{ boardNumber: 1, playerId: memberA1._id.toString() }],
        }),
      }
    );
    const lineupJson = await lineupRes.json();
    assert(lineupRes.status === 200, 'Captain sets lineup on generated match fixture (200 OK)');
    assert(lineupJson.data.boards[0].teamAPlayer._id === memberA1._id.toString(), 'Board 1 teamAPlayer assigned');

    // Verify GET /rounds endpoint returns populated byeTeam and match counts
    const publicRoundsRes = await get(`/team-competitions/${activeCompOdd._id}/rounds`);
    assert(publicRoundsRes.status === 200, 'GET /rounds returns 200 OK');
    assert(publicRoundsRes.data.data.length === 3, 'GET /rounds returns 3 rounds');
    assert(publicRoundsRes.data.data[0].byeTeam !== undefined, 'byeTeam field present in public rounds response');

    console.log('\n--- 12. Targeted Audit: Concurrency, Rollback, and Regeneration Safety ---');

    // 12.1 Concurrent Schedule Generation Protection
    const auditComp1 = await TeamCompetition.create({
      name: `${testPrefix} Concurrency Audit Competition`,
      organizer: organizer._id,
      status: 'READY',
    });
    createdCompIds.push(auditComp1._id);

    const auditTeams1 = await Promise.all([
      TeamCompetitionTeam.create({ competition: auditComp1._id, name: `${testPrefix} C1`, captain: playerA._id, status: 'ACTIVE' }),
      TeamCompetitionTeam.create({ competition: auditComp1._id, name: `${testPrefix} C2`, captain: playerB._id, status: 'ACTIVE' }),
      TeamCompetitionTeam.create({ competition: auditComp1._id, name: `${testPrefix} C3`, captain: playerC._id, status: 'ACTIVE' }),
    ]);

    // Send two concurrent generation requests
    const [concurrentRes1, concurrentRes2] = await Promise.all([
      post(`/team-competitions/${auditComp1._id}/schedule/round-robin`, { boardCount: 2 }, orgToken),
      post(`/team-competitions/${auditComp1._id}/schedule/round-robin`, { boardCount: 2 }, orgToken),
    ]);

    const statuses = [concurrentRes1.status, concurrentRes2.status];
    assert(statuses.includes(201), 'One of the concurrent generation requests succeeded with 201');
    assert(
      statuses.some((s) => s === 409 || s === 400),
      'The second concurrent generation request was rejected with conflict (409 or 400)'
    );

    const auditDbRounds1 = await TeamCompetitionRound.find({ competition: auditComp1._id });
    auditDbRounds1.forEach((r) => createdRoundIds.push(r._id));
    assert(auditDbRounds1.length === 3, 'Exactly 3 rounds exist after concurrent requests (no duplicate rounds)');

    const auditDbMatches1 = await TeamMatch.find({ competition: auditComp1._id });
    auditDbMatches1.forEach((m) => createdMatchIds.push(m._id));
    assert(auditDbMatches1.length === 3, 'Exactly 3 matches exist after concurrent requests (no duplicate matches)');

    // 12.2 Active / In-Progress Match Protection on Regeneration
    const matchToStart = auditDbMatches1[0];
    await TeamMatch.findByIdAndUpdate(matchToStart._id, { status: 'IN_PROGRESS' });

    const regenBlockedRes = await post(
      `/team-competitions/${auditComp1._id}/schedule/round-robin`,
      { boardCount: 4, regenerate: true },
      orgToken
    );

    assert(regenBlockedRes.status === 400, 'Regeneration rejected with 400 when an in-progress match exists');
    assert(
      regenBlockedRes.data.message.includes('one or more matches have already started or completed'),
      'Informative error message protecting active match from regeneration'
    );

    const matchAfterBlockedRegen = await TeamMatch.findById(matchToStart._id);
    assert(matchAfterBlockedRegen !== null, 'In-progress match was NOT deleted by rejected regeneration attempt');
    assert(matchAfterBlockedRegen.status === 'IN_PROGRESS', 'In-progress match retained its status and data');

    // Reset status back to DRAFT for cleanup
    await TeamMatch.findByIdAndUpdate(matchToStart._id, { status: 'DRAFT' });

    // 12.3 Database Conflict & Rollback Isolation
    const auditComp2 = await TeamCompetition.create({
      name: `${testPrefix} Rollback Audit Competition`,
      organizer: organizer._id,
      status: 'READY',
    });
    createdCompIds.push(auditComp2._id);

    await Promise.all([
      TeamCompetitionTeam.create({ competition: auditComp2._id, name: `${testPrefix} R1`, captain: playerA._id, status: 'ACTIVE' }),
      TeamCompetitionTeam.create({ competition: auditComp2._id, name: `${testPrefix} R2`, captain: playerB._id, status: 'ACTIVE' }),
    ]);

    // Pre-insert a conflicting round number 1 to induce a DB unique-index conflict during schedule creation
    const conflictingRound = await TeamCompetitionRound.create({
      competition: auditComp2._id,
      roundNumber: 1,
      name: 'Pre-existing Conflict Round 1',
      createdBy: organizer._id,
    });
    createdRoundIds.push(conflictingRound._id);

    let conflictErrorCaught = false;
    try {
      await teamMatchService.generateRoundRobinSchedule(auditComp2._id, { boardCount: 2 }, organizer._id);
    } catch (err) {
      conflictErrorCaught = true;
      assert(
        err.statusCode === 409 || err.code === 11000 || err.message.includes('already exists'),
        'Database conflict or existing schedule correctly raises conflict error'
      );
    }
    assert(conflictErrorCaught === true, 'Conflict error caught when database conflict is encountered');

    // Verify rollback: no orphaned matches or boards were created for auditComp2
    const orphanMatches = await TeamMatch.find({ competition: auditComp2._id });
    assert(orphanMatches.length === 0, 'Zero orphan matches created following conflict rollback');

    const orphanBoards = await TeamMatchBoard.find({ match: { $in: orphanMatches.map((m) => m._id) } });
    assert(orphanBoards.length === 0, 'Zero orphan boards created following conflict rollback');

    // Remove conflicting round and verify schedule generation now succeeds cleanly
    await TeamCompetitionRound.findByIdAndDelete(conflictingRound._id);
    const cleanGenRes = await teamMatchService.generateRoundRobinSchedule(
      auditComp2._id,
      { boardCount: 2 },
      organizer._id
    );
    assert(cleanGenRes.totalRounds === 1, 'Schedule generation succeeds cleanly after resolving conflict');

    const cleanDbRounds = await TeamCompetitionRound.find({ competition: auditComp2._id });
    cleanDbRounds.forEach((r) => createdRoundIds.push(r._id));
    assert(cleanDbRounds.length === 1, 'Exactly 1 round created for 2 teams');

    const cleanDbMatches = await TeamMatch.find({ competition: auditComp2._id });
    cleanDbMatches.forEach((m) => createdMatchIds.push(m._id));
    assert(cleanDbMatches.length === 1, 'Exactly 1 match created for 2 teams');

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
    console.log('🎉 Team Competition V5 Round Robin Scheduling Test Suite Passed!\n');
  } finally {
    console.log('🧹 Cleaning up test fixtures...');
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

runTeamCompetitionRoundRobinTestSuite().catch((err) => {
  console.error('\n❌ Fatal Test Runner Error:', err);
  process.exit(1);
});
