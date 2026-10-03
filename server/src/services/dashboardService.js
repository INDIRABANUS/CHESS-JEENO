import mongoose from 'mongoose';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';
import { getTournamentStandings } from './standingsService.js';

/**
 * Evaluates candidate tournaments for the dashboard and assigns strict priority:
 * 1. IN_PROGRESS tournament with active/current pairing for the user
 * 2. READY_CHECK tournament
 * 3. COUNTDOWN tournament
 * 4. Active tournament awaiting next round
 * 5. Upcoming approved tournament (REGISTRATION / PENDING)
 *
 * @param {Array<Object>} candidates
 * @param {mongoose.Types.ObjectId} userObjectId
 * @returns {Promise<Object|null>} prioritized tournament evaluation object
 */
const resolvePrioritizedCurrentTournament = async (candidates, userObjectId) => {
  if (!candidates || candidates.length === 0) return null;

  const evaluated = [];

  for (const t of candidates) {
    // Exclude completed or cancelled tournaments
    if (['FINISHED', 'COMPLETED', 'CANCELLED'].includes(t.status)) {
      continue;
    }

    // 1 & 4: IN_PROGRESS or RUNNING tournaments
    if (t.status === 'IN_PROGRESS' || t.status === 'RUNNING') {
      let currentRound = await Round.findOne({
        tournamentId: t._id,
        status: 'RUNNING',
      });

      if (!currentRound) {
        currentRound = await Round.findOne({
          tournamentId: t._id,
        }).sort({ roundNumber: -1 });
      }

      let activePairing = null;
      let hasActivePairing = false;

      if (currentRound) {
        activePairing = await Pairing.findOne({
          roundId: currentRound._id,
          $or: [{ whitePlayer: userObjectId }, { blackPlayer: userObjectId }],
        }).populate('whitePlayer blackPlayer', 'name avatar lichessUsername');

        if (activePairing) {
          const isFinished =
            activePairing.status === 'FINISHED' ||
            ['1-0', '0-1', '1/2-1/2', 'WHITE_WIN', 'BLACK_WIN', 'DRAW'].includes(
              activePairing.result
            );
          if (!isFinished && activePairing.status !== 'ABORTED' && activePairing.status !== 'CANCELLED') {
            hasActivePairing = true;
          }
        }
      }

      if (hasActivePairing) {
        evaluated.push({
          tournament: t,
          priority: 1, // Priority 1: IN_PROGRESS with active/current pairing
          round: currentRound,
          pairing: activePairing,
          sortTime: t.updatedAt ? new Date(t.updatedAt).getTime() : 0,
        });
      } else {
        evaluated.push({
          tournament: t,
          priority: 4, // Priority 4: Active tournament awaiting next round
          round: currentRound,
          pairing: activePairing,
          sortTime: t.updatedAt ? new Date(t.updatedAt).getTime() : 0,
        });
      }
      continue;
    }

    // 2: READY_CHECK
    if (t.status === 'READY_CHECK') {
      evaluated.push({
        tournament: t,
        priority: 2, // Priority 2: READY_CHECK
        round: null,
        pairing: null,
        sortTime: t.updatedAt ? new Date(t.updatedAt).getTime() : 0,
      });
      continue;
    }

    // 3: COUNTDOWN
    if (t.status === 'COUNTDOWN') {
      evaluated.push({
        tournament: t,
        priority: 3, // Priority 3: COUNTDOWN
        round: null,
        pairing: null,
        sortTime: t.countdownStartedAt
          ? new Date(t.countdownStartedAt).getTime()
          : t.updatedAt
          ? new Date(t.updatedAt).getTime()
          : 0,
      });
      continue;
    }

    // 5: Upcoming approved tournament (REGISTRATION / PENDING / DRAFT)
    if (['REGISTRATION', 'PENDING', 'DRAFT'].includes(t.status)) {
      evaluated.push({
        tournament: t,
        priority: 5, // Priority 5: Upcoming approved tournament
        round: null,
        pairing: null,
        sortTime: t.startTime
          ? new Date(t.startTime).getTime()
          : t.createdAt
          ? new Date(t.createdAt).getTime()
          : 0,
      });
      continue;
    }
  }

  if (evaluated.length === 0) return null;

  // Sort by priority (1 to 5), then tiebreak by sortTime
  evaluated.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Tiebreaker within Priority 5: closer upcoming startTime first
    if (a.priority === 5) {
      const timeA = a.tournament.startTime ? new Date(a.tournament.startTime).getTime() : Infinity;
      const timeB = b.tournament.startTime ? new Date(b.tournament.startTime).getTime() : Infinity;
      if (timeA !== timeB) return timeA - timeB;
    }
    // Tiebreaker for active/running: most recently updated first
    return b.sortTime - a.sortTime;
  });

  return evaluated[0];
};

/**
 * Retrieves the comprehensive dashboard data for a given user:
 * 1. Current Active Tournament with current round, user score, rank, and next match pairing.
 * 2. My Tournaments breakdown (active, upcoming, completed, hosted counts + lists).
 * 3. Recent match results across tournaments (win, loss, draw, opponent, delta).
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Object>}
 */
export const getUserDashboardData = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId).select('name email avatar lichessUsername createdAt updatedAt');
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 1. Get all tournaments the user is an approved participant in (isApproved === true)
  // Pending or rejected join requests are strictly excluded.
  const approvedPlayerDocs = await TournamentPlayer.find({
    userId: userObjectId,
    isApproved: true,
  }).select('tournamentId');
  const approvedTournamentIds = approvedPlayerDocs.map((tp) => tp.tournamentId);

  // Fetch all tournaments where user is an approved participant OR the creator/host
  const myTournamentsList = await Tournament.find({
    $or: [{ _id: { $in: approvedTournamentIds } }, { createdBy: userObjectId }],
  })
    .sort({ updatedAt: -1 })
    .populate('createdBy', 'name email avatar lichessUsername');

  const activeTournaments = myTournamentsList.filter((t) =>
    ['IN_PROGRESS', 'READY_CHECK', 'COUNTDOWN', 'RUNNING', 'ACTIVE'].includes(t.status)
  );
  const upcomingTournaments = myTournamentsList.filter((t) =>
    ['PENDING', 'REGISTRATION', 'DRAFT'].includes(t.status)
  );
  const completedTournaments = myTournamentsList.filter((t) =>
    ['FINISHED', 'COMPLETED'].includes(t.status)
  );
  const hostedTournaments = myTournamentsList.filter(
    (t) => t.createdBy?._id?.toString() === userId.toString()
  );

  // 2. Determine Current Primary Tournament & Active Match with strict priority:
  // 1. IN_PROGRESS with active pairing -> 2. READY_CHECK -> 3. COUNTDOWN -> 4. Active awaiting round -> 5. Upcoming approved
  const candidateTournaments = myTournamentsList.filter(
    (t) => !['FINISHED', 'COMPLETED', 'CANCELLED'].includes(t.status)
  );

  const bestCandidate = await resolvePrioritizedCurrentTournament(
    candidateTournaments,
    userObjectId
  );

  let currentTournamentData = null;

  if (bestCandidate) {
    const { tournament: primaryTournament, round: activeRound, pairing: activePairing, priority } = bestCandidate;

    let nextMatchData = null;
    let userScore = 0;
    let userRank = null;
    let totalPlayers = 0;

    // Authoritative score & rank from standingsService
    try {
      const standingsData = await getTournamentStandings(primaryTournament._id);
      const standings = standingsData.standings || [];
      totalPlayers = standings.length;
      const myStandingIndex = standings.findIndex(
        (s) => s.playerId?.toString() === userId.toString()
      );
      if (myStandingIndex !== -1) {
        userScore = standings[myStandingIndex].score;
        userRank = myStandingIndex + 1;
      }
    } catch (err) {
      console.error('Error fetching authoritative standings for dashboard:', err);
    }

    if (activePairing) {
      const isWhite =
        activePairing.whitePlayer?._id?.toString() === userId.toString();
      const opponent = isWhite
        ? activePairing.blackPlayer
        : activePairing.whitePlayer;

      const lichessGameUrl =
        activePairing.lichessGameUrl ||
        (activePairing.lichessGameId
          ? `https://lichess.org/${activePairing.lichessGameId}`
          : null);

      nextMatchData = {
        pairingId: activePairing._id,
        roundId: activeRound?._id || activePairing.roundId,
        roundNumber: activeRound?.roundNumber || 1,
        isWhite,
        playerColor: isWhite ? 'white' : 'black',
        opponent: opponent
          ? {
              _id: opponent._id,
              name: opponent.name || 'Opponent',
              lichessUsername: opponent.lichessUsername || null,
              avatar: opponent.avatar || null,
            }
          : null,
        status: activePairing.status,
        result: activePairing.result,
        lichessGameId: activePairing.lichessGameId || null,
        lichessGameUrl,
        isBye: activePairing.status === 'BYE',
      };
    }

    currentTournamentData = {
      _id: primaryTournament._id,
      name: primaryTournament.name,
      format: primaryTournament.format,
      status: primaryTournament.status,
      priorityLevel: priority,
      clockLimit: primaryTournament.clockLimit,
      increment: primaryTournament.increment,
      totalRounds: primaryTournament.totalRounds || null,
      currentRoundNumber: activeRound ? activeRound.roundNumber : 1,
      currentRoundStatus: activeRound ? activeRound.status : 'PENDING',
      stageName: activeRound ? activeRound.stageName : null,
      userScore,
      userRank,
      totalPlayers,
      nextMatch: nextMatchData,
      isHost: primaryTournament.createdBy?._id?.toString() === userId.toString(),
    };
  }

  // 3. Recent Results across all tournaments (strictly completed matches)
  const completedPairings = await Pairing.find({
    $or: [{ whitePlayer: userObjectId }, { blackPlayer: userObjectId }],
    status: { $in: ['FINISHED', 'COMPLETED'] },
    result: { $in: ['1-0', '0-1', '1/2-1/2', 'WHITE_WIN', 'BLACK_WIN', 'DRAW'] },
  })
    .populate('whitePlayer blackPlayer', 'name avatar lichessUsername')
    .populate('tournamentId', 'name format')
    .populate('roundId', 'roundNumber stageName')
    .sort({ completedAt: -1, updatedAt: -1 })
    .limit(8);

  const recentResults = completedPairings.map((p) => {
    const isWhite = p.whitePlayer?._id?.toString() === userId.toString();
    const opponent = isWhite ? p.blackPlayer : p.whitePlayer;
    const res = p.result;

    let outcome = 'draw';
    let label = 'Draw';
    let symbol = '½';
    let pointDelta = '+0.5';

    if (res === '1-0' || res === 'WHITE_WIN') {
      if (isWhite) {
        outcome = 'win';
        label = 'Win';
        symbol = '✓';
        pointDelta = '+1.0';
      } else {
        outcome = 'loss';
        label = 'Loss';
        symbol = '✗';
        pointDelta = '0';
      }
    } else if (res === '0-1' || res === 'BLACK_WIN') {
      if (!isWhite) {
        outcome = 'win';
        label = 'Win';
        symbol = '✓';
        pointDelta = '+1.0';
      } else {
        outcome = 'loss';
        label = 'Loss';
        symbol = '✗';
        pointDelta = '0';
      }
    }

    return {
      pairingId: p._id,
      tournamentId: p.tournamentId?._id || null,
      tournamentName: p.tournamentId?.name || 'Tournament Match',
      roundNumber: p.roundId?.roundNumber || 1,
      stageName: p.roundId?.stageName || null,
      opponent: opponent
        ? {
            _id: opponent._id,
            name: opponent.name || 'Opponent',
            lichessUsername: opponent.lichessUsername || null,
            avatar: opponent.avatar || null,
          }
        : { name: 'Opponent', lichessUsername: null, avatar: null },
      outcome,
      label,
      symbol,
      pointDelta,
      result: res,
      playedAs: isWhite ? 'white' : 'black',
      lichessGameUrl:
        p.lichessGameUrl ||
        (p.lichessGameId ? `https://lichess.org/${p.lichessGameId}` : null),
      completedAt: p.completedAt || p.updatedAt,
    };
  });

  // Map tournament summaries for fast, secure UI display (no internal hashes or tokens)
  const mapTournament = (t) => ({
    _id: t._id,
    name: t.name,
    format: t.format,
    status: t.status,
    clockLimit: t.clockLimit,
    increment: t.increment,
    totalRounds: t.totalRounds || null,
    startTime: t.startTime,
    isHost: t.createdBy?._id?.toString() === userId.toString(),
  });

  return {
    user: {
      _id: user._id,
      name: user.name || 'Player',
      email: user.email,
      avatar: user.avatar || null,
      lichessUsername: user.lichessUsername || null,
    },
    currentTournament: currentTournamentData,
    myTournaments: {
      activeCount: activeTournaments.length,
      upcomingCount: upcomingTournaments.length,
      completedCount: completedTournaments.length,
      hostedCount: hostedTournaments.length,
      totalCount: myTournamentsList.length,
      active: activeTournaments.slice(0, 5).map(mapTournament),
      upcoming: upcomingTournaments.slice(0, 5).map(mapTournament),
      completed: completedTournaments.slice(0, 5).map(mapTournament),
      hosted: hostedTournaments.slice(0, 5).map(mapTournament),
    },
    recentResults,
  };
};

export default {
  getUserDashboardData,
};
