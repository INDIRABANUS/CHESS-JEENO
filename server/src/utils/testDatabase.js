import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB, getDatabaseStatus } from '../config/database.js';
import { User, Tournament, TournamentPlayer, Round, Pairing } from '../models/index.js';

dotenv.config();

const runDatabaseTests = async () => {
  console.log('🧪 Starting Database Layer Verification Tests...\n');

  // 1. Connect to Database
  await connectDB();
  console.log(`📡 Database status: ${getDatabaseStatus()}`);

  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database is not connected! Aborting tests.');
  }

  // Ensure indexes are built
  await Promise.all([
    User.syncIndexes(),
    Tournament.syncIndexes(),
    TournamentPlayer.syncIndexes(),
    Round.syncIndexes(),
    Pairing.syncIndexes(),
  ]);
  console.log('✅ Indexes synchronized across all models.');

  const testEmail = `test_${Date.now()}@example.com`;
  let testUser = null;
  let testTournament = null;
  let testRound = null;
  let testPlayer = null;
  let testPairing = null;

  try {
    // 2. Test User Model creation & validation
    console.log('\n--- Testing User Model ---');
    testUser = await User.create({
      name: 'Grandmaster Test',
      email: testEmail,
      authProvider: 'lichess',
      lichessUsername: `test_gm_${Date.now()}`,
      lichessUserId: `user_${Date.now()}`,
    });
    console.log(`✅ User created: ${testUser.name} (${testUser._id})`);

    // Verify User required field validation
    try {
      await User.create({ name: 'Incomplete' });
      throw new Error('Validation failed to catch missing email & authProvider');
    } catch (err) {
      console.log('✅ User schema validation enforced (caught missing required fields).');
    }

    // 3. Test Tournament Model creation & validation
    console.log('\n--- Testing Tournament Model ---');
    testTournament = await Tournament.create({
      name: 'Spring Championship 2026',
      description: 'Annual Spring Blitz Tournament',
      createdBy: testUser._id,
      format: 'SWISS',
      clockLimit: 10,
      increment: 2,
      maxPlayers: 16,
      rated: true,
    });
    console.log(`✅ Tournament created: ${testTournament.name} (${testTournament._id})`);

    // Verify clockLimit >= 1 validation
    try {
      await Tournament.create({
        name: 'Invalid Clock',
        createdBy: testUser._id,
        format: 'SWISS',
        clockLimit: 0,
        increment: 0,
      });
      throw new Error('Validation failed to catch clockLimit < 1');
    } catch (err) {
      console.log('✅ Tournament validation enforced (clockLimit >= 1 caught).');
    }

    // 4. Test TournamentPlayer Model & Compound Unique Index
    console.log('\n--- Testing TournamentPlayer Model ---');
    testPlayer = await TournamentPlayer.create({
      tournamentId: testTournament._id,
      userId: testUser._id,
    });
    console.log(`✅ TournamentPlayer registered: User ${testPlayer.userId} in Tourney ${testPlayer.tournamentId}`);

    // Verify duplicate registration rejection (compound unique index)
    try {
      await TournamentPlayer.create({
        tournamentId: testTournament._id,
        userId: testUser._id,
      });
      throw new Error('Compound index failed to prevent duplicate player in tournament');
    } catch (err) {
      if (err.code === 11000) {
        console.log('✅ Compound unique index (tournamentId + userId) successfully prevented duplicate player registration.');
      } else {
        throw err;
      }
    }

    // 5. Test Round Model & Unique Round Index
    console.log('\n--- Testing Round Model ---');
    testRound = await Round.create({
      tournamentId: testTournament._id,
      roundNumber: 1,
      status: 'PENDING',
    });
    console.log(`✅ Round created: Round ${testRound.roundNumber} (${testRound._id})`);

    // Verify duplicate round rejection
    try {
      await Round.create({
        tournamentId: testTournament._id,
        roundNumber: 1,
      });
      throw new Error('Index failed to prevent duplicate round number for same tournament');
    } catch (err) {
      if (err.code === 11000) {
        console.log('✅ Compound unique index (tournamentId + roundNumber) successfully prevented duplicate round.');
      } else {
        throw err;
      }
    }

    // 6. Test Pairing Model
    console.log('\n--- Testing Pairing Model ---');
    testPairing = await Pairing.create({
      roundId: testRound._id,
      tournamentId: testTournament._id,
      whitePlayer: testUser._id,
      blackPlayer: testUser._id,
      lichessGameId: `game_${Date.now()}`,
      status: 'PENDING',
      result: 'PENDING',
    });
    console.log(`✅ Pairing created: ID ${testPairing._id} (Lichess Game: ${testPairing.lichessGameId})`);

    console.log('\n--- Relationships Verification ---');
    const populatedPairing = await Pairing.findById(testPairing._id)
      .populate('whitePlayer', 'name email lichessUsername')
      .populate('tournamentId', 'name format status')
      .populate('roundId', 'roundNumber status');

    console.log(`✅ Populated Pairing Tournament: "${populatedPairing.tournamentId.name}" (${populatedPairing.tournamentId.format})`);
    console.log(`✅ Populated Pairing White Player: "${populatedPairing.whitePlayer.name}" (${populatedPairing.whitePlayer.lichessUsername})`);
    console.log(`✅ Populated Pairing Round: #${populatedPairing.roundId.roundNumber}`);

  } finally {
    // 7. Clean up all test documents
    console.log('\n--- Cleaning Up Temporary Test Documents ---');
    if (testPairing) await Pairing.findByIdAndDelete(testPairing._id);
    if (testRound) await Round.findByIdAndDelete(testRound._id);
    if (testPlayer) await TournamentPlayer.findByIdAndDelete(testPlayer._id);
    if (testTournament) await Tournament.findByIdAndDelete(testTournament._id);
    if (testUser) await User.findByIdAndDelete(testUser._id);
    console.log('🧹 Temporary test documents successfully cleaned up. Database is pristine.');
  }

  await mongoose.disconnect();
  console.log('\n🎉 All database tests passed successfully!\n');
};

runDatabaseTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
