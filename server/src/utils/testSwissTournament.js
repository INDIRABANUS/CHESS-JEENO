import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import * as tournamentService from '../services/tournamentService.js';
import * as roundService from '../services/roundService.js';
import * as standingsService from '../services/standingsService.js';
import * as pairingService from '../services/pairingService.js';
import { generateSwissPairings, assignColors } from './swissPairing.js';
import { setMockExportTransport } from '../services/lichessService.js';

dotenv.config();

const runSwissTests = async () => {
  console.log('🧪 Starting Milestone 13: Swiss Tournament Test Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `swiss_test_${timestamp}`;
  const createdUserIds = [];
  const createdTournamentIds = [];

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

  try {
    // =========================================================================
    // SECTION 1: Swiss Tournament Creation & Validation
    // =========================================================================
    console.log('--- SECTION 1: Tournament Creation & Validation ---');

    const devHost = await User.create({
      name: 'Swiss Host',
      email: `${testPrefix}_host@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'swiss_host_lic',
      lichessUserId: 'swiss_host_lic',
    });
    createdUserIds.push(devHost._id);

    // 1. Missing totalRounds for Swiss rejected
    let rejectedMissingRounds = false;
    try {
      await tournamentService.createTournament(
        {
          name: 'Missing Rounds Swiss',
          format: 'SWISS',
          clockLimit: 300,
          increment: 0,
        },
        devHost._id
      );
    } catch (err) {
      rejectedMissingRounds = err.statusCode === 400 && err.message.includes('Total rounds is required');
    }
    assert(rejectedMissingRounds, '1. Swiss tournament creation without totalRounds is rejected with 400');

    // 2. totalRounds = 0 rejected
    let rejectedZeroRounds = false;
    try {
      await tournamentService.createTournament(
        {
          name: 'Zero Rounds Swiss',
          format: 'SWISS',
          totalRounds: 0,
          clockLimit: 300,
          increment: 0,
        },
        devHost._id
      );
    } catch (err) {
      rejectedZeroRounds = err.statusCode === 400 && err.message.includes('between 1 and 20');
    }
    assert(rejectedZeroRounds, '2. Swiss tournament with totalRounds = 0 is rejected with 400');

    // 3. totalRounds > 20 rejected
    let rejectedExcessRounds = false;
    try {
      await tournamentService.createTournament(
        {
          name: 'Excess Rounds Swiss',
          format: 'SWISS',
          totalRounds: 21,
          clockLimit: 300,
          increment: 0,
        },
        devHost._id
      );
    } catch (err) {
      rejectedExcessRounds = err.statusCode === 400 && err.message.includes('between 1 and 20');
    }
    assert(rejectedExcessRounds, '3. Swiss tournament with totalRounds > 20 is rejected with 400');

    // 4. Valid Swiss tournament created
    const validSwiss = await tournamentService.createTournament(
      {
        name: 'Valid Swiss Championship',
        format: 'SWISS',
        totalRounds: 5,
        clockLimit: 300,
        increment: 0,
      },
      devHost._id
    );
    createdTournamentIds.push(validSwiss._id);
    assert(validSwiss.totalRounds === 5, '4. Swiss tournament created successfully with totalRounds = 5');
    assert(validSwiss.format === 'SWISS', '4. Tournament format is SWISS');

    // =========================================================================
    // SECTION 2: Swiss Pairing Engine Unit Tests (Even Players)
    // =========================================================================
    console.log('\n--- SECTION 2: Basic Pairing (4, 6, 8 Players) ---');

    // 5. 4 players basic pairing
    const p4 = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Charlie' },
      { id: 'p4', name: 'David' },
    ];
    const res4 = generateSwissPairings({ players: p4, roundNumber: 1 });
    assert(res4.pairings.length === 2, '5. 4 players produces exactly 2 pairings');
    assert(res4.byePlayer === null, '5. 4 players has no BYE');
    assert(res4.pairings.every((p) => p.whitePlayer !== p.blackPlayer), '5. No self-pairings in 4-player round');
    const p4Accounts = new Set(res4.pairings.flatMap((p) => [p.whitePlayer, p.blackPlayer]));
    assert(p4Accounts.size === 4, '5. All 4 players are paired');

    // 6. 6 players basic pairing
    const p6 = Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }));
    const res6 = generateSwissPairings({ players: p6, roundNumber: 1 });
    assert(res6.pairings.length === 3, '6. 6 players produces exactly 3 pairings');
    assert(res6.byePlayer === null, '6. 6 players has no BYE');
    const p6Accounts = new Set(res6.pairings.flatMap((p) => [p.whitePlayer, p.blackPlayer]));
    assert(p6Accounts.size === 6, '6. All 6 players are accounted for');

    // 7. 8 players basic pairing
    const p8 = Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }));
    const res8 = generateSwissPairings({ players: p8, roundNumber: 1 });
    assert(res8.pairings.length === 4, '7. 8 players produces exactly 4 pairings');
    assert(res8.byePlayer === null, '7. 8 players has no BYE');
    const p8Accounts = new Set(res8.pairings.flatMap((p) => [p.whitePlayer, p.blackPlayer]));
    assert(p8Accounts.size === 8, '7. All 8 players are accounted for');

    // =========================================================================
    // SECTION 3: Odd Player Counts & BYE Assignment
    // =========================================================================
    console.log('\n--- SECTION 3: Odd Players & BYE Assignment (5, 7, 9 Players) ---');

    // 8. 5 players -> 2 pairings + 1 BYE
    const p5 = Array.from({ length: 5 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }));
    const res5 = generateSwissPairings({ players: p5, roundNumber: 1 });
    assert(res5.pairings.length === 2, '8. 5 players produces exactly 2 pairings');
    assert(res5.byePlayer !== null, '8. 5 players produces exactly 1 BYE');
    const p5Accounts = new Set([...res5.pairings.flatMap((p) => [p.whitePlayer, p.blackPlayer]), res5.byePlayer]);
    assert(p5Accounts.size === 5, '8. All 5 players accounted for including BYE');

    // 9. 7 players -> 3 pairings + 1 BYE
    const p7 = Array.from({ length: 7 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }));
    const res7 = generateSwissPairings({ players: p7, roundNumber: 1 });
    assert(res7.pairings.length === 3, '9. 7 players produces exactly 3 pairings');
    assert(res7.byePlayer !== null, '9. 7 players produces exactly 1 BYE');
    const p7Accounts = new Set([...res7.pairings.flatMap((p) => [p.whitePlayer, p.blackPlayer]), res7.byePlayer]);
    assert(p7Accounts.size === 7, '9. All 7 players accounted for including BYE');

    // 10. 9 players -> 4 pairings + 1 BYE
    const p9 = Array.from({ length: 9 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }));
    const res9 = generateSwissPairings({ players: p9, roundNumber: 1 });
    assert(res9.pairings.length === 4, '10. 9 players produces exactly 4 pairings');
    assert(res9.byePlayer !== null, '10. 9 players produces exactly 1 BYE');
    const p9Accounts = new Set([...res9.pairings.flatMap((p) => [p.whitePlayer, p.blackPlayer]), res9.byePlayer]);
    assert(p9Accounts.size === 9, '10. All 9 players accounted for including BYE');

    // =========================================================================
    // SECTION 4: BYE History & Low-Score Preference
    // =========================================================================
    console.log('\n--- SECTION 4: BYE History & Lower-Score Preference ---');

    // 11. Player who had a previous BYE does not receive a second BYE if another player is eligible
    const prevRoundWithBye = {
      roundNumber: 1,
      byePlayer: 'p5',
      pairings: [
        { whitePlayer: 'p1', blackPlayer: 'p2' },
        { whitePlayer: 'p3', blackPlayer: 'p4' },
      ],
    };
    const standingsR2 = [
      { playerId: 'p1', score: 1 },
      { playerId: 'p3', score: 1 },
      { playerId: 'p5', score: 1 }, // had bye in R1 (+1 win)
      { playerId: 'p2', score: 0 },
      { playerId: 'p4', score: 0 },
    ];
    const res5R2 = generateSwissPairings({
      players: p5,
      standings: standingsR2,
      previousRounds: [prevRoundWithBye],
      roundNumber: 2,
    });
    assert(res5R2.byePlayer !== 'p5', '11. Player who had BYE in Round 1 does not receive BYE in Round 2');
    assert(['p2', 'p4'].includes(res5R2.byePlayer), '11. BYE in Round 2 is awarded to a lower-score player (0 pts) without previous BYE');

    // =========================================================================
    // SECTION 5: Score Groups & Float Handling
    // =========================================================================
    console.log('\n--- SECTION 5: Score Groups & Down-Floating ---');

    // 12. Score group pairing: Winners play winners, losers play losers
    const standings4R2 = [
      { playerId: 'p1', name: 'Alice', score: 1, wins: 1 },
      { playerId: 'p3', name: 'Charlie', score: 1, wins: 1 },
      { playerId: 'p2', name: 'Bob', score: 0, wins: 0 },
      { playerId: 'p4', name: 'David', score: 0, wins: 0 },
    ];
    const prevR1_4 = {
      roundNumber: 1,
      pairings: [
        { whitePlayer: 'p1', blackPlayer: 'p2' },
        { whitePlayer: 'p3', blackPlayer: 'p4' },
      ],
    };
    const res4R2 = generateSwissPairings({
      players: p4,
      standings: standings4R2,
      previousRounds: [prevR1_4],
      roundNumber: 2,
    });
    const pair1Players = [res4R2.pairings[0].whitePlayer, res4R2.pairings[0].blackPlayer];
    const pair2Players = [res4R2.pairings[1].whitePlayer, res4R2.pairings[1].blackPlayer];

    // Winners p1 and p3 must play each other; losers p2 and p4 must play each other
    assert(pair1Players.includes('p1') && pair1Players.includes('p3'), '12. 1-0 winners (p1, p3) are paired together in Round 2');
    assert(pair2Players.includes('p2') && pair2Players.includes('p4'), '12. 0-1 losers (p2, p4) are paired together in Round 2');

    // 13. No repeated opponents
    const p1OpponentsAcrossRounds = [
      prevR1_4.pairings.find((p) => p.whitePlayer === 'p1' || p.blackPlayer === 'p1'),
      res4R2.pairings.find((p) => p.whitePlayer === 'p1' || p.blackPlayer === 'p1'),
    ];
    const op1 = p1OpponentsAcrossRounds[0].whitePlayer === 'p1' ? p1OpponentsAcrossRounds[0].blackPlayer : p1OpponentsAcrossRounds[0].whitePlayer;
    const op2 = p1OpponentsAcrossRounds[1].whitePlayer === 'p1' ? p1OpponentsAcrossRounds[1].blackPlayer : p1OpponentsAcrossRounds[1].whitePlayer;
    assert(op1 !== op2, '13. Player p1 faces distinct opponents across Round 1 and Round 2');

    // =========================================================================
    // SECTION 6: Color Balancing
    // =========================================================================
    console.log('\n--- SECTION 6: Color Balancing ---');

    // 14. Player who was White in Round 1 gets Black when paired with someone who was Black
    // In R1: p1 was White, p3 was White -> let's test p1 (White in R1) vs p4 (Black in R1)
    const colorHistTest = new Map();
    colorHistTest.set('p1', { white: 1, black: 0, colorDifference: 1, lastColor: 'W' });
    colorHistTest.set('p4', { white: 0, black: 1, colorDifference: -1, lastColor: 'B' });

    const colorAssignment = assignColors({ id: 'p1' }, { id: 'p4' }, colorHistTest, 0);
    assert(colorAssignment.white.id === 'p4', '14. Player with fewer Whites (p4) receives White piece');
    assert(colorAssignment.black.id === 'p1', '14. Player with more Whites (p1) receives Black piece');

    // =========================================================================
    // SECTION 7: Determinism
    // =========================================================================
    console.log('\n--- SECTION 7: Determinism ---');

    // 15. Same inputs yield identical output
    const runA = generateSwissPairings({ players: p6, roundNumber: 1 });
    const runB = generateSwissPairings({ players: p6, roundNumber: 1 });
    assert(JSON.stringify(runA) === JSON.stringify(runB), '15. Swiss pairing output is 100% deterministic');

    // =========================================================================
    // SECTION 8: Controlled Error on Impossible Pairings
    // =========================================================================
    console.log('\n--- SECTION 8: Impossible Pairings Edge Case ---');

    // 16. In 4 players, after 3 rounds, all possible distinct matchups (6 pairs) have already been played.
    // Round 4 is impossible without repeat opponents.
    const allPlayedRounds = [
      {
        roundNumber: 1,
        pairings: [{ whitePlayer: 'p1', blackPlayer: 'p2' }, { whitePlayer: 'p3', blackPlayer: 'p4' }],
      },
      {
        roundNumber: 2,
        pairings: [{ whitePlayer: 'p1', blackPlayer: 'p3' }, { whitePlayer: 'p2', blackPlayer: 'p4' }],
      },
      {
        roundNumber: 3,
        pairings: [{ whitePlayer: 'p1', blackPlayer: 'p4' }, { whitePlayer: 'p2', blackPlayer: 'p3' }],
      },
    ];

    let impossibleErrorCaught = false;
    try {
      generateSwissPairings({
        players: p4,
        previousRounds: allPlayedRounds,
        roundNumber: 4,
      });
    } catch (err) {
      impossibleErrorCaught = err.statusCode === 400 && err.message.includes('no valid pairings exist without repeat matchups');
    }
    assert(impossibleErrorCaught, '16. Impossible pairing throws controlled 400 error without forcing repeat opponents');

    // =========================================================================
    // SECTION 9: End-to-End Service & Database Integration
    // =========================================================================
    console.log('\n--- SECTION 9: End-to-End Service & Database Integration ---');

    // Create 4 users
    const swissUsers = [];
    for (let i = 1; i <= 4; i++) {
      const u = await User.create({
        name: `Swiss User ${i}`,
        email: `${testPrefix}_u${i}@chessjeeno.local`,
        passwordHash: 'dummy_hash',
        authProvider: 'local',
        lichessUsername: `swiss_u${i}_lic`,
        lichessUserId: `swiss_u${i}_lic`,
      });
      createdUserIds.push(u._id);
      swissUsers.push(u);
    }

    // Create 2-round Swiss Tournament
    const swissTourney = await tournamentService.createTournament(
      {
        name: `${testPrefix} 2-Round Swiss Cup`,
        format: 'SWISS',
        totalRounds: 2,
        clockLimit: 300,
        increment: 0,
      },
      swissUsers[0]._id
    );
    createdTournamentIds.push(swissTourney._id);

    // Register all 4 players
    for (const u of swissUsers) {
      await TournamentPlayer.create({
        tournamentId: swissTourney._id,
        userId: u._id,
      });
    }

    // 17. Create Round 1
    const r1 = await roundService.createRound(swissTourney._id, swissUsers[0]._id);
    assert(r1.round.roundNumber === 1, '17. Swiss Round 1 created successfully');
    assert(r1.pairings.length === 2, '17. Round 1 has 2 pairings for 4 players');
    assert(r1.round.byePlayer === null, '17. No BYE in 4-player round');

    // 18. Round 2 blocked while Round 1 is incomplete
    let r2Blocked = false;
    try {
      await roundService.createRound(swissTourney._id, swissUsers[0]._id);
    } catch (err) {
      r2Blocked = err.statusCode === 400 && err.message.includes('Previous round is not complete');
    }
    assert(r2Blocked, '18. Creating Round 2 while Round 1 is incomplete is rejected with 400');

    // Simulate completion of Round 1
    const p1Doc = await Pairing.findById(r1.pairings[0]._id);
    p1Doc.status = 'FINISHED';
    p1Doc.result = '1-0';
    p1Doc.completedAt = new Date();
    await p1Doc.save();

    const p2Doc = await Pairing.findById(r1.pairings[1]._id);
    p2Doc.status = 'FINISHED';
    p2Doc.result = '0-1';
    p2Doc.completedAt = new Date();
    await p2Doc.save();

    // Verify Round 1 status complete
    const r1Status = await roundService.getRoundCompletionStatus(swissTourney._id, 1);
    assert(r1Status.complete === true, '18. Round 1 completion verified');

    // 19. Create Round 2 (Final round for this 2-round tournament)
    const r2 = await roundService.createRound(swissTourney._id, swissUsers[0]._id);
    assert(r2.round.roundNumber === 2, '19. Swiss Round 2 created successfully');
    assert(r2.pairings.length === 2, '19. Round 2 has 2 pairings');

    // Verify no repeat opponents in Round 2
    const allRoundsDocs = await roundService.getRounds(swissTourney._id);
    const r1Pairs = allRoundsDocs.find((r) => r.roundNumber === 1).pairings;
    const r2Pairs = allRoundsDocs.find((r) => r.roundNumber === 2).pairings;

    for (const p2 of r2Pairs) {
      const matchInR1 = r1Pairs.find(
        (p1) =>
          (p1.whitePlayer._id.toString() === p2.whitePlayer._id.toString() &&
            p1.blackPlayer._id.toString() === p2.blackPlayer._id.toString()) ||
          (p1.whitePlayer._id.toString() === p2.blackPlayer._id.toString() &&
            p1.blackPlayer._id.toString() === p2.whitePlayer._id.toString())
      );
      assert(!matchInR1, '19. Round 2 pairing does not repeat any Round 1 matchup');
    }

    // 20. Creating Round 3 (beyond totalRounds = 2) is blocked
    // Simulate finishing Round 2 first
    const r2p1 = await Pairing.findById(r2.pairings[0]._id);
    r2p1.status = 'FINISHED';
    r2p1.result = '1/2-1/2';
    r2p1.completedAt = new Date();
    await r2p1.save();

    const r2p2 = await Pairing.findById(r2.pairings[1]._id);
    r2p2.status = 'FINISHED';
    r2p2.result = '1-0';
    r2p2.completedAt = new Date();
    await r2p2.save();

    // 21. Tournament completion: Completing final round transitions tournament to FINISHED
    const r2Status = await roundService.getRoundCompletionStatus(swissTourney._id, 2);
    assert(r2Status.complete === true, '21. Final round (Round 2) marked complete');

    const finishedTourney = await Tournament.findById(swissTourney._id);
    assert(finishedTourney.status === 'FINISHED', '21. Swiss tournament status automatically transitioned to FINISHED upon final round completion');

    // 22. Attempting to create Round 3 on FINISHED tournament is blocked
    let r3Blocked = false;
    try {
      await roundService.createRound(swissTourney._id, swissUsers[0]._id);
    } catch (err) {
      r3Blocked = err.statusCode === 400;
    }
    assert(r3Blocked, '22. Round 3 beyond totalRounds is blocked with 400');

    // 23. Standings correctly calculated for Swiss tournament
    const swissStandings = await standingsService.getTournamentStandings(swissTourney._id);
    assert(swissStandings.standings.length === 4, '23. Standings generated for all 4 Swiss players');
    assert(swissStandings.standings[0].rank === 1, '23. Winner ranked #1 in Swiss standings');

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');
  } finally {
    console.log('🧹 Cleaning up test data...');
    if (createdTournamentIds.length > 0) {
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
      await Round.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Pairing.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('✨ Cleanup complete.\n');
  }
};

runSwissTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Swiss test suite failed:', err);
    process.exit(1);
  });
