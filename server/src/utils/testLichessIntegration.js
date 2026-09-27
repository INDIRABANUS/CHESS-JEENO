import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import { requireLichessToken } from '../config/lichess.js';
import lichessService, { setMockTransport, setMockExportTransport } from '../services/lichessService.js';
import * as pairingService from '../services/pairingService.js';
import * as roundService from '../services/roundService.js';
import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import * as tournamentService from '../services/tournamentService.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import { getDevUserId } from './devUser.js';

dotenv.config();

const runLichessTests = async () => {
  console.log('🧪 Starting Lichess Game Creation & Pairing Integration Test Suite...\n');
  await connectDB();

  const devUserId = await getDevUserId();
  const testPrefix = `test_lic_${Date.now()}`;
  const createdUserIds = [];
  const createdTournamentIds = [];

  // Helper to create test user with optional lichessUsername and token
  const createTestUser = async (label, lichessUsername = null, hasToken = true) => {
    const userData = {
      name: `Player ${label}`,
      email: `${testPrefix}_${label.toLowerCase()}@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: lichessUsername,
      lichessUserId: lichessUsername ? lichessUsername.toLowerCase() : null,
    };
    if (lichessUsername && hasToken) {
      userData.lichessOAuth = {
        accessToken: `mock_tok_${lichessUsername}`,
        tokenType: 'Bearer',
        connectedAt: new Date(),
      };
    }
    const user = await User.create(userData);
    createdUserIds.push(user._id);
    if (lichessUsername && hasToken) {
      process.env[`LICHESS_TOKEN_${lichessUsername.toUpperCase()}`] = `mock_tok_${lichessUsername}`;
    }
    return user;
  };

  // Helper to create a tournament and registered players
  const setupTournamentWithPlayers = async (timeControl = { clockLimit: 300, increment: 3, rated: true }, users = []) => {
    const tournament = await tournamentService.createTournament(
      {
        name: `Lichess Test Tourney ${Date.now()}`,
        description: 'Test tournament for Lichess integration',
        format: 'ROUND_ROBIN',
        rated: timeControl.rated ?? false,
        clockLimit: timeControl.clockLimit ?? 300,
        increment: timeControl.increment ?? 0,
        maxPlayers: 10,
      },
      devUserId
    );
    createdTournamentIds.push(tournament._id);

    for (const u of users) {
      await tournamentPlayerService.joinTournament(tournament._id, u._id);
    }

    return tournament;
  };

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1 — Missing token
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Missing Token Handling ---');
    const originalToken = process.env.LICHESS_API_TOKEN;
    delete process.env.LICHESS_API_TOKEN;

    try {
      requireLichessToken();
      assert(false, 'Should throw error when LICHESS_API_TOKEN is missing');
    } catch (err) {
      assert(
        err.message.includes('Lichess API token is not configured'),
        `Properly rejected missing token: "${err.message}"`
      );
    } finally {
      // Restore or set a dummy test token for subsequent mock tests
      process.env.LICHESS_API_TOKEN = originalToken || 'test_mock_token_12345';
    }

    // Register standard mock transport for tests
    let lastMockCall = null;
    let mockGameCounter = 1000;
    setMockTransport(async (params) => {
      lastMockCall = params;
      mockGameCounter++;
      return {
        gameId: `lic_game_${mockGameCounter}`,
        gameUrl: `https://lichess.org/lic_game_${mockGameCounter}`,
      };
    });

    // -------------------------------------------------------------------------
    // TEST 2 — Missing white Lichess username
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Missing White Lichess Username ---');
    const userNoLichessWhite = await createTestUser('NoLicW', null);
    const userWithLichessBlack = await createTestUser('LicB', 'lichess_user_b');

    const tourneyT2 = await setupTournamentWithPlayers(
      { clockLimit: 300, increment: 0, rated: false },
      [userNoLichessWhite, userWithLichessBlack]
    );
    const roundT2 = await roundService.createRound(tourneyT2._id);
    const pairingT2 = roundT2.pairings[0];

    try {
      await pairingService.createLichessGameForPairing(
        tourneyT2._id,
        roundT2.round.roundNumber,
        pairingT2._id
      );
      assert(false, 'Should reject when white player has no lichess username');
    } catch (err) {
      assert(
        err.statusCode === 400 &&
          err.message.includes('Both players must have linked Lichess usernames'),
        `Rejected missing white username with 400: "${err.message}"`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 3 — Missing black Lichess username
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Missing Black Lichess Username ---');
    const userWithLichessWhite = await createTestUser('LicW', 'lichess_user_w');
    const userNoLichessBlack = await createTestUser('NoLicB', null);

    const tourneyT3 = await setupTournamentWithPlayers(
      { clockLimit: 180, increment: 2, rated: false },
      [userWithLichessWhite, userNoLichessBlack]
    );
    const roundT3 = await roundService.createRound(tourneyT3._id);
    const pairingT3 = roundT3.pairings[0];

    try {
      await pairingService.createLichessGameForPairing(
        tourneyT3._id,
        roundT3.round.roundNumber,
        pairingT3._id
      );
      assert(false, 'Should reject when black player has no lichess username');
    } catch (err) {
      assert(
        err.statusCode === 400 &&
          err.message.includes('Both players must have linked Lichess usernames'),
        `Rejected missing black username with 400: "${err.message}"`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 4 — Invalid tournament
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Invalid Tournament ---');
    const fakeTournamentId = new mongoose.Types.ObjectId();
    try {
      await pairingService.createLichessGameForPairing(
        fakeTournamentId,
        1,
        pairingT2._id
      );
      assert(false, 'Should throw 404 for invalid tournament');
    } catch (err) {
      assert(
        err.statusCode === 404 && err.message.includes('Tournament not found'),
        `Returned 404 for nonexistent tournament: "${err.message}"`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 5 — Invalid round
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Invalid Round ---');
    try {
      await pairingService.createLichessGameForPairing(
        tourneyT2._id,
        999,
        pairingT2._id
      );
      assert(false, 'Should throw 404 for nonexistent round number');
    } catch (err) {
      assert(
        err.statusCode === 404 && err.message.includes('Round not found'),
        `Returned 404 for nonexistent round: "${err.message}"`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 6 — Invalid pairing
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Invalid Pairing ---');
    const fakePairingId = new mongoose.Types.ObjectId();
    try {
      await pairingService.createLichessGameForPairing(
        tourneyT2._id,
        roundT2.round.roundNumber,
        fakePairingId
      );
      assert(false, 'Should throw 404 for nonexistent pairing');
    } catch (err) {
      assert(
        err.statusCode === 404 && err.message.includes('Pairing not found'),
        `Returned 404 for nonexistent pairing: "${err.message}"`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 7 — Pairing from another round/tournament
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Pairing from Another Round / Tournament ---');
    // Using pairingT2 with tourneyT3
    try {
      await pairingService.createLichessGameForPairing(
        tourneyT3._id,
        roundT3.round.roundNumber,
        pairingT2._id
      );
      assert(false, 'Should reject pairing that does not belong to specified tournament');
    } catch (err) {
      assert(
        err.statusCode === 400 &&
          err.message.includes('Pairing does not belong'),
        `Rejected mismatched tournament pairing with 400: "${err.message}"`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 8 — Token Enforcement & Username Fallback Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Token Enforcement & Username Fallback Prevention ---');

    // 8a: Both tokens present -> request uses token:token
    process.env.LICHESS_TOKEN_PLAYER_ALPHA = 'mock_token_alpha_123';
    process.env.LICHESS_TOKEN_PLAYER_BETA = 'mock_token_beta_456';
    await lichessService.createGame({
      whiteUsername: 'player_alpha',
      blackUsername: 'player_beta',
      clockLimit: 300,
      increment: 0,
    });
    assert(
      lastMockCall?.playersPayload === 'mock_token_alpha_123:mock_token_beta_456',
      `Both tokens present -> request uses token:token ("${lastMockCall?.playersPayload}")`
    );
    assert(
      !lastMockCall?.playersPayload.includes('player_alpha') && !lastMockCall?.playersPayload.includes('player_beta'),
      'Confirmed: Usernames are never used as fallback tokens in players payload'
    );

    // 8b: White token missing -> clear error
    delete process.env.LICHESS_TOKEN_NO_TOKEN_WHITE;
    process.env.LICHESS_TOKEN_HAS_TOKEN_BLACK = 'mock_token_has_black';
    try {
      await lichessService.createGame({
        whiteUsername: 'no_token_white',
        blackUsername: 'has_token_black',
        clockLimit: 300,
        increment: 0,
      });
      assert(false, 'Should throw error when white player token is missing');
    } catch (err) {
      assert(
        err.statusCode === 400 && err.message === 'Missing Lichess token for player: no_token_white',
        `White token missing -> clear error: "${err.message}"`
      );
    }

    // 8c: Black token missing -> clear error
    process.env.LICHESS_TOKEN_HAS_TOKEN_WHITE = 'mock_token_has_white';
    delete process.env.LICHESS_TOKEN_NO_TOKEN_BLACK;
    try {
      await lichessService.createGame({
        whiteUsername: 'has_token_white',
        blackUsername: 'no_token_black',
        clockLimit: 300,
        increment: 0,
      });
      assert(false, 'Should throw error when black player token is missing');
    } catch (err) {
      assert(
        err.statusCode === 400 && err.message === 'Missing Lichess token for player: no_token_black',
        `Black token missing -> clear error: "${err.message}"`
      );
    }

    // 8d: Pure usernames without tokens -> verified never accepted as tokens
    try {
      await lichessService.createGame({
        whiteUsername: 'pure_username_1',
        blackUsername: 'pure_username_2',
        clockLimit: 300,
        increment: 0,
      });
      assert(false, 'Should reject raw usernames without tokens');
    } catch (err) {
      assert(
        err.statusCode === 400 && err.message.startsWith('Missing Lichess token for player:'),
        `Usernames without tokens rejected: "${err.message}"`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 9 & 10 — Successful Mocked Creation & Duplicate Protection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Successful Mocked Lichess Game Creation ---');
    const userGoodWhite = await createTestUser('GoodW', 'magnuscarlsen');
    const userGoodBlack = await createTestUser('GoodB', 'hikaru');

    const tourneyT9 = await setupTournamentWithPlayers(
      { clockLimit: 300, increment: 3, rated: true },
      [userGoodWhite, userGoodBlack]
    );
    const roundT9 = await roundService.createRound(tourneyT9._id);
    const pairingT9 = roundT9.pairings[0];

    const updatedPairing = await pairingService.createLichessGameForPairing(
      tourneyT9._id,
      roundT9.round.roundNumber,
      pairingT9._id
    );

    assert(
      Boolean(updatedPairing.lichessGameId) && updatedPairing.lichessGameId.startsWith('lic_game_'),
      `Stored lichessGameId: ${updatedPairing.lichessGameId}`
    );
    assert(
      Boolean(updatedPairing.lichessGameUrl) &&
        updatedPairing.lichessGameUrl === `https://lichess.org/${updatedPairing.lichessGameId}`,
      `Stored lichessGameUrl: ${updatedPairing.lichessGameUrl}`
    );
    assert(
      updatedPairing.status === 'ACTIVE' || updatedPairing.status === 'READY',
      `Pairing status transitioned to ${updatedPairing.status}`
    );
    assert(
      updatedPairing.result === 'PENDING' || updatedPairing.result === null,
      `Pairing result remained PENDING / untouched: ${updatedPairing.result}`
    );

    // TEST 8 — Duplicate game protection
    console.log('\n--- TEST 8: Existing Lichess Game (Duplicate Protection) ---');
    try {
      await pairingService.createLichessGameForPairing(
        tourneyT9._id,
        roundT9.round.roundNumber,
        pairingT9._id
      );
      assert(false, 'Should reject duplicate game creation on already created pairing');
    } catch (err) {
      assert(
        err.statusCode === 400 &&
          err.message.includes('Lichess game has already been created for this pairing'),
        `Rejected duplicate game creation with 400: "${err.message}"`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 10 — Time Control Mapping
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Time Control Mapping ---');
    const userTC1 = await createTestUser('TC1', 'player_tc_1');
    const userTC2 = await createTestUser('TC2', 'player_tc_2');

    const tourneyT10 = await setupTournamentWithPlayers(
      { clockLimit: 600, increment: 5, rated: false },
      [userTC1, userTC2]
    );
    const roundT10 = await roundService.createRound(tourneyT10._id);
    await pairingService.createLichessGameForPairing(
      tourneyT10._id,
      roundT10.round.roundNumber,
      roundT10.pairings[0]._id
    );

    assert(
      lastMockCall?.clockLimit === 600 && lastMockCall?.increment === 5,
      `Passed exact tournament clockLimit (600s) and increment (5s): got ${lastMockCall?.clockLimit}+${lastMockCall?.increment}`
    );

    // -------------------------------------------------------------------------
    // TEST 11 — Rated / Casual Mapping
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: Rated / Casual Mapping ---');
    assert(
      lastMockCall?.rated === false,
      `Casual tournament (rated: false) correctly passed rated=false to Lichess API`
    );

    const userR1 = await createTestUser('R1', 'player_r_1');
    const userR2 = await createTestUser('R2', 'player_r_2');
    const tourneyRated = await setupTournamentWithPlayers(
      { clockLimit: 180, increment: 0, rated: true },
      [userR1, userR2]
    );
    const roundRated = await roundService.createRound(tourneyRated._id);
    await pairingService.createLichessGameForPairing(
      tourneyRated._id,
      roundRated.round.roundNumber,
      roundRated.pairings[0]._id
    );

    assert(
      lastMockCall?.rated === true,
      `Rated tournament (rated: true) correctly passed rated=true to Lichess API`
    );

    // -------------------------------------------------------------------------
    // TEST 12 — Round-level Creation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 12: Round-Level Bulk Creation ---');
    const uA = await createTestUser('B1', 'bulk_player_1');
    const uB = await createTestUser('B2', 'bulk_player_2');
    const uC = await createTestUser('B3', 'bulk_player_3');
    const uD = await createTestUser('B4', 'bulk_player_4');

    const tourneyBulk = await setupTournamentWithPlayers(
      { clockLimit: 300, increment: 0, rated: false },
      [uA, uB, uC, uD]
    );
    const roundBulk = await roundService.createRound(tourneyBulk._id);
    assert(roundBulk.pairings.length === 2, `Round 1 generated 2 pairings for 4 players`);

    const bulkSummary = await pairingService.createAllLichessGamesForRound(
      tourneyBulk._id,
      roundBulk.round.roundNumber
    );

    assert(bulkSummary.created === 2, `Bulk creation reported 2 created games`);
    assert(bulkSummary.skipped === 0, `Bulk creation reported 0 skipped`);
    assert(bulkSummary.failed === 0, `Bulk creation reported 0 failed`);
    assert(
      bulkSummary.pairings.every((p) => p.lichessGameId && p.status === 'ACTIVE'),
      `All pairings in round now have lichessGameId and ACTIVE status`
    );

    // Call again -> should all be skipped
    const secondBulkSummary = await pairingService.createAllLichessGamesForRound(
      tourneyBulk._id,
      roundBulk.round.roundNumber
    );
    assert(secondBulkSummary.created === 0, `Second bulk run created 0 games`);
    assert(secondBulkSummary.skipped === 2, `Second bulk run skipped 2 existing games`);

    // -------------------------------------------------------------------------
    // TEST 13 — Partial Failure
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 13: Partial Failure Resilience in Round-Level Creation ---');
    const uPartGood1 = await createTestUser('PG1', 'part_good_1');
    const uPartGood2 = await createTestUser('PG2', 'part_good_2');
    const uPartBad1 = await createTestUser('PB1', null); // Missing username
    const uPartBad2 = await createTestUser('PB2', 'part_good_4');

    const tourneyPart = await setupTournamentWithPlayers(
      { clockLimit: 300, increment: 0, rated: false },
      [uPartGood1, uPartGood2, uPartBad1, uPartBad2]
    );
    const roundPart = await roundService.createRound(tourneyPart._id);
    // In roundPart: pairing 1 is PG1 vs PB2 (or similar), pairing 2 has PB1
    const partSummary = await pairingService.createAllLichessGamesForRound(
      tourneyPart._id,
      roundPart.round.roundNumber
    );

    assert(
      partSummary.failed > 0,
      `Partial failure detected: ${partSummary.failed} pairing(s) failed due to missing username`
    );
    assert(
      partSummary.created > 0,
      `Partial success preserved: ${partSummary.created} eligible pairing(s) successfully created`
    );
    assert(
      partSummary.pairings.length === roundPart.pairings.length,
      `Round structure remained completely intact with ${partSummary.pairings.length} pairings`
    );

    // =========================================================================
    // MILESTONE 7: LICHESS GAME RESULT SYNC TESTS
    // =========================================================================
    console.log('\n--- MILESTONE 7 TESTS: Lichess Game Result Synchronization ---');

    const uSyncW = await createTestUser('SyncW', 'player_sync_w');
    const uSyncB = await createTestUser('SyncB', 'player_sync_b');
    const tourneySync = await setupTournamentWithPlayers(
      { clockLimit: 300, increment: 0, rated: false },
      [uSyncW, uSyncB]
    );
    const roundSync = await roundService.createRound(tourneySync._id);
    const pairingSync = roundSync.pairings[0];
    pairingSync.lichessGameId = 'game_sync_test';
    pairingSync.status = 'ACTIVE';
    pairingSync.result = 'PENDING';
    await pairingSync.save();

    const resetPairing = async (status = 'ACTIVE', result = 'PENDING', lichessGameId = 'game_sync_test') => {
      await Pairing.findByIdAndUpdate(pairingSync._id, {
        status,
        result,
        lichessGameId,
        lichessStatus: null,
      });
    };

    // 1. Finished white win -> 1-0
    console.log('\n--- TEST 14: Finished White Win -> 1-0 ---');
    await resetPairing('ACTIVE', 'PENDING');
    setMockExportTransport(async (gameId) => ({
      id: gameId,
      status: 'resign',
      winner: 'white',
      players: {
        white: { user: { name: 'player_sync_w' } },
        black: { user: { name: 'player_sync_b' } },
      },
    }));
    const syncRes1 = await pairingService.syncPairingResult(
      tourneySync._id,
      roundSync.round.roundNumber,
      pairingSync._id
    );
    assert(
      syncRes1.status === 'FINISHED' && syncRes1.result === '1-0',
      `White win synchronized: status=${syncRes1.status}, result=${syncRes1.result}`
    );

    // 2. Finished black win -> 0-1
    console.log('\n--- TEST 15: Finished Black Win -> 0-1 ---');
    await resetPairing('ACTIVE', 'PENDING');
    setMockExportTransport(async (gameId) => ({
      id: gameId,
      status: 'mate',
      winner: 'black',
      players: {
        white: { user: { name: 'player_sync_w' } },
        black: { user: { name: 'player_sync_b' } },
      },
    }));
    const syncRes2 = await pairingService.syncPairingResult(
      tourneySync._id,
      roundSync.round.roundNumber,
      pairingSync._id
    );
    assert(
      syncRes2.status === 'FINISHED' && syncRes2.result === '0-1',
      `Black win synchronized: status=${syncRes2.status}, result=${syncRes2.result}`
    );

    // 3. Finished draw -> 1/2-1/2
    console.log('\n--- TEST 16: Finished Draw -> 1/2-1/2 ---');
    await resetPairing('ACTIVE', 'PENDING');
    setMockExportTransport(async (gameId) => ({
      id: gameId,
      status: 'draw',
      winner: null,
      players: {
        white: { user: { name: 'player_sync_w' } },
        black: { user: { name: 'player_sync_b' } },
      },
    }));
    const syncRes3 = await pairingService.syncPairingResult(
      tourneySync._id,
      roundSync.round.roundNumber,
      pairingSync._id
    );
    assert(
      syncRes3.status === 'FINISHED' && syncRes3.result === '1/2-1/2',
      `Draw synchronized: status=${syncRes3.status}, result=${syncRes3.result}`
    );

    // 4. Game still running -> Pairing remains active/not finished
    console.log('\n--- TEST 17: Game Still Running -> Remains ACTIVE ---');
    await resetPairing('ACTIVE', 'PENDING');
    setMockExportTransport(async (gameId) => ({
      id: gameId,
      status: 'started',
      winner: null,
      players: {
        white: { user: { name: 'player_sync_w' } },
        black: { user: { name: 'player_sync_b' } },
      },
    }));
    const syncRes4 = await pairingService.syncPairingResult(
      tourneySync._id,
      roundSync.round.roundNumber,
      pairingSync._id
    );
    assert(
      syncRes4.status === 'ACTIVE' && syncRes4.result === 'PENDING',
      `Running game preserved: status=${syncRes4.status}, result=${syncRes4.result}`
    );

    // 5. Aborted game -> handled correctly
    console.log('\n--- TEST 18: Aborted Game -> Status ABORTED ---');
    await resetPairing('ACTIVE', 'PENDING');
    setMockExportTransport(async (gameId) => ({
      id: gameId,
      status: 'aborted',
      winner: null,
      players: {
        white: { user: { name: 'player_sync_w' } },
        black: { user: { name: 'player_sync_b' } },
      },
    }));
    const syncRes5 = await pairingService.syncPairingResult(
      tourneySync._id,
      roundSync.round.roundNumber,
      pairingSync._id
    );
    assert(
      syncRes5.status === 'ABORTED' && syncRes5.result === 'ABORTED',
      `Aborted game synchronized: status=${syncRes5.status}, result=${syncRes5.result}`
    );

    // 6. Missing lichessGameId
    console.log('\n--- TEST 19: Missing lichessGameId Rejection ---');
    await resetPairing('ACTIVE', 'PENDING', null);
    try {
      await pairingService.syncPairingResult(
        tourneySync._id,
        roundSync.round.roundNumber,
        pairingSync._id
      );
      assert(false, 'Should throw error when pairing has no lichessGameId');
    } catch (err) {
      assert(
        err.statusCode === 400 && err.message.includes('does not have an associated Lichess game'),
        `Rejected missing lichessGameId with 400: "${err.message}"`
      );
    }
    // Restore lichessGameId
    await resetPairing('ACTIVE', 'PENDING', 'game_sync_test');

    // 7. Lichess API failure
    console.log('\n--- TEST 20: Upstream Lichess API Failure Handling ---');
    await resetPairing('ACTIVE', 'PENDING', 'game_sync_test');
    setMockExportTransport(async () => {
      const err = new Error('Lichess upstream server error');
      err.statusCode = 502;
      throw err;
    });
    try {
      await pairingService.syncPairingResult(
        tourneySync._id,
        roundSync.round.roundNumber,
        pairingSync._id
      );
      assert(false, 'Should propagate Lichess API failure');
    } catch (err) {
      assert(
        err.statusCode === 502,
        `Handled upstream API failure with 502: "${err.message}"`
      );
    }

    // 8. Invalid / malformed Lichess response
    console.log('\n--- TEST 21: Malformed Lichess Response Handling ---');
    await resetPairing('ACTIVE', 'PENDING', 'game_sync_test');
    setMockExportTransport(async () => null);
    try {
      await pairingService.syncPairingResult(
        tourneySync._id,
        roundSync.round.roundNumber,
        pairingSync._id
      );
      assert(false, 'Should reject malformed Lichess response');
    } catch (err) {
      assert(
        err.statusCode === 502,
        `Handled malformed response with 502: "${err.message}"`
      );
    }

    // 9. Already-finished pairing does not get incorrectly overwritten
    console.log('\n--- TEST 22: Already-Finished Pairing Not Overwritten ---');
    pairingSync.status = 'FINISHED';
    pairingSync.result = '1-0';
    await pairingSync.save();
    // Transport returns different result (e.g. draw)
    setMockExportTransport(async (gameId) => ({
      id: gameId,
      status: 'draw',
      winner: null,
      players: {
        white: { user: { name: 'player_sync_w' } },
        black: { user: { name: 'player_sync_b' } },
      },
    }));
    const syncRes9 = await pairingService.syncPairingResult(
      tourneySync._id,
      roundSync.round.roundNumber,
      pairingSync._id
    );
    assert(
      syncRes9.status === 'FINISHED' && syncRes9.result === '1-0',
      `Finalized result preserved without being overwritten: status=${syncRes9.status}, result=${syncRes9.result}`
    );

    // 10. Tournament/round/pairing relationship validation
    console.log('\n--- TEST 23: Tournament/Round/Pairing Relationship Validation ---');
    const fakeId = new mongoose.Types.ObjectId();
    try {
      await pairingService.syncPairingResult(fakeId, roundSync.round.roundNumber, pairingSync._id);
      assert(false, 'Should 404 for invalid tournament');
    } catch (err) {
      assert(err.statusCode === 404, `Tournament not found 404: "${err.message}"`);
    }

    try {
      await pairingService.syncPairingResult(tourneySync._id, 999, pairingSync._id);
      assert(false, 'Should 404 for invalid round');
    } catch (err) {
      assert(err.statusCode === 404, `Round not found 404: "${err.message}"`);
    }

    try {
      await pairingService.syncPairingResult(tourneySync._id, roundSync.round.roundNumber, fakeId);
      assert(false, 'Should 404 for invalid pairing');
    } catch (err) {
      assert(err.statusCode === 404, `Pairing not found 404: "${err.message}"`);
    }

    // Mismatched round test
    const fakeOtherRound = await Round.create({
      tournamentId: tourneySync._id,
      roundNumber: 2,
      status: 'PENDING',
      pairings: [],
    });
    createdTournamentIds.push(fakeOtherRound._id);
    try {
      await pairingService.syncPairingResult(tourneySync._id, 2, pairingSync._id);
      assert(false, 'Should reject pairing belonging to another round');
    } catch (err) {
      assert(err.statusCode === 400, `Rejected mismatched round: "${err.message}"`);
    }

    // Reset mock transports to null
    setMockTransport(null);
    setMockExportTransport(null);

    console.log('\n==================================================');
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
    console.log('==================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Unexpected test error:', error);
    process.exit(1);
  } finally {
    // Cleanup created test records
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
    await mongoose.connection.close();
  }
};

runLichessTests();
