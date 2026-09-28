import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import * as roundService from '../services/roundService.js';
import * as standingsService from '../services/standingsService.js';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';

async function runRealSwissSmokeTest() {
  console.log('🧪 Starting Real Swiss Tournament API / Database Smoke Test...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `smoke_swiss_${timestamp}`;
  const createdUserIds = [];
  let tournamentId = null;

  try {
    // 1. Register host and 4 players
    console.log('--- Step 1: Creating Host and 4 Players ---');
    const hostRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Swiss Host',
        email: `${testPrefix}_host@chessjeeno.local`,
        password: 'Password123!',
      }),
    });
    const hostData = await hostRes.json();
    const hostToken = hostData.data?.token || hostData.token;
    const hostUser = hostData.data?.user || hostData.user;
    if (!hostToken || !hostUser) throw new Error(`Host registration failed: ${JSON.stringify(hostData)}`);
    createdUserIds.push(hostUser._id);
    console.log(`  ✅ Host registered: ${hostUser.name} (${hostUser.email})`);

    const players = [];
    const playerTokens = [];
    for (let i = 1; i <= 4; i++) {
      const pRes = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Swiss Player ${i}`,
          email: `${testPrefix}_p${i}@chessjeeno.local`,
          password: 'Password123!',
        }),
      });
      const pData = await pRes.json();
      const pToken = pData.data?.token || pData.token;
      const pUser = pData.data?.user || pData.user;
      if (!pToken || !pUser) throw new Error(`Player ${i} registration failed: ${JSON.stringify(pData)}`);
      createdUserIds.push(pUser._id);
      players.push(pUser);
      playerTokens.push(pToken);
    }
    console.log(`  ✅ 4 players registered successfully.`);

    // 2. Host creates a Swiss tournament with totalRounds: 2
    console.log('\n--- Step 2: Host Creates 2-Round Swiss Tournament ---');
    const tourneyRes = await fetch(`${API_BASE}/tournaments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        name: `${testPrefix} Championship`,
        description: 'Real smoke test Swiss tournament',
        format: 'SWISS',
        totalRounds: 2,
        clockLimit: 300,
        increment: 0,
        maxPlayers: 8,
      }),
    });
    const tourneyData = await tourneyRes.json();
    if (!tourneyData.data?._id) throw new Error(`Tournament creation failed: ${JSON.stringify(tourneyData)}`);
    tournamentId = tourneyData.data._id;
    console.log(`  ✅ Swiss tournament created: "${tourneyData.data.name}" (totalRounds: ${tourneyData.data.totalRounds})`);

    // 3. 4 Players join the tournament
    console.log('\n--- Step 3: Players Join Tournament ---');
    for (let i = 0; i < 4; i++) {
      const joinRes = await fetch(`${API_BASE}/tournaments/${tournamentId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerTokens[i]}`,
        },
      });
      const joinData = await joinRes.json();
      if (!joinData.success) throw new Error(`Player ${i + 1} join failed: ${JSON.stringify(joinData)}`);
    }
    console.log('  ✅ All 4 players joined the tournament.');

    // 4. Host creates Round 1
    console.log('\n--- Step 4: Host Creates Swiss Round 1 ---');
    const r1Res = await fetch(`${API_BASE}/tournaments/${tournamentId}/rounds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({ roundNumber: 1 }),
    });
    const r1Data = await r1Res.json();
    if (!r1Data.success) throw new Error(`Round 1 creation failed: ${JSON.stringify(r1Data)}`);
    console.log(`  ✅ Round 1 created. Number of pairings: ${r1Data.data.pairings.length}`);
    if (r1Data.data.pairings.length !== 2) throw new Error('Expected 2 pairings in Round 1');

    const round1Pairings = r1Data.data.pairings;
    const match1 = round1Pairings[0];
    const match2 = round1Pairings[1];

    // 5. Complete Round 1 matches in database
    console.log('\n--- Step 5: Complete Round 1 Matches ---');
    // Match 1: White wins (1-0)
    await Pairing.findByIdAndUpdate(match1._id, {
      status: 'FINISHED',
      result: '1-0',
    });
    // Match 2: Black wins (0-1)
    await Pairing.findByIdAndUpdate(match2._id, {
      status: 'FINISHED',
      result: '0-1',
    });

    const r1Status = await roundService.getRoundCompletionStatus(tournamentId, 1);
    if (!r1Status.complete && !r1Status.isComplete) throw new Error('Round 1 should be complete');
    console.log('  ✅ Round 1 completed. Results: Match 1 = 1-0, Match 2 = 0-1.');

    // 6. Host creates Round 2 (Swiss pairings should group 1.0 vs 1.0 and 0.0 vs 0.0)
    console.log('\n--- Step 6: Host Creates Swiss Round 2 (Score Group Pairing) ---');
    const r2Res = await fetch(`${API_BASE}/tournaments/${tournamentId}/rounds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({ roundNumber: 2 }),
    });
    const r2Data = await r2Res.json();
    if (!r2Data.success) throw new Error(`Round 2 creation failed: ${JSON.stringify(r2Data)}`);
    console.log(`  ✅ Round 2 created. Number of pairings: ${r2Data.data.pairings.length}`);

    const r2Pairings = r2Data.data.pairings;
    const r1MatchupKeys = new Set([
      `${match1.whitePlayer._id || match1.whitePlayer}_${match1.blackPlayer._id || match1.blackPlayer}`,
      `${match1.blackPlayer._id || match1.blackPlayer}_${match1.whitePlayer._id || match1.whitePlayer}`,
      `${match2.whitePlayer._id || match2.whitePlayer}_${match2.blackPlayer._id || match2.blackPlayer}`,
      `${match2.blackPlayer._id || match2.blackPlayer}_${match2.whitePlayer._id || match2.whitePlayer}`,
    ]);

    for (const p of r2Pairings) {
      const w = (p.whitePlayer._id || p.whitePlayer).toString();
      const b = (p.blackPlayer._id || p.blackPlayer).toString();
      const key = `${w}_${b}`;
      if (r1MatchupKeys.has(key)) {
        throw new Error(`Round 2 repeated opponent! Key: ${key}`);
      }
    }
    console.log('  ✅ Round 2 pairings verified: No repeat opponents.');

    // 7. Complete Round 2 matches
    console.log('\n--- Step 7: Complete Round 2 Matches ---');
    await Pairing.findByIdAndUpdate(r2Pairings[0]._id, {
      status: 'FINISHED',
      result: '1-0',
    });
    await Pairing.findByIdAndUpdate(r2Pairings[1]._id, {
      status: 'FINISHED',
      result: '1/2-1/2',
    });

    const r2Status = await roundService.getRoundCompletionStatus(tournamentId, 2);
    if (!r2Status.complete && !r2Status.isComplete) throw new Error('Round 2 should be complete');
    console.log('  ✅ Round 2 completed.');

    // 8. Verify Tournament Automatically Transitions to FINISHED
    console.log('\n--- Step 8: Verify Tournament Automatically Transitions to FINISHED ---');
    const finalTourney = await Tournament.findById(tournamentId);
    if (finalTourney.status !== 'FINISHED') {
      throw new Error(`Expected tournament status to be FINISHED, got: ${finalTourney.status}`);
    }
    console.log(`  ✅ Swiss tournament status is FINISHED.`);

    // 9. Verify Round 3 is blocked
    console.log('\n--- Step 9: Verify Round 3 is Blocked Beyond totalRounds ---');
    const r3Res = await fetch(`${API_BASE}/tournaments/${tournamentId}/rounds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({ roundNumber: 3 }),
    });
    if (r3Res.status !== 400) {
      throw new Error(`Expected 400 for Round 3, got: ${r3Res.status}`);
    }
    const r3Data = await r3Res.json();
    console.log(`  ✅ Round 3 correctly rejected with 400: "${r3Data.message}"`);

    // 10. Verify Standings
    console.log('\n--- Step 10: Verify Tournament Standings ---');
    const standingsRes = await fetch(`${API_BASE}/tournaments/${tournamentId}/standings`);
    const standingsData = await standingsRes.json();
    if (!standingsData.success || !standingsData.data) throw new Error('Failed to retrieve standings');
    console.log('  ✅ Standings retrieved successfully:');
    const standingsList = Array.isArray(standingsData.data) ? standingsData.data : (standingsData.data.standings || []);
    standingsList.forEach((s) => {
      console.log(`     #${s.rank} ${s.name}: ${s.score} pts (${s.wins}W / ${s.draws}D / ${s.losses}L)`);
    });

    console.log('\n🎉 Real Swiss Smoke Test PASSED SUCCESSFULLY!');
  } finally {
    console.log('\n🧹 Cleaning up test data...');
    if (tournamentId) {
      await Pairing.deleteMany({ tournamentId });
      await Round.deleteMany({ tournamentId });
      await TournamentPlayer.deleteMany({ tournamentId });
      await Tournament.findByIdAndDelete(tournamentId);
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('✨ Cleanup complete.');
    await mongoose.connection.close();
  }
}

runRealSwissSmokeTest().catch((err) => {
  console.error('💥 Smoke test failed:', err);
  process.exit(1);
});
