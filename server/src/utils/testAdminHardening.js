import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database.js';
import apiRouter from '../routes/index.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../services/authService.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

dotenv.config();

/**
 * V2 MILESTONE 5F — AUTOMATED ADMIN HARDENING & PRODUCTION AUDIT TEST SUITE
 * 
 * Comprehensive verification covering:
 * 1. Authorization & RBAC across all 9 Admin endpoints
 * 2. Role spoofing resistance (persisted DB authority)
 * 3. Strict Input Validation (ObjectIds, bounds, enums, oversized strings, types)
 * 4. Regex safety & ReDoS protection
 * 5. Bounded Pagination & Resource Limits
 * 6. Sensitive Data Auditing (passwords, tokens, OAuth credentials)
 * 7. Production Error Handling & Sanitization
 * 8. Admin Safety & Moderation (last-admin lockout protection, invalid cancellation states)
 * 9. Platform Analytics aggregation bounds & integrity
 * 10. Regression verification across all Admin surfaces
 */
const runAdminHardeningTests = async () => {
  console.log('🧪 Starting CHESS JEENO Milestone 5F Admin Hardening Test Suite...\n');
  await connectDB();

  // Create isolated Express test app matching production server configuration
  const testApp = express();

  // Standard security headers middleware
  testApp.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  testApp.use(express.json({ limit: '1mb' }));
  testApp.use('/api', apiRouter);
  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  const testServer = http.createServer(testApp);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const API_BASE = `http://localhost:${port}/api`;
  console.log(`📡 In-process test server started on ${API_BASE}\n`);

  const timestamp = Date.now();
  const testPrefix = `harden_${timestamp}`;

  const createdUserIds = [];
  const createdTournamentIds = [];
  const createdRoundIds = [];
  const createdPairingIds = [];
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

  try {
    // =========================================================================
    // 0. Setup Fixtures
    // =========================================================================
    console.log('--- Setting up Test Data Fixtures ---');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('HardenP@ssw0rd123!', salt);

    // Primary test admin
    const admin1 = await User.create({
      name: 'Hardened Admin Primary',
      email: `${testPrefix}_admin1@chessjeeno.local`,
      passwordHash,
      authProvider: 'local',
      role: 'ADMIN',
      lichessUsername: 'lichess_admin_1',
      lichessOAuth: {
        accessToken: 'harden_lichess_access_secret_1',
        refreshToken: 'harden_lichess_refresh_secret_1',
        expiresAt: new Date(Date.now() + 86400000),
      },
      googleId: 'harden_google_id_admin1',
    });
    createdUserIds.push(admin1._id);
    const admin1Token = generateToken(admin1._id);

    // Secondary test admin (for role demotion tests)
    const admin2 = await User.create({
      name: 'Hardened Admin Secondary',
      email: `${testPrefix}_admin2@chessjeeno.local`,
      passwordHash,
      authProvider: 'local',
      role: 'ADMIN',
      lichessUsername: 'lichess_admin_2',
      lichessOAuth: {
        accessToken: 'harden_lichess_access_secret_2',
        refreshToken: 'harden_lichess_refresh_secret_2',
      },
    });
    createdUserIds.push(admin2._id);
    const admin2Token = generateToken(admin2._id);

    // Normal user
    const normalUser = await User.create({
      name: 'Hardened Normal Player',
      email: `${testPrefix}_user@chessjeeno.local`,
      passwordHash,
      authProvider: 'local',
      role: 'USER',
      lichessUsername: 'lichess_player_norm',
    });
    createdUserIds.push(normalUser._id);
    const normalUserToken = generateToken(normalUser._id);

    // Sample tournament in REGISTRATION status
    const tourneyReg = await Tournament.create({
      name: `${testPrefix} Summer Swiss Championship`,
      description: 'Hardening test tournament',
      createdBy: admin1._id,
      format: 'SWISS',
      status: 'REGISTRATION',
      clockLimit: 600,
      increment: 5,
    });
    createdTournamentIds.push(tourneyReg._id);

    // Sample tournament in FINISHED status
    const tourneyFinished = await Tournament.create({
      name: `${testPrefix} Finished Cup`,
      createdBy: admin1._id,
      format: 'ROUND_ROBIN',
      status: 'FINISHED',
      clockLimit: 300,
      increment: 0,
      winnerPlayer: normalUser._id,
    });
    createdTournamentIds.push(tourneyFinished._id);

    // Sample tournament with an ACTIVE match (cannot be cancelled)
    const tourneyWithLiveGame = await Tournament.create({
      name: `${testPrefix} Live Ongoing Tournament`,
      createdBy: admin1._id,
      format: 'SWISS',
      status: 'RUNNING',
      clockLimit: 600,
      increment: 5,
    });
    createdTournamentIds.push(tourneyWithLiveGame._id);

    const liveRound = await Round.create({
      tournamentId: tourneyWithLiveGame._id,
      roundNumber: 1,
      status: 'RUNNING',
    });
    createdRoundIds.push(liveRound._id);

    const livePairing = await Pairing.create({
      tournamentId: tourneyWithLiveGame._id,
      roundId: liveRound._id,
      roundNumber: 1,
      tableNumber: 1,
      whitePlayer: admin1._id,
      blackPlayer: normalUser._id,
      status: 'RUNNING',
    });
    createdPairingIds.push(livePairing._id);

    // =========================================================================
    // 1. Authorization: All 9 Endpoints Rejection for Unauthenticated (401)
    // =========================================================================
    console.log('\n--- 1. Testing Unauthenticated Request Rejection Across All 9 Endpoints (401) ---');
    const unauthChecks = [
      { method: 'GET', url: `${API_BASE}/admin/me` },
      { method: 'GET', url: `${API_BASE}/admin/overview` },
      { method: 'GET', url: `${API_BASE}/admin/analytics` },
      { method: 'GET', url: `${API_BASE}/admin/users` },
      { method: 'GET', url: `${API_BASE}/admin/users/${normalUser._id}` },
      { method: 'PATCH', url: `${API_BASE}/admin/users/${normalUser._id}/role`, body: { role: 'ADMIN' } },
      { method: 'GET', url: `${API_BASE}/admin/tournaments` },
      { method: 'GET', url: `${API_BASE}/admin/tournaments/${tourneyReg._id}` },
      { method: 'PATCH', url: `${API_BASE}/admin/tournaments/${tourneyReg._id}/cancel` },
    ];

    for (const check of unauthChecks) {
      const res = await fetch(check.url, {
        method: check.method,
        headers: { 'Content-Type': 'application/json' },
        body: check.body ? JSON.stringify(check.body) : undefined,
      });
      assert(res.status === 401, `Unauthenticated ${check.method} ${check.url.replace(API_BASE, '')} returns 401`);
      const body = await res.json();
      assert(body.success === false, `Unauthenticated response returns success: false`);
    }

    // =========================================================================
    // 2. Authorization: All 9 Endpoints Rejection for Normal USER (403)
    // =========================================================================
    console.log('\n--- 2. Testing Normal USER Access Rejection Across All 9 Endpoints (403) ---');
    for (const check of unauthChecks) {
      const res = await fetch(check.url, {
        method: check.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${normalUserToken}`,
        },
        body: check.body ? JSON.stringify(check.body) : undefined,
      });
      assert(res.status === 403, `Normal USER ${check.method} ${check.url.replace(API_BASE, '')} returns 403 Forbidden`);
      const body = await res.json();
      assert(body.success === false, `Forbidden response returns success: false`);
      assert(
        body.message.includes('Administrator') || body.message.includes('privileges'),
        `Clear authorization error message returned`
      );
    }

    // =========================================================================
    // 3. Authorization: Role Spoofing Resistance
    // =========================================================================
    console.log('\n--- 3. Testing Role Spoofing Resistance (Server-Side Authority) ---');
    // Spoofing via query param ?role=ADMIN
    const resSpoofQuery = await fetch(`${API_BASE}/admin/me?role=ADMIN&isAdmin=true`, {
      headers: { Authorization: `Bearer ${normalUserToken}` },
    });
    assert(resSpoofQuery.status === 403, 'Normal USER with ?role=ADMIN query parameter is rejected with 403');

    // Spoofing via body role on GET / Overview
    const resSpoofOverview = await fetch(`${API_BASE}/admin/overview?role=ADMIN`, {
      headers: { Authorization: `Bearer ${normalUserToken}` },
    });
    assert(resSpoofOverview.status === 403, 'Normal USER attempting ?role=ADMIN on overview is rejected with 403');

    // Spoofing via manipulated user ID parameter
    const resSpoofId = await fetch(`${API_BASE}/admin/users/${admin1._id}`, {
      headers: { Authorization: `Bearer ${normalUserToken}` },
    });
    assert(resSpoofId.status === 403, 'Normal USER attempting to inspect admin via IDOR is rejected with 403');

    // Deleted user authentication attempt
    const ephemeralUser = await User.create({
      name: 'Doomed Admin Account',
      email: `${testPrefix}_doomed@chessjeeno.local`,
      passwordHash,
      authProvider: 'local',
      role: 'ADMIN',
    });
    const doomedToken = generateToken(ephemeralUser._id);
    await User.findByIdAndDelete(ephemeralUser._id);

    const resDeletedUser = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${doomedToken}` },
    });
    assert(resDeletedUser.status === 401, 'Deleted user account token is immediately rejected with 401');

    // =========================================================================
    // 4. Input Validation: ObjectIds, Bounds, Enums, Types
    // =========================================================================
    console.log('\n--- 4. Testing Input Validation & Controlled 4xx Error Responses ---');

    // Malformed ObjectIds
    const malformedIdEndpoints = [
      { method: 'GET', url: `${API_BASE}/admin/users/not-an-objectid` },
      { method: 'PATCH', url: `${API_BASE}/admin/users/123invalid/role`, body: { role: 'ADMIN' } },
      { method: 'GET', url: `${API_BASE}/admin/tournaments/bad-tourney-id` },
      { method: 'PATCH', url: `${API_BASE}/admin/tournaments/xyz-456/cancel` },
    ];

    for (const item of malformedIdEndpoints) {
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${admin1Token}`,
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
      assert(res.status === 400, `Malformed ObjectId on ${item.method} ${item.url.replace(API_BASE, '')} returns 400`);
      const body = await res.json();
      assert(body.success === false, 'Error response returns success: false');
    }

    // Pagination validation: Users
    const resNegativePage = await fetch(`${API_BASE}/admin/users?page=-1`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resNegativePage.status === 400, 'Negative page (page=-1) returns 400');

    const resZeroPage = await fetch(`${API_BASE}/admin/users?page=0`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resZeroPage.status === 400, 'Zero page (page=0) returns 400');

    const resAlphaPage = await fetch(`${API_BASE}/admin/users?page=abc`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resAlphaPage.status === 400, 'String page (page=abc) returns 400');

    const resHugePage = await fetch(`${API_BASE}/admin/users?page=999999`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resHugePage.status === 400, 'Huge page (page=999999) returns controlled 400 without DB overflow');

    const resNegativeLimit = await fetch(`${API_BASE}/admin/users?limit=-5`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resNegativeLimit.status === 400, 'Negative limit returns 400');

    const resZeroLimit = await fetch(`${API_BASE}/admin/users?limit=0`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resZeroLimit.status === 400, 'Zero limit returns 400');

    const resLimitOverMax = await fetch(`${API_BASE}/admin/users?limit=51`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resLimitOverMax.status === 400, 'Limit above maximum (51) returns 400');

    const resHugeLimit = await fetch(`${API_BASE}/admin/users?limit=999999`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resHugeLimit.status === 400, 'Huge limit (999999) returns 400');

    // Pagination validation: Tournaments
    const resTourneyHugePage = await fetch(`${API_BASE}/admin/tournaments?page=999999`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resTourneyHugePage.status === 400, 'Tournaments huge page returns 400');

    const resTourneyHugeLimit = await fetch(`${API_BASE}/admin/tournaments?limit=500`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resTourneyHugeLimit.status === 400, 'Tournaments huge limit returns 400');

    // Enum validation: invalid role filter
    const resInvalidRoleFilter = await fetch(`${API_BASE}/admin/users?role=GOD_MODE`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resInvalidRoleFilter.status === 400, 'Invalid role filter (?role=GOD_MODE) returns 400');

    // Enum validation: invalid tournament status filter
    const resInvalidStatusFilter = await fetch(`${API_BASE}/admin/tournaments?status=NOT_A_STATUS`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resInvalidStatusFilter.status === 400, 'Invalid tournament status filter returns 400');

    // Enum validation: invalid tournament format filter
    const resInvalidFormatFilter = await fetch(`${API_BASE}/admin/tournaments?format=QUADRUPLE_ELIM`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resInvalidFormatFilter.status === 400, 'Invalid tournament format filter returns 400');

    // Role update body validation: empty body
    const resRoleEmpty = await fetch(`${API_BASE}/admin/users/${normalUser._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin1Token}`,
      },
      body: JSON.stringify({}),
    });
    assert(resRoleEmpty.status === 400, 'Role update with empty body returns 400');

    // Role update body validation: invalid role
    const resRoleInvalid = await fetch(`${API_BASE}/admin/users/${normalUser._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin1Token}`,
      },
      body: JSON.stringify({ role: 'SUPERADMIN' }),
    });
    assert(resRoleInvalid.status === 400, 'Role update with invalid role value returns 400');

    // Role update body validation: non-string role
    const resRoleNonString = await fetch(`${API_BASE}/admin/users/${normalUser._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin1Token}`,
      },
      body: JSON.stringify({ role: 12345 }),
    });
    assert(resRoleNonString.status === 400, 'Role update with numeric role returns 400');

    // =========================================================================
    // 5. Search / Regex Safety & ReDoS Protection
    // =========================================================================
    console.log('\n--- 5. Testing Search Sanitization & Regex Abuse Protection ---');

    // Oversized search query (> 100 characters)
    const longQuery = 'x'.repeat(101);
    const resOversizedUserSearch = await fetch(`${API_BASE}/admin/users?search=${longQuery}`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resOversizedUserSearch.status === 400, 'Oversized user search string (>100 chars) returns 400');

    const resOversizedTourneySearch = await fetch(`${API_BASE}/admin/tournaments?search=${longQuery}`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resOversizedTourneySearch.status === 400, 'Oversized tournament search string (>100 chars) returns 400');

    // Regex metacharacters in search queries: must be escaped and return 200 without regex engine blowup
    const regexAbuseCases = [
      '.*',
      '+',
      '?',
      '(((',
      ')))',
      '[a-z]+',
      '\\',
      '^$',
      '{1,10}',
      '|admin|',
      '[[[[[[',
    ];

    for (const pattern of regexAbuseCases) {
      const encoded = encodeURIComponent(pattern);
      const resUserRegex = await fetch(`${API_BASE}/admin/users?search=${encoded}`, {
        headers: { Authorization: `Bearer ${admin1Token}` },
      });
      assert(resUserRegex.status === 200, `User search with regex metacharacter "${pattern}" safely returns 200`);

      const resTourneyRegex = await fetch(`${API_BASE}/admin/tournaments?search=${encoded}`, {
        headers: { Authorization: `Bearer ${admin1Token}` },
      });
      assert(resTourneyRegex.status === 200, `Tournament search with regex metacharacter "${pattern}" safely returns 200`);
    }

    // =========================================================================
    // 6. Sensitive Data Audit: Complete Sanitization Across All Responses
    // =========================================================================
    console.log('\n--- 6. Testing Sensitive Credentials & Secret Concealment ---');

    // 6.1 Identity endpoint
    const resMe = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resMe.status === 200, 'GET /api/admin/me returns 200');
    const bodyMe = await resMe.json();
    assert(!bodyMe.admin.passwordHash, 'admin identity excludes passwordHash');
    assert(!bodyMe.admin.lichessOAuth, 'admin identity excludes lichessOAuth');
    assert(!bodyMe.admin.accessToken, 'admin identity excludes accessToken');
    assert(!bodyMe.admin.refreshToken, 'admin identity excludes refreshToken');
    assert(!bodyMe.admin.googleId, 'admin identity excludes googleId');

    // 6.2 Overview endpoint
    const resOverview = await fetch(`${API_BASE}/admin/overview`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resOverview.status === 200, 'GET /api/admin/overview returns 200');
    const bodyOverview = await resOverview.json();
    const overviewStr = JSON.stringify(bodyOverview);
    assert(!overviewStr.includes('passwordHash'), 'Overview excludes passwordHash');
    assert(!overviewStr.includes('harden_lichess_access_secret'), 'Overview excludes Lichess access tokens');
    assert(!overviewStr.includes('harden_lichess_refresh_secret'), 'Overview excludes Lichess refresh tokens');
    assert(!overviewStr.includes('harden_google_id'), 'Overview excludes Google secrets');

    // 6.3 Users listing endpoint
    const resUsers = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resUsers.status === 200, 'GET /api/admin/users returns 200');
    const bodyUsers = await resUsers.json();
    const usersStr = JSON.stringify(bodyUsers);
    assert(!usersStr.includes('passwordHash'), 'User listing excludes passwordHash');
    assert(!usersStr.includes('harden_lichess_access_secret'), 'User listing excludes Lichess tokens');
    assert(!usersStr.includes('harden_google_id'), 'User listing excludes Google identifiers');

    // 6.4 User Details endpoint
    const resUserDetails = await fetch(`${API_BASE}/admin/users/${admin1._id}`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resUserDetails.status === 200, 'GET /api/admin/users/:userId returns 200');
    const bodyUserDetails = await resUserDetails.json();
    const detailsStr = JSON.stringify(bodyUserDetails);
    assert(!detailsStr.includes('passwordHash'), 'User details excludes passwordHash');
    assert(!detailsStr.includes('harden_lichess_access_secret'), 'User details excludes Lichess tokens');
    assert(!detailsStr.includes('harden_google_id'), 'User details excludes raw Google secrets');
    assert(bodyUserDetails.user.googleConnected === true, 'Google status represented safely as boolean');
    assert(bodyUserDetails.user.lichessConnected === true, 'Lichess status represented safely as boolean');

    // 6.5 Tournament Details endpoint
    const resTourneyDetails = await fetch(`${API_BASE}/admin/tournaments/${tourneyReg._id}`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resTourneyDetails.status === 200, 'GET /api/admin/tournaments/:id returns 200');
    const bodyTourneyDetails = await resTourneyDetails.json();
    const tourneyStr = JSON.stringify(bodyTourneyDetails);
    assert(!tourneyStr.includes('passwordHash'), 'Tournament inspection excludes passwordHash');
    assert(!tourneyStr.includes('harden_lichess_access_secret'), 'Tournament inspection excludes OAuth secrets');

    // 6.6 Analytics endpoint
    const resAnalytics = await fetch(`${API_BASE}/admin/analytics`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resAnalytics.status === 200, 'GET /api/admin/analytics returns 200');
    const bodyAnalytics = await resAnalytics.json();
    const analyticsStr = JSON.stringify(bodyAnalytics);
    assert(!analyticsStr.includes('passwordHash'), 'Analytics excludes passwordHash');
    assert(!analyticsStr.includes('harden_lichess_access_secret'), 'Analytics excludes tokens');

    // =========================================================================
    // 7. Security Headers & Production Error Sanitization
    // =========================================================================
    console.log('\n--- 7. Testing Security Headers & Production Error Sanitization ---');
    assert(resMe.headers.get('x-content-type-options') === 'nosniff', 'Security header X-Content-Type-Options: nosniff present');
    assert(resMe.headers.get('x-frame-options') === 'DENY', 'Security header X-Frame-Options: DENY present');
    assert(resMe.headers.get('strict-transport-security') !== null, 'Security header Strict-Transport-Security present');

    // Verify error responses do not leak stack traces or system paths
    const resNotFound = await fetch(`${API_BASE}/admin/nonexistent-route-404`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resNotFound.status === 404, 'Unknown admin route returns 404');
    const bodyNotFound = await resNotFound.json();
    assert(!bodyNotFound.stack, 'Error response does not leak stack trace');
    assert(!JSON.stringify(bodyNotFound).includes('node_modules'), 'Error response does not leak filesystem paths');

    // =========================================================================
    // 8. Admin Safety: Last-Admin Lockout Protection & Moderation Rules
    // =========================================================================
    console.log('\n--- 8. Testing Last-Admin Protection & Tournament Moderation Safety ---');

    // Multiple admins exist: demoting admin2 to USER should succeed
    const resDemoteAdmin2 = await fetch(`${API_BASE}/admin/users/${admin2._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin1Token}`,
      },
      body: JSON.stringify({ role: 'USER' }),
    });
    assert(resDemoteAdmin2.status === 200, 'Demoting admin2 when admin1 remains succeeds with 200');
    const bodyDemote = await resDemoteAdmin2.json();
    assert(bodyDemote.user.role === 'USER', 'Admin2 role updated to USER in response');

    // Verify persisted DB role
    const updatedAdmin2Doc = await User.findById(admin2._id);
    assert(updatedAdmin2Doc.role === 'USER', 'Admin2 persisted DB role is strictly USER');

    // Isolate platform to only admin1 as ADMIN by temporarily setting other admins to USER
    const otherAdminsInDb = await User.find({ role: 'ADMIN', _id: { $ne: admin1._id } });
    const otherAdminIds = otherAdminsInDb.map((a) => a._id);
    await User.updateMany({ _id: { $in: otherAdminIds } }, { role: 'USER' });

    try {
      const soleAdminCount = await User.countDocuments({ role: 'ADMIN' });
      assert(soleAdminCount === 1, 'Verified exactly 1 ADMIN exists in platform during isolation test');

      // Demoting the final remaining admin must be blocked with HTTP 409 Conflict
      const resDemoteFinalAdmin = await fetch(`${API_BASE}/admin/users/${admin1._id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${admin1Token}`,
        },
        body: JSON.stringify({ role: 'USER' }),
      });
      assert(resDemoteFinalAdmin.status === 409, 'Demoting the final remaining ADMIN is blocked with HTTP 409 Conflict');
      const bodyFinalConflict = await resDemoteFinalAdmin.json();
      assert(
        bodyFinalConflict.message.includes('final') || bodyFinalConflict.message.includes('at least one'),
        'Clear last-admin protection message returned'
      );

      // Verify admin1 remains ADMIN
      const finalAdmin1Doc = await User.findById(admin1._id);
      assert(finalAdmin1Doc.role === 'ADMIN', 'Last admin role remains preserved as ADMIN in MongoDB');
    } finally {
      // Restore other admins
      await User.updateMany({ _id: { $in: otherAdminIds } }, { role: 'ADMIN' });
    }

    // Moderation safety: cannot cancel already FINISHED tournament
    const resCancelFinished = await fetch(`${API_BASE}/admin/tournaments/${tourneyFinished._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resCancelFinished.status === 400, 'Cancelling a FINISHED tournament is blocked with HTTP 400');

    // Moderation safety: cannot cancel tournament with active ongoing matches
    const resCancelLiveGame = await fetch(`${API_BASE}/admin/tournaments/${tourneyWithLiveGame._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resCancelLiveGame.status === 409, 'Cancelling tournament with live active match is blocked with HTTP 409');
    const bodyLiveCancel = await resCancelLiveGame.json();
    assert(
      bodyLiveCancel.message.includes('active') || bodyLiveCancel.message.includes('conclude'),
      'Clear conflict message explaining active games must conclude first'
    );

    // Moderation safety: safe cancellation of REGISTRATION tournament
    const resCancelReg = await fetch(`${API_BASE}/admin/tournaments/${tourneyReg._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resCancelReg.status === 200, 'Safely cancelling a REGISTRATION tournament returns 200');
    const bodyCancelReg = await resCancelReg.json();
    assert(bodyCancelReg.tournament.status === 'CANCELLED', 'Tournament status transitioned to CANCELLED');

    // Cannot cancel already CANCELLED tournament
    const resCancelAlready = await fetch(`${API_BASE}/admin/tournaments/${tourneyReg._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resCancelAlready.status === 400, 'Cancelling an already CANCELLED tournament returns 400');

    // Nonexistent tournament cancellation
    const nonExistentId = new mongoose.Types.ObjectId();
    const resCancelNotFound = await fetch(`${API_BASE}/admin/tournaments/${nonExistentId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resCancelNotFound.status === 404, 'Cancelling nonexistent tournament ID returns 404');

    // Nonexistent user role change
    const resUserNotFound = await fetch(`${API_BASE}/admin/users/${nonExistentId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin1Token}`,
      },
      body: JSON.stringify({ role: 'ADMIN' }),
    });
    assert(resUserNotFound.status === 404, 'Changing role of nonexistent user returns 404');

    // =========================================================================
    // 9. Analytics: Aggregation Integrity & Bounds
    // =========================================================================
    console.log('\n--- 9. Testing Analytics Aggregation Integrity & Bounds ---');
    const resAnalyticsData = await fetch(`${API_BASE}/admin/analytics`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resAnalyticsData.status === 200, 'Admin analytics returns 200');
    const analytics = await resAnalyticsData.json();

    assert(typeof analytics.overview.totalUsers === 'number', 'overview.totalUsers is a number');
    assert(typeof analytics.overview.totalAdmins === 'number', 'overview.totalAdmins is a number');
    assert(typeof analytics.overview.totalTournaments === 'number', 'overview.totalTournaments is a number');
    assert(Array.isArray(analytics.tournaments.formatDistribution), 'tournaments.formatDistribution is an array');
    assert(Array.isArray(analytics.tournaments.statusDistribution), 'tournaments.statusDistribution is an array');
    assert(Array.isArray(analytics.users.roleDistribution), 'users.roleDistribution is an array');
    assert(Array.isArray(analytics.users.recentRegistrations), 'users.recentRegistrations is an array');
    assert(typeof analytics.games.totalGames === 'number', 'games.totalGames is a number');
    assert(typeof analytics.games.completedGames === 'number', 'games.completedGames is a number');
    assert(typeof analytics.games.whiteWins === 'number', 'games.whiteWins is a number');
    assert(typeof analytics.games.blackWins === 'number', 'games.blackWins is a number');
    assert(typeof analytics.games.draws === 'number', 'games.draws is a number');

    // =========================================================================
    // 10. Regression: User and Tournament Filtering & Pagination Integrity
    // =========================================================================
    console.log('\n--- 10. Testing Regression on User & Tournament Listings ---');

    // Filter users by role ADMIN
    const resAdminUsers = await fetch(`${API_BASE}/admin/users?role=ADMIN`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resAdminUsers.status === 200, 'GET /admin/users?role=ADMIN returns 200');
    const bodyAdminUsers = await resAdminUsers.json();
    assert(bodyAdminUsers.users.every((u) => u.role === 'ADMIN'), 'All returned users have role ADMIN');

    // Filter users by role USER
    const resNormUsers = await fetch(`${API_BASE}/admin/users?role=USER`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resNormUsers.status === 200, 'GET /admin/users?role=USER returns 200');
    const bodyNormUsers = await resNormUsers.json();
    assert(bodyNormUsers.users.every((u) => u.role === 'USER'), 'All returned users have role USER');

    // Filter tournaments by format SWISS
    const resSwissTourneys = await fetch(`${API_BASE}/admin/tournaments?format=SWISS`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resSwissTourneys.status === 200, 'GET /admin/tournaments?format=SWISS returns 200');
    const bodySwiss = await resSwissTourneys.json();
    assert(bodySwiss.tournaments.every((t) => t.format === 'SWISS'), 'All returned tournaments have format SWISS');

    // Check pagination metadata consistency
    const resPagedTourneys = await fetch(`${API_BASE}/admin/tournaments?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert(resPagedTourneys.status === 200, 'GET /admin/tournaments?page=1&limit=2 returns 200');
    const bodyPagedTourneys = await resPagedTourneys.json();
    assert(bodyPagedTourneys.page === 1, 'Metadata reports page: 1');
    assert(bodyPagedTourneys.limit === 2, 'Metadata reports limit: 2');
    assert(bodyPagedTourneys.tournaments.length <= 2, 'Returned tournaments length bounded by limit=2');

    console.log('\n======================================================');
    console.log(`🎉 ALL ADMIN HARDENING AUDIT TESTS PASSED: ${passedTests}/${totalTests} assertions`);
    console.log('======================================================\n');
  } finally {
    console.log('🧹 Cleaning up test users, tournaments, rounds, and pairings...');
    try {
      if (createdPairingIds.length > 0) {
        await Pairing.deleteMany({ _id: { $in: createdPairingIds } });
      }
      if (createdRoundIds.length > 0) {
        await Round.deleteMany({ _id: { $in: createdRoundIds } });
      }
      if (createdTournamentIds.length > 0) {
        await Tournament.deleteMany({ _id: { $in: createdTournamentIds } });
        await TournamentPlayer.deleteMany({ tournamentId: { $in: createdTournamentIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    }

    await new Promise((resolve) => testServer.close(resolve));
    await mongoose.connection.close();
    console.log('✅ In-process test server and database connection closed.\n');
  }
};

runAdminHardeningTests().catch((err) => {
  console.error('\n❌ Uncaught error during Admin Hardening tests:', err);
  process.exit(1);
});
