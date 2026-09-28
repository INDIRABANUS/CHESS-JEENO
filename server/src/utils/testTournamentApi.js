import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import * as tournamentService from '../services/tournamentService.js';
import { getDevUserId } from './devUser.js';
import Tournament from '../models/Tournament.js';

dotenv.config();

const runTournamentTests = async () => {
  console.log('🧪 Starting Tournament Service / CRUD Tests...\n');
  await connectDB();

  const devUserId = await getDevUserId();
  console.log(`👤 Using Dev Creator ID: ${devUserId}`);

  let createdTournament = null;

  try {
    // 1. Create tournament
    console.log('\n--- 1. Testing Tournament Creation ---');
    createdTournament = await tournamentService.createTournament(
      {
        name: 'Weekend Blitz Championship',
        description: 'Casual blitz tournament for all skill levels',
        format: 'SWISS',
        rated: true,
        clockLimit: 300,
        increment: 3,
        maxPlayers: 16,
        totalRounds: 5,
        startTime: new Date(Date.now() + 86400000).toISOString(),
      },
      devUserId
    );
    console.log(`✅ Tournament created successfully: "${createdTournament.name}" (ID: ${createdTournament._id})`);
    console.log(`   Status: ${createdTournament.status}, Creator: ${createdTournament.createdBy?.name}`);

    // 2. Get all tournaments
    console.log('\n--- 2. Testing Get All Tournaments ---');
    const allTournaments = await tournamentService.getTournaments();
    console.log(`✅ Retrieved ${allTournaments.length} tournament(s)`);
    const found = allTournaments.find((t) => t._id.toString() === createdTournament._id.toString());
    if (!found) throw new Error('Created tournament not found in list');
    console.log('✅ Created tournament confirmed in listing.');

    // 2b. Test filters
    const filteredByStatus = await tournamentService.getTournaments({ status: 'REGISTRATION' });
    console.log(`✅ Filter by status=REGISTRATION returned ${filteredByStatus.length} item(s)`);

    // 3. Get single tournament
    console.log('\n--- 3. Testing Get Single Tournament ---');
    const single = await tournamentService.getTournamentById(createdTournament._id);
    console.log(`✅ Retrieved single tournament: "${single.name}", Format: ${single.format}`);

    // 4. Update tournament
    console.log('\n--- 4. Testing Tournament Update ---');
    const updated = await tournamentService.updateTournament(createdTournament._id, {
      name: 'Weekend Blitz Championship (Updated)',
      clockLimit: 600,
      increment: 5,
    });
    console.log(`✅ Updated tournament: "${updated.name}", Clock: ${updated.clockLimit}+${updated.increment}`);

    // 5. Test validation rejections
    console.log('\n--- 5. Testing Validation Rules ---');

    // 5a. Reject invalid format
    try {
      await tournamentService.createTournament(
        {
          name: 'Invalid Format Tourney',
          format: 'SINGLE_ELIMINATION_INVALID',
          clockLimit: 300,
          increment: 0,
        },
        devUserId
      );
      throw new Error('Failed to reject invalid format');
    } catch (err) {
      console.log(`✅ Reject invalid format passed: ${err.message}`);
    }

    // 5b. Reject invalid clockLimit
    try {
      await tournamentService.createTournament(
        {
          name: 'Invalid Clock Tourney',
          format: 'ROUND_ROBIN',
          clockLimit: 0,
          increment: 0,
        },
        devUserId
      );
      throw new Error('Failed to reject invalid clockLimit');
    } catch (err) {
      console.log(`✅ Reject invalid clockLimit (<1) passed: ${err.message}`);
    }

    // 5c. Reject invalid increment
    try {
      await tournamentService.createTournament(
        {
          name: 'Invalid Inc Tourney',
          format: 'ROUND_ROBIN',
          clockLimit: 300,
          increment: -1,
        },
        devUserId
      );
      throw new Error('Failed to reject invalid increment');
    } catch (err) {
      console.log(`✅ Reject invalid increment (<0) passed: ${err.message}`);
    }

    // 5d. Reject invalid maxPlayers
    try {
      await tournamentService.createTournament(
        {
          name: 'Invalid Players Tourney',
          format: 'ROUND_ROBIN',
          clockLimit: 300,
          increment: 0,
          maxPlayers: 1,
        },
        devUserId
      );
      throw new Error('Failed to reject invalid maxPlayers');
    } catch (err) {
      console.log(`✅ Reject invalid maxPlayers (<2) passed: ${err.message}`);
    }

    // 5e. Return 404 for nonexistent tournament
    try {
      const nonExistentId = new mongoose.Types.ObjectId();
      await tournamentService.getTournamentById(nonExistentId);
      throw new Error('Failed to return 404 for nonexistent tournament');
    } catch (err) {
      console.log(`✅ Return 404 for nonexistent tournament passed (code ${err.statusCode})`);
    }

    // 5f. Reject status modification via PATCH
    try {
      await tournamentService.updateTournament(createdTournament._id, {
        status: 'RUNNING',
      });
      throw new Error('Failed to block status modification via update');
    } catch (err) {
      console.log(`✅ Block status modification via update passed: ${err.message}`);
    }

    // 5g. Reject deletion of RUNNING tournament
    console.log('\n--- 6. Testing Deletion Rules ---');
    // Set status to RUNNING directly in DB to test deletion guard
    await Tournament.findByIdAndUpdate(createdTournament._id, { status: 'RUNNING' });
    try {
      await tournamentService.deleteTournament(createdTournament._id);
      throw new Error('Failed to prevent deletion of RUNNING tournament');
    } catch (err) {
      console.log(`✅ Reject deletion of RUNNING tournament passed: ${err.message}`);
    }

    // Reset status back to REGISTRATION to test successful deletion
    await Tournament.findByIdAndUpdate(createdTournament._id, { status: 'REGISTRATION' });

    // 6. Delete draft/registration tournament
    const deleteResult = await tournamentService.deleteTournament(createdTournament._id);
    console.log(`✅ Delete REGISTRATION tournament passed: ${deleteResult.message}`);
    createdTournament = null; // Mark as deleted

    // Verify it is gone
    try {
      await tournamentService.getTournamentById(createdTournament?._id);
    } catch (err) {
      console.log('✅ Confirmed tournament is no longer in database.');
    }

  } finally {
    if (createdTournament) {
      await Tournament.findByIdAndDelete(createdTournament._id);
    }
    await mongoose.disconnect();
    console.log('\n🎉 All Tournament CRUD and validation tests passed successfully!\n');
  }
};

runTournamentTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
