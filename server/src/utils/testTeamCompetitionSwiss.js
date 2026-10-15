import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
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
import {
  generateTeamSwissPairings,
  normalizeTeamIds,
} from './teamSwiss.js';
import {
  calculateBoardScore,
  calculateMatchScore,
  rebuildCompetitionStandings,
} from '../services/teamCompetitionStandingsService.js';
import teamMatchService from '../services/teamMatchService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

const createToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: '1h' });
};

const runTeamCompetitionSwissTestSuite = async () => {
  console.log('🧪 Starting CHESS JEENO Team Competition V6 Test Suite (Swiss Scheduling)...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `tc_v6_${timestamp}`;

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
    // SECTION 1: UNIT-LEVEL SWISS PAIRING ENGINE TESTS
    // =========================================================================
    console.log('--- 1. Testing Unit-Level Swiss Pairing Engine ---');

    // 1.1 Team ID normalization
    const rawTeams = [
      { _id: new mongoose.Types.ObjectId(), name: 'Team Alpha' },
      { id: 'custom_team_beta', name: 'Team Beta' },
      'team_gamma',
    ];
    const norm = normalizeTeamIds(rawTeams);
    assert(norm.length === 3, 'normalizeTeamIds extracts 3 IDs');
    assert(typeof norm[0] === 'string', 'First normalized ID is a string');
    assert(norm[1] === 'custom_team_beta', 'Object with .id correctly extracted');
    assert(norm[2] === 'team_gamma', 'Plain string ID correctly preserved');

    // 1.2 Minimum team requirement
    let threwUnderMin = false;
    try {
      generateTeamSwissPairings({ teams: [{ id: 'single_team', name: 'Only One' }] });
    } catch (err) {
      threwUnderMin = true;
      assert(err.statusCode === 400, 'Under 2 teams throws 400 error');
    }
    assert(threwUnderMin, 'generateTeamSwissPairings rejects < 2 teams');

    // 1.3 Even team count (4 teams, Round 1)
    const teams4 = [
      { id: 'team_a', name: 'Team A' },
      { id: 'team_b', name: 'Team B' },
      { id: 'team_c', name: 'Team C' },
      { id: 'team_d', name: 'Team D' },
    ];
    const r1Even = generateTeamSwissPairings({ teams: teams4, roundNumber: 1 });
    assert(r1Even.roundNumber === 1, 'Round 1 number is 1');
    assert(r1Even.pairings.length === 2, '4 teams produces exactly 2 pairings');
    assert(r1Even.byeTeam === null, 'Even team count produces no BYE');
    assert(r1Even.hadRematches === false, 'Round 1 has 0 rematches');

    // Check pair uniqueness and no team scheduled twice
    const round1TeamsScheduled = new Set();
    r1Even.pairings.forEach((p) => {
      assert(p.teamA !== p.teamB, 'Pairing does not self-pair');
      assert(!round1TeamsScheduled.has(p.teamA), `Team ${p.teamA} not scheduled twice in round 1`);
      assert(!round1TeamsScheduled.has(p.teamB), `Team ${p.teamB} not scheduled twice in round 1`);
      round1TeamsScheduled.add(p.teamA);
      round1TeamsScheduled.add(p.teamB);
    });
    assert(round1TeamsScheduled.size === 4, 'All 4 teams scheduled in Round 1');

    // 1.4 Determinism / Reproducibility: running identical inputs produces identical pairings
    const r1EvenRepeat = generateTeamSwissPairings({ teams: teams4, roundNumber: 1 });
    assert(
      JSON.stringify(r1Even.pairings) === JSON.stringify(r1EvenRepeat.pairings),
      'Deterministic tie-breaks produce identical pairings across repeated calls'
    );

    // 1.5 Odd team count (3 teams, Round 1)
    const teams3 = [
      { id: 'team_1', name: 'Team 1' },
      { id: 'team_2', name: 'Team 2' },
      { id: 'team_3', name: 'Team 3' },
    ];
    const r1Odd = generateTeamSwissPairings({ teams: teams3, roundNumber: 1 });
    assert(r1Odd.pairings.length === 1, '3 teams produces exactly 1 match');
    assert(r1Odd.byeTeam !== null, 'Odd team count produces exactly 1 BYE');
    assert(r1Odd.byeReason !== null, 'BYE includes selection rationale');
    const scheduledWithBye = new Set([
      r1Odd.pairings[0].teamA,
      r1Odd.pairings[0].teamB,
      r1Odd.byeTeam,
    ]);
    assert(scheduledWithBye.size === 3, 'All 3 teams accounted for (2 in match, 1 in BYE)');

    // 1.6 Round 2 pairing by standings (Score groups) and repeat avoidance
    // Simulate Round 1 result: Team A beat Team B; Team C beat Team D.
    // Standings after Round 1:
    // Team A: 3 pts, Team C: 3 pts (winners)
    // Team B: 0 pts, Team D: 0 pts (losers)
    const standingsAfterR1 = [
      { teamId: 'team_a', matchPoints: 3, boardPoints: 4, name: 'Team A' },
      { teamId: 'team_c', matchPoints: 3, boardPoints: 3, name: 'Team C' },
      { teamId: 'team_b', matchPoints: 0, boardPoints: 0, name: 'Team B' },
      { teamId: 'team_d', matchPoints: 0, boardPoints: 1, name: 'Team D' },
    ];
    const prevRoundsR1 = [
      {
        roundNumber: 1,
        pairings: [
          { teamA: 'team_a', teamB: 'team_b' },
          { teamA: 'team_c', teamB: 'team_d' },
        ],
        byeTeam: null,
      },
    ];

    const r2Swiss = generateTeamSwissPairings({
      teams: teams4,
      standings: standingsAfterR1,
      previousRounds: prevRoundsR1,
      roundNumber: 2,
    });

    assert(r2Swiss.roundNumber === 2, 'Round 2 number is 2');
    assert(r2Swiss.pairings.length === 2, 'Round 2 has 2 pairings');
    assert(r2Swiss.hadRematches === false, 'Round 2 strictly avoided rematches');

    // Winner score group (3 pts) must play each other: Team A vs Team C
    // Loser score group (0 pts) must play each other: Team B vs Team D
    const pair1 = r2Swiss.pairings.find(
      (p) =>
        (p.teamA === 'team_a' && p.teamB === 'team_c') ||
        (p.teamA === 'team_c' && p.teamB === 'team_a')
    );
    const pair2 = r2Swiss.pairings.find(
      (p) =>
        (p.teamA === 'team_b' && p.teamB === 'team_d') ||
        (p.teamA === 'team_d' && p.teamB === 'team_b')
    );
    assert(Boolean(pair1), 'Score group 3 pts: Team A paired with Team C');
    assert(Boolean(pair2), 'Score group 0 pts: Team B paired with Team D');
    assert(!pair1.isRematch, 'Pair 1 is a fresh matchup');
    assert(!pair2.isRematch, 'Pair 2 is a fresh matchup');

    // 1.7 Multi-round BYE assignment avoidance for odd team counts
    // In Round 1, team_1 was assigned BYE. In Round 2, another team should get BYE.
    const prevRoundsOdd = [
      {
        roundNumber: 1,
        pairings: [{ teamA: 'team_2', teamB: 'team_3' }],
        byeTeam: 'team_1',
      },
    ];
    const standingsOddR1 = [
      { teamId: 'team_2', matchPoints: 3, boardPoints: 3, name: 'Team 2' },
      { teamId: 'team_1', matchPoints: 0, boardPoints: 0, name: 'Team 1' },
      { teamId: 'team_3', matchPoints: 0, boardPoints: 1, name: 'Team 3' },
    ];
    const r2Odd = generateTeamSwissPairings({
      teams: teams3,
      standings: standingsOddR1,
      previousRounds: prevRoundsOdd,
      roundNumber: 2,
    });
    assert(r2Odd.byeTeam !== 'team_1', 'Team 1 had BYE in Round 1; not assigned BYE in Round 2');
    assert(['team_2', 'team_3'].includes(r2Odd.byeTeam), 'Eligible team without prior BYE assigned');

    // 1.8 Behavior when avoiding repeat opponents is mathematically impossible
    // 2 teams that have already played each other in Round 1
    const twoTeams = [
      { id: 'team_x', name: 'Team X' },
      { id: 'team_y', name: 'Team Y' },
    ];
    const prevTwo = [
      {
        roundNumber: 1,
        pairings: [{ teamA: 'team_x', teamB: 'team_y' }],
        byeTeam: null,
      },
    ];

    // Case A: Strict mode (allowRematches: false) -> throws controlled error ALL_MATCHUPS_EXHAUSTED
    let threwExhausted = false;
    try {
      generateTeamSwissPairings({
        teams: twoTeams,
        previousRounds: prevTwo,
        roundNumber: 2,
        options: { allowRematches: false },
      });
    } catch (err) {
      threwExhausted = true;
      assert(err.code === 'ALL_MATCHUPS_EXHAUSTED', 'Throws error with code ALL_MATCHUPS_EXHAUSTED');
    }
    assert(threwExhausted, 'Strict non-repeat mode rejects when all matchups exhausted');

    // Case B: Fallback rematch mode (allowRematches: true) -> deterministically pairs with isRematch: true
    const rematchResult = generateTeamSwissPairings({
      teams: twoTeams,
      previousRounds: prevTwo,
      roundNumber: 2,
      options: { allowRematches: true },
    });
    assert(rematchResult.pairings.length === 1, 'Generates rematch pairing when unavoidable');
    assert(rematchResult.hadRematches === true, 'hadRematches is true');
    assert(rematchResult.pairings[0].isRematch === true, 'isRematch flag set to true');
    assert(rematchResult.pairings[0].priorMeetings === 1, 'priorMeetings count is 1');
    assert(
      rematchResult.pairings[0].repeatAvoidance.includes('Rematch'),
      'repeatAvoidance notes that all non-repeat alternatives were exhausted'
    );

    // 1.9 Backtracking search succeeds where greedy pairing would fail
    // 4 teams: T1, T2, T3, T4 all with equal match points
    // History: T1 played T2; T2 played T4; T3 played T4.
    // T1's candidates in rank order: T3, T4.
    // Greedy would pick T3 for T1, leaving [T2, T4], but T2 already played T4!
    // Backtracking must find the only valid non-repeat matching: (T1, T4) and (T2, T3).
    const greedyTeams = [
      { id: 'g_t1', name: 'Team G1', matchPoints: 2, boardPoints: 2 },
      { id: 'g_t2', name: 'Team G2', matchPoints: 2, boardPoints: 2 },
      { id: 'g_t3', name: 'Team G3', matchPoints: 2, boardPoints: 2 },
      { id: 'g_t4', name: 'Team G4', matchPoints: 2, boardPoints: 2 },
    ];
    const greedyHistory = [
      {
        roundNumber: 1,
        pairings: [
          { teamA: 'g_t1', teamB: 'g_t2' },
          { teamA: 'g_t3', teamB: 'g_t4' },
        ],
      },
      {
        roundNumber: 2,
        pairings: [
          { teamA: 'g_t2', teamB: 'g_t4' },
        ],
      },
    ];
    const backtracked = generateTeamSwissPairings({
      teams: greedyTeams,
      previousRounds: greedyHistory,
      roundNumber: 3,
      options: { allowRematches: false },
    });
    assert(backtracked.hadRematches === false, 'Backtracking avoids rematches where greedy would fail');
    assert(backtracked.pairings.length === 2, '2 valid pairings found by backtracking');
    const hasT1T4 = backtracked.pairings.some(
      (p) => (p.teamA === 'g_t1' && p.teamB === 'g_t4') || (p.teamA === 'g_t4' && p.teamB === 'g_t1')
    );
    const hasT2T3 = backtracked.pairings.some(
      (p) => (p.teamA === 'g_t2' && p.teamB === 'g_t3') || (p.teamA === 'g_t3' && p.teamB === 'g_t2')
    );
    assert(hasT1T4, 'Backtracking correctly paired T1 with T4');
    assert(hasT2T3, 'Backtracking correctly paired T2 with T3');

    // 1.10 Tied standings and multiple previous BYEs
    // 5 teams: Alpha, Bravo, Charlie, Delta, Echo
    // Round 1: Echo received BYE.
    // Round 2: Delta received BYE.
    // Round 3: Alpha, Bravo, Charlie tied in match points, none have received BYE.
    const fiveTeams = [
      { id: 't_alpha', name: 'Alpha', matchPoints: 1, boardPoints: 2, scoreDifference: 0 },
      { id: 't_bravo', name: 'Bravo', matchPoints: 1, boardPoints: 2, scoreDifference: 0 },
      { id: 't_charlie', name: 'Charlie', matchPoints: 1, boardPoints: 2, scoreDifference: 0 },
      { id: 't_delta', name: 'Delta', matchPoints: 3, boardPoints: 4, scoreDifference: 2 },
      { id: 't_echo', name: 'Echo', matchPoints: 0, boardPoints: 1, scoreDifference: -2 },
    ];
    const prev5Rounds = [
      { roundNumber: 1, pairings: [{ teamA: 't_alpha', teamB: 't_bravo' }, { teamA: 't_charlie', teamB: 't_delta' }], byeTeam: 't_echo' },
      { roundNumber: 2, pairings: [{ teamA: 't_alpha', teamB: 't_echo' }, { teamA: 't_bravo', teamB: 't_charlie' }], byeTeam: 't_delta' },
    ];
    const r3Five = generateTeamSwissPairings({
      teams: fiveTeams,
      previousRounds: prev5Rounds,
      roundNumber: 3,
    });
    assert(r3Five.byeTeam !== 't_echo', 'T_Echo had prior BYE; not assigned in Round 3');
    assert(r3Five.byeTeam !== 't_delta', 'T_Delta had prior BYE; not assigned in Round 3');
    assert(['t_alpha', 't_bravo', 't_charlie'].includes(r3Five.byeTeam), 'Assigned BYE to eligible team with no prior BYE among tied teams');
    assert(r3Five.totalMatches === 2, 'Remaining 4 teams paired into 2 matches');

    // Case B: All 5 teams have already received a BYE (e.g. Round 6)
    const prev5RoundsAllByes = [
      ...prev5Rounds,
      { roundNumber: 3, pairings: [], byeTeam: 't_alpha' },
      { roundNumber: 4, pairings: [], byeTeam: 't_bravo' },
      { roundNumber: 5, pairings: [], byeTeam: 't_charlie' },
    ];
    const r6Five = generateTeamSwissPairings({
      teams: fiveTeams,
      previousRounds: prev5RoundsAllByes,
      roundNumber: 6,
    });
    assert(r6Five.byeTeam === 't_echo', 'When all teams have had prior BYE, lowest ranked team receives BYE');
    assert(r6Five.byeReason.includes('all eligible teams have received prior BYEs'), 'Correct rationale for all-teams-had-byes');

    // =========================================================================
    // SECTION 2: END-TO-END COMPETITION LIFECYCLE & AUTHORIZATION
    // =========================================================================
    console.log('\n--- 2. Testing Competition Lifecycle & Authorization ---');

    // Create organizer and captain users
    const organizer = await User.create({
      name: 'Organizer Swiss',
      email: `${testPrefix}_org@chess.test`,
      passwordHash: 'hashed_pw',
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(organizer._id);
    const orgToken = createToken(organizer._id);

    const outsider = await User.create({
      name: 'Outsider User',
      email: `${testPrefix}_out@chess.test`,
      passwordHash: 'hashed_pw',
      authProvider: 'local',
      role: 'USER',
    });
    createdUserIds.push(outsider._id);
    const outsiderToken = createToken(outsider._id);

    // 2.1 Create competition with format: 'SWISS'
    const createCompRes = await post(
      '/team-competitions',
      {
        name: `${testPrefix} Swiss League`,
        description: 'V6 Swiss scheduling competition',
        format: 'SWISS',
      },
      orgToken
    );
    assert(createCompRes.status === 201, 'POST /team-competitions with format: SWISS returns 201');
    const compId = createCompRes.data.data?._id || createCompRes.data._id;
    createdCompIds.push(compId);

    const getCompRes = await get(`/team-competitions/${compId}`);
    assert(getCompRes.status === 200, 'GET /team-competitions/:id returns 200');
    const compBody = getCompRes.data.data || getCompRes.data;
    assert(compBody.format === 'SWISS', 'Competition format is stored as SWISS');

    // 2.2 Unauthenticated and non-organizer authorization guards
    const unauthRes = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 4 }
    );
    assert(unauthRes.status === 401, 'Unauthenticated Swiss round generation rejected with 401');

    const outsiderRes = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 4 },
      outsiderToken
    );
    assert(outsiderRes.status === 403, 'Non-organizer Swiss round generation rejected with 403 Forbidden');

    // 2.3 Insufficient teams guard (< 2 teams)
    const underTeamsRes = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 4 },
      orgToken
    );
    assert(underTeamsRes.status === 400, 'Generating Swiss round with 0 teams rejected with 400');

    // Register 4 teams with captains
    const captains = [];
    const teams = [];
    for (let i = 1; i <= 4; i++) {
      const cap = await User.create({
        name: `Captain ${i}`,
        email: `${testPrefix}_cap${i}@chess.test`,
        passwordHash: 'hashed_pw',
        authProvider: 'local',
        role: 'USER',
      });
      createdUserIds.push(cap._id);
      captains.push(cap);

      const teamRes = await post(
        `/team-competitions/${compId}/teams`,
        { name: `Squad ${i}` },
        createToken(cap._id)
      );
      assert(teamRes.status === 201, `Squad ${i} registered with 201`);
      teams.push(teamRes.data.data?._id || teamRes.data._id);
    }

    // =========================================================================
    // SECTION 3: SWISS PREVIEW & ROUND 1 GENERATION
    // =========================================================================
    console.log('\n--- 3. Testing Swiss Preview & Round 1 Generation ---');

    // 3.1 Preview Round 1
    const previewRes = await get(`/team-competitions/${compId}/schedule/swiss/preview`, orgToken);
    assert(previewRes.status === 200, 'GET /schedule/swiss/preview returns 200');
    const prevData = previewRes.data.data;
    assert(prevData.nextRoundNumber === 1, 'Preview calculates nextRoundNumber = 1');
    assert(prevData.eligibleTeamsCount === 4, 'Preview identifies 4 eligible active teams');
    assert(prevData.totalMatches === 2, 'Preview identifies 2 matches for Round 1');
    assert(prevData.proposedPairings.length === 2, 'Preview contains 2 proposed pairings');
    assert(prevData.canGenerate === true, 'Organizer can generate Round 1');
    assert(prevData.hasUnresolvedBlocker === false, 'No unresolved blockers for Round 1');

    // 3.2 Generate Round 1 (Even: 4 teams, 2 boards each)
    const genR1Res = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 2 },
      orgToken
    );
    assert(genR1Res.status === 201, 'POST /schedule/swiss/round returns 201 Created');
    const r1Data = genR1Res.data.data;
    assert(r1Data.roundNumber === 1, 'Generated roundNumber is 1');
    assert(r1Data.totalMatches === 2, 'Round 1 has 2 matches');
    assert(r1Data.matches.length === 2, 'Round 1 returns 2 match objects');
    createdRoundIds.push(r1Data.roundId);
    r1Data.matches.forEach((m) => createdMatchIds.push(m.matchId));

    // Verify database state for Round 1
    const r1Doc = await TeamCompetitionRound.findById(r1Data.roundId);
    assert(r1Doc !== null, 'Round 1 document persisted in MongoDB');
    assert(r1Doc.status === 'DRAFT', 'Round 1 initial status is DRAFT');
    assert(r1Doc.byeTeam === null, 'Round 1 byeTeam is null for even teams');

    const compAfterR1 = await TeamCompetition.findById(compId);
    assert(compAfterR1.status === 'READY', 'Competition status transitioned to READY upon scheduling');

    // =========================================================================
    // SECTION 4: SAFE REGENERATION OF PRE-START ROUND
    // =========================================================================
    console.log('\n--- 4. Testing Safe Regeneration of Pre-Start Round ---');

    // 4.1 Duplicate generation without regenerate: true rejected
    const dupRes = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 2 },
      orgToken
    );
    assert(dupRes.status === 400, 'Duplicate generation without regenerate: true rejected with 400');

    // 4.2 Safe regeneration with regenerate: true succeeds
    const regenRes = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 3, regenerate: true },
      orgToken
    );
    assert(regenRes.status === 201, 'Regenerating pre-start round with regenerate: true returns 201');
    const regenData = regenRes.data.data;
    assert(regenData.roundNumber === 1, 'Regenerated roundNumber is still 1');
    assert(regenData.boardCount === 3, 'Regenerated fixtures use updated boardCount = 3');
    createdRoundIds.push(regenData.roundId);
    regenData.matches.forEach((m) => createdMatchIds.push(m.matchId));

    // Verify old boards deleted and exactly 2 matches × 3 boards = 6 boards exist
    const match1Boards = await TeamMatchBoard.find({ match: regenData.matches[0].matchId });
    assert(match1Boards.length === 3, 'Match 1 has exactly 3 boards after regeneration');

    // 4.3 Attempting regeneration after a match is IN_PROGRESS is strictly rejected
    const mActiveTest = await TeamMatch.findById(regenData.matches[0].matchId);
    mActiveTest.status = 'IN_PROGRESS';
    await mActiveTest.save();

    const blockedRegenRes = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 2, regenerate: true },
      orgToken
    );
    assert(blockedRegenRes.status === 400, 'Regeneration rejected with 400 when match is IN_PROGRESS');
    assert(
      blockedRegenRes.data.message.includes('already started or completed'),
      'Clear error message on started/completed match regeneration'
    );
    // Verify fixtures and boards were preserved
    const matchCountPreserved = await TeamMatch.countDocuments({ round: regenData.roundId });
    const boardCountPreserved = await TeamMatchBoard.countDocuments({ match: regenData.matches[0].matchId });
    assert(matchCountPreserved === 2, 'Matches are NOT deleted when regeneration is rejected');
    assert(boardCountPreserved === 3, 'Boards are NOT deleted when regeneration is rejected');

    // Restore back to DRAFT for next lifecycle tests
    mActiveTest.status = 'DRAFT';
    await mActiveTest.save();

    // =========================================================================
    // SECTION 5: BLOCKING NEXT ROUND ON UNRESOLVED MATCHES
    // =========================================================================
    console.log('\n--- 5. Testing Blocking Next Round on Incomplete / Unresolved Matches ---');

    // 5.1 Set match 1 status to IN_PROGRESS so Round 1 has active ongoing fixtures
    const mInitial = await TeamMatch.findById(regenData.matches[0].matchId);
    mInitial.status = 'IN_PROGRESS';
    await mInitial.save();

    // Now attempt to generate Round 2 while Round 1 is in progress / incomplete
    const blockedR2Res = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 2 },
      orgToken
    );
    assert(blockedR2Res.status === 400, 'Generating Round 2 while Round 1 is incomplete rejected with 400');
    assert(
      blockedR2Res.data.message.includes('preceding Round 1'),
      'Error message identifies preceding Round 1 as incomplete blocker'
    );

    // 5.2 Preview also reflects the blocker
    const previewBlocked = await get(`/team-competitions/${compId}/schedule/swiss/preview`, orgToken);
    assert(previewBlocked.status === 200, 'Preview endpoint returns 200 during blocker');
    assert(previewBlocked.data.data.hasUnresolvedBlocker === true, 'Preview indicates hasUnresolvedBlocker = true');
    assert(previewBlocked.data.data.canGenerate === false, 'Preview indicates canGenerate = false');

    // 5.3 Simulate match with REVIEW_REQUIRED in Round 1
    // Mark Match 1 as COMPLETED with scoringStatus: REVIEW_REQUIRED
    const m1 = await TeamMatch.findById(regenData.matches[0].matchId);
    m1.status = 'COMPLETED';
    m1.scoringStatus = 'REVIEW_REQUIRED';
    await m1.save();

    const reviewBlockRes = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 2 },
      orgToken
    );
    assert(reviewBlockRes.status === 400, 'Generating Round 2 with REVIEW_REQUIRED match rejected with 400');
    assert(
      reviewBlockRes.data.message.includes('requiring organizer review'),
      'Error message notes organizer review blocker'
    );

    // 5.4 Preceding round with unfinished boards is blocked
    // Set both matches to COMPLETED with scoringStatus: FINAL, but set one of Match 1's boards to ACTIVE with result: null
    const m1Clean = await TeamMatch.findById(regenData.matches[0].matchId);
    m1Clean.status = 'COMPLETED';
    m1Clean.scoringStatus = 'FINAL';
    await m1Clean.save();

    const m2Clean = await TeamMatch.findById(regenData.matches[1].matchId);
    m2Clean.status = 'COMPLETED';
    m2Clean.scoringStatus = 'FINAL';
    await m2Clean.save();

    const boardToUnfinish = await TeamMatchBoard.findOne({ match: regenData.matches[0].matchId });
    const originalBoardStatus = boardToUnfinish.lichessStatus;
    const originalBoardResult = boardToUnfinish.result;
    boardToUnfinish.lichessStatus = 'ACTIVE';
    boardToUnfinish.result = null;
    boardToUnfinish.overrideResult = null;
    await boardToUnfinish.save();

    const unfinishedBoardRes = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 2 },
      orgToken
    );
    assert(unfinishedBoardRes.status === 400, 'Generating next round with unfinished boards rejected with 400');
    assert(
      unfinishedBoardRes.data.message.includes('unfinished boards'),
      'Error message specifically identifies unfinished boards'
    );

    // Restore board
    boardToUnfinish.lichessStatus = originalBoardStatus;
    boardToUnfinish.result = originalBoardResult;
    await boardToUnfinish.save();

    // 5.5 Immutability of competition format after rounds exist
    const patchFormatRes = await fetch(`${API_BASE}/team-competitions/${compId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({ format: 'ROUND_ROBIN' }),
    });
    const patchFormatJson = await patchFormatRes.json().catch(() => ({}));
    assert(patchFormatRes.status === 400, 'Modifying competition format after rounds exist rejected with 400');
    assert(
      patchFormatJson.message.includes('Cannot change competition format'),
      'Clear error message rejecting format change on scheduled competition'
    );

    // =========================================================================
    // SECTION 6: ROUND 2 GENERATION & STANDINGS PAIRING
    // =========================================================================
    console.log('\n--- 6. Testing Round 2 Generation & Standings Pairing ---');

    // Now cleanly finalize both matches of Round 1:
    // Match 1: Team A (Home) beats Team B (Away) -> Team A: 3 pts, Team B: 0 pts
    const match1 = await TeamMatch.findById(regenData.matches[0].matchId);
    match1.status = 'COMPLETED';
    match1.scoringStatus = 'FINAL';
    match1.teamAScore = 3;
    match1.teamBScore = 0;
    match1.teamAMatchPoints = 3;
    match1.teamBMatchPoints = 0;
    match1.teamAResult = 'WIN';
    match1.teamBResult = 'LOSS';
    match1.winnerTeam = match1.teamA;
    await match1.save();

    // Match 2: Team C beats Team D -> Team C: 3 pts, Team D: 0 pts
    const match2 = await TeamMatch.findById(regenData.matches[1].matchId);
    match2.status = 'COMPLETED';
    match2.scoringStatus = 'FINAL';
    match2.teamAScore = 2.5;
    match2.teamBScore = 0.5;
    match2.teamAMatchPoints = 3;
    match2.teamBMatchPoints = 0;
    match2.teamAResult = 'WIN';
    match2.teamBResult = 'LOSS';
    match2.winnerTeam = match2.teamA;
    await match2.save();

    // Finalize all boards in Round 1
    await TeamMatchBoard.updateMany(
      { match: { $in: [match1._id, match2._id] } },
      { $set: { lichessStatus: 'FINISHED', result: '1-0' } }
    );

    // Rebuild standings and verify
    const standingsRes = await rebuildCompetitionStandings(compId);
    assert(standingsRes.standings.length === 4, 'Authoritative standings contain 4 teams');
    const winners = standingsRes.standings.filter((s) => s.matchPoints === 3);
    const losers = standingsRes.standings.filter((s) => s.matchPoints === 0);
    assert(winners.length === 2, 'Exactly 2 teams in 3-point score group');
    assert(losers.length === 2, 'Exactly 2 teams in 0-point score group');

    // Now Round 2 preview should be clear and show score-group pairings without repeat opponents
    const pR2 = await get(`/team-competitions/${compId}/schedule/swiss/preview`, orgToken);
    assert(pR2.data.data.nextRoundNumber === 2, 'Next round number is 2');
    assert(pR2.data.data.hasUnresolvedBlocker === false, 'No unresolved blockers');
    assert(pR2.data.data.canGenerate === true, 'Organizer can generate Round 2');

    // Generate Round 2
    const genR2Res = await post(
      `/team-competitions/${compId}/schedule/swiss/round`,
      { boardCount: 2 },
      orgToken
    );
    assert(genR2Res.status === 201, 'POST /schedule/swiss/round for Round 2 returns 201 Created');
    const r2Data = genR2Res.data.data;
    assert(r2Data.roundNumber === 2, 'Generated roundNumber is 2');
    assert(r2Data.totalMatches === 2, 'Round 2 has 2 matches');
    createdRoundIds.push(r2Data.roundId);
    r2Data.matches.forEach((m) => createdMatchIds.push(m.matchId));

    // Verify Round 2 does not repeat Round 1 matchups
    const r1PairKeys = new Set([
      `${match1.teamA}_${match1.teamB}`,
      `${match1.teamB}_${match1.teamA}`,
      `${match2.teamA}_${match2.teamB}`,
      `${match2.teamB}_${match2.teamA}`,
    ]);

    r2Data.matches.forEach((m) => {
      const forwardKey = `${m.teamA._id}_${m.teamB._id}`;
      const reverseKey = `${m.teamB._id}_${m.teamA._id}`;
      assert(!r1PairKeys.has(forwardKey), 'Round 2 does not repeat forward Round 1 matchup');
      assert(!r1PairKeys.has(reverseKey), 'Round 2 does not repeat reverse Round 1 matchup');
      assert(!m.isRematch, 'Match is marked with isRematch: false');
    });

    // =========================================================================
    // SECTION 7: ODD TEAM COUNT & ZERO-POINT BYE VERIFICATION
    // =========================================================================
    console.log('\n--- 7. Testing Odd Team Count & Zero-Point BYE Safety ---');

    // Create a 3-team Swiss competition
    const compOddRes = await post(
      '/team-competitions',
      {
        name: `${testPrefix} Odd Swiss League`,
        format: 'SWISS',
      },
      orgToken
    );
    const compOddId = compOddRes.data.data?._id || compOddRes.data._id;
    createdCompIds.push(compOddId);

    for (let i = 1; i <= 3; i++) {
      await post(
        `/team-competitions/${compOddId}/teams`,
        { name: `Odd Squad ${i}` },
        createToken(captains[i - 1]._id)
      );
    }

    // Generate Round 1 for odd teams
    const oddR1Res = await post(
      `/team-competitions/${compOddId}/schedule/swiss/round`,
      { boardCount: 2 },
      orgToken
    );
    assert(oddR1Res.status === 201, 'Odd team Round 1 generation succeeds with 201');
    const oddR1Data = oddR1Res.data.data;
    assert(oddR1Data.totalMatches === 1, '3 teams produces 1 match in Round 1');
    assert(oddR1Data.byeTeam !== null, '3 teams produces exactly 1 BYE in Round 1');
    assert(oddR1Data.byeReason !== null, 'BYE rationale included');
    createdRoundIds.push(oddR1Data.roundId);
    oddR1Data.matches.forEach((m) => createdMatchIds.push(m.matchId));

    // Verify BYE does not award match points or played matches in standings
    const oddStandings = await rebuildCompetitionStandings(compOddId);
    assert(oddStandings.standings.length === 3, 'Standings contains all 3 teams');
    const byeTeamStanding = oddStandings.standings.find(
      (s) => s.teamId.toString() === oddR1Data.byeTeam._id.toString()
    );
    assert(byeTeamStanding !== undefined, 'BYE team is present in standings');
    assert(byeTeamStanding.played === 0, 'BYE team has played = 0 (no unplayed game counted)');
    assert(byeTeamStanding.matchPoints === 0, 'BYE does NOT award match points (matchPoints = 0)');
    assert(byeTeamStanding.boardPoints === 0, 'BYE does NOT award board points (boardPoints = 0)');

    // =========================================================================
    // SECTION 8: CONCURRENCY, UNIQUE INDEX & COMPENSATING ROLLBACK
    // =========================================================================
    console.log('\n--- 8. Testing Concurrency & Rollback Safety ---');

    // Create a 2-team competition
    const compConcRes = await post(
      '/team-competitions',
      {
        name: `${testPrefix} Concurrency Swiss`,
        format: 'SWISS',
      },
      orgToken
    );
    const compConcId = compConcRes.data.data?._id || compConcRes.data._id;
    createdCompIds.push(compConcId);

    for (let i = 1; i <= 2; i++) {
      await post(
        `/team-competitions/${compConcId}/teams`,
        { name: `Conc Squad ${i}` },
        createToken(captains[i - 1]._id)
      );
    }

    // Launch 2 simultaneous round generation requests
    const [conc1, conc2] = await Promise.all([
      post(`/team-competitions/${compConcId}/schedule/swiss/round`, { boardCount: 2 }, orgToken),
      post(`/team-competitions/${compConcId}/schedule/swiss/round`, { boardCount: 2 }, orgToken),
    ]);

    const successes = [conc1, conc2].filter((r) => r.status === 201);
    const conflicts = [conc1, conc2].filter((r) => [409, 400].includes(r.status));
    assert(successes.length === 1, 'Exactly one concurrent generation request succeeded with 201');
    assert(conflicts.length === 1, 'The competing concurrent request was rejected with conflict');

    // Verify exactly 1 round and 1 match exist in database (no duplicated rounds)
    const concRounds = await TeamCompetitionRound.find({ competition: compConcId });
    const concMatches = await TeamMatch.find({ competition: compConcId });
    assert(concRounds.length === 1, 'Exactly 1 round exists in MongoDB after concurrent generation');
    assert(concMatches.length === 1, 'Exactly 1 match exists in MongoDB after concurrent generation');

    // 8.2 True Multi-Process Concurrency Test using separate Node.js OS processes
    console.log('\n--- 8.2 Testing Multi-Process Concurrency (Separate OS Processes) ---');
    const compMultiProcRes = await post(
      '/team-competitions',
      {
        name: `${testPrefix} MultiProc Swiss`,
        format: 'SWISS',
      },
      orgToken
    );
    const compMultiProcId = compMultiProcRes.data.data?._id || compMultiProcRes.data._id;
    createdCompIds.push(compMultiProcId);

    for (let i = 1; i <= 2; i++) {
      await post(
        `/team-competitions/${compMultiProcId}/teams`,
        { name: `MultiProc Squad ${i}` },
        createToken(captains[i - 1]._id)
      );
    }

    const workerPath = path.resolve(__dirname, 'concurrentSwissWorker.js');
    const targetUrl = `${API_BASE}/team-competitions/${compMultiProcId}/schedule/swiss/round`;

    const runWorkerProcess = () =>
      new Promise((resolve) => {
        const cp = spawn('node', [workerPath, targetUrl, orgToken]);
        let stdout = '';
        let stderr = '';
        cp.stdout.on('data', (d) => (stdout += d));
        cp.stderr.on('data', (d) => (stderr += d));
        cp.on('close', (code) => {
          let parsed = {};
          try {
            parsed = JSON.parse(stdout);
          } catch {}
          resolve({ code, stdout, stderr, status: parsed.status });
        });
      });

    // Launch two separate Node.js processes simultaneously
    const [proc1, proc2] = await Promise.all([runWorkerProcess(), runWorkerProcess()]);
    const procStatuses = [proc1.status, proc2.status];
    const proc201 = procStatuses.filter((s) => s === 201);
    const proc409 = procStatuses.filter((s) => [409, 400].includes(s));
    assert(proc201.length === 1, 'Multi-process: Exactly one OS process succeeded with 201');
    assert(proc409.length === 1, 'Multi-process: The other OS process was rejected with 409 conflict');

    const multiProcRounds = await TeamCompetitionRound.find({ competition: compMultiProcId });
    const multiProcMatches = await TeamMatch.find({ competition: compMultiProcId });
    assert(multiProcRounds.length === 1, 'Multi-process: Exactly 1 round document created in database');
    assert(multiProcMatches.length === 1, 'Multi-process: Exactly 1 match document created in database');

    // 8.3 Non-transaction compensating cleanup test
    console.log('\n--- 8.3 Testing Compensating Cleanup When Transactions Unavailable ---');
    const compRollbackRes = await post(
      '/team-competitions',
      {
        name: `${testPrefix} Rollback Swiss`,
        format: 'SWISS',
      },
      orgToken
    );
    const compRollbackId = compRollbackRes.data.data?._id || compRollbackRes.data._id;
    createdCompIds.push(compRollbackId);
    for (let i = 1; i <= 2; i++) {
      await post(
        `/team-competitions/${compRollbackId}/teams`,
        { name: `Rollback Squad ${i}` },
        createToken(captains[i - 1]._id)
      );
    }

    // Force startSession to throw so non-transaction path is exercised
    const origStartSession = mongoose.startSession;
    mongoose.startSession = async () => {
      throw new Error('Simulated transactions unavailable');
    };

    // Also simulate failure during match board creation
    const origInsertMany = TeamMatchBoard.insertMany;
    TeamMatchBoard.insertMany = async () => {
      const err = new Error('Simulated board creation failure');
      err.code = 500;
      throw err;
    };

    let nonTxThrew = false;
    try {
      await teamMatchService.generateSwissRound(compRollbackId, { boardCount: 2 }, organizer._id);
    } catch (err) {
      nonTxThrew = true;
      assert(err.message === 'Simulated board creation failure', 'Non-transaction creation threw simulated error');
    } finally {
      mongoose.startSession = origStartSession;
      TeamMatchBoard.insertMany = origInsertMany;
    }
    assert(nonTxThrew, 'Non-transaction error path executed');

    // Verify compensating cleanup deleted any partial round/match documents
    const orphanRounds = await TeamCompetitionRound.find({ competition: compRollbackId });
    const orphanMatches = await TeamMatch.find({ competition: compRollbackId });
    const orphanBoards = await TeamMatchBoard.find({ match: { $in: orphanMatches.map((m) => m._id) } });
    assert(orphanRounds.length === 0, 'Compensating cleanup removed partial round document');
    assert(orphanMatches.length === 0, 'Compensating cleanup removed partial match document');
    assert(orphanBoards.length === 0, 'Compensating cleanup removed partial board documents');

    // =========================================================================
    // SECTION 9: V2 LINEUP & SCORING COMPATIBILITY
    // =========================================================================
    console.log('\n--- 9. Testing V2 Captain Lineup Compatibility ---');

    const createdSwissMatch = concMatches[0];
    const matchBoards = await TeamMatchBoard.find({ match: createdSwissMatch._id }).sort({
      boardNumber: 1,
    });
    assert(matchBoards.length === 2, 'Created match has 2 boards');

    // Captain sets lineup on generated fixture
    const lineupRes = await fetch(
      `${API_BASE}/team-competitions/${compConcId}/matches/${createdSwissMatch._id}/lineup`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${createToken(captains[0]._id)}`,
        },
        body: JSON.stringify({
          teamId: createdSwissMatch.teamA.toString(),
          assignments: [{ boardNumber: 1, playerId: captains[0]._id.toString() }],
        }),
      }
    );
    assert(lineupRes.status === 200, 'Captain updates lineup on Swiss match fixture (200 OK)');
    const updatedBoard = await TeamMatchBoard.findOne({
      match: createdSwissMatch._id,
      boardNumber: 1,
    });
    assert(
      updatedBoard.teamAPlayer.toString() === captains[0]._id.toString(),
      'Board 1 teamAPlayer correctly assigned to captain'
    );

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
    console.log('🎉 Team Competition V6 Swiss Scheduling Test Suite Passed!\n');
  } finally {
    // Clean up test server and database fixtures
    testServer.close();
    console.log('🧹 Cleaning up test fixtures...');
    try {
      if (createdCompIds.length > 0) {
        await TeamMatchBoard.deleteMany({
          match: { $in: await TeamMatch.find({ competition: { $in: createdCompIds } }).select('_id') },
        });
        await TeamMatch.deleteMany({ competition: { $in: createdCompIds } });
        await TeamCompetitionRound.deleteMany({ competition: { $in: createdCompIds } });
        await TeamCompetitionStanding.deleteMany({ competition: { $in: createdCompIds } });
        await TeamCompetitionMember.deleteMany({ competition: { $in: createdCompIds } });
        await TeamCompetitionTeam.deleteMany({ competition: { $in: createdCompIds } });
        await TeamCompetition.deleteMany({ _id: { $in: createdCompIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      console.log('✨ Cleanup complete.');
    } catch (cleanupErr) {
      console.warn('⚠️ Cleanup warning:', cleanupErr.message);
    }
    await mongoose.disconnect();
  }
};

runTeamCompetitionSwissTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
