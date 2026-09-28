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
import {
  calculateBracketSize,
  calculateTotalRounds,
  getKnockoutStageName,
  generateBracketSeedPairs,
  generateKnockoutInitialPairings,
  generateKnockoutNextRoundPairings,
  determinePairingWinner,
} from './knockoutPairing.js';

dotenv.config();

const runKnockoutTests = async () => {
  console.log('🧪 Starting Milestone 14: Knockout Tournament Test Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `ko_test_${timestamp}`;
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
    // SECTION 1: Pure Bracket Generator Unit Tests (2 to 16 players)
    // =========================================================================
    console.log('--- SECTION 1: Pure Bracket Generation & Seeding Engine Tests ---');

    // Test bracket sizes & total rounds calculations
    const cases = [
      { count: 2, expectedSize: 2, expectedRounds: 1, expectedByes: 0, stage: 'Final' },
      { count: 3, expectedSize: 4, expectedRounds: 2, expectedByes: 1, stage: 'Semifinals' },
      { count: 4, expectedSize: 4, expectedRounds: 2, expectedByes: 0, stage: 'Semifinals' },
      { count: 5, expectedSize: 8, expectedRounds: 3, expectedByes: 3, stage: 'Quarterfinals' },
      { count: 6, expectedSize: 8, expectedRounds: 3, expectedByes: 2, stage: 'Quarterfinals' },
      { count: 7, expectedSize: 8, expectedRounds: 3, expectedByes: 1, stage: 'Quarterfinals' },
      { count: 8, expectedSize: 8, expectedRounds: 3, expectedByes: 0, stage: 'Quarterfinals' },
      { count: 9, expectedSize: 16, expectedRounds: 4, expectedByes: 7, stage: 'Round of 16' },
      { count: 16, expectedSize: 16, expectedRounds: 4, expectedByes: 0, stage: 'Round of 16' },
    ];

    for (const c of cases) {
      const size = calculateBracketSize(c.count);
      const rounds = calculateTotalRounds(c.count);
      const byes = size - c.count;
      const stageName = getKnockoutStageName(1, rounds);

      assert(size === c.expectedSize, `Player count ${c.count} yields bracketSize ${c.expectedSize}`);
      assert(rounds === c.expectedRounds, `Player count ${c.count} yields totalRounds ${c.expectedRounds}`);
      assert(byes === c.expectedByes, `Player count ${c.count} yields ${c.expectedByes} BYE(s)`);
      assert(stageName === c.stage, `Player count ${c.count} Round 1 stageName is "${c.stage}"`);

      // Mock player objects with registration order
      const mockPlayers = Array.from({ length: c.count }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        name: `Player ${i + 1}`,
      }));

      const initialData = generateKnockoutInitialPairings(mockPlayers);
      const pairingsList = initialData.pairings;

      // Verify slot count in round 1
      assert(pairingsList.length === size / 2, `Round 1 pairings count is ${size / 2} for bracket size ${size}`);

      // Verify every player appears exactly once across pairings
      const matchedPlayerIds = [];
      let byeCountFound = 0;
      for (const p of pairingsList) {
        assert(p.whitePlayer, `White player must be present in every pairing slot`);
        matchedPlayerIds.push(p.whitePlayer.toString());

        if (p.isBye) {
          byeCountFound++;
          assert(p.blackPlayer === null, `BYE pairing must have blackPlayer as null`);
          assert(p.status === 'BYE', `BYE pairing status must be 'BYE'`);
          assert(p.result === 'BYE', `BYE pairing result must be 'BYE'`);
        } else {
          assert(p.blackPlayer, `Actual pairing must have blackPlayer`);
          matchedPlayerIds.push(p.blackPlayer.toString());
          assert(p.status === 'PENDING', `Actual pairing status must be 'PENDING'`);
          assert(p.result === 'PENDING', `Actual pairing result must be 'PENDING'`);
          // No self-pairing
          assert(p.whitePlayer.toString() !== p.blackPlayer.toString(), `No self-pairing`);
        }
      }

      assert(byeCountFound === c.expectedByes, `Generated exactly ${c.expectedByes} BYE pairings for ${c.count} players`);
      assert(matchedPlayerIds.length === c.count, `All ${c.count} players placed into round 1 pairings`);

      // Verify no duplicates
      const uniqueIds = new Set(matchedPlayerIds);
      assert(uniqueIds.size === c.count, `No player is duplicated across pairings for ${c.count} players`);

      // Determinism check: running again produces identical structure
      const secondRun = generateKnockoutInitialPairings(mockPlayers);
      const isIdentical = pairingsList.every((p, idx) => {
        const p2 = secondRun.pairings[idx];
        const wMatch = p.whitePlayer.toString() === p2.whitePlayer.toString();
        const bMatch = (!p.blackPlayer && !p2.blackPlayer) ||
          (p.blackPlayer?.toString() === p2.blackPlayer?.toString());
        return wMatch && bMatch && p.isBye === p2.isBye;
      });
      assert(isIdentical, `Knockout initial pairing generation is strictly deterministic for ${c.count} players`);
    }

    // Verify 8-player standard deterministic seed layout:
    // Match 1: 1 vs 8, Match 2: 4 vs 5, Match 3: 2 vs 7, Match 4: 3 vs 6
    const seedPairs8 = generateBracketSeedPairs(8);
    const expectedSeedPairs8 = [
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ];
    assert(
      JSON.stringify(seedPairs8) === JSON.stringify(expectedSeedPairs8),
      `8-bracket seed layout matches standard bracket: [1,8], [4,5], [2,7], [3,6]`
    );

    // =========================================================================
    // SECTION 2: Tournament Creation & Validation
    // =========================================================================
    console.log('\n--- SECTION 2: Knockout Tournament Creation & Requirements ---');

    const devHost = await User.create({
      name: 'Knockout Host',
      email: `${testPrefix}_host@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'ko_host_lic',
      lichessUserId: 'ko_host_lic',
    });
    createdUserIds.push(devHost._id);

    // 1. Knockout creation does NOT require totalRounds
    const koTournament = await tournamentService.createTournament(
      {
        name: 'Auto Knockout Cup',
        format: 'KNOCKOUT',
        clockLimit: 300,
        increment: 0,
        description: 'Knockout format without manual totalRounds',
      },
      devHost._id
    );
    createdTournamentIds.push(koTournament._id);
    assert(koTournament.format === 'KNOCKOUT', `Tournament created with format KNOCKOUT`);
    assert(koTournament.totalRounds === null, `Knockout totalRounds defaults to null (derived dynamically)`);

    // 2. Starting with 0 or 1 player is rejected
    let rejectedNoPlayers = false;
    try {
      await roundService.createRound(koTournament._id, devHost._id);
    } catch (err) {
      rejectedNoPlayers = err.statusCode === 400 && err.message.includes('At least 2 players are required');
    }
    assert(rejectedNoPlayers, `Cannot create Round 1 with 0 registered players`);

    // Register 1 player
    const player1 = await User.create({
      name: 'Single Player',
      email: `${testPrefix}_p1@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: 'p1_lic',
      lichessUserId: 'p1_lic',
    });
    createdUserIds.push(player1._id);
    await TournamentPlayer.create({ tournamentId: koTournament._id, userId: player1._id });

    let rejectedOnePlayer = false;
    try {
      await roundService.createRound(koTournament._id, devHost._id);
    } catch (err) {
      rejectedOnePlayer = err.statusCode === 400 && err.message.includes('At least 2 players are required');
    }
    assert(rejectedOnePlayer, `Cannot create Round 1 with only 1 registered player`);

    // =========================================================================
    // SECTION 3: Full 6-Player Knockout Tournament (BYEs + Round Progression + Final)
    // =========================================================================
    console.log('\n--- SECTION 3: Full 6-Player Knockout Simulation (8-slot bracket, 2 BYEs) ---');

    // Register 5 more players (total 6)
    const players6 = [player1];
    for (let i = 2; i <= 6; i++) {
      const p = await User.create({
        name: `KO Player ${i}`,
        email: `${testPrefix}_p${i}@chessjeeno.local`,
        passwordHash: 'dummy_hash',
        authProvider: 'local',
        lichessUsername: `p${i}_lic`,
        lichessUserId: `p${i}_lic`,
      });
      createdUserIds.push(p._id);
      await TournamentPlayer.create({ tournamentId: koTournament._id, userId: p._id });
      players6.push(p);
    }

    // Create Round 1
    const r1Result = await roundService.createRound(koTournament._id, devHost._id);
    assert(r1Result.round.roundNumber === 1, `Round 1 created`);
    assert(r1Result.round.stageName === 'Quarterfinals', `Round 1 stageName is Quarterfinals`);
    assert(r1Result.pairings.length === 4, `Quarterfinals has 4 pairings (for 8-slot bracket)`);

    // Verify tournament updated with derived totalRounds = 3
    const tourneyAfterR1 = await Tournament.findById(koTournament._id);
    assert(tourneyAfterR1.totalRounds === 3, `Tournament totalRounds dynamically set to 3`);

    // Verify BYE matches in Round 1
    const byePairings = r1Result.pairings.filter((p) => p.status === 'BYE');
    const actualPairings = r1Result.pairings.filter((p) => p.status !== 'BYE');
    assert(byePairings.length === 2, `Exactly 2 BYE pairings created in Round 1`);
    assert(actualPairings.length === 2, `Exactly 2 actual matches created in Round 1`);

    // Verify creating Lichess game for a BYE pairing is rejected
    let rejectedByeLichess = false;
    try {
      await pairingService.createLichessGameForPairing(koTournament._id, 1, byePairings[0]._id, devHost._id);
    } catch (err) {
      rejectedByeLichess = err.statusCode === 400 && err.message.includes('BYE');
    }
    assert(rejectedByeLichess, `Cannot create Lichess game for a BYE pairing`);

    // Verify creating Round 2 while Round 1 has incomplete actual matches is rejected
    let rejectedR2Incomplete = false;
    try {
      await roundService.createRound(koTournament._id, devHost._id);
    } catch (err) {
      rejectedR2Incomplete = err.statusCode === 400 && err.message.includes('not complete');
    }
    assert(rejectedR2Incomplete, `Cannot create Round 2 while Round 1 actual matches are incomplete`);

    // Complete Match 1 of actual pairings (White wins: 1-0)
    await Pairing.findByIdAndUpdate(actualPairings[0]._id, {
      status: 'FINISHED',
      result: '1-0',
    });

    // Still blocked because Match 2 is pending
    let rejectedR2StillIncomplete = false;
    try {
      await roundService.createRound(koTournament._id, devHost._id);
    } catch (err) {
      rejectedR2StillIncomplete = err.statusCode === 400;
    }
    assert(rejectedR2StillIncomplete, `Round 2 still blocked with 1 unfinished match`);

    // Complete Match 2 of actual pairings (Black wins: 0-1)
    await Pairing.findByIdAndUpdate(actualPairings[1]._id, {
      status: 'FINISHED',
      result: '0-1',
    });

    // Verify Round 1 status is now complete
    const r1Status = await roundService.getRoundCompletionStatus(koTournament._id, 1);
    assert(r1Status.isComplete === true, `Round 1 is complete once all actual matches finish`);

    // Create Round 2 (Semifinals)
    const r2Result = await roundService.createRound(koTournament._id, devHost._id);
    assert(r2Result.round.roundNumber === 2, `Round 2 created`);
    assert(r2Result.round.stageName === 'Semifinals', `Round 2 stageName is Semifinals`);
    assert(r2Result.pairings.length === 2, `Semifinals has 2 pairings`);

    // Verify Semifinals pairings contain exactly the winners from Round 1
    // Round 1 pairings:
    // P[0] (Seed 1 vs BYE) -> Winner: Seed 1 (players6[0])
    // P[1] (Seed 4 vs Seed 5) -> Actual match 0. White won -> Winner: Seed 4
    // P[2] (Seed 2 vs BYE) -> Winner: Seed 2 (players6[1])
    // P[3] (Seed 3 vs Seed 6) -> Actual match 1. Black won -> Winner: Seed 6
    const expectedSemisWhite0 = r1Result.pairings[0].whitePlayer._id.toString();
    const expectedSemisBlack0 = r1Result.pairings[1].whitePlayer._id.toString(); // white won match 0
    const expectedSemisWhite1 = r1Result.pairings[2].whitePlayer._id.toString();
    const expectedSemisBlack1 = r1Result.pairings[3].blackPlayer._id.toString(); // black won match 1

    const semi1 = r2Result.pairings[0];
    const semi2 = r2Result.pairings[1];

    const semi1Players = new Set([semi1.whitePlayer._id.toString(), semi1.blackPlayer._id.toString()]);
    const semi2Players = new Set([semi2.whitePlayer._id.toString(), semi2.blackPlayer._id.toString()]);

    assert(
      semi1Players.has(expectedSemisWhite0) && semi1Players.has(expectedSemisBlack0),
      `Semifinal 1 correctly pairs winner of match 1 with winner of match 2`
    );
    assert(
      semi2Players.has(expectedSemisWhite1) && semi2Players.has(expectedSemisBlack1),
      `Semifinal 2 correctly pairs winner of match 3 with winner of match 4`
    );

    // Complete Semifinals
    // Semi 1: White wins (Seed 1 advances)
    await Pairing.findByIdAndUpdate(semi1._id, { status: 'FINISHED', result: '1-0' });
    // Semi 2: Black wins (Seed 6 advances)
    await Pairing.findByIdAndUpdate(semi2._id, { status: 'FINISHED', result: '0-1' });

    // Verify Round 2 status is complete
    const r2Status = await roundService.getRoundCompletionStatus(koTournament._id, 2);
    assert(r2Status.isComplete === true, `Round 2 (Semifinals) is complete`);

    // Create Round 3 (Final)
    const r3Result = await roundService.createRound(koTournament._id, devHost._id);
    assert(r3Result.round.roundNumber === 3, `Round 3 created`);
    assert(r3Result.round.stageName === 'Final', `Round 3 stageName is Final`);
    assert(r3Result.pairings.length === 1, `Final has exactly 1 pairing`);

    const finalMatch = r3Result.pairings[0];
    const semi1Winner = semi1.whitePlayer._id.toString();
    const semi2Winner = semi2.blackPlayer._id.toString();
    const finalPlayers = new Set([finalMatch.whitePlayer._id.toString(), finalMatch.blackPlayer._id.toString()]);
    assert(
      finalPlayers.has(semi1Winner),
      `Finalist 1 is winner of Semifinal 1`
    );
    assert(
      finalPlayers.has(semi2Winner),
      `Finalist 2 is winner of Semifinal 2`
    );

    // Complete Final (White wins: 1-0)
    await Pairing.findByIdAndUpdate(finalMatch._id, { status: 'FINISHED', result: '1-0' });

    // Trigger round completion status check
    const r3Status = await roundService.getRoundCompletionStatus(koTournament._id, 3);
    assert(r3Status.isComplete === true, `Round 3 (Final) is complete`);

    // Verify Tournament state: FINISHED and winnerPlayer set!
    const finalTourney = await Tournament.findById(koTournament._id);
    assert(finalTourney.status === 'FINISHED', `Tournament status is FINISHED after final round`);
    assert(
      finalTourney.winnerPlayer && finalTourney.winnerPlayer.toString() === finalMatch.whitePlayer._id.toString(),
      `Tournament winnerPlayer is correctly set to champion (${finalMatch.whitePlayer._id})`
    );

    // Verify creating another round after final is rejected
    let rejectedPostFinal = false;
    try {
      await roundService.createRound(koTournament._id, devHost._id);
    } catch (err) {
      rejectedPostFinal = err.statusCode === 400;
    }
    assert(rejectedPostFinal, `Creating another round after Final is rejected with 400`);

    // =========================================================================
    // SECTION 4: 2-Player Knockout Tournament (Direct to Final)
    // =========================================================================
    console.log('\n--- SECTION 4: 2-Player Knockout Tournament (Direct to Final) ---');

    const tourney2 = await tournamentService.createTournament(
      {
        name: 'Direct Final Cup',
        format: 'KNOCKOUT',
        clockLimit: 300,
        increment: 0,
      },
      devHost._id
    );
    createdTournamentIds.push(tourney2._id);

    await TournamentPlayer.create({ tournamentId: tourney2._id, userId: players6[0]._id });
    await TournamentPlayer.create({ tournamentId: tourney2._id, userId: players6[1]._id });

    const directFinalResult = await roundService.createRound(tourney2._id, devHost._id);
    assert(directFinalResult.round.roundNumber === 1, `2-player tournament starts at Round 1`);
    assert(directFinalResult.round.stageName === 'Final', `2-player tournament Round 1 is immediately named "Final"`);
    assert(directFinalResult.pairings.length === 1, `2-player tournament has exactly 1 match`);
    assert(directFinalResult.pairings[0].status === 'PENDING', `Match is PENDING`);
    assert(!directFinalResult.pairings[0].isBye, `No BYE for 2 players`);

    // Complete the match
    await Pairing.findByIdAndUpdate(directFinalResult.pairings[0]._id, {
      status: 'FINISHED',
      result: '0-1',
    });

    await roundService.getRoundCompletionStatus(tourney2._id, 1);
    const tourney2Finished = await Tournament.findById(tourney2._id);
    assert(tourney2Finished.status === 'FINISHED', `2-player tournament transitions to FINISHED after 1 round`);
    assert(
      tourney2Finished.winnerPlayer.toString() === players6[1]._id.toString(),
      `2-player tournament champion is correctly stored`
    );

    // =========================================================================
    // SECTION 5: 3-Player Knockout Tournament (1 BYE, Semifinals -> Final)
    // =========================================================================
    console.log('\n--- SECTION 5: 3-Player Knockout Tournament (1 BYE) ---');

    const tourney3 = await tournamentService.createTournament(
      {
        name: '3-Player Cup',
        format: 'KNOCKOUT',
        clockLimit: 300,
        increment: 0,
      },
      devHost._id
    );
    createdTournamentIds.push(tourney3._id);

    await TournamentPlayer.create({ tournamentId: tourney3._id, userId: players6[0]._id });
    await TournamentPlayer.create({ tournamentId: tourney3._id, userId: players6[1]._id });
    await TournamentPlayer.create({ tournamentId: tourney3._id, userId: players6[2]._id });

    const r1Result3 = await roundService.createRound(tourney3._id, devHost._id);
    assert(r1Result3.round.stageName === 'Semifinals', `3-player tournament stage 1 is Semifinals`);
    assert(r1Result3.pairings.length === 2, `3-player tournament has 2 pairings in Semifinals`);

    // Pairing 0 is Seed 1 vs BYE
    const pBye3 = r1Result3.pairings.find((p) => p.status === 'BYE');
    const pActual3 = r1Result3.pairings.find((p) => p.status !== 'BYE');
    assert(pBye3 !== undefined, `BYE pairing present`);
    assert(pActual3 !== undefined, `Actual pairing present`);
    assert(pBye3.whitePlayer._id.toString() === players6[0]._id.toString(), `Seed 1 awarded the BYE`);

    // Finish actual match (White wins)
    await Pairing.findByIdAndUpdate(pActual3._id, { status: 'FINISHED', result: '1-0' });
    await roundService.getRoundCompletionStatus(tourney3._id, 1);

    // Create Round 2 (Final)
    const r2Result3 = await roundService.createRound(tourney3._id, devHost._id);
    assert(r2Result3.round.stageName === 'Final', `Round 2 is Final`);
    assert(r2Result3.pairings.length === 1, `Final has 1 match`);
    assert(
      r2Result3.pairings[0].whitePlayer._id.toString() === players6[0]._id.toString(),
      `BYE recipient advanced to Final`
    );

    // Complete Final
    await Pairing.findByIdAndUpdate(r2Result3.pairings[0]._id, { status: 'FINISHED', result: '1-0' });
    await roundService.getRoundCompletionStatus(tourney3._id, 2);
    const tourney3Finished = await Tournament.findById(tourney3._id);
    assert(tourney3Finished.status === 'FINISHED', `3-player tournament marked FINISHED`);
    assert(
      tourney3Finished.winnerPlayer.toString() === players6[0]._id.toString(),
      `Seed 1 is champion after advancing through BYE and winning Final`
    );

    // =========================================================================
    // SECTION 6: Standings Endpoint Compatibility
    // =========================================================================
    console.log('\n--- SECTION 6: Standings Endpoint Compatibility ---');
    const standingsData = await standingsService.getTournamentStandings(koTournament._id);
    assert(Array.isArray(standingsData.standings), `Standings endpoint returns an array for Knockout tournaments`);
    assert(standingsData.standings.length === 6, `Standings array includes all 6 registered players`);

    console.log(`\n🎉 All Knockout Tournament Unit & Integration Tests Passed (${passedTests}/${totalTests})!`);
  } finally {
    console.log('\n🧹 Cleaning up test data...');
    if (createdTournamentIds.length > 0) {
      await Pairing.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Round.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('✨ Cleanup complete.');
    await mongoose.connection.close();
  }
};

runKnockoutTests().catch((err) => {
  console.error('💥 Knockout tests failed with uncaught exception:', err);
  process.exit(1);
});
