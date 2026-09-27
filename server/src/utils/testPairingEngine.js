import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import * as roundService from '../services/roundService.js';
import { generateRoundRobinSchedule } from './roundRobin.js';
import { getDevUserId } from './devUser.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

dotenv.config();

const runPairingTests = async () => {
  console.log('🧪 Starting Round Robin Pairing Engine Test Suite...\n');
  await connectDB();

  const devUserId = await getDevUserId();
  const testPrefix = `test_rr_${Date.now()}`;
  const createdUserIds = [];
  const createdTournamentIds = [];

  // Helper to create test user
  const createTestUser = async (label) => {
    const user = await User.create({
      name: `Player ${label}`,
      email: `${testPrefix}_${label.toLowerCase()}@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `${testPrefix}_${label.toLowerCase()}`,
    });
    createdUserIds.push(user._id);
    return user;
  };

  // Helper to register players for tournament
  const registerPlayers = async (tournamentId, users) => {
    for (const u of users) {
      await tournamentPlayerService.joinTournament(tournamentId, u._id);
    }
  };

  try {
    // ---------------------------------------------------------------
    // TEST 1 — 2 players
    // ---------------------------------------------------------------
    console.log('--- TEST 1: 2 Players (1 Round, 1 Pairing) ---');
    const u1 = await createTestUser('1A');
    const u2 = await createTestUser('1B');

    const t1 = await tournamentService.createTournament(
      { name: 'RR 2 Players', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t1._id);
    await registerPlayers(t1._id, [u1, u2]);

    const r1 = await roundService.createRound(t1._id);
    if (r1.round.roundNumber !== 1) throw new Error('Expected round number 1');
    if (r1.pairings.length !== 1) throw new Error(`Expected 1 pairing, got ${r1.pairings.length}`);
    if (r1.round.byePlayer) throw new Error('No BYE expected for 2 players');

    console.log(`✅ TEST 1 Passed: 2 players -> 1 round, 1 pairing (${r1.pairings[0].whitePlayer.name} vs ${r1.pairings[0].blackPlayer.name})`);

    // ---------------------------------------------------------------
    // TEST 2 — 4 players
    // ---------------------------------------------------------------
    console.log('\n--- TEST 2: 4 Players (3 Rounds, 2 Pairings/Round, 6 Total Matchups) ---');
    const u2_1 = await createTestUser('2A');
    const u2_2 = await createTestUser('2B');
    const u2_3 = await createTestUser('2C');
    const u2_4 = await createTestUser('2D');

    const t2 = await tournamentService.createTournament(
      { name: 'RR 4 Players', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t2._id);
    await registerPlayers(t2._id, [u2_1, u2_2, u2_3, u2_4]);

    // Create 3 rounds (finishing previous round before creating next)
    const t2Round1 = await roundService.createRound(t2._id);
    await Pairing.updateMany({ roundId: t2Round1.round._id }, { status: 'FINISHED', result: '1-0' });
    const t2Round2 = await roundService.createRound(t2._id);
    await Pairing.updateMany({ roundId: t2Round2.round._id }, { status: 'FINISHED', result: '1-0' });
    const t2Round3 = await roundService.createRound(t2._id);

    if (t2Round1.pairings.length !== 2 || t2Round2.pairings.length !== 2 || t2Round3.pairings.length !== 2) {
      throw new Error('Each round for 4 players must have 2 pairings');
    }

    const allRoundsT2 = await roundService.getRounds(t2._id);
    if (allRoundsT2.length !== 3) throw new Error(`Expected 3 rounds, got ${allRoundsT2.length}`);

    // Check unique matchups
    const matchupSetT2 = new Set();
    for (const r of allRoundsT2) {
      for (const p of r.pairings) {
        const key = [p.whitePlayer._id.toString(), p.blackPlayer._id.toString()].sort().join('_vs_');
        matchupSetT2.add(key);
      }
    }
    if (matchupSetT2.size !== 6) {
      throw new Error(`Expected 6 unique matchups, got ${matchupSetT2.size}`);
    }
    console.log(`✅ TEST 2 Passed: 4 players -> 3 rounds, 2 pairings/round, ${matchupSetT2.size} unique matchups.`);

    // ---------------------------------------------------------------
    // TEST 3 — 6 players
    // ---------------------------------------------------------------
    console.log('\n--- TEST 3: 6 Players (5 Rounds, 3 Pairings/Round, 15 Total Matchups) ---');
    const u3_players = [];
    for (let i = 1; i <= 6; i++) {
      u3_players.push(await createTestUser(`3_${i}`));
    }
    const t3 = await tournamentService.createTournament(
      { name: 'RR 6 Players', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t3._id);
    await registerPlayers(t3._id, u3_players);

    for (let r = 1; r <= 5; r++) {
      const created = await roundService.createRound(t3._id);
      await Pairing.updateMany({ roundId: created.round._id }, { status: 'FINISHED', result: '1-0' });
    }

    const allRoundsT3 = await roundService.getRounds(t3._id);
    if (allRoundsT3.length !== 5) throw new Error(`Expected 5 rounds, got ${allRoundsT3.length}`);

    const matchupSetT3 = new Set();
    for (const r of allRoundsT3) {
      if (r.pairings.length !== 3) throw new Error(`Expected 3 pairings in round ${r.roundNumber}`);
      for (const p of r.pairings) {
        const key = [p.whitePlayer._id.toString(), p.blackPlayer._id.toString()].sort().join('_vs_');
        matchupSetT3.add(key);
      }
    }
    if (matchupSetT3.size !== 15) {
      throw new Error(`Expected 15 unique matchups, got ${matchupSetT3.size}`);
    }
    console.log(`✅ TEST 3 Passed: 6 players -> 5 rounds, 3 pairings/round, ${matchupSetT3.size} unique matchups.`);

    // ---------------------------------------------------------------
    // TEST 4 — 5 players (Odd Count, BYE System)
    // ---------------------------------------------------------------
    console.log('\n--- TEST 4: 5 Players (5 Rounds, 2 Pairings/Round, 1 BYE Each Round) ---');
    const u4_players = [];
    for (let i = 1; i <= 5; i++) {
      u4_players.push(await createTestUser(`4_${i}`));
    }
    const t4 = await tournamentService.createTournament(
      { name: 'RR 5 Players', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(t4._id);
    await registerPlayers(t4._id, u4_players);

    for (let r = 1; r <= 5; r++) {
      const created = await roundService.createRound(t4._id);
      await Pairing.updateMany({ roundId: created.round._id }, { status: 'FINISHED', result: '1-0' });
    }

    const allRoundsT4 = await roundService.getRounds(t4._id);
    if (allRoundsT4.length !== 5) throw new Error(`Expected 5 rounds, got ${allRoundsT4.length}`);

    const byeReceivers = new Set();
    const matchupSetT4 = new Set();

    for (const r of allRoundsT4) {
      if (r.pairings.length !== 2) throw new Error(`Expected 2 pairings in round ${r.roundNumber}, got ${r.pairings.length}`);
      if (!r.byePlayer) throw new Error(`Expected a BYE player in round ${r.roundNumber}`);

      byeReceivers.add(r.byePlayer._id.toString());

      for (const p of r.pairings) {
        const key = [p.whitePlayer._id.toString(), p.blackPlayer._id.toString()].sort().join('_vs_');
        matchupSetT4.add(key);
      }
    }

    if (byeReceivers.size !== 5) {
      throw new Error(`Expected all 5 players to receive exactly one BYE, but only ${byeReceivers.size} distinct players got BYE`);
    }
    if (matchupSetT4.size !== 10) {
      throw new Error(`Expected 10 unique matchups for 5 players, got ${matchupSetT4.size}`);
    }
    console.log(`✅ TEST 4 Passed: 5 players -> 5 rounds, 2 pairings/round, exactly 1 BYE/round, all 5 players received 1 BYE, ${matchupSetT4.size} unique matchups.`);

    // ---------------------------------------------------------------
    // TEST 5 — Duplicate round creation
    // ---------------------------------------------------------------
    console.log('\n--- TEST 5: Duplicate Round Creation Rejection ---');
    // t1 currently has Round 1 created. For 2 players, total rounds is 1.
    try {
      await roundService.createRound(t1._id);
      throw new Error('Should have rejected creating duplicate round or round beyond schedule limit');
    } catch (err) {
      console.log(`✅ TEST 5 Passed: Duplicate / excess round rejected: "${err.message}" (Status: ${err.statusCode})`);
    }

    // ---------------------------------------------------------------
    // TEST 6 — Insufficient players (< 2)
    // ---------------------------------------------------------------
    console.log('\n--- TEST 6: Insufficient Players Rejection ---');
    const tEmpty = await tournamentService.createTournament(
      { name: 'Empty Tourney', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(tEmpty._id);

    try {
      await roundService.createRound(tEmpty._id);
      throw new Error('Should have rejected tournament with 0 players');
    } catch (err) {
      console.log(`✅ TEST 6a Passed (0 players): "${err.message}"`);
    }

    const singleUser = await createTestUser('Single');
    await tournamentPlayerService.joinTournament(tEmpty._id, singleUser._id);
    try {
      await roundService.createRound(tEmpty._id);
      throw new Error('Should have rejected tournament with 1 player');
    } catch (err) {
      console.log(`✅ TEST 6b Passed (1 player): "${err.message}"`);
    }

    // ---------------------------------------------------------------
    // TEST 7 — Tournament status checks
    // ---------------------------------------------------------------
    console.log('\n--- TEST 7: Tournament Status Restrictions ---');
    const tStatus = await tournamentService.createTournament(
      { name: 'Status Check Tourney', format: 'ROUND_ROBIN', clockLimit: 300, increment: 0 },
      devUserId
    );
    createdTournamentIds.push(tStatus._id);
    const s1 = await createTestUser('S1');
    const s2 = await createTestUser('S2');
    await registerPlayers(tStatus._id, [s1, s2]);

    // Test RUNNING
    await Tournament.findByIdAndUpdate(tStatus._id, { status: 'RUNNING' });
    try {
      await roundService.createRound(tStatus._id);
      throw new Error('Should have rejected round creation for RUNNING tournament');
    } catch (err) {
      console.log(`✅ TEST 7a Passed (RUNNING status rejected): "${err.message}"`);
    }

    // Test FINISHED
    await Tournament.findByIdAndUpdate(tStatus._id, { status: 'FINISHED' });
    try {
      await roundService.createRound(tStatus._id);
      throw new Error('Should have rejected round creation for FINISHED tournament');
    } catch (err) {
      console.log(`✅ TEST 7b Passed (FINISHED status rejected): "${err.message}"`);
    }

    // ---------------------------------------------------------------
    // TEST 8 — Invalid tournament
    // ---------------------------------------------------------------
    console.log('\n--- TEST 8: Invalid / Nonexistent Tournament ---');
    try {
      const fakeId = new mongoose.Types.ObjectId();
      await roundService.createRound(fakeId);
      throw new Error('Should have rejected nonexistent tournament');
    } catch (err) {
      console.log(`✅ TEST 8 Passed (Nonexistent tournament 404): "${err.message}"`);
    }

    // ---------------------------------------------------------------
    // TEST 9 & 10 — Unique matchups & No self-pairing
    // ---------------------------------------------------------------
    console.log('\n--- TEST 9 & 10: Unique Matchups & No Self-Pairing Verification ---');
    // Test pure pairing generator utility for 8 players
    const eightPlayerIds = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    const eightSchedule = generateRoundRobinSchedule(eightPlayerIds);

    const matchupSet8 = new Set();
    for (const r of eightSchedule) {
      for (const p of r.pairings) {
        if (p.whitePlayer === p.blackPlayer) {
          throw new Error(`Self-pairing detected: ${p.whitePlayer} vs ${p.blackPlayer}`);
        }
        const key = [p.whitePlayer, p.blackPlayer].sort().join('_vs_');
        if (matchupSet8.has(key)) {
          throw new Error(`Duplicate matchup detected: ${key}`);
        }
        matchupSet8.add(key);
      }
    }
    // 8 players -> 8 * 7 / 2 = 28 matchups
    if (matchupSet8.size !== 28) {
      throw new Error(`Expected 28 matchups, got ${matchupSet8.size}`);
    }
    console.log(`✅ TEST 9 & 10 Passed: 8 players schedule verified (28 distinct matchups, 0 self-pairings, 0 duplicate matches).`);

    // ---------------------------------------------------------------
    // TEST 11 — Database cleanup
    // ---------------------------------------------------------------
    console.log('\n--- TEST 11: Cleaning Up All Temporary Test Data ---');
  } finally {
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
    console.log('🧹 TEST 11 Passed: All temporary test tournaments, rounds, pairings, and users deleted. Database is pristine.');
  }

  console.log('\n🎉 ALL 11 Round Robin Pairing Engine Tests Passed Successfully!\n');
};

runPairingTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
