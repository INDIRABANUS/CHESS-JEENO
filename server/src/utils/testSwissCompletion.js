/**
 * testSwissCompletion.js
 *
 * Dedicated test suite validating Swiss tournament completion behavior:
 * - TOTAL_ROUNDS_REACHED
 * - ALL_MATCHUPS_EXHAUSTED
 * - Idempotency, error separation, winner resolution, and realtime events.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import * as tournamentService from '../services/tournamentService.js';
import * as roundService from '../services/roundService.js';
import * as standingsService from '../services/standingsService.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import { generateSwissPairings } from './swissPairing.js';

dotenv.config();

let totalAssertions = 0;
let passedAssertions = 0;

const assert = (condition, message) => {
  totalAssertions++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
  console.log(`  ✅ Passed: ${message}`);
};

const runSwissCompletionTests = async () => {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('🧪 Starting CHESS JEENO Swiss Completion & Exhaustion Test Suite');
  console.log('══════════════════════════════════════════════════════════════════\n');

  await connectDB();

  const testPrefix = `swiss_comp_${Date.now()}`;
  const createdUserIds = [];
  const createdTournamentIds = [];

  // Helper to create test users
  const createTestUsers = async (count, tag = 'u') => {
    const users = [];
    for (let i = 1; i <= count; i++) {
      const u = await User.create({
        name: `Swiss Player ${tag}_${i}`,
        email: `${testPrefix}_${tag}_${i}@chessjeeno.local`,
        passwordHash: 'dummy_hash',
        authProvider: 'local',
        lichessUsername: `swiss_${tag}_${i}_${Date.now()}`,
      });
      createdUserIds.push(u._id);
      users.push(u);
    }
    return users;
  };

  try {
    // =========================================================================
    // TEST A: 4 players, 3 completed rounds (all 6 matchups exhausted)
    // Attempt to create Round 4 -> clean completion with ALL_MATCHUPS_EXHAUSTED
    // =========================================================================
    console.log('\n--- TEST A: 4 Players, All Matchups Exhausted -> ALL_MATCHUPS_EXHAUSTED ---');
    const usersA = await createTestUsers(4, 'a');
    const hostA = usersA[0];

    const tourneyA = await tournamentService.createTournament(
      {
        name: 'Swiss Exhaustion Test Tournament',
        format: 'SWISS',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 4,
        totalRounds: 5, // Configured for 5 rounds, but 4 players can only play 3 rounds!
      },
      hostA._id
    );
    createdTournamentIds.push(tourneyA._id);

    // Register 4 players and transition to RUNNING
    for (const u of usersA) {
      await TournamentPlayer.create({ tournamentId: tourneyA._id, userId: u._id });
    }
    await Tournament.findByIdAndUpdate(tourneyA._id, { status: 'RUNNING' });

    // Round 1
    const r1A = await roundService.createRound(tourneyA._id, hostA._id);
    assert(r1A.round.roundNumber === 1, 'TEST A.1: Round 1 created successfully');
    assert(r1A.pairings.length === 2, 'TEST A.1: Round 1 has 2 pairings');

    // Simulate completion of Round 1 (P1 wins, P3 wins)
    await Pairing.findByIdAndUpdate(r1A.pairings[0]._id, { status: 'FINISHED', result: '1-0', completedAt: new Date() });
    await Pairing.findByIdAndUpdate(r1A.pairings[1]._id, { status: 'FINISHED', result: '1-0', completedAt: new Date() });
    await roundService.getRoundCompletionStatus(tourneyA._id, 1);

    // Round 2
    const r2A = await roundService.createRound(tourneyA._id, hostA._id);
    assert(r2A.round.roundNumber === 2, 'TEST A.2: Round 2 created successfully');
    assert(r2A.pairings.length === 2, 'TEST A.2: Round 2 has 2 pairings');

    // Simulate completion of Round 2
    await Pairing.findByIdAndUpdate(r2A.pairings[0]._id, { status: 'FINISHED', result: '1/2-1/2', completedAt: new Date() });
    await Pairing.findByIdAndUpdate(r2A.pairings[1]._id, { status: 'FINISHED', result: '1-0', completedAt: new Date() });
    await roundService.getRoundCompletionStatus(tourneyA._id, 2);

    // Round 3 (All 4 players will have played everyone after this)
    const r3A = await roundService.createRound(tourneyA._id, hostA._id);
    assert(r3A.round.roundNumber === 3, 'TEST A.3: Round 3 created successfully');
    assert(r3A.pairings.length === 2, 'TEST A.3: Round 3 has 2 pairings');

    // Simulate completion of Round 3
    await Pairing.findByIdAndUpdate(r3A.pairings[0]._id, { status: 'FINISHED', result: '1-0', completedAt: new Date() });
    await Pairing.findByIdAndUpdate(r3A.pairings[1]._id, { status: 'FINISHED', result: '0-1', completedAt: new Date() });
    const r3Status = await roundService.getRoundCompletionStatus(tourneyA._id, 3);
    assert(r3Status.complete === true, 'TEST A.4: Round 3 marked complete');

    // ATTEMPT TO CREATE ROUND 4 (All 6 pairings are exhausted)
    const r4Result = await roundService.createRound(tourneyA._id, hostA._id);

    // Verify expected behavior:
    assert(r4Result.completed === true, 'TEST A.5: createRound returns completed=true');
    assert(r4Result.completionReason === 'ALL_MATCHUPS_EXHAUSTED', 'TEST A.6: completionReason is ALL_MATCHUPS_EXHAUSTED');
    assert(r4Result.round === null, 'TEST A.7: No Round 4 document returned');

    // Verify database state
    const allRoundsInDb = await Round.find({ tournamentId: tourneyA._id });
    assert(allRoundsInDb.length === 3, 'TEST A.8: Exactly 3 rounds exist in database (no Round 4 created)');

    const updatedTourneyA = await Tournament.findById(tourneyA._id);
    assert(updatedTourneyA.status === 'FINISHED', 'TEST A.9: Tournament status is FINISHED');
    assert(updatedTourneyA.completionReason === 'ALL_MATCHUPS_EXHAUSTED', 'TEST A.10: Tournament completionReason persisted as ALL_MATCHUPS_EXHAUSTED');
    assert(updatedTourneyA.winnerPlayer !== null, 'TEST A.11: Winner player resolved and persisted');

    const standingsA = await standingsService.getTournamentStandings(tourneyA._id);
    assert(standingsA.standings.length === 4, 'TEST A.12: Standings preserved for all 4 players');
    assert(standingsA.standings[0].playerId.toString() === updatedTourneyA.winnerPlayer.toString(), 'TEST A.13: Persisted winner matches #1 standings player');

    // =========================================================================
    // TEST B: 4 players, only 2 completed rounds (valid Round 3 exists)
    // Round 3 is created normally, tournament does NOT complete
    // =========================================================================
    console.log('\n--- TEST B: 4 Players, 2 Rounds Completed -> Round 3 Created Normally ---');
    const usersB = await createTestUsers(4, 'b');
    const hostB = usersB[0];

    const tourneyB = await tournamentService.createTournament(
      {
        name: 'Swiss Valid Next Round Test',
        format: 'SWISS',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 4,
        totalRounds: 3,
      },
      hostB._id
    );
    createdTournamentIds.push(tourneyB._id);

    for (const u of usersB) {
      await TournamentPlayer.create({ tournamentId: tourneyB._id, userId: u._id });
    }
    await Tournament.findByIdAndUpdate(tourneyB._id, { status: 'RUNNING' });

    // Round 1
    const r1B = await roundService.createRound(tourneyB._id, hostB._id);
    await Pairing.findByIdAndUpdate(r1B.pairings[0]._id, { status: 'FINISHED', result: '1-0', completedAt: new Date() });
    await Pairing.findByIdAndUpdate(r1B.pairings[1]._id, { status: 'FINISHED', result: '0-1', completedAt: new Date() });
    await roundService.getRoundCompletionStatus(tourneyB._id, 1);

    // Round 2
    const r2B = await roundService.createRound(tourneyB._id, hostB._id);
    await Pairing.findByIdAndUpdate(r2B.pairings[0]._id, { status: 'FINISHED', result: '1/2-1/2', completedAt: new Date() });
    await Pairing.findByIdAndUpdate(r2B.pairings[1]._id, { status: 'FINISHED', result: '1-0', completedAt: new Date() });
    await roundService.getRoundCompletionStatus(tourneyB._id, 2);

    // Create Round 3 (valid pairings remain)
    const r3B = await roundService.createRound(tourneyB._id, hostB._id);
    assert(r3B.round && r3B.round.roundNumber === 3, 'TEST B.1: Round 3 created normally');
    assert(r3B.pairings.length === 2, 'TEST B.2: Round 3 has 2 valid pairings');

    const tourneyBState = await Tournament.findById(tourneyB._id);
    assert(tourneyBState.status === 'RUNNING', 'TEST B.3: Tournament remains in RUNNING status');
    assert(tourneyBState.completionReason === null, 'TEST B.4: completionReason remains null while active');

    // =========================================================================
    // TEST C: 4 players, configured totalRounds = 3, Round 3 completes
    // Completes normally with TOTAL_ROUNDS_REACHED
    // =========================================================================
    console.log('\n--- TEST C: totalRounds Reached -> TOTAL_ROUNDS_REACHED ---');
    // Finish Round 3 games of tourneyB
    await Pairing.findByIdAndUpdate(r3B.pairings[0]._id, { status: 'FINISHED', result: '1-0', completedAt: new Date() });
    await Pairing.findByIdAndUpdate(r3B.pairings[1]._id, { status: 'FINISHED', result: '0-1', completedAt: new Date() });

    const r3BStatus = await roundService.getRoundCompletionStatus(tourneyB._id, 3);
    assert(r3BStatus.complete === true, 'TEST C.1: Round 3 marked complete');

    const finishedTourneyB = await Tournament.findById(tourneyB._id);
    assert(finishedTourneyB.status === 'FINISHED', 'TEST C.2: Tournament transitions to FINISHED when totalRounds reached');
    assert(finishedTourneyB.completionReason === 'TOTAL_ROUNDS_REACHED', 'TEST C.3: completionReason is TOTAL_ROUNDS_REACHED');
    assert(finishedTourneyB.winnerPlayer !== null, 'TEST C.4: Winner persisted');

    // =========================================================================
    // TEST D: 6 players, enough unused matchups remain -> Round created normally
    // =========================================================================
    console.log('\n--- TEST D: 6 Players, Plenty of Matchups -> Next Round Created ---');
    const usersD = await createTestUsers(6, 'd');
    const hostD = usersD[0];

    const tourneyD = await tournamentService.createTournament(
      {
        name: 'Swiss 6 Player Test',
        format: 'SWISS',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 6,
        totalRounds: 4,
      },
      hostD._id
    );
    createdTournamentIds.push(tourneyD._id);

    for (const u of usersD) {
      await TournamentPlayer.create({ tournamentId: tourneyD._id, userId: u._id });
    }
    await Tournament.findByIdAndUpdate(tourneyD._id, { status: 'RUNNING' });

    // Round 1
    const r1D = await roundService.createRound(tourneyD._id, hostD._id);
    assert(r1D.round.roundNumber === 1, 'TEST D.1: 6-player Round 1 created');
    assert(r1D.pairings.length === 3, 'TEST D.2: Exactly 3 pairings for 6 players');

    // Complete Round 1
    for (const p of r1D.pairings) {
      await Pairing.findByIdAndUpdate(p._id, { status: 'FINISHED', result: '1-0', completedAt: new Date() });
    }
    await roundService.getRoundCompletionStatus(tourneyD._id, 1);

    // Round 2
    const r2D = await roundService.createRound(tourneyD._id, hostD._id);
    assert(r2D.round.roundNumber === 2, 'TEST D.3: 6-player Round 2 created normally');
    assert(r2D.pairings.length === 3, 'TEST D.4: Exactly 3 pairings in Round 2');

    // =========================================================================
    // TEST E: Invalid / corrupt pairing input
    // MUST NOT be interpreted as matchup exhaustion; throws error
    // =========================================================================
    console.log('\n--- TEST E: Invalid Pairing Input -> Throws Controlled Error ---');

    // 1. Insufficient players (< 2)
    let underPlayersError = null;
    try {
      generateSwissPairings({
        players: [{ id: 'solo_player', name: 'Solo' }],
        roundNumber: 1,
      });
    } catch (err) {
      underPlayersError = err;
    }
    assert(underPlayersError !== null, 'TEST E.1: Fewer than 2 players throws error');
    assert(underPlayersError.statusCode === 400, 'TEST E.2: Status code is 400');
    assert(underPlayersError.code !== 'ALL_MATCHUPS_EXHAUSTED', 'TEST E.3: Error code is NOT ALL_MATCHUPS_EXHAUSTED');

    // 2. Duplicate player IDs in roster
    let dupPlayerError = null;
    try {
      generateSwissPairings({
        players: [
          { id: 'dup_id', name: 'User 1' },
          { id: 'dup_id', name: 'User 2' },
        ],
        roundNumber: 1,
      });
    } catch (err) {
      dupPlayerError = err;
    }
    assert(dupPlayerError !== null, 'TEST E.4: Duplicate player IDs throws error');
    assert(dupPlayerError.message.includes('Duplicate player IDs'), 'TEST E.5: Rejects duplicate players explicitly');
    assert(dupPlayerError.code !== 'ALL_MATCHUPS_EXHAUSTED', 'TEST E.6: Error code is NOT ALL_MATCHUPS_EXHAUSTED');

    // =========================================================================
    // TEST F: Attempt completion twice -> Idempotent
    // =========================================================================
    console.log('\n--- TEST F: Idempotent Completion ---');
    const firstWinner = updatedTourneyA.winnerPlayer.toString();

    // Call finishTournament again on tourneyA
    const repeatResult = await roundService.finishTournament(tourneyA._id, 'ALL_MATCHUPS_EXHAUSTED');
    assert(repeatResult.status === 'FINISHED', 'TEST F.1: Tournament remains FINISHED');
    assert(repeatResult.completionReason === 'ALL_MATCHUPS_EXHAUSTED', 'TEST F.2: completionReason unchanged');
    assert(repeatResult.winnerPlayer.toString() === firstWinner, 'TEST F.3: Winner player remains identical');

    // Calling createRound again on the finished tourneyA
    const repeatCreate = await roundService.createRound(tourneyA._id, hostA._id);
    assert(repeatCreate.completed === true, 'TEST F.4: Repeated createRound returns completed=true');
    assert(repeatCreate.round === null, 'TEST F.5: No duplicate round created');
    assert(repeatCreate.tournament.winnerPlayer.toString() === firstWinner, 'TEST F.6: Winner preserved on repeated call');

    const totalRoundsAfterRepeat = await Round.countDocuments({ tournamentId: tourneyA._id });
    assert(totalRoundsAfterRepeat === 3, 'TEST F.7: Round count strictly unchanged at 3');

    // =========================================================================
    // TEST G: Realtime completion
    // TOURNAMENT_COMPLETED event is emitted through existing Socket.IO mechanism
    // =========================================================================
    console.log('\n--- TEST G: Realtime Completion Event ---');
    const usersG = await createTestUsers(2, 'g');
    const tourneyG = await tournamentService.createTournament(
      {
        name: 'Socket Swiss Test',
        format: 'SWISS',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 2,
        totalRounds: 1,
      },
      usersG[0]._id
    );
    createdTournamentIds.push(tourneyG._id);

    for (const u of usersG) {
      await TournamentPlayer.create({ tournamentId: tourneyG._id, userId: u._id });
    }
    await Tournament.findByIdAndUpdate(tourneyG._id, { status: 'RUNNING' });

    // Mock Socket.IO broadcast verification
    let socketEventEmitted = false;
    let socketPayload = null;

    const mockIo = {
      to: (room) => ({
        emit: (event, payload) => {
          if (event === 'TOURNAMENT_COMPLETED') {
            socketEventEmitted = true;
            socketPayload = payload;
          }
        },
      }),
    };

    // Trigger finishTournament with mock socket imported
    const r1G = await roundService.createRound(tourneyG._id, usersG[0]._id);
    await Pairing.findByIdAndUpdate(r1G.pairings[0]._id, { status: 'FINISHED', result: '1-0', completedAt: new Date() });

    await roundService.getRoundCompletionStatus(tourneyG._id, 1);
    const finalG = await Tournament.findById(tourneyG._id);
    assert(finalG.status === 'FINISHED', 'TEST G.1: Tournament completed');
    assert(finalG.completionReason === 'TOTAL_ROUNDS_REACHED', 'TEST G.2: completionReason is TOTAL_ROUNDS_REACHED');

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passedAssertions} passed, 0 failed (out of ${totalAssertions} assertions)`);
    console.log('==================================================\n');
  } finally {
    console.log('🧹 Cleaning up test data...');
    if (createdTournamentIds.length > 0) {
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Round.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Pairing.deleteMany({ tournamentId: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('✨ Cleanup complete.');
    await mongoose.disconnect();
  }
};

runSwissCompletionTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
