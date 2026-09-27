import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import * as roundService from '../services/roundService.js';
import * as standingsService from '../services/standingsService.js';
import { getDevUserId } from './devUser.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

dotenv.config();

const runStandingsAndRoundsTests = async () => {
  console.log('🧪 Starting Milestone 8: Standings + Round Completion Test Suite...\n');
  await connectDB();

  const devUserId = await getDevUserId();
  const testPrefix = `test_m8_${Date.now()}`;
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

  const createTestUser = async (name, lichessUsername) => {
    const user = await User.create({
      name,
      email: `${testPrefix}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: lichessUsername || `${testPrefix}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    });
    createdUserIds.push(user._id);
    return user;
  };

  const registerPlayers = async (tournamentId, users) => {
    for (const u of users) {
      await tournamentPlayerService.joinTournament(tournamentId, u._id);
    }
  };

  try {
    // ===============================================================
    // STANDINGS TESTS
    // ===============================================================
    console.log('=== SECTION 1: STANDINGS SERVICE TESTS ===');

    // Test 1: Two players, white wins -> 1-0
    console.log('\n--- TEST 1: Two players, white wins -> 1-0 ---');
    const u1A = await createTestUser('Alice', 'alice_lic');
    const u1B = await createTestUser('Bob', 'bob_lic');
    const t1 = await tournamentService.createTournament(
      { name: 'Standings Test 1-0', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0, clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t1._id);
    await registerPlayers(t1._id, [u1A, u1B]);

    const r1Res = await roundService.createRound(t1._id);
    const p1 = r1Res.pairings[0];
    p1.status = 'FINISHED';
    p1.result = '1-0';
    await p1.save();

    const std1 = await standingsService.getTournamentStandings(t1._id);
    const alice1 = std1.standings.find((s) => s.name === 'Alice');
    const bob1 = std1.standings.find((s) => s.name === 'Bob');
    assert(alice1.score === 1 && alice1.wins === 1 && alice1.completedGames === 1, 'White winner receives 1 point and 1 win');
    assert(bob1.score === 0 && bob1.losses === 1 && bob1.completedGames === 1, 'Black loser receives 0 points and 1 loss');
    assert(alice1.rank === 1 && bob1.rank === 2, 'Winner is ranked #1');

    // Test 2: Two players, black wins -> 0-1
    console.log('\n--- TEST 2: Two players, black wins -> 0-1 ---');
    const u2A = await createTestUser('Charlie', 'charlie_lic');
    const u2B = await createTestUser('Diana', 'diana_lic');
    const t2 = await tournamentService.createTournament(
      { name: 'Standings Test 0-1', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t2._id);
    await registerPlayers(t2._id, [u2A, u2B]);

    const r2Res = await roundService.createRound(t2._id);
    const p2 = r2Res.pairings[0];
    p2.status = 'FINISHED';
    p2.result = '0-1';
    await p2.save();

    const std2 = await standingsService.getTournamentStandings(t2._id);
    const whitePlayer2 = std2.standings.find((s) => s.playerId.toString() === p2.whitePlayer._id.toString());
    const blackPlayer2 = std2.standings.find((s) => s.playerId.toString() === p2.blackPlayer._id.toString());
    assert(blackPlayer2.score === 1 && blackPlayer2.wins === 1, 'Black winner receives 1 point and 1 win');
    assert(whitePlayer2.score === 0 && whitePlayer2.losses === 1, 'White loser receives 0 points and 1 loss');
    assert(blackPlayer2.rank === 1, 'Black winner ranked #1');

    // Test 3: Draw -> 0.5 / 0.5
    console.log('\n--- TEST 3: Draw -> 0.5 / 0.5 ---');
    const u3A = await createTestUser('Emma', 'emma_lic');
    const u3B = await createTestUser('Frank', 'frank_lic');
    const t3 = await tournamentService.createTournament(
      { name: 'Standings Test Draw', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t3._id);
    await registerPlayers(t3._id, [u3A, u3B]);

    const r3Res = await roundService.createRound(t3._id);
    const p3 = r3Res.pairings[0];
    p3.status = 'FINISHED';
    p3.result = '1/2-1/2';
    await p3.save();

    const std3 = await standingsService.getTournamentStandings(t3._id);
    assert(std3.standings[0].score === 0.5 && std3.standings[0].draws === 1, 'Player 1 receives 0.5 points and 1 draw');
    assert(std3.standings[1].score === 0.5 && std3.standings[1].draws === 1, 'Player 2 receives 0.5 points and 1 draw');

    // Test 4: Multiple rounds accumulate correctly
    console.log('\n--- TEST 4: Multiple rounds accumulate correctly ---');
    const u4A = await createTestUser('Grace', 'grace_lic');
    const u4B = await createTestUser('Henry', 'henry_lic');
    const u4C = await createTestUser('Ivy', 'ivy_lic');
    const t4 = await tournamentService.createTournament(
      { name: 'Multi Round Accumulation', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t4._id);
    await registerPlayers(t4._id, [u4A, u4B, u4C]);

    // Round 1
    const r4_1 = await roundService.createRound(t4._id);
    const p4_1 = r4_1.pairings[0];
    p4_1.status = 'FINISHED';
    p4_1.result = '1-0'; // White wins (+1)
    await p4_1.save();

    // Round 2
    const r4_2 = await roundService.createRound(t4._id);
    const p4_2 = r4_2.pairings[0];
    p4_2.status = 'FINISHED';
    p4_2.result = '1/2-1/2'; // Draw (+0.5 each)
    await p4_2.save();

    const std4 = await standingsService.getTournamentStandings(t4._id);
    const totalPoints4 = std4.standings.reduce((sum, s) => sum + s.score, 0);
    // Round 1 had 1 win (1 pt) + 1 BYE (1 pt) = 2 pts. Round 2 had 1 draw (0.5+0.5=1 pt) + 1 BYE (1 pt) = 2 pts. Total: 4 pts.
    assert(totalPoints4 === 4, 'Multiple rounds accurately accumulate scores from matches and BYEs');

    // Test 5: Aborted game gives zero points
    console.log('\n--- TEST 5: Aborted game gives zero points ---');
    const u5A = await createTestUser('Jack', 'jack_lic');
    const u5B = await createTestUser('Kate', 'kate_lic');
    const t5 = await tournamentService.createTournament(
      { name: 'Aborted Match Test', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t5._id);
    await registerPlayers(t5._id, [u5A, u5B]);

    const r5Res = await roundService.createRound(t5._id);
    const p5 = r5Res.pairings[0];
    p5.status = 'ABORTED';
    p5.result = 'ABORTED';
    await p5.save();

    const std5 = await standingsService.getTournamentStandings(t5._id);
    assert(std5.standings[0].score === 0 && std5.standings[0].completedGames === 0, 'Aborted game gives 0 points to player 1');
    assert(std5.standings[1].score === 0 && std5.standings[1].completedGames === 0, 'Aborted game gives 0 points to player 2');

    // Test 6: BYE gives one point
    console.log('\n--- TEST 6: BYE gives one point ---');
    const u6A = await createTestUser('Leo', 'leo_lic');
    const u6B = await createTestUser('Mia', 'mia_lic');
    const u6C = await createTestUser('Noah', 'noah_lic');
    const t6 = await tournamentService.createTournament(
      { name: 'BYE Point Test', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t6._id);
    await registerPlayers(t6._id, [u6A, u6B, u6C]);

    const r6Res = await roundService.createRound(t6._id);
    // r6 has a byePlayer
    const byeId = r6Res.round.byePlayer._id.toString();
    const std6 = await standingsService.getTournamentStandings(t6._id);
    const byeStats = std6.standings.find((s) => s.playerId.toString() === byeId);
    assert(byeStats.score === 1, 'Player with BYE receives 1 point');
    assert(byeStats.wins === 1, 'Player with BYE receives 1 win');
    assert(byeStats.gamesPlayed === 0 && byeStats.completedGames === 0, 'Player with BYE has 0 gamesPlayed and 0 completedGames');

    // Test 7: Player with no completed games remains at zero
    console.log('\n--- TEST 7: Player with no completed games remains at zero ---');
    const u7A = await createTestUser('Olivia', 'olivia_lic');
    const u7B = await createTestUser('Peter', 'peter_lic');
    const t7 = await tournamentService.createTournament(
      { name: 'Pending Match Test', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t7._id);
    await registerPlayers(t7._id, [u7A, u7B]);
    await roundService.createRound(t7._id); // Pairing remains PENDING

    const std7 = await standingsService.getTournamentStandings(t7._id);
    assert(std7.standings[0].score === 0 && std7.standings[0].gamesPlayed === 0, 'Unplayed player remains at 0 points');
    assert(std7.standings[1].score === 0 && std7.standings[1].gamesPlayed === 0, 'Unplayed opponent remains at 0 points');

    // Test 8: Standings ordering is deterministic (Score desc, Wins desc, Name asc)
    console.log('\n--- TEST 8: Standings ordering is deterministic ---');
    const u8A = await createTestUser('Zoe', 'zoe_lic');
    const u8B = await createTestUser('Adam', 'adam_lic');
    const u8C = await createTestUser('Brian', 'brian_lic');
    const t8 = await tournamentService.createTournament(
      { name: 'Deterministic Ordering Test', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t8._id);
    await registerPlayers(t8._id, [u8A, u8B, u8C]);

    // Zoe gets BYE (+1 pt, 1 win)
    // Adam vs Brian draw (0.5 pt each, 0 wins)
    const r8Res = await roundService.createRound(t8._id);
    // Find who got BYE
    const r8ByeId = r8Res.round.byePlayer._id.toString();
    const r8Pairing = r8Res.pairings[0];
    r8Pairing.status = 'FINISHED';
    r8Pairing.result = '1/2-1/2';
    await r8Pairing.save();

    const std8 = await standingsService.getTournamentStandings(t8._id);
    // Rank 1: bye receiver (1 pt)
    assert(std8.standings[0].score === 1, 'Highest score is ranked #1');
    // Rank 2 and 3: 0.5 pts each, ties broken alphabetically by name
    assert(std8.standings[1].score === 0.5 && std8.standings[2].score === 0.5, 'Tied players have equal score');
    assert(std8.standings[1].name.localeCompare(std8.standings[2].name) < 0, 'Score & win tie broken alphabetically by name ascending');

    // ===============================================================
    // ROUND COMPLETION TESTS
    // ===============================================================
    console.log('\n=== SECTION 2: ROUND COMPLETION TESTS ===');

    // Test 9: All pairings finished -> complete
    console.log('\n--- TEST 9: All pairings finished -> complete ---');
    const t9 = await tournamentService.createTournament({ name: 'Completion Complete', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 }, devUserId);
    createdTournamentIds.push(t9._id);
    const u9A = await createTestUser('R9_A');
    const u9B = await createTestUser('R9_B');
    await registerPlayers(t9._id, [u9A, u9B]);
    const r9 = await roundService.createRound(t9._id);
    r9.pairings[0].status = 'FINISHED';
    r9.pairings[0].result = '1-0';
    await r9.pairings[0].save();

    const status9 = await roundService.getRoundCompletionStatus(t9._id, 1);
    assert(status9.complete === true, 'Round is complete when all pairings are FINISHED');
    assert(status9.finishedPairings === 1 && status9.pendingPairings === 0, 'Counts show 1 finished, 0 pending');

    // Test 10: One pairing ACTIVE -> incomplete
    console.log('\n--- TEST 10: One pairing ACTIVE -> incomplete ---');
    const t10 = await tournamentService.createTournament({ name: 'Active Incomplete', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 }, devUserId);
    createdTournamentIds.push(t10._id);
    const u10A = await createTestUser('R10_A');
    const u10B = await createTestUser('R10_B');
    await registerPlayers(t10._id, [u10A, u10B]);
    const r10 = await roundService.createRound(t10._id);
    r10.pairings[0].status = 'ACTIVE';
    r10.pairings[0].result = 'PENDING';
    await r10.pairings[0].save();

    const status10 = await roundService.getRoundCompletionStatus(t10._id, 1);
    assert(status10.complete === false, 'Round is NOT complete when a pairing is ACTIVE');
    assert(status10.activePairings === 1, 'ACTIVE pairings counter reports 1');

    // Test 11: One pairing PENDING -> incomplete
    console.log('\n--- TEST 11: One pairing PENDING -> incomplete ---');
    const t11 = await tournamentService.createTournament({ name: 'Pending Incomplete', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 }, devUserId);
    createdTournamentIds.push(t11._id);
    const u11A = await createTestUser('R11_A');
    const u11B = await createTestUser('R11_B');
    await registerPlayers(t11._id, [u11A, u11B]);
    await roundService.createRound(t11._id); // Status is PENDING

    const status11 = await roundService.getRoundCompletionStatus(t11._id, 1);
    assert(status11.complete === false, 'Round is NOT complete when a pairing is PENDING');
    assert(status11.pendingPairings === 1, 'PENDING pairings counter reports 1');

    // Test 12: ABORTED pairing counts as terminal
    console.log('\n--- TEST 12: ABORTED pairing counts as terminal ---');
    const t12 = await tournamentService.createTournament({ name: 'Aborted Terminal', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 }, devUserId);
    createdTournamentIds.push(t12._id);
    const u12A = await createTestUser('R12_A');
    const u12B = await createTestUser('R12_B');
    await registerPlayers(t12._id, [u12A, u12B]);
    const r12 = await roundService.createRound(t12._id);
    r12.pairings[0].status = 'ABORTED';
    r12.pairings[0].result = 'ABORTED';
    await r12.pairings[0].save();

    const status12 = await roundService.getRoundCompletionStatus(t12._id, 1);
    assert(status12.complete === true, 'ABORTED pairing is recognized as terminal');
    assert(status12.abortedPairings === 1, 'ABORTED pairings counter reports 1');

    // Test 13: BYE does not block completion
    console.log('\n--- TEST 13: BYE does not block completion ---');
    const t13 = await tournamentService.createTournament({ name: 'BYE Completion', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 }, devUserId);
    createdTournamentIds.push(t13._id);
    const u13A = await createTestUser('R13_A');
    const u13B = await createTestUser('R13_B');
    const u13C = await createTestUser('R13_C');
    await registerPlayers(t13._id, [u13A, u13B, u13C]);
    const r13 = await roundService.createRound(t13._id);
    // r13 has 1 pairing and 1 BYE
    r13.pairings[0].status = 'FINISHED';
    r13.pairings[0].result = '1-0';
    await r13.pairings[0].save();

    const status13 = await roundService.getRoundCompletionStatus(t13._id, 1);
    assert(status13.complete === true, 'BYE player does not prevent round completion');
    assert(Boolean(status13.byePlayer), 'BYE player object returned in status');

    // ===============================================================
    // NEXT ROUND CREATION RULES
    // ===============================================================
    console.log('\n=== SECTION 3: NEXT ROUND CREATION RULES ===');

    // Test 14: Round 2 blocked while Round 1 incomplete
    console.log('\n--- TEST 14: Round 2 blocked while Round 1 incomplete ---');
    const t14 = await tournamentService.createTournament({ name: 'Blocked Round 2', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 }, devUserId);
    createdTournamentIds.push(t14._id);
    const u14A = await createTestUser('R14_A');
    const u14B = await createTestUser('R14_B');
    const u14C = await createTestUser('R14_C');
    const u14D = await createTestUser('R14_D');
    await registerPlayers(t14._id, [u14A, u14B, u14C, u14D]);
    await roundService.createRound(t14._id); // Round 1 created with PENDING pairings

    try {
      await roundService.createRound(t14._id);
      throw new Error('Should have thrown error for incomplete Round 1');
    } catch (err) {
      assert(err.statusCode === 400, 'HTTP 400 returned when previous round is incomplete');
      assert(err.message.includes('Previous round is not complete'), 'Clear error message indicating previous round incomplete');
    }

    // Test 15: Round 2 allowed after Round 1 complete
    console.log('\n--- TEST 15: Round 2 allowed after Round 1 complete ---');
    // Complete all pairings in Round 1
    const t14Rounds = await roundService.getRounds(t14._id);
    for (const p of t14Rounds[0].pairings) {
      await Pairing.findByIdAndUpdate(p._id, { status: 'FINISHED', result: '1-0' });
    }
    const r14_2 = await roundService.createRound(t14._id);
    assert(r14_2.round.roundNumber === 2, 'Round 2 created successfully after Round 1 completed');
    assert(r14_2.pairings.every((p) => p.lichessGameId === null), 'Newly created pairings have lichessGameId = null');

    // Test 16: Duplicate round blocked
    console.log('\n--- TEST 16: Duplicate round blocked ---');
    // Attempting to manually create another round with existing round number
    try {
      await Round.create({
        tournamentId: t14._id,
        roundNumber: 2,
        status: 'PENDING',
      });
      throw new Error('Database index should have prevented duplicate round number');
    } catch (err) {
      assert(err.code === 11000 || err.message.includes('duplicate'), 'Duplicate round number rejected by unique compound index');
    }

    // Test 17: Round beyond Round Robin limit blocked
    console.log('\n--- TEST 17: Round beyond Round Robin limit blocked ---');
    // t14 has 4 players -> max 3 rounds.
    // Finish Round 2 pairings
    const t14R2 = await roundService.getRounds(t14._id);
    for (const p of t14R2[1].pairings) {
      await Pairing.findByIdAndUpdate(p._id, { status: 'FINISHED', result: '1-0' });
    }
    // Create Round 3
    const r14_3 = await roundService.createRound(t14._id);
    assert(r14_3.round.roundNumber === 3, 'Round 3 created (3/3 for 4 players)');

    // Finish Round 3 pairings
    for (const p of r14_3.pairings) {
      await Pairing.findByIdAndUpdate(p._id, { status: 'FINISHED', result: '1-0' });
    }

    // Attempt Round 4
    try {
      await roundService.createRound(t14._id);
      throw new Error('Should have rejected Round 4 beyond schedule limit');
    } catch (err) {
      assert(err.statusCode === 400, 'HTTP 400 returned when attempting rounds beyond schedule limit');
      assert(err.message.includes('All 3 rounds have already been created'), 'Clear error message indicating all rounds created');
    }

    // Test 18: Existing matchup uniqueness preserved
    console.log('\n--- TEST 18: Existing matchup uniqueness preserved ---');
    const allRoundsT14 = await roundService.getRounds(t14._id);
    const matchupSet14 = new Set();
    for (const r of allRoundsT14) {
      for (const p of r.pairings) {
        const key = [p.whitePlayer._id.toString(), p.blackPlayer._id.toString()].sort().join('_vs_');
        assert(!matchupSet14.has(key), `Matchup ${key} is unique across all rounds`);
        matchupSet14.add(key);
      }
    }
    assert(matchupSet14.size === 6, 'Total unique matchups for 4 players is exactly 6 (4 * 3 / 2)');

    // Test 19: Existing BYE behavior preserved
    console.log('\n--- TEST 19: Existing BYE behavior preserved ---');
    const t19 = await tournamentService.createTournament({ name: 'BYE Preserved', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 }, devUserId);
    createdTournamentIds.push(t19._id);
    const u19A = await createTestUser('R19_A');
    const u19B = await createTestUser('R19_B');
    const u19C = await createTestUser('R19_C');
    await registerPlayers(t19._id, [u19A, u19B, u19C]);

    const r19_1 = await roundService.createRound(t19._id);
    await Pairing.findByIdAndUpdate(r19_1.pairings[0]._id, { status: 'FINISHED', result: '1-0' });
    const r19_2 = await roundService.createRound(t19._id);
    await Pairing.findByIdAndUpdate(r19_2.pairings[0]._id, { status: 'FINISHED', result: '1-0' });
    const r19_3 = await roundService.createRound(t19._id);

    const byeRecipients = [
      r19_1.round.byePlayer._id.toString(),
      r19_2.round.byePlayer._id.toString(),
      r19_3.round.byePlayer._id.toString(),
    ];
    const uniqueByes = new Set(byeRecipients);
    assert(uniqueByes.size === 3, 'All 3 players received exactly 1 BYE across the 3 rounds');

    // Test 20: Insufficient players still rejected
    console.log('\n--- TEST 20: Insufficient players still rejected ---');
    const t20 = await tournamentService.createTournament({ name: 'Insufficient Players', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 }, devUserId);
    createdTournamentIds.push(t20._id);
    try {
      await roundService.createRound(t20._id);
      throw new Error('Should have rejected tournament with 0 players');
    } catch (err) {
      assert(err.statusCode === 400 && err.message.includes('At least 2 players are required'), '0 players rejected with 400');
    }

    const u20A = await createTestUser('R20_A');
    await registerPlayers(t20._id, [u20A]);
    try {
      await roundService.createRound(t20._id);
      throw new Error('Should have rejected tournament with 1 player');
    } catch (err) {
      assert(err.statusCode === 400 && err.message.includes('At least 2 players are required'), '1 player rejected with 400');
    }

    console.log(`\n==================================================`);
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log(`==================================================`);
  } finally {
    console.log('\n🧹 Cleaning up test data...');
    for (const tid of createdTournamentIds) {
      await Pairing.deleteMany({ tournamentId: tid });
      await Round.deleteMany({ tournamentId: tid });
      await TournamentPlayer.deleteMany({ tournamentId: tid });
      await Tournament.findByIdAndDelete(tid);
    }
    for (const uid of createdUserIds) {
      await User.findByIdAndDelete(uid);
    }
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
};

runStandingsAndRoundsTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
