import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  Tournament,
  TournamentPlayer,
  TournamentJoinRequest,
  Round,
  Pairing,
  Notification,
  User,
} from '../models/index.js';
import { connectDB } from '../config/database.js';

// Resolve environment configuration regardless of invocation directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

/**
 * ==============================================================================
 * CHESS JEENO - SAFE TEST TOURNAMENT CLEANUP UTILITY
 * ==============================================================================
 *
 * CRITICAL SAFETY INVARIANTS:
 * 1. Default mode is STRICT DRY RUN. Zero mutations occur without --confirm-delete.
 * 2. Hardcoded Allowlist: Only the 9 user-confirmed test tournament IDs are allowed.
 * 3. Hardcoded Denylist: "BIT 2026" and "Blitz" (and any non-allowlisted ID) are strictly protected.
 * 4. Pre-flight Verification: Every candidate ID is queried and name-matched before deletion.
 * 5. Atomic Execution: Uses a MongoDB multi-document transaction (session.withTransaction).
 *    If the MongoDB deployment does not support transactions (e.g. non-replica local mongod),
 *    the script ABORTS cleanly rather than performing non-atomic partial deletions.
 * 6. Cascades safely to all child models:
 *    - TournamentPlayer       (filter: tournamentId)
 *    - TournamentJoinRequest  (filter: tournament)
 *    - Round                  (filter: tournamentId)
 *    - Pairing                (filter: tournamentId)
 *    - Notification           (filter: tournament, round, pairing)
 * 7. Strictly PRESERVES User records and external Lichess games.
 * ==============================================================================
 */

/**
 * The 9 user-confirmed candidate test tournaments.
 * Format: { id: string, expectedName: string }
 */
export const APPROVED_TEST_TOURNAMENTS = Object.freeze([
  { id: '6ac529a490b505af0a342da5', expectedName: 'Notification test' },
  { id: '6abe02bde140ab6a47440081', expectedName: 'TEST O' },
  { id: '6abd3aff2be6bc1b7635f89e', expectedName: 'ELEMINATION TEST' },
  { id: '6abd1ed909cdc0394fa267c5', expectedName: 'ABORTED TEST' },
  { id: '6abd10845414389a5f979a9e', expectedName: 'Test Rated 1' },
  { id: '6abcfd4512367cac8f572442', expectedName: 'TEST 2 B' },
  { id: '6abcdfe75dd3f3358556dcfd', expectedName: 'TEST 2' },
  { id: '6abb6498da480627e483d32f', expectedName: 'TEST PHASE 1' },
  { id: '6aba54745fa3d5422482b4fc', expectedName: 'BIT TEST 2' },
]);

/**
 * Explicit protected tournament IDs that must NEVER be touched under any circumstances.
 */
export const PROTECTED_TOURNAMENT_IDS = Object.freeze(
  new Set([
    '6aba397c5c5bb408be9083a0', // BIT 2026
    '6ad215e2a14384add9d00691', // Blitz (Real User Tournament)
  ])
);

/**
 * Analyzes target tournaments and calculates all dependent documents.
 * Safe, read-only inspection.
 *
 * @param {Array<{ id: string, expectedName: string }>} candidates
 * @returns {Promise<Object>} Inspection summary
 */
export const inspectCandidateTournaments = async (candidates = APPROVED_TEST_TOURNAMENTS) => {
  const allowlistMap = new Map(candidates.map((c) => [c.id, c.expectedName]));
  const targetObjectIds = [];

  for (const candidate of candidates) {
    if (!mongoose.isValidObjectId(candidate.id)) {
      throw new Error(`Invalid ObjectId in candidate list: ${candidate.id}`);
    }
    if (PROTECTED_TOURNAMENT_IDS.has(candidate.id)) {
      throw new Error(
        `CRITICAL SAFETY VIOLATION: Candidate ${candidate.id} (${candidate.expectedName}) is in the protected list!`
      );
    }
    targetObjectIds.push(new mongoose.Types.ObjectId(candidate.id));
  }

  // 1. Fetch tournaments from DB
  const foundTournaments = await Tournament.find({ _id: { $in: targetObjectIds } })
    .populate('createdBy', 'name email role')
    .lean();

  if (foundTournaments.length !== candidates.length) {
    const foundIds = new Set(foundTournaments.map((t) => t._id.toString()));
    const missing = candidates.filter((c) => !foundIds.has(c.id));
    throw new Error(
      `Pre-flight check failed: Expected ${candidates.length} tournaments, but found ${
        foundTournaments.length
      }. Missing IDs: ${missing.map((m) => `${m.id} ("${m.expectedName}")`).join(', ')}`
    );
  }

  // 2. Validate exact name matching
  for (const t of foundTournaments) {
    const tId = t._id.toString();
    const expectedName = allowlistMap.get(tId);
    if (t.name !== expectedName) {
      throw new Error(
        `Pre-flight name mismatch for tournament ID ${tId}: expected "${expectedName}", but database record is named "${t.name}". Aborting.`
      );
    }
  }

  // 3. Inspect related Rounds
  const relatedRounds = await Round.find({ tournamentId: { $in: targetObjectIds } })
    .select('_id tournamentId roundNumber status')
    .lean();
  const roundObjectIds = relatedRounds.map((r) => r._id);

  // 4. Inspect related Pairings
  const relatedPairings = await Pairing.find({ tournamentId: { $in: targetObjectIds } })
    .select('_id tournamentId roundId lichessGameId status result')
    .lean();
  const pairingObjectIds = relatedPairings.map((p) => p._id);
  const lichessGameIds = relatedPairings
    .filter((p) => Boolean(p.lichessGameId))
    .map((p) => p.lichessGameId);

  // 5. Inspect related TournamentPlayers
  const relatedPlayers = await TournamentPlayer.find({ tournamentId: { $in: targetObjectIds } })
    .select('_id tournamentId userId score')
    .lean();

  // 6. Inspect related TournamentJoinRequests (note: field name is `tournament`, not `tournamentId`)
  const relatedJoinRequests = await TournamentJoinRequest.find({ tournament: { $in: targetObjectIds } })
    .select('_id tournament user status')
    .lean();

  // 7. Inspect related Notifications
  // Notifications can link via tournament, round, or pairing
  const notificationQuery = {
    $or: [
      { tournament: { $in: targetObjectIds } },
      ...(roundObjectIds.length > 0 ? [{ round: { $in: roundObjectIds } }] : []),
      ...(pairingObjectIds.length > 0 ? [{ pairing: { $in: pairingObjectIds } }] : []),
    ],
  };
  const relatedNotifications = await Notification.find(notificationQuery)
    .select('_id recipient type title tournament round pairing')
    .lean();

  // 8. Verify protected tournaments still exist and are untouched
  const protectedTournaments = await Tournament.find({
    _id: { $in: Array.from(PROTECTED_TOURNAMENT_IDS).map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select('_id name status')
    .lean();

  return {
    candidates,
    targetObjectIds,
    roundObjectIds,
    pairingObjectIds,
    foundTournaments,
    relatedRounds,
    relatedPairings,
    relatedPlayers,
    relatedJoinRequests,
    relatedNotifications,
    lichessGameIds,
    protectedTournaments,
  };
};

/**
 * Executes dry-run reporting or confirmed atomic database cleanup.
 *
 * @param {Object} [options]
 * @param {boolean} [options.confirmDelete=false] - Must be explicitly true to perform deletion
 * @returns {Promise<Object>} Execution result
 */
export const runTournamentCleanup = async ({ confirmDelete = false } = {}) => {
  console.log('\n==============================================================================');
  console.log('CHESS JEENO - TEST TOURNAMENT DATABASE CLEANUP');
  console.log('==============================================================================');
  console.log(`Execution Mode:  ${confirmDelete ? '🚨 CONFIRMED ATOMIC DELETION' : '🛡️  DRY RUN (READ-ONLY PREVIEW)'}`);
  console.log(`Timestamp:       ${new Date().toISOString()}`);
  console.log('==============================================================================\n');

  // Step 1: Pre-flight Inspection
  console.log('Step 1: Running pre-flight verification on candidate tournaments...');
  const inspection = await inspectCandidateTournaments(APPROVED_TEST_TOURNAMENTS);
  console.log(`  -> Verified all ${inspection.foundTournaments.length} approved tournaments exist with exact matching names.`);
  console.log(`  -> Verified ${inspection.protectedTournaments.length} protected tournaments ("BIT 2026", "Blitz") are excluded.\n`);

  // Step 2: Display Detailed Breakdown
  console.log('Step 2: Candidate Records Summary:');
  inspection.foundTournaments.forEach((t, idx) => {
    const pCount = inspection.relatedPlayers.filter((p) => p.tournamentId.toString() === t._id.toString()).length;
    const jrCount = inspection.relatedJoinRequests.filter((jr) => jr.tournament.toString() === t._id.toString()).length;
    const rCount = inspection.relatedRounds.filter((r) => r.tournamentId.toString() === t._id.toString()).length;
    const pairCount = inspection.relatedPairings.filter((pair) => pair.tournamentId.toString() === t._id.toString()).length;
    const lGames = inspection.relatedPairings
      .filter((pair) => pair.tournamentId.toString() === t._id.toString() && Boolean(pair.lichessGameId))
      .map((p) => p.lichessGameId);

    console.log(`  ${idx + 1}. [${t._id}] "${t.name}"`);
    console.log(`     Status: ${t.status} | Format: ${t.format} | Creator: ${t.createdBy?.email || 'Unknown'}`);
    console.log(`     Players: ${pCount} | Join Requests: ${jrCount} | Rounds: ${rCount} | Pairings: ${pairCount}`);
    console.log(`     Lichess Game IDs (${lGames.length}): ${lGames.length > 0 ? lGames.join(', ') : 'None'}`);
  });

  console.log('\nStep 3: Cumulative Impact Analysis:');
  console.log(`  • Tournaments to remove:        ${inspection.foundTournaments.length}`);
  console.log(`  • TournamentPlayer records:     ${inspection.relatedPlayers.length}`);
  console.log(`  • TournamentJoinRequest records:${inspection.relatedJoinRequests.length}`);
  console.log(`  • Round records:                ${inspection.relatedRounds.length}`);
  console.log(`  • Pairing records:              ${inspection.relatedPairings.length}`);
  console.log(`  • Target Notification records:  ${inspection.relatedNotifications.length}`);
  console.log(`  • User Accounts Affected:       0 (ALL User accounts strictly preserved)`);
  console.log(`  • External Lichess Games:       0 affected on Lichess (${inspection.lichessGameIds.length} historical pairings unlinked)`);
  console.log(`  • Protected Tournaments Safe:   ${inspection.protectedTournaments.map((p) => `"${p.name}" (${p._id})`).join(', ')}`);

  // Step 4: Handle Dry Run (Default)
  if (!confirmDelete) {
    console.log('\n------------------------------------------------------------------------------');
    console.log('✅ DRY RUN COMPLETED SUCCESSFULLY');
    console.log('   ZERO records were deleted, modified, or created.');
    console.log('   The database is completely unchanged.');
    console.log('\nTo execute this cleanup permanently using an atomic transaction, run:');
    console.log('   node src/utils/cleanTestTournaments.js --confirm-delete');
    console.log('------------------------------------------------------------------------------\n');

    return {
      success: true,
      mode: 'DRY_RUN',
      inspection,
    };
  }

  // Step 5: Confirmed Deletion with Atomic MongoDB Transaction
  console.log('\nStep 4: Initiating Atomic Multi-Document Transaction...');

  let session;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    throw new Error(
      `Cannot start MongoDB session: ${err.message}. Ensure MongoDB connection is active and supports sessions.`
    );
  }

  try {
    let deletionResults = {};

    await session.withTransaction(async () => {
      console.log('  -> Transaction started.');

      // 1. Delete TournamentPlayers
      const delPlayers = await TournamentPlayer.deleteMany(
        { tournamentId: { $in: inspection.targetObjectIds } },
        { session }
      );
      console.log(`  -> Deleted ${delPlayers.deletedCount} TournamentPlayer records.`);

      // 2. Delete TournamentJoinRequests
      const delRequests = await TournamentJoinRequest.deleteMany(
        { tournament: { $in: inspection.targetObjectIds } },
        { session }
      );
      console.log(`  -> Deleted ${delRequests.deletedCount} TournamentJoinRequest records.`);

      // 3. Delete Pairings
      const delPairings = await Pairing.deleteMany(
        { tournamentId: { $in: inspection.targetObjectIds } },
        { session }
      );
      console.log(`  -> Deleted ${delPairings.deletedCount} Pairing records.`);

      // 4. Delete Rounds
      const delRounds = await Round.deleteMany(
        { tournamentId: { $in: inspection.targetObjectIds } },
        { session }
      );
      console.log(`  -> Deleted ${delRounds.deletedCount} Round records.`);

      // 5. Delete specific related Notifications
      const notificationFilter = {
        $or: [
          { tournament: { $in: inspection.targetObjectIds } },
          ...(inspection.roundObjectIds.length > 0 ? [{ round: { $in: inspection.roundObjectIds } }] : []),
          ...(inspection.pairingObjectIds.length > 0 ? [{ pairing: { $in: inspection.pairingObjectIds } }] : []),
        ],
      };
      const delNotifications = await Notification.deleteMany(notificationFilter, { session });
      console.log(`  -> Deleted ${delNotifications.deletedCount} Notification records.`);

      // 6. Delete Tournaments
      const delTournaments = await Tournament.deleteMany(
        { _id: { $in: inspection.targetObjectIds } },
        { session }
      );
      console.log(`  -> Deleted ${delTournaments.deletedCount} Tournament records.`);

      if (delTournaments.deletedCount !== inspection.foundTournaments.length) {
        throw new Error(
          `Transaction aborted: Expected to delete ${inspection.foundTournaments.length} tournaments, but deleted ${delTournaments.deletedCount}. Rolling back all operations.`
        );
      }

      // 7. Verify protected tournaments remain intact
      const protectedCheck = await Tournament.countDocuments(
        {
          _id: {
            $in: Array.from(PROTECTED_TOURNAMENT_IDS).map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
        { session }
      );

      if (protectedCheck !== PROTECTED_TOURNAMENT_IDS.size) {
        throw new Error(
          `CRITICAL SAFETY ABORT: Protected tournaments count check failed! Expected ${PROTECTED_TOURNAMENT_IDS.size}, found ${protectedCheck}. Rolling back transaction!`
        );
      }

      deletionResults = {
        tournamentsDeleted: delTournaments.deletedCount,
        playersDeleted: delPlayers.deletedCount,
        joinRequestsDeleted: delRequests.deletedCount,
        roundsDeleted: delRounds.deletedCount,
        pairingsDeleted: delPairings.deletedCount,
        notificationsDeleted: delNotifications.deletedCount,
      };

      console.log('  -> All operations verified within transaction.');
    });

    console.log('  -> Transaction committed successfully.\n');

    console.log('==============================================================================');
    console.log('🎉 CLEANUP EXECUTION COMPLETED SUCCESSFULLY');
    console.log('==============================================================================');
    console.log(`• Tournaments removed:          ${deletionResults.tournamentsDeleted}`);
    console.log(`• TournamentPlayers removed:    ${deletionResults.playersDeleted}`);
    console.log(`• Join Requests removed:        ${deletionResults.joinRequestsDeleted}`);
    console.log(`• Rounds removed:               ${deletionResults.roundsDeleted}`);
    console.log(`• Pairings removed:             ${deletionResults.pairingsDeleted}`);
    console.log(`• Notifications removed:        ${deletionResults.notificationsDeleted}`);
    console.log('• Protected records ("BIT 2026", "Blitz") and all User profiles remain intact.');
    console.log('==============================================================================\n');

    return {
      success: true,
      mode: 'CONFIRMED_DELETION',
      results: deletionResults,
    };
  } catch (err) {
    console.error('\n❌ TRANSACTION FAILED / ABORTED:');
    console.error(`   ${err.message}`);
    console.error('   All changes have been automatically ROLLED BACK. The database is intact.\n');
    throw err;
  } finally {
    await session.endSession();
  }
};

/**
 * CLI execution entrypoint.
 */
const runCli = async () => {
  const args = process.argv.slice(2);
  const confirmDelete = args.includes('--confirm-delete');

  try {
    await connectDB();
    await runTournamentCleanup({ confirmDelete });
  } catch (err) {
    console.error(`\n❌ [Fatal Error] ${err.message}`);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

// Check if run directly from command line
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}

export default {
  APPROVED_TEST_TOURNAMENTS,
  PROTECTED_TOURNAMENT_IDS,
  inspectCandidateTournaments,
  runTournamentCleanup,
};
