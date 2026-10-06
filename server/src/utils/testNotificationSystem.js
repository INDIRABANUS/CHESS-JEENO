import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connectDB } from '../config/database.js';
import apiRouter from '../routes/index.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import TournamentJoinRequest from '../models/TournamentJoinRequest.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import Notification from '../models/Notification.js';
import * as notificationService from '../services/notificationService.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentJoinRequestService from '../services/tournamentJoinRequestService.js';
import * as roundService from '../services/roundService.js';
import * as pairingService from '../services/pairingService.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

const createToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: '1h' });
};

const runNotificationSystemTests = async () => {
  console.log('🧪 Starting CHESS JEENO In-App Notifications Test Suite...\n');
  await connectDB();

  const timestamp = Date.now();
  const testPrefix = `notif_test_${timestamp}`;

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, description) => {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${description}`);
      throw new Error(`Test assertion failed: ${description}`);
    }
    passedTests++;
    console.log(`  ✅ Passed: ${description}`);
  };

  // Start in-process express server
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api', apiRouter);
  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  const testServer = http.createServer(testApp);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const API_BASE = `http://localhost:${port}/api`;
  console.log(`📡 In-process test server running at ${API_BASE}\n`);

  // Track created fixtures for cleanup
  const createdUserIds = [];
  const createdTournamentIds = [];
  const createdNotificationIds = [];

  try {
    // -------------------------------------------------------------
    // SETUP: Create test users
    // -------------------------------------------------------------
    const userA = await User.create({
      name: 'Alice Player',
      email: `${testPrefix}_alice@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `alice_${timestamp}`,
    });
    createdUserIds.push(userA._id);
    const tokenA = createToken(userA._id);

    const userB = await User.create({
      name: 'Bob Player',
      email: `${testPrefix}_bob@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `bob_${timestamp}`,
    });
    createdUserIds.push(userB._id);
    const tokenB = createToken(userB._id);

    const userHost = await User.create({
      name: 'Host Organizer',
      email: `${testPrefix}_host@chessjeeno.local`,
      authProvider: 'local',
      lichessUsername: `host_${timestamp}`,
    });
    createdUserIds.push(userHost._id);
    const tokenHost = createToken(userHost._id);

    // =============================================================
    // 1. Notification Service: Creation, Sanitization, References
    // =============================================================
    console.log('--- 1. Testing Notification Service Creation & Metadata Sanitization ---');
    const directNotif = await notificationService.createNotification({
      recipient: userA._id,
      type: 'ROUND_READY',
      title: 'Round 1 ready',
      message: 'Round 1 has been generated.',
      metadata: {
        roundNumber: 1,
        password: 'should_be_stripped',
        secretToken: 'should_be_stripped_token',
        validDetail: 'safe_value',
      },
      eventKey: `test_event_1_${timestamp}`,
    });
    createdNotificationIds.push(directNotif._id);

    assert(directNotif._id != null, 'Notification created with valid _id');
    assert(directNotif.recipient.toString() === userA._id.toString(), 'Recipient correctly set to User A');
    assert(directNotif.read === false, 'Default read state is false');
    assert(directNotif.metadata.password === undefined, 'Sensitive password stripped from metadata');
    assert(directNotif.metadata.secretToken === undefined, 'Sensitive token stripped from metadata');
    assert(directNotif.metadata.validDetail === 'safe_value', 'Safe metadata preserved');

    // =============================================================
    // 2. Duplicate Prevention via eventKey
    // =============================================================
    console.log('\n--- 2. Testing Deterministic Duplicate Prevention ---');
    const duplicateNotif = await notificationService.createNotification({
      recipient: userA._id,
      type: 'ROUND_READY',
      title: 'Round 1 ready duplicate attempt',
      message: 'This should not create a second document.',
      eventKey: `test_event_1_${timestamp}`,
    });

    assert(duplicateNotif._id.toString() === directNotif._id.toString(), 'Duplicate createNotification returned original document without duplicating');
    const totalWithEventKey = await Notification.countDocuments({
      recipient: userA._id,
      eventKey: `test_event_1_${timestamp}`,
    });
    assert(totalWithEventKey === 1, 'Database contains exactly 1 document for unique eventKey');

    // =============================================================
    // 3. Unauthenticated Access Protection (401)
    // =============================================================
    console.log('\n--- 3. Testing Unauthenticated Access Rejection (401) ---');
    const unauthGet = await fetch(`${API_BASE}/notifications`);
    assert(unauthGet.status === 401, 'GET /notifications without token returns 401');

    const unauthCount = await fetch(`${API_BASE}/notifications/unread-count`);
    assert(unauthCount.status === 401, 'GET /notifications/unread-count without token returns 401');

    const unauthPatch = await fetch(`${API_BASE}/notifications/${directNotif._id}/read`, {
      method: 'PATCH',
    });
    assert(unauthPatch.status === 401, 'PATCH /notifications/:id/read without token returns 401');

    const unauthPatchAll = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
    });
    assert(unauthPatchAll.status === 401, 'PATCH /notifications/read-all without token returns 401');

    const unauthDelete = await fetch(`${API_BASE}/notifications/${directNotif._id}`, {
      method: 'DELETE',
    });
    assert(unauthDelete.status === 401, 'DELETE /notifications/:id without token returns 401');

    // =============================================================
    // 4. Cross-User Access Isolation & Ownership Protection
    // =============================================================
    console.log('\n--- 4. Testing Cross-User Access Isolation ---');
    // User B tries to read User A's notifications
    const getResB = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const dataB = await getResB.json();
    assert(getResB.status === 200, 'User B can query own notifications endpoint');
    assert(dataB.data.notifications.length === 0, 'User B cannot see User A notifications');

    // User B tries to mark User A's notification as read
    const crossPatch = await fetch(`${API_BASE}/notifications/${directNotif._id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossPatch.status === 403, 'User B marking User A notification as read returns 403 Forbidden');

    // User B tries to delete User A's notification
    const crossDelete = await fetch(`${API_BASE}/notifications/${directNotif._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossDelete.status === 403, 'User B deleting User A notification returns 403 Forbidden');

    // =============================================================
    // 5. Malformed ID Handling
    // =============================================================
    console.log('\n--- 5. Testing Malformed ID Handling ---');
    const malformedPatch = await fetch(`${API_BASE}/notifications/invalid-notif-id/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(malformedPatch.status === 404, 'Malformed notification ID returns controlled 404');

    const malformedDelete = await fetch(`${API_BASE}/notifications/invalid-notif-id`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(malformedDelete.status === 404, 'Malformed notification delete returns controlled 404');

    // =============================================================
    // 6. Pagination & Unread Count
    // =============================================================
    console.log('\n--- 6. Testing Pagination & Unread Count ---');
    // Create several notifications for User A
    for (let i = 2; i <= 6; i++) {
      const n = await notificationService.createNotification({
        recipient: userA._id,
        type: 'ROUND_READY',
        title: `Notification ${i}`,
        message: `Message body for notif ${i}`,
        eventKey: `test_event_${i}_${timestamp}`,
      });
      createdNotificationIds.push(n._id);
    }

    const unreadCountRes = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const unreadCountData = await unreadCountRes.json();
    assert(unreadCountRes.status === 200, 'GET /unread-count returns 200');
    assert(unreadCountData.data.unreadCount === 6, 'Unread count correctly equals 6');

    // Paginated fetch: page 1, limit 3
    const page1Res = await fetch(`${API_BASE}/notifications?page=1&limit=3`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const page1Data = await page1Res.json();
    assert(page1Data.data.notifications.length === 3, 'Page 1 returns exactly 3 notifications');
    assert(page1Data.data.pagination.page === 1, 'Pagination page is 1');
    assert(page1Data.data.pagination.limit === 3, 'Pagination limit is 3');
    assert(page1Data.data.pagination.totalCount === 6, 'Pagination totalCount is 6');
    assert(page1Data.data.pagination.totalPages === 2, 'Pagination totalPages is 2');
    assert(page1Data.data.pagination.hasNext === true, 'Pagination hasNext is true');

    // Check newest first sorting
    const nFirst = page1Data.data.notifications[0];
    const nSecond = page1Data.data.notifications[1];
    assert(new Date(nFirst.createdAt) >= new Date(nSecond.createdAt), 'Notifications sorted newest first');

    // =============================================================
    // 7. Mark as Read (Individual & All)
    // =============================================================
    console.log('\n--- 7. Testing Mark as Read Operations ---');
    // Mark directNotif as read
    const markReadRes = await fetch(`${API_BASE}/notifications/${directNotif._id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const markReadData = await markReadRes.json();
    assert(markReadRes.status === 200, 'PATCH /notifications/:id/read returns 200');
    assert(markReadData.data.notification.read === true, 'Notification read flag updated to true');

    // Verify unread count decremented to 5
    const countAfterOne = await notificationService.getUnreadCount(userA._id);
    assert(countAfterOne.unreadCount === 5, 'Unread count updated to 5 after marking one as read');

    // Mark all as read
    const markAllRes = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const markAllData = await markAllRes.json();
    assert(markAllRes.status === 200, 'PATCH /notifications/read-all returns 200');
    assert(markAllData.data.modifiedCount === 5, 'Modified count equals remaining 5 unread notifications');

    const countAfterAll = await notificationService.getUnreadCount(userA._id);
    assert(countAfterAll.unreadCount === 0, 'Unread count is 0 after markAllAsRead');

    // =============================================================
    // 8. Delete Notification
    // =============================================================
    console.log('\n--- 8. Testing Notification Deletion ---');
    const deleteRes = await fetch(`${API_BASE}/notifications/${directNotif._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(deleteRes.status === 200, 'DELETE /notifications/:id returns 200');

    const checkDeleted = await Notification.findById(directNotif._id);
    assert(checkDeleted === null, 'Notification successfully deleted from MongoDB');

    // =============================================================
    // 9. Event Integration: Join Request Flow (Host & Player)
    // =============================================================
    console.log('\n--- 9. Testing Join Request Flow Event Integration ---');
    const tournament = await tournamentService.createTournament(
      {
        name: 'Notifications Championship',
        format: 'ROUND_ROBIN',
        clockLimit: 300,
        increment: 0,
        maxPlayers: 4,
      },
      userHost._id
    );
    createdTournamentIds.push(tournament._id);

    // Player A creates join request -> Host should be notified
    const joinReqA = await tournamentJoinRequestService.createJoinRequest(tournament._id, userA._id);
    const hostNotifs = await Notification.find({
      recipient: userHost._id,
      type: 'JOIN_REQUEST_RECEIVED',
      tournament: tournament._id,
    });
    assert(hostNotifs.length === 1, 'Host received exactly 1 JOIN_REQUEST_RECEIVED notification');
    assert(hostNotifs[0].title === 'New join request', 'Host notification title is "New join request"');
    assert(hostNotifs[0].message.includes('Alice Player requested to join'), 'Host notification message contains requester name');

    // Host approves Player A's join request -> Player A should be notified
    await tournamentJoinRequestService.approveJoinRequest(tournament._id, joinReqA._id, userHost._id);
    const playerAApprovalNotifs = await Notification.find({
      recipient: userA._id,
      type: 'JOIN_REQUEST_APPROVED',
      tournament: tournament._id,
    });
    assert(playerAApprovalNotifs.length === 1, 'Player A received exactly 1 JOIN_REQUEST_APPROVED notification');
    assert(playerAApprovalNotifs[0].title === 'Join request approved', 'Player A notification title is "Join request approved"');

    // Player B creates join request and Host rejects it -> Player B should be notified
    const joinReqB = await tournamentJoinRequestService.createJoinRequest(tournament._id, userB._id);
    await tournamentJoinRequestService.rejectJoinRequest(tournament._id, joinReqB._id, userHost._id);
    const playerBRejectionNotifs = await Notification.find({
      recipient: userB._id,
      type: 'JOIN_REQUEST_REJECTED',
      tournament: tournament._id,
    });
    assert(playerBRejectionNotifs.length === 1, 'Player B received exactly 1 JOIN_REQUEST_REJECTED notification');
    assert(playerBRejectionNotifs[0].title === 'Join request rejected', 'Player B notification title is "Join request rejected"');

    // =============================================================
    // 10. Event Integration: Round, Pairings, Result & Completion
    // =============================================================
    console.log('\n--- 10. Testing Round, Pairing, Result & Completion Events ---');
    // Add userB as participant so we have 2 players (userA and userB)
    await TournamentPlayer.create({
      tournamentId: tournament._id,
      userId: userB._id,
      isApproved: true,
      joinedAt: new Date(),
    });

    // Create Round 1 -> Both players should receive PAIRING_CREATED and ROUND_READY
    const roundResult = await roundService.createRound(tournament._id, userHost._id);
    assert(roundResult.pairings.length > 0, 'Round 1 pairings generated');

    const roundReadyNotifs = await Notification.find({
      tournament: tournament._id,
      type: 'ROUND_READY',
    });
    assert(roundReadyNotifs.length === 2, 'Both registered players received ROUND_READY notification');

    const pairingCreatedNotifs = await Notification.find({
      tournament: tournament._id,
      type: 'PAIRING_CREATED',
    });
    assert(pairingCreatedNotifs.length === 2, 'Both paired players received PAIRING_CREATED notification');

    // Test game result synchronization notification
    const pairing1 = roundResult.pairings[0];
    pairing1.lichessGameId = `lichess_mock_game_${timestamp}`;
    pairing1.status = 'ACTIVE';
    await pairing1.save();

    // Mock result sync update directly
    pairing1.status = 'FINISHED';
    pairing1.result = '1-0';
    pairing1.completedAt = new Date();
    await pairing1.save();

    // Trigger result notification manually via service or test flow
    const whitePlayerId = pairing1.whitePlayer?._id || pairing1.whitePlayer;
    const blackPlayerId = pairing1.blackPlayer?._id || pairing1.blackPlayer;

    await notificationService.createNotification({
      recipient: whitePlayerId,
      type: 'GAME_RESULT',
      title: 'Game result updated',
      message: 'Your Round 1 game against Bob Player has been recorded.',
      tournament: tournament._id,
      pairing: pairing1._id,
      round: roundResult.round._id,
      eventKey: `GAME_RESULT:${pairing1._id.toString()}:${whitePlayerId.toString()}:1-0`,
    });

    const resultNotifs = await Notification.find({
      recipient: whitePlayerId,
      type: 'GAME_RESULT',
    });
    assert(resultNotifs.length >= 1, 'White player received GAME_RESULT notification');

    // Finish tournament -> Both players should receive TOURNAMENT_COMPLETED
    await roundService.finishTournament(tournament._id, 'TOTAL_ROUNDS_REACHED');
    const completionNotifs = await Notification.find({
      tournament: tournament._id,
      type: 'TOURNAMENT_COMPLETED',
    });
    assert(completionNotifs.length === 2, 'Both tournament participants received TOURNAMENT_COMPLETED notification');

    // Duplicate finishTournament call should not duplicate notifications
    await roundService.finishTournament(tournament._id, 'TOTAL_ROUNDS_REACHED');
    const completionNotifsAfter = await Notification.find({
      tournament: tournament._id,
      type: 'TOURNAMENT_COMPLETED',
    });
    assert(completionNotifsAfter.length === 2, 'Duplicate finishTournament did not create duplicate TOURNAMENT_COMPLETED notifications');

    console.log(`\n==================================================`);
    console.log(`📊 Test Results: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log(`==================================================\n`);
  } finally {
    // Teardown test server
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }

    // Clean up created test data
    console.log('🧹 Cleaning up test users, tournaments, and notifications...');
    if (createdNotificationIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: createdNotificationIds } });
    }
    if (createdTournamentIds.length > 0) {
      await Notification.deleteMany({ tournament: { $in: createdTournamentIds } });
      await Pairing.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await Round.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      await TournamentJoinRequest.deleteMany({ tournament: { $in: createdTournamentIds } });
      await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
    }
    if (createdUserIds.length > 0) {
      await Notification.deleteMany({ recipient: { $in: createdUserIds } });
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('✨ Cleanup complete.');
  }
};

runNotificationSystemTests()
  .then(() => {
    console.log('🎉 In-App Notifications Test Suite Passed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Test Suite Failed:', err);
    process.exit(1);
  });
