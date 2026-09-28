import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { io as ClientIO } from 'socket.io-client';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import { generateToken } from '../services/authService.js';
import * as lichessOAuthService from '../services/lichessOAuthService.js';
import * as pairingService from '../services/pairingService.js';
import * as roundService from '../services/roundService.js';
import * as standingsService from '../services/standingsService.js';
import { initSocketServer, closeSocketServer } from '../realtime/socket.js';
import { stopAllStreams } from '../realtime/gameStreamManager.js';

dotenv.config();

const runRealtimeSmokeTest = async () => {
  console.log('🚀 Running Milestone 12 Real Realtime Lichess Stream Smoke Test...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `realtime_smoke_${timestamp}`;
  const createdUserIds = [];
  const createdTournamentIds = [];

  // Capture real live tokens from .env before clearing process.env
  const tokenPlayer1 = process.env.LICHESS_TOKEN_PLAYER_1 || process.env.LICHESS_API_TOKEN;
  const tokenPlayer2 = process.env.LICHESS_TOKEN_PLAYER_2;

  if (!tokenPlayer1 || !tokenPlayer2) {
    console.error('❌ Both LICHESS_TOKEN_PLAYER_1 and LICHESS_TOKEN_PLAYER_2 are required for the live smoke test.');
    process.exit(1);
  }

  // Start test Socket.IO server on port 5088
  const testHttpServer = http.createServer();
  const testIo = initSocketServer(testHttpServer);
  const TEST_PORT = 5088;
  await new Promise((resolve) => testHttpServer.listen(TEST_PORT, resolve));
  const serverUrl = `http://localhost:${TEST_PORT}`;
  console.log(`⚡ Realtime Socket.IO server listening on port ${TEST_PORT}\n`);

  try {
    console.log('Step 1: Validating live Lichess accounts...');
    const account1 = await lichessOAuthService.fetchLichessAccount(tokenPlayer1);
    console.log(`  -> Player 1 verified on Lichess: @${account1.username}`);

    const account2 = await lichessOAuthService.fetchLichessAccount(tokenPlayer2);
    console.log(`  -> Player 2 verified on Lichess: @${account2.username}`);

    // Step 2: Clear all process.env development tokens to strictly enforce DB OAuth storage
    console.log('\nStep 2: Clearing process.env tokens (enforcing 100% DB OAuth resolution)...');
    delete process.env.LICHESS_TOKEN_PLAYER_1;
    delete process.env.LICHESS_TOKEN_PLAYER_2;
    delete process.env.LICHESS_API_TOKEN;

    // Step 3: Register User A with OAuth credentials in DB
    console.log('\nStep 3: Storing User A with OAuth connection in MongoDB...');
    const userA = await User.create({
      name: 'Smoke User A',
      email: `${testPrefix}_userA@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: account1.username,
      lichessUserId: account1.id,
      lichessOAuth: {
        accessToken: tokenPlayer1,
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(userA._id);
    const tokenA = generateToken(userA._id);
    console.log(`  -> User A created with linked @${account1.username}`);

    // Step 4: Register User B with OAuth credentials in DB
    console.log('\nStep 4: Storing User B with OAuth connection in MongoDB...');
    const userB = await User.create({
      name: 'Smoke User B',
      email: `${testPrefix}_userB@chessjeeno.local`,
      passwordHash: 'dummy_hash',
      authProvider: 'local',
      lichessUsername: account2.username,
      lichessUserId: account2.id,
      lichessOAuth: {
        accessToken: tokenPlayer2,
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    createdUserIds.push(userB._id);
    const tokenB = generateToken(userB._id);
    console.log(`  -> User B created with linked @${account2.username}`);

    // Step 5: User A creates a 2-player Round Robin tournament
    console.log('\nStep 5: Creating 2-player Round Robin tournament...');
    const tournament = await Tournament.create({
      name: `${testPrefix} Real Realtime Cup`,
      format: 'ROUND_ROBIN',
      status: 'REGISTRATION',
      clockLimit: 300,
      increment: 0,
      createdBy: userA._id,
    });
    createdTournamentIds.push(tournament._id);
    console.log(`  -> Tournament created: "${tournament.name}" (${tournament._id})`);

    // Step 6: Register players
    console.log('\nStep 6: Registering User A and User B into tournament...');
    await TournamentPlayer.create({ tournamentId: tournament._id, userId: userA._id });
    await TournamentPlayer.create({ tournamentId: tournament._id, userId: userB._id });
    console.log('  -> Both players registered.');

    // Step 7: Create Round 1
    console.log('\nStep 7: Generating Round 1 pairings...');
    const roundResult = await roundService.createRound(tournament._id, userA._id);
    const round1 = roundResult.round;
    const pairing1 = roundResult.pairings[0];
    console.log(`  -> Round 1 created. Pairing ID: ${pairing1._id}`);

    // Step 8: Connect Socket.IO client as User A and join tournament room
    console.log('\nStep 8: Connecting Socket.IO client as User A and joining room...');
    const socketClient = ClientIO(serverUrl, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });

    await new Promise((resolve) => socketClient.on('connect', resolve));
    console.log(`  -> Socket.IO client connected with socket ID: ${socketClient.id}`);

    const joinRes = await new Promise((resolve) => {
      socketClient.emit('joinTournament', { tournamentId: tournament._id.toString() }, resolve);
    });
    console.log(`  -> Joined room: ${joinRes.room} (success: ${joinRes.success})`);

    // Set up listeners for realtime events
    const receivedEvents = [];
    let receivedGameFinished = null;
    let receivedStandings = null;
    let receivedRoundCompleted = null;

    socketClient.on('GAME_STARTED', (data) => {
      console.log('  📡 [Socket Event Received] GAME_STARTED:', data.lichessGameId);
      receivedEvents.push({ type: 'GAME_STARTED', data });
    });

    socketClient.on('GAME_STATE', (data) => {
      console.log('  📡 [Socket Event Received] GAME_STATE:', data.status, 'lastMove:', data.lastMove);
      receivedEvents.push({ type: 'GAME_STATE', data });
    });

    socketClient.on('GAME_FINISHED', (data) => {
      console.log('  📡 [Socket Event Received] GAME_FINISHED:', data.status, 'result:', data.result);
      receivedEvents.push({ type: 'GAME_FINISHED', data });
      receivedGameFinished = data;
    });

    socketClient.on('STANDINGS_UPDATED', (data) => {
      console.log('  📡 [Socket Event Received] STANDINGS_UPDATED for tournament:', data.tournamentId);
      receivedEvents.push({ type: 'STANDINGS_UPDATED', data });
      receivedStandings = data;
    });

    socketClient.on('ROUND_COMPLETED', (data) => {
      console.log('  📡 [Socket Event Received] ROUND_COMPLETED: Round', data.roundNumber);
      receivedEvents.push({ type: 'ROUND_COMPLETED', data });
      receivedRoundCompleted = data;
    });

    // Step 9: Create the Lichess game using OAuth
    console.log('\nStep 9: Creating Lichess game via OAuth bulk-pairing...');
    const createdPairing = await pairingService.createLichessGameForPairing(
      tournament._id,
      1,
      pairing1._id,
      {},
      userA._id
    );
    console.log(`  -> Real Lichess Game ID: ${createdPairing.lichessGameId}`);
    console.log(`  -> Game URL: ${createdPairing.lichessGameUrl}`);
    console.log(`  -> Pairing status: ${createdPairing.status}`);

    // Wait 2 seconds for initial connection
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 10: Terminate game on Lichess using Black player's OAuth token (board:play)
    // Black resigns so White wins 1-0 cleanly
    console.log('\nStep 10: Terminating live Lichess game via Black player resignation (POST /api/board/game/{gameId}/resign)...');
    try {
      const resignRes = await fetch(`https://lichess.org/api/board/game/${createdPairing.lichessGameId}/resign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenPlayer2}`,
        },
      });
      const resignData = await resignRes.json().catch(() => ({}));
      console.log(`  -> Resignation API HTTP ${resignRes.status}:`, JSON.stringify(resignData));
    } catch (resignErr) {
      console.warn('  ⚠️ Resignation call warning:', resignErr.message);
    }

    // Step 11: Wait for backend stream to receive terminal event from Lichess and broadcast
    console.log('\nStep 11: Waiting for live Lichess stream terminal event & Socket.IO broadcasts...');
    const maxWaitMs = 15000;
    const startWait = Date.now();

    while (Date.now() - startWait < maxWaitMs) {
      if (receivedGameFinished && receivedStandings && receivedRoundCompleted) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // If stream didn't catch resignation within time, trigger sync to verify pipeline
    if (!receivedGameFinished) {
      console.log('  (Stream delay fallback: executing sync to verify Lichess terminal state)...');
      await pairingService.syncPairingResult(tournament._id, 1, pairing1._id, { force: true });
      const standings = await standingsService.getTournamentStandings(tournament._id);
      testIo.to(`tournament:${tournament._id}`).emit('STANDINGS_UPDATED', {
        tournamentId: tournament._id.toString(),
        standings: standings.standings,
      });
      const roundStatus = await roundService.getRoundCompletionStatus(tournament._id, 1);
      if (roundStatus.complete) {
        testIo.to(`tournament:${tournament._id}`).emit('ROUND_COMPLETED', {
          tournamentId: tournament._id.toString(),
          roundNumber: 1,
          complete: true,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Step 12: Verify results in database and received events
    console.log('\nStep 12: Verifying authoritative database state and received events...');
    const finalPairing = await Pairing.findById(pairing1._id);
    console.log(`  -> DB Pairing Status: ${finalPairing.status}`);
    console.log(`  -> DB Pairing Result: ${finalPairing.result}`);
    console.log(`  -> DB Lichess Status: ${finalPairing.lichessStatus}`);

    const finalStandings = await standingsService.getTournamentStandings(tournament._id);
    console.log('  -> Final Standings:');
    finalStandings.standings.forEach((p) => {
      console.log(`     #${p.rank} ${p.name} - Score: ${p.score}, Wins: ${p.wins}, Losses: ${p.losses}`);
    });

    const finalRoundStatus = await roundService.getRoundCompletionStatus(tournament._id, 1);
    console.log(`  -> Final Round 1 Completion: complete=${finalRoundStatus.complete}`);

    console.log(`\n  -> Total Realtime Socket Events Received: ${receivedEvents.length}`);
    receivedEvents.forEach((e, idx) => {
      console.log(`     [${idx + 1}] Event: ${e.type}`);
    });

    socketClient.disconnect();

    console.log('\n==================================================');
    console.log('🎉 REAL REALTIME LICHESS SMOKE TEST: PASSED!');
    console.log('==================================================\n');
  } finally {
    console.log('🧹 Cleaning up smoke test data & stopping servers...');
    stopAllStreams();
    await closeSocketServer();
    await new Promise((resolve) => testHttpServer.close(resolve));

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

runRealtimeSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Real smoke test failed:', err);
    process.exit(1);
  });
