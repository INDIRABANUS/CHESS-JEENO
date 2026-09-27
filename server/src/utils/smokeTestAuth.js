import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';

const runRealSmokeTest = async () => {
  console.log('🚀 Running Real Local Auth API Smoke Test...\n');
  await connectDB();

  const timestamp = Date.now();
  const emailA = `smoke_a_${timestamp}@chessjeeno.local`;
  const emailB = `smoke_b_${timestamp}@chessjeeno.local`;
  const password = 'SuperSmokePassword99!';

  let tokenA = null;
  let userAId = null;
  let tokenB = null;
  let userBId = null;
  let tournamentId = null;

  try {
    // -------------------------------------------------------------
    // Step A: Register & Login User A, Create Tournament
    // -------------------------------------------------------------
    console.log('Step A1: Register User A');
    const regResA = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Smoke Host',
        email: emailA,
        password,
        lichessUsername: `lichess_smoke_a_${timestamp}`,
      }),
    });
    const regDataA = await regResA.json();
    if (regResA.status !== 201) throw new Error(`User A registration failed: ${regDataA.message}`);
    userAId = regDataA.data.user._id;
    console.log(`  -> User A registered (Name: ${regDataA.data.user.name})`);

    console.log('Step A2: Login User A & receive JWT');
    const loginResA = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password }),
    });
    const loginDataA = await loginResA.json();
    if (loginResA.status !== 200) throw new Error(`User A login failed: ${loginDataA.message}`);
    tokenA = loginDataA.data.token;
    console.log('  -> User A logged in successfully (JWT received and securely stored in memory)');

    console.log('Step A3: User A creates tournament');
    const tourneyRes = await fetch(`${API_BASE}/tournaments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: `Smoke Championship ${timestamp}`,
        description: 'Real smoke test tournament',
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 2,
      }),
    });
    const tourneyData = await tourneyRes.json();
    if (tourneyRes.status !== 201) throw new Error(`Tournament creation failed: ${tourneyData.message}`);
    tournamentId = tourneyData.data._id;
    console.log(`  -> Tournament created: "${tourneyData.data.name}" (ID: ${tournamentId})`);

    // -------------------------------------------------------------
    // Step B: Register & Login User B, Join User A's Tournament
    // -------------------------------------------------------------
    console.log('\nStep B1: Register User B');
    const regResB = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Smoke Player',
        email: emailB,
        password,
        lichessUsername: `lichess_smoke_b_${timestamp}`,
      }),
    });
    const regDataB = await regResB.json();
    if (regResB.status !== 201) throw new Error(`User B registration failed: ${regDataB.message}`);
    userBId = regDataB.data.user._id;
    console.log(`  -> User B registered (Name: ${regDataB.data.user.name})`);

    console.log('Step B2: Login User B & receive JWT');
    const loginResB = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password }),
    });
    const loginDataB = await loginResB.json();
    if (loginResB.status !== 200) throw new Error(`User B login failed: ${loginDataB.message}`);
    tokenB = loginDataB.data.token;
    console.log('  -> User B logged in successfully (JWT received and securely stored in memory)');

    // User A joins the tournament as Player 1
    console.log("Step B3: User A joins their own tournament");
    const joinResA = await fetch(`${API_BASE}/tournaments/${tournamentId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    if (joinResA.status !== 200) throw new Error('User A join failed');
    console.log('  -> User A joined tournament');

    console.log("Step B4: User B joins User A's tournament");
    const joinResB = await fetch(`${API_BASE}/tournaments/${tournamentId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    if (joinResB.status !== 200) throw new Error('User B join failed');
    console.log('  -> User B joined tournament (2 players registered, capacity reached)');

    // -------------------------------------------------------------
    // Step C: Verifications
    // -------------------------------------------------------------
    console.log('\n--- Step C: Verification of Ownership & Identity ---');

    // 1. User B cannot edit User A's tournament
    console.log("1. Verify User B CANNOT edit User A's tournament:");
    const editResB = await fetch(`${API_BASE}/tournaments/${tournamentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ name: 'Tampered Title' }),
    });
    const editDataB = await editResB.json();
    if (editResB.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for User B edit, got ${editResB.status}`);
    }
    console.log(`   ✅ Correctly rejected with HTTP 403 Forbidden: "${editDataB.message}"`);

    // 2. User B cannot delete User A's tournament
    console.log("2. Verify User B CANNOT delete User A's tournament:");
    const delResB = await fetch(`${API_BASE}/tournaments/${tournamentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const delDataB = await delResB.json();
    if (delResB.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for User B delete, got ${delResB.status}`);
    }
    console.log(`   ✅ Correctly rejected with HTTP 403 Forbidden: "${delDataB.message}"`);

    // 3. User A can edit the tournament
    console.log("3. Verify User A CAN edit their own tournament:");
    const editResA = await fetch(`${API_BASE}/tournaments/${tournamentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ description: 'Updated by authorized creator Alice' }),
    });
    const editDataA = await editResA.json();
    if (editResA.status !== 200) {
      throw new Error(`Expected HTTP 200 for User A edit, got ${editResA.status}: ${editDataA.message}`);
    }
    console.log(`   ✅ Successfully updated by User A: "${editDataA.data.description}"`);

    // 4. User A can create the next eligible round
    console.log("4. Verify User A CAN create the next eligible round:");
    const roundResA = await fetch(`${API_BASE}/tournaments/${tournamentId}/rounds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const roundDataA = await roundResA.json();
    if (roundResA.status !== 201) {
      throw new Error(`Expected HTTP 201 for User A round creation, got ${roundResA.status}: ${roundDataA.message}`);
    }
    console.log(`   ✅ Round ${roundDataA.data.round.roundNumber} created with ${roundDataA.data.pairings.length} pairing(s)`);

    // 5. /api/auth/me returns the correct identity for each JWT
    console.log("5. Verify /api/auth/me returns correct identity for each JWT:");
    const meResA = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const meDataA = await meResA.json();
    if (meResA.status !== 200 || meDataA.data?.user?._id !== userAId.toString()) {
      throw new Error('Identity mismatch for User A token');
    }
    console.log(`   ✅ Token A identifies: ${meDataA.data.user.name} (${meDataA.data.user.email})`);

    const meResB = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const meDataB = await meResB.json();
    if (meResB.status !== 200 || meDataB.data?.user?._id !== userBId.toString()) {
      throw new Error('Identity mismatch for User B token');
    }
    console.log(`   ✅ Token B identifies: ${meDataB.data.user.name} (${meDataB.data.user.email})`);

    console.log('\n🎉 ALL REAL SMOKE TEST VERIFICATIONS PASSED SUCCESSFULLY!\n');
  } finally {
    console.log('🧹 Cleaning up smoke test artifacts from database...');
    if (tournamentId) {
      await Tournament.findByIdAndDelete(tournamentId);
      await TournamentPlayer.deleteMany({ tournamentId });
      await Round.deleteMany({ tournamentId });
      await Pairing.deleteMany({ tournamentId });
    }
    if (userAId) await User.findByIdAndDelete(userAId);
    if (userBId) await User.findByIdAndDelete(userBId);
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
};

runRealSmokeTest().catch((err) => {
  console.error('\n❌ Real smoke test failed:', err);
  process.exit(1);
});
