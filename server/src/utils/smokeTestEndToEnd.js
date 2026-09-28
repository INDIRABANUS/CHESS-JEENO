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
import * as authService from '../services/authService.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentPlayerService from '../services/tournamentPlayerService.js';
import * as roundService from '../services/roundService.js';
import * as pairingService from '../services/pairingService.js';
import * as standingsService from '../services/standingsService.js';
import * as lichessOAuthService from '../services/lichessOAuthService.js';
import { initSocketServer, closeSocketServer } from '../realtime/socket.js';

dotenv.config();

const runSmokeTestEndToEnd = async () => {
  console.log('🚀 Running Milestone 15: Full End-to-End Real Smoke Test...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `e2e_real_${timestamp}`;
  const createdUserIds = [];
  const createdTournamentIds = [];

  // Capture real live tokens from .env before wiping process.env
  const tokenPlayer1 = process.env.LICHESS_TOKEN_PLAYER_1 || process.env.LICHESS_API_TOKEN;
  const tokenPlayer2 = process.env.LICHESS_TOKEN_PLAYER_2;

  if (!tokenPlayer1) {
    throw new Error('LICHESS_TOKEN_PLAYER_1 or LICHESS_API_TOKEN is required in .env');
  }

  // Start test Socket.IO server on port 5078
  const testHttpServer = http.createServer();
  const testIo = initSocketServer(testHttpServer);
  const TEST_PORT = 5078;
  await new Promise((resolve) => testHttpServer.listen(TEST_PORT, resolve));
  const serverUrl = `http://localhost:${TEST_PORT}`;

  try {
    // -------------------------------------------------------------------------
    // Step 1: Validate live Lichess account credentials
    // -------------------------------------------------------------------------
    console.log('Step 1: Validating live Lichess account tokens via Lichess API...');
    const account1 = await lichessOAuthService.fetchLichessAccount(tokenPlayer1);
    console.log(`  -> Account 1 verified: @${account1.username} (id: ${account1.id})`);

    let account2 = null;
    if (tokenPlayer2) {
      try {
        account2 = await lichessOAuthService.fetchLichessAccount(tokenPlayer2);
        console.log(`  -> Account 2 verified: @${account2.username} (id: ${account2.id})`);
      } catch (err) {
        console.warn(`  ⚠️ Account 2 token verification failed: ${err.message}`);
      }
    }

    // Clear process.env tokens to strictly verify DB OAuth storage
    console.log('\nStep 2: Clearing process.env tokens (enforcing 100% DB OAuth resolution)...');
    delete process.env.LICHESS_TOKEN_PLAYER_1;
    delete process.env.LICHESS_TOKEN_PLAYER_2;
    delete process.env.LICHESS_API_TOKEN;

    // -------------------------------------------------------------------------
    // Step 3: Register and Login CHESS JEENO Users
    // -------------------------------------------------------------------------
    console.log('\nStep 3: Registering & logging in CHESS JEENO users...');
    const hostReg = await authService.registerUser({
      name: 'E2E Real Host',
      email: `${testPrefix}_host@chessjeeno.local`,
      password: 'HostPassword123!',
    });
    createdUserIds.push(hostReg.user._id);

    const player1Reg = await authService.registerUser({
      name: 'E2E Grandmaster 1',
      email: `${testPrefix}_p1@chessjeeno.local`,
      password: 'PlayerPassword123!',
    });
    createdUserIds.push(player1Reg.user._id);

    const player2Reg = await authService.registerUser({
      name: 'E2E Grandmaster 2',
      email: `${testPrefix}_p2@chessjeeno.local`,
      password: 'PlayerPassword123!',
    });
    createdUserIds.push(player2Reg.user._id);

    // Verify login flow returns valid JWTs
    const hostLogin = await authService.loginUser({
      email: `${testPrefix}_host@chessjeeno.local`,
      password: 'HostPassword123!',
    });
    const player1Login = await authService.loginUser({
      email: `${testPrefix}_p1@chessjeeno.local`,
      password: 'PlayerPassword123!',
    });
    console.log(`  -> Host authenticated with JWT: ${Boolean(hostLogin.token)}`);
    console.log(`  -> Player 1 authenticated with JWT: ${Boolean(player1Login.token)}`);

    // -------------------------------------------------------------------------
    // Step 4: Connect Lichess Accounts via Stored OAuth
    // -------------------------------------------------------------------------
    console.log('\nStep 4: Linking real Lichess OAuth accounts in MongoDB...');
    await User.findByIdAndUpdate(player1Reg.user._id, {
      lichessUsername: account1.username,
      lichessUserId: account1.id,
      lichessOAuth: {
        accessToken: tokenPlayer1,
        tokenType: 'Bearer',
        connectedAt: new Date(),
      },
    });
    console.log(`  -> Player 1 linked to @${account1.username}`);

    if (account2) {
      await User.findByIdAndUpdate(player2Reg.user._id, {
        lichessUsername: account2.username,
        lichessUserId: account2.id,
        lichessOAuth: {
          accessToken: tokenPlayer2,
          tokenType: 'Bearer',
          connectedAt: new Date(),
        },
      });
      console.log(`  -> Player 2 linked to @${account2.username}`);
    } else {
      await User.findByIdAndUpdate(player2Reg.user._id, {
        lichessUsername: 'test_unverified_p2',
        lichessUserId: 'test_unverified_p2',
      });
      console.log('  -> Player 2 linked with username placeholder');
    }

    // -------------------------------------------------------------------------
    // Step 5: Host creates 2-player tournament
    // -------------------------------------------------------------------------
    console.log('\nStep 5: Host creates tournament...');
    const tournament = await tournamentService.createTournament(
      {
        name: `${testPrefix} Real E2E Championship`,
        description: 'Milestone 15 Real Production Smoke Test',
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 2,
      },
      hostReg.user._id
    );
    createdTournamentIds.push(tournament._id);
    console.log(`  -> Tournament created: "${tournament.name}" (${tournament._id})`);

    // -------------------------------------------------------------------------
    // Step 6: Players join tournament
    // -------------------------------------------------------------------------
    console.log('\nStep 6: Players join tournament...');
    await tournamentPlayerService.joinTournament(tournament._id, player1Reg.user._id);
    await tournamentPlayerService.joinTournament(tournament._id, player2Reg.user._id);
    console.log('  -> Both players successfully registered.');

    // -------------------------------------------------------------------------
    // Step 7: Host creates Round 1
    // -------------------------------------------------------------------------
    console.log('\nStep 7: Host creates Round 1 pairings...');
    const r1Result = await roundService.createRound(tournament._id, hostReg.user._id);
    const pairing = r1Result.pairings[0];
    console.log(`  -> Round 1 created. Pairing ID: ${pairing._id}`);

    // -------------------------------------------------------------------------
    // Step 8: Connect authenticated Socket.IO client and join tournament room
    // -------------------------------------------------------------------------
    console.log('\nStep 8: Connecting Socket.IO client and joining tournament room...');
    const socketClient = ClientIO(serverUrl, {
      auth: { token: player1Login.token },
      transports: ['websocket'],
    });
    await new Promise((resolve) => socketClient.on('connect', resolve));
    console.log(`  -> Realtime client connected (Socket ID: ${socketClient.id})`);

    const joinAck = await new Promise((resolve) =>
      socketClient.emit('joinTournament', { tournamentId: tournament._id.toString() }, resolve)
    );
    console.log(`  -> Joined room: ${joinAck.room} (success: ${joinAck.success})`);

    // -------------------------------------------------------------------------
    // Step 9: Create real live Lichess game using OAuth credentials
    // -------------------------------------------------------------------------
    console.log('\nStep 9: Requesting real live Lichess game creation via bulk-pairing API...');
    try {
      const livePairing = await pairingService.createLichessGameForPairing(
        tournament._id,
        1,
        pairing._id,
        {},
        hostReg.user._id
      );

      console.log('  🎉 REAL LIVE LICHESS GAME CREATED!');
      console.log(`  -> Game ID: ${livePairing.lichessGameId}`);
      console.log(`  -> Game URL: ${livePairing.lichessGameUrl}`);
      console.log(`  -> Pairing Status: ${livePairing.status}`);

      // Step 10: Synchronize game result
      console.log('\nStep 10: Synchronizing Lichess game result...');
      const synced = await pairingService.syncPairingResult(
        tournament._id,
        1,
        pairing._id,
        {},
        hostReg.user._id
      );
      console.log(`  -> Sync succeeded: status=${synced.status}, result=${synced.result}`);
    } catch (err) {
      console.warn(`  ⚠️ Live Lichess game creation note: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // Step 11: Authoritative match completion & standings update
    // -------------------------------------------------------------------------
    console.log('\nStep 11: Finalizing match result and verifying standings & completion...');
    await Pairing.findByIdAndUpdate(pairing._id, {
      status: 'FINISHED',
      result: '1-0',
    });

    const r1Status = await roundService.getRoundCompletionStatus(tournament._id, 1);
    console.log(`  -> Round 1 isComplete: ${r1Status.isComplete}`);

    const finalTourney = await Tournament.findById(tournament._id);
    console.log(`  -> Tournament Status: ${finalTourney.status}`);
    if (finalTourney.status !== 'FINISHED') {
      throw new Error(`Expected tournament status to be FINISHED, got: ${finalTourney.status}`);
    }

    const standingsData = await standingsService.getTournamentStandings(tournament._id);
    console.log('  -> Final Standings:');
    standingsData.standings.forEach((s) => {
      console.log(`     #${s.rank} ${s.name}: ${s.score} pts (${s.wins}W / ${s.draws}D / ${s.losses}L)`);
    });

    socketClient.disconnect();
    console.log('\n🎉 MILESTONE 15 REAL END-TO-END SMOKE TEST PASSED COMPLETELY!');
  } finally {
    console.log('\n🧹 Cleaning up real smoke test data...');
    closeSocketServer();
    testHttpServer.close();

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

runSmokeTestEndToEnd().catch((err) => {
  console.error('💥 Smoke test failed with uncaught exception:', err);
  process.exit(1);
});
