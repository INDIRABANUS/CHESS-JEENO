import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Pairing from '../models/Pairing.js';
import Round from '../models/Round.js';
import Tournament from '../models/Tournament.js';
import { generateToken } from '../services/authService.js';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';
const TOURNAMENT_ID = '6ab9353fcb4da21c4e409711';

const runSmokeTest = async () => {
  console.log('🧪 Starting Milestone 8 Real API Smoke Test...');
  console.log(`🎯 Tournament ID: ${TOURNAMENT_ID}\n`);

  await mongoose.connect(process.env.MONGODB_URI);

  const tourney = await Tournament.findById(TOURNAMENT_ID);
  if (!tourney) throw new Error('Tournament not found');
  const hostToken = generateToken(tourney.createdBy);
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${hostToken}`,
  };

  // -------------------------------------------------------------
  // Step 0: Ensure Round 1 pairing is ready with real game p6GtWsRf
  // -------------------------------------------------------------
  const initialPairing = await Pairing.findOne({ tournamentId: TOURNAMENT_ID });
  if (!initialPairing || !initialPairing.lichessGameId) {
    throw new Error('Tournament does not have a real Lichess pairing in Round 1.');
  }
  const pairingId = initialPairing._id.toString();
  console.log(`♟️ Round 1 Pairing: ${pairingId} (Lichess Game: ${initialPairing.lichessGameId})`);

  // -------------------------------------------------------------
  // Step 4 Verification: Attempting to create next round BEFORE
  // completion is rejected with 400.
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Attempting next round while Round 1 is incomplete ---');
  // Temporarily set pairing status to ACTIVE
  await Pairing.findByIdAndUpdate(pairingId, { status: 'ACTIVE', result: 'PENDING' });

  // Check Round 1 completion status
  const preStatusRes = await fetch(`${API_BASE}/tournaments/${TOURNAMENT_ID}/rounds/1/status`);
  const preStatusData = await preStatusRes.json();
  console.log('Round 1 status when ACTIVE:', preStatusData.data);
  if (preStatusData.data.complete !== false) {
    throw new Error('Expected Round 1 to be incomplete while pairing is ACTIVE');
  }

  // Attempt POST /rounds while incomplete
  const rejectRes = await fetch(`${API_BASE}/tournaments/${TOURNAMENT_ID}/rounds`, {
    method: 'POST',
    headers: authHeaders,
  });
  const rejectData = await rejectRes.json();
  console.log(`HTTP Status: ${rejectRes.status} | Response:`, rejectData);
  if (rejectRes.status !== 400) {
    throw new Error(`Expected HTTP 400, got ${rejectRes.status}`);
  }
  if (!rejectData.message.includes('Previous round is not complete')) {
    throw new Error(`Expected 'Previous round is not complete' error message, got: ${rejectData.message}`);
  }
  console.log('✅ PASS: Creating next round blocked while previous round is incomplete.');

  // -------------------------------------------------------------
  // Step 1: Sync the real finished game
  // -------------------------------------------------------------
  console.log('\n--- Step 1: Syncing Real Finished Game via API ---');
  const syncRes = await fetch(
    `${API_BASE}/tournaments/${TOURNAMENT_ID}/rounds/1/pairings/${pairingId}/sync`,
    {
      method: 'POST',
      headers: authHeaders,
    }
  );
  const syncData = await syncRes.json();
  console.log(`Sync HTTP Status: ${syncRes.status} | Result:`, {
    status: syncData.data?.status,
    result: syncData.data?.result,
    lichessStatus: syncData.data?.lichessStatus,
  });
  if (syncRes.status !== 200 || syncData.data?.status !== 'FINISHED' || syncData.data?.result !== '0-1') {
    throw new Error(`Expected synchronized FINISHED result 0-1, got ${JSON.stringify(syncData)}`);
  }
  console.log('✅ PASS: Real Lichess game p6GtWsRf synchronized to FINISHED (0-1).');

  // -------------------------------------------------------------
  // Step 2: GET /api/tournaments/:id/standings
  // -------------------------------------------------------------
  console.log('\n--- Step 2: Verifying Standings API ---');
  const standingsRes = await fetch(`${API_BASE}/tournaments/${TOURNAMENT_ID}/standings`);
  const standingsData = await standingsRes.json();
  console.log('Standings response:');
  console.table(
    standingsData.data.standings.map((s) => ({
      Rank: s.rank,
      Name: s.name,
      Lichess: s.lichessUsername,
      Score: s.score,
      W: s.wins,
      D: s.draws,
      L: s.losses,
      Games: s.completedGames,
    }))
  );

  const indira = standingsData.data.standings.find((s) => s.name === 'indirabanus');
  const host = standingsData.data.standings.find((s) => s.name === 'CHESS JEENO Host');
  const pavakka = standingsData.data.standings.find((s) => s.name === 'pavakka_ib');

  if (!indira || indira.score !== 1 || indira.wins !== 1 || indira.completedGames !== 1) {
    throw new Error(`Indirabanus score calculation incorrect: ${JSON.stringify(indira)}`);
  }
  if (!host || host.score !== 1 || host.wins !== 1 || host.completedGames !== 0) {
    throw new Error(`Host BYE score calculation incorrect: ${JSON.stringify(host)}`);
  }
  if (!pavakka || pavakka.score !== 0 || pavakka.losses !== 1 || pavakka.completedGames !== 1) {
    throw new Error(`Pavakka score calculation incorrect: ${JSON.stringify(pavakka)}`);
  }
  console.log('✅ PASS: Standings calculated correctly from match results and BYEs.');

  // -------------------------------------------------------------
  // Step 3: Round status reports complete only when every pairing is terminal
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Verifying Round 1 Completion Status ---');
  const roundStatusRes = await fetch(`${API_BASE}/tournaments/${TOURNAMENT_ID}/rounds/1/status`);
  const roundStatusData = await roundStatusRes.json();
  console.log('Round 1 status after sync:', roundStatusData.data);
  if (
    !roundStatusData.data.complete ||
    roundStatusData.data.finishedPairings !== 1 ||
    roundStatusData.data.pendingPairings !== 0 ||
    roundStatusData.data.activePairings !== 0
  ) {
    throw new Error(`Expected Round 1 complete=true with 1 finished pairing: ${JSON.stringify(roundStatusData)}`);
  }
  console.log('✅ PASS: Round 1 reports complete = true after all pairings terminal.');

  // -------------------------------------------------------------
  // Step 5: After all Round 1 pairings synchronized, create Round 2
  // -------------------------------------------------------------
  console.log('\n--- Step 5: Creating Round 2 ---');
  const createR2Res = await fetch(`${API_BASE}/tournaments/${TOURNAMENT_ID}/rounds`, {
    method: 'POST',
    headers: authHeaders,
  });
  const createR2Data = await createR2Res.json();
  console.log(`Create Round 2 HTTP Status: ${createR2Res.status}`);
  if (createR2Res.status !== 201) {
    throw new Error(`Failed to create Round 2: ${JSON.stringify(createR2Data)}`);
  }
  const round2 = createR2Data.data.round;
  const round2Pairings = createR2Data.data.pairings;
  console.log(`Created Round ${round2.roundNumber} with ${round2Pairings.length} pairing(s) and BYE player: ${round2.byePlayer?.name || round2.byePlayer}`);
  console.log('Round 2 Matchup:', `${round2Pairings[0]?.whitePlayer?.name} vs ${round2Pairings[0]?.blackPlayer?.name}`);
  console.log('✅ PASS: Round 2 successfully created.');

  // -------------------------------------------------------------
  // Step 6 & 7: Verify Round 2 pairings and 0 duplicate matchups
  // -------------------------------------------------------------
  console.log('\n--- Steps 6 & 7: Verifying Matchup Uniqueness ---');
  const allRoundsRes = await fetch(`${API_BASE}/tournaments/${TOURNAMENT_ID}/rounds`);
  const allRoundsData = await allRoundsRes.json();
  const allRounds = allRoundsData.data;

  const matchups = [];
  const matchupSet = new Set();
  let duplicateCount = 0;

  for (const r of allRounds) {
    for (const p of r.pairings) {
      const p1 = p.whitePlayer._id || p.whitePlayer;
      const p2 = p.blackPlayer._id || p.blackPlayer;
      const key = [p1.toString(), p2.toString()].sort().join('_vs_');
      const label = `${p.whitePlayer?.name || p1} vs ${p.blackPlayer?.name || p2}`;
      matchups.push({ round: r.roundNumber, label, key });
      if (matchupSet.has(key)) {
        duplicateCount++;
      }
      matchupSet.add(key);
    }
  }

  console.log('Existing Matchups Across All Rounds:');
  console.table(matchups);
  console.log(`Number of duplicate matchups found: ${duplicateCount}`);
  if (duplicateCount !== 0) {
    throw new Error(`Found ${duplicateCount} duplicate matchups! Expected 0.`);
  }
  console.log('✅ PASS: Matchup uniqueness guaranteed. 0 duplicate matchups found.');

  // -------------------------------------------------------------
  // Step 8: Verify Round 2 pairings have lichessGameId = null
  // -------------------------------------------------------------
  console.log('\n--- Step 8: Verifying Round 2 Pairing has lichessGameId = null ---');
  for (const p of round2Pairings) {
    console.log(`Pairing ${p._id}: lichessGameId = ${p.lichessGameId}`);
    if (p.lichessGameId !== null) {
      throw new Error(`Expected lichessGameId to be null, got: ${p.lichessGameId}`);
    }
  }
  console.log('✅ PASS: Round 2 pairings have lichessGameId = null (no auto-created Lichess games).');

  // -------------------------------------------------------------
  // Step 9: Verify standings remain correct after Round 2 is created
  // -------------------------------------------------------------
  console.log('\n--- Step 9: Verifying Standings After Round 2 Creation ---');
  const postStandingsRes = await fetch(`${API_BASE}/tournaments/${TOURNAMENT_ID}/standings`);
  const postStandingsData = await postStandingsRes.json();
  console.table(
    postStandingsData.data.standings.map((s) => ({
      Rank: s.rank,
      Name: s.name,
      Score: s.score,
      W: s.wins,
      D: s.draws,
      L: s.losses,
      Games: s.completedGames,
    }))
  );

  const postIndira = postStandingsData.data.standings.find((s) => s.name === 'indirabanus');
  const postHost = postStandingsData.data.standings.find((s) => s.name === 'CHESS JEENO Host');
  const postPavakka = postStandingsData.data.standings.find((s) => s.name === 'pavakka_ib');
  if (postIndira.score !== 1 || postHost.score !== 1 || postPavakka.score !== 1) {
    throw new Error('Standings changed unexpectedly after Round 2 creation');
  }
  console.log('✅ PASS: Standings remain consistent after Round 2 is created (Pavakka receives Round 2 BYE point).');

  // -------------------------------------------------------------
  // Verification: Token Safety
  // -------------------------------------------------------------
  console.log('\n--- Token Safety Check ---');
  const envText = JSON.stringify(standingsData) + JSON.stringify(postStandingsData) + JSON.stringify(allRoundsData);
  const tokenRegex = /lip_[a-zA-Z0-9]{20,}/;
  if (tokenRegex.test(envText)) {
    throw new Error('CRITICAL: Lichess API token exposed in API responses!');
  }
  console.log('✅ PASS: No API tokens exposed or logged in API responses.');

  await mongoose.disconnect();
  console.log('\n🎉 ALL REAL API SMOKE TEST VERIFICATIONS PASSED SUCCESSFULLY!\n');
};

runSmokeTest().catch((err) => {
  console.error('\n❌ Real API Smoke Test Failed:', err);
  process.exit(1);
});
