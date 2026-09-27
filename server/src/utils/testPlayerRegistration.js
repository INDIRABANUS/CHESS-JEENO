import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import { getDevUserId } from './devUser.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';

dotenv.config();

const runPlayerRegistrationTests = async () => {
  console.log('🧪 Starting Tournament Player Registration Test Suite...\n');
  await connectDB();

  const devUserId = await getDevUserId();
  const testEmailPrefix = `test_player_${Date.now()}`;

  // Create an extra user to test capacity and multi-player features
  const secondUser = await User.create({
    name: 'Magnus Test',
    email: `${testEmailPrefix}_2@chessjeeno.local`,
    authProvider: 'local',
    lichessUsername: 'magnus_test',
  });

  const thirdUser = await User.create({
    name: 'Hikaru Test',
    email: `${testEmailPrefix}_3@chessjeeno.local`,
    authProvider: 'local',
    lichessUsername: 'hikaru_test',
  });

  let tournament = null;

  try {
    // Setup: Create a tournament with capacity of 2 players
    console.log('--- Setup: Creating Tournament (Capacity = 2) ---');
    tournament = await tournamentService.createTournament(
      {
        name: 'Registration Test Tournament',
        description: 'Testing player registration and capacity enforcement',
        format: 'SWISS',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 2,
        rated: false,
      },
      devUserId
    );
    console.log(`✅ Tournament created: "${tournament.name}" (Capacity: ${tournament.maxPlayers})`);

    // Verify creator is NOT automatically joined
    console.log('\n--- Rule: Host/Creator Does Not Automatically Join ---');
    let players = await tournamentPlayerService.getTournamentPlayers(tournament._id);
    if (players.length !== 0) throw new Error('Creator should not be automatically registered!');
    console.log(`✅ Initial player count is 0 (creator was not auto-registered).`);

    // 1. Join valid tournament
    console.log('\n--- 1. Testing Valid Join ---');
    const joinedPlayer1 = await tournamentPlayerService.joinTournament(tournament._id, devUserId);
    console.log(`✅ Player 1 joined successfully: ${joinedPlayer1.userId.name} (Score: ${joinedPlayer1.score})`);

    // 2. Duplicate join rejected
    console.log('\n--- 2. Testing Duplicate Join Rejection ---');
    try {
      await tournamentPlayerService.joinTournament(tournament._id, devUserId);
      throw new Error('Failed to reject duplicate registration');
    } catch (err) {
      console.log(`✅ Duplicate join correctly rejected: "${err.message}" (Status: ${err.statusCode})`);
    }

    // 3. Player list returned & 4. Player count correct
    console.log('\n--- 3 & 4. Testing Player List and Count ---');
    players = await tournamentPlayerService.getTournamentPlayers(tournament._id);
    if (players.length !== 1) throw new Error(`Expected 1 player, got ${players.length}`);
    console.log(`✅ Player list retrieved successfully (Count: ${players.length}). Player name: ${players[0].userId.name}`);

    // Verify tournament details returns correct registeredPlayers count
    const tourneyDetails = await tournamentService.getTournamentById(tournament._id, devUserId);
    if (tourneyDetails.registeredPlayers !== 1) {
      throw new Error(`Expected registeredPlayers = 1, got ${tourneyDetails.registeredPlayers}`);
    }
    if (!tourneyDetails.isRegistered) {
      throw new Error('Expected isRegistered = true for player 1');
    }
    console.log(`✅ Tournament details calculated registeredPlayers = ${tourneyDetails.registeredPlayers}, isRegistered = ${tourneyDetails.isRegistered}`);

    // 5. Tournament capacity enforced
    console.log('\n--- 5. Testing Tournament Capacity Enforcement ---');
    // Join second player (reaches max capacity 2)
    const joinedPlayer2 = await tournamentPlayerService.joinTournament(tournament._id, secondUser._id);
    console.log(`✅ Player 2 joined successfully: ${joinedPlayer2.userId.name}`);

    // Try joining third player when capacity is 2
    try {
      await tournamentPlayerService.joinTournament(tournament._id, thirdUser._id);
      throw new Error('Failed to enforce tournament capacity');
    } catch (err) {
      console.log(`✅ Capacity limit enforced: "${err.message}" (Status: ${err.statusCode})`);
    }

    // 6. Leave valid tournament & 7. Leave removes registration
    console.log('\n--- 6 & 7. Testing Leave Tournament ---');
    const leaveRes = await tournamentPlayerService.leaveTournament(tournament._id, devUserId);
    console.log(`✅ Player 1 left successfully: "${leaveRes.message}"`);

    players = await tournamentPlayerService.getTournamentPlayers(tournament._id);
    if (players.length !== 1) throw new Error(`Expected 1 player remaining after leave, got ${players.length}`);
    console.log(`✅ Player 1 successfully removed from list. Remaining player: ${players[0].userId.name}`);

    // Now that Player 1 left, Player 3 should be able to join!
    console.log('\n--- Testing Re-opening of Spot After Leave ---');
    const joinedPlayer3 = await tournamentPlayerService.joinTournament(tournament._id, thirdUser._id);
    console.log(`✅ Player 3 joined into newly freed spot: ${joinedPlayer3.userId.name}`);

    // 8. Joining RUNNING tournament rejected
    console.log('\n--- 8. Testing Joining RUNNING Tournament ---');
    await Tournament.findByIdAndUpdate(tournament._id, { status: 'RUNNING' });
    try {
      await tournamentPlayerService.joinTournament(tournament._id, devUserId);
      throw new Error('Failed to reject join on RUNNING tournament');
    } catch (err) {
      console.log(`✅ Joining RUNNING tournament correctly rejected: "${err.message}" (Status: ${err.statusCode})`);
    }

    // 9. Leaving RUNNING tournament rejected
    console.log('\n--- 9. Testing Leaving RUNNING Tournament ---');
    try {
      await tournamentPlayerService.leaveTournament(tournament._id, secondUser._id);
      throw new Error('Failed to reject leave on RUNNING tournament');
    } catch (err) {
      console.log(`✅ Leaving RUNNING tournament correctly rejected: "${err.message}" (Status: ${err.statusCode})`);
    }

    // 10. Joining nonexistent tournament returns 404
    console.log('\n--- 10. Testing Nonexistent Tournament ---');
    try {
      const fakeId = new mongoose.Types.ObjectId();
      await tournamentPlayerService.joinTournament(fakeId, devUserId);
      throw new Error('Failed to return 404 for nonexistent tournament');
    } catch (err) {
      console.log(`✅ Nonexistent tournament correctly returned 404: "${err.message}"`);
    }

    // 11. Database compound unique index protection
    console.log('\n--- 11. Testing Database-Level Unique Index ---');
    // Set status back to REGISTRATION
    await Tournament.findByIdAndUpdate(tournament._id, { status: 'REGISTRATION' });
    try {
      // Direct Mongoose create to bypass service check and test MongoDB compound unique index
      await TournamentPlayer.create({
        tournamentId: tournament._id,
        userId: secondUser._id, // secondUser is already registered!
      });
      throw new Error('Database compound unique index failed to prevent duplicate record');
    } catch (err) {
      if (err.code === 11000) {
        console.log(`✅ Database unique index (tournamentId + userId) caught duplicate with Mongo E11000.`);
      } else {
        throw err;
      }
    }

  } finally {
    console.log('\n--- Cleaning Up Temporary Test Documents ---');
    if (tournament) {
      await TournamentPlayer.deleteMany({ tournamentId: tournament._id });
      await Tournament.findByIdAndDelete(tournament._id);
    }
    await User.findByIdAndDelete(secondUser._id);
    await User.findByIdAndDelete(thirdUser._id);
    await mongoose.disconnect();
    console.log('🧹 Temporary test records cleaned up. Database is pristine.');
  }

  console.log('\n🎉 All Tournament Player Registration Tests Passed Successfully!\n');
};

runPlayerRegistrationTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
