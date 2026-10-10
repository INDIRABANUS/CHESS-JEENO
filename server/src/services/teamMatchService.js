import mongoose from 'mongoose';
import User from '../models/User.js';
import TeamCompetition from '../models/TeamCompetition.js';
import TeamCompetitionTeam from '../models/TeamCompetitionTeam.js';
import TeamCompetitionMember from '../models/TeamCompetitionMember.js';
import TeamCompetitionRound, { ROUND_STATUSES } from '../models/TeamCompetitionRound.js';
import TeamMatch, { MATCH_STATUSES } from '../models/TeamMatch.js';
import TeamMatchBoard from '../models/TeamMatchBoard.js';
import * as notificationService from './notificationService.js';
import * as lichessService from './lichessService.js';
import * as lichessOAuthService from './lichessOAuthService.js';
import {
  calculateBoardScore,
  calculateMatchScore,
  rebuildCompetitionStandings,
  getCompetitionStandings,
} from './teamCompetitionStandingsService.js';
import { generateTeamRoundRobinSchedule } from '../utils/teamRoundRobin.js';

// In-process mutex set for concurrent schedule generation protection
const activeScheduleGenerations = new Set();


/**
 * Validates that an ID is a valid MongoDB ObjectId.
 */
export const validateObjectId = (id, fieldName = 'ID') => {
  if (!id || !mongoose.isValidObjectId(id)) {
    const error = new Error(`Invalid ${fieldName}`);
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Helper to extract string ID from ObjectId or populated document.
 */
const toIdString = (docOrId) => {
  if (!docOrId) return null;
  if (typeof docOrId === 'string') return docOrId;
  return docOrId._id ? docOrId._id.toString() : docOrId.toString();
};

/**
 * Create a new round within a team competition (Organizer only).
 */
export const createRound = async (
  competitionId,
  { roundNumber, name, scheduledStart },
  userId
) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(userId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (toIdString(competition.organizer) !== userId.toString()) {
    const error = new Error('Forbidden: Only the competition organizer can create rounds');
    error.statusCode = 403;
    throw error;
  }

  if (competition.status === 'CANCELLED' || competition.status === 'COMPLETED') {
    const error = new Error(`Cannot add rounds to a ${competition.status.toLowerCase()} competition`);
    error.statusCode = 400;
    throw error;
  }

  const parsedRoundNumber = parseInt(roundNumber, 10);
  if (isNaN(parsedRoundNumber) || parsedRoundNumber < 1) {
    const error = new Error('Round number must be an integer greater than or equal to 1');
    error.statusCode = 400;
    throw error;
  }

  // Prevent duplicate round numbers in the same competition
  const existingRound = await TeamCompetitionRound.findOne({
    competition: competitionId,
    roundNumber: parsedRoundNumber,
  });
  if (existingRound) {
    const error = new Error(`Round number ${parsedRoundNumber} already exists in this competition`);
    error.statusCode = 400;
    throw error;
  }

  let cleanScheduledStart = null;
  if (scheduledStart) {
    const parsedDate = new Date(scheduledStart);
    if (isNaN(parsedDate.getTime())) {
      const error = new Error('Invalid scheduledStart date format');
      error.statusCode = 400;
      throw error;
    }
    cleanScheduledStart = parsedDate;
  }

  const trimmedName = typeof name === 'string' && name.trim() ? name.trim() : `Round ${parsedRoundNumber}`;

  const round = await TeamCompetitionRound.create({
    competition: competitionId,
    roundNumber: parsedRoundNumber,
    name: trimmedName,
    status: 'DRAFT',
    scheduledStart: cleanScheduledStart,
    createdBy: userId,
  });

  return round;
};

/**
 * Get all rounds for a competition, with match counts.
 */
export const getRounds = async (competitionId) => {
  validateObjectId(competitionId, 'competition ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  const rounds = await TeamCompetitionRound.find({ competition: competitionId })
    .populate('byeTeam', '_id name captain status')
    .sort({ roundNumber: 1 })
    .lean();

  const roundIds = rounds.map((r) => r._id);
  const matchCounts = await TeamMatch.aggregate([
    { $match: { round: { $in: roundIds }, status: { $ne: 'CANCELLED' } } },
    { $group: { _id: '$round', count: { $sum: 1 } } },
  ]);

  const countMap = {};
  matchCounts.forEach((mc) => {
    countMap[mc._id.toString()] = mc.count;
  });

  return rounds.map((r) => ({
    ...r,
    matchCount: countMap[r._id.toString()] || 0,
  }));
};

/**
 * Get round details including its matches.
 */
export const getRoundById = async (competitionId, roundId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(roundId, 'round ID');

  const round = await TeamCompetitionRound.findOne({
    _id: roundId,
    competition: competitionId,
  })
    .populate('byeTeam', '_id name captain status')
    .lean();

  if (!round) {
    const error = new Error('Round not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  const matches = await TeamMatch.find({ round: roundId })
    .populate('teamA', '_id name captain status')
    .populate('teamB', '_id name captain status')
    .sort({ createdAt: 1 })
    .lean();

  return {
    ...round,
    matches,
  };
};

/**
 * Update round details or transition round status (Organizer only).
 */
export const updateRound = async (competitionId, roundId, updateData, userId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(roundId, 'round ID');
  validateObjectId(userId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (toIdString(competition.organizer) !== userId.toString()) {
    const error = new Error('Forbidden: Only the competition organizer can update rounds');
    error.statusCode = 403;
    throw error;
  }

  const round = await TeamCompetitionRound.findOne({
    _id: roundId,
    competition: competitionId,
  });

  if (!round) {
    const error = new Error('Round not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  if (round.status === 'CANCELLED') {
    const error = new Error('Cannot modify a cancelled round');
    error.statusCode = 400;
    throw error;
  }

  if (round.status === 'COMPLETED') {
    const error = new Error('Cannot modify a completed round');
    error.statusCode = 400;
    throw error;
  }

  if (updateData.name !== undefined) {
    const trimmed = typeof updateData.name === 'string' ? updateData.name.trim() : '';
    if (!trimmed) {
      const error = new Error('Round name cannot be empty');
      error.statusCode = 400;
      throw error;
    }
    round.name = trimmed;
  }

  if (updateData.scheduledStart !== undefined) {
    if (updateData.scheduledStart === null || updateData.scheduledStart === '') {
      round.scheduledStart = null;
    } else {
      const parsedDate = new Date(updateData.scheduledStart);
      if (isNaN(parsedDate.getTime())) {
        const error = new Error('Invalid scheduledStart date format');
        error.statusCode = 400;
        throw error;
      }
      round.scheduledStart = parsedDate;
    }
  }

  if (updateData.status !== undefined) {
    const targetStatus = updateData.status;
    if (!ROUND_STATUSES.includes(targetStatus)) {
      const error = new Error(`Invalid round status: '${targetStatus}'`);
      error.statusCode = 400;
      throw error;
    }

    if (targetStatus === 'LINEUP') {
      const activeMatchesCount = await TeamMatch.countDocuments({
        round: roundId,
        status: { $ne: 'CANCELLED' },
      });
      if (activeMatchesCount === 0) {
        const error = new Error('Cannot advance round to LINEUP: At least 1 active match is required');
        error.statusCode = 400;
        throw error;
      }
      // Advance all DRAFT matches in this round to LINEUP
      await TeamMatch.updateMany(
        { round: roundId, status: 'DRAFT' },
        { $set: { status: 'LINEUP' } }
      );
      round.status = 'LINEUP';
    } else if (targetStatus === 'READY') {
      const matches = await TeamMatch.find({
        round: roundId,
        status: { $ne: 'CANCELLED' },
      });
      if (matches.length === 0) {
        const error = new Error('Cannot set round to READY: At least 1 active match is required');
        error.statusCode = 400;
        throw error;
      }
      const notReady = matches.some((m) => m.status !== 'READY');
      if (notReady) {
        const error = new Error('Cannot set round to READY: All matches in the round must be in READY status');
        error.statusCode = 400;
        throw error;
      }
      round.status = 'READY';
    } else if (targetStatus === 'CANCELLED') {
      round.status = 'CANCELLED';
      // Mark all pre-start matches as cancelled
      await TeamMatch.updateMany(
        { round: roundId, status: { $in: ['DRAFT', 'LINEUP', 'READY'] } },
        { $set: { status: 'CANCELLED' } }
      );
    } else if (targetStatus === 'SCHEDULED' || targetStatus === 'DRAFT') {
      round.status = targetStatus;
    } else {
      const error = new Error(`Invalid status transition to '${targetStatus}'`);
      error.statusCode = 400;
      throw error;
    }
  }

  await round.save();
  return round;
};

/**
 * Create a new team match inside a round (Organizer only).
 * Automatically initializes sequential boards from 1 to boardCount.
 */
export const createMatch = async (
  competitionId,
  roundId,
  { teamA, teamB, boardCount = 4, scheduledStart },
  userId
) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(roundId, 'round ID');
  validateObjectId(teamA, 'Team A ID');
  validateObjectId(teamB, 'Team B ID');
  validateObjectId(userId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (toIdString(competition.organizer) !== userId.toString()) {
    const error = new Error('Forbidden: Only the competition organizer can create matches');
    error.statusCode = 403;
    throw error;
  }

  const round = await TeamCompetitionRound.findOne({
    _id: roundId,
    competition: competitionId,
  });

  if (!round) {
    const error = new Error('Round not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  if (round.status === 'CANCELLED' || round.status === 'COMPLETED') {
    const error = new Error(`Cannot add matches to a ${round.status.toLowerCase()} round`);
    error.statusCode = 400;
    throw error;
  }

  // teamA and teamB must be different
  if (teamA.toString() === teamB.toString()) {
    const error = new Error('Team A and Team B must be different');
    error.statusCode = 400;
    throw error;
  }

  // Validate team existence, active status, and competition membership
  const [teamDocA, teamDocB] = await Promise.all([
    TeamCompetitionTeam.findById(teamA),
    TeamCompetitionTeam.findById(teamB),
  ]);

  if (!teamDocA) {
    const error = new Error('Team A not found');
    error.statusCode = 404;
    throw error;
  }

  if (!teamDocB) {
    const error = new Error('Team B not found');
    error.statusCode = 404;
    throw error;
  }

  if (
    teamDocA.competition.toString() !== competitionId.toString() ||
    teamDocB.competition.toString() !== competitionId.toString()
  ) {
    const error = new Error('Both teams must belong to the same competition');
    error.statusCode = 400;
    throw error;
  }

  if (teamDocA.status !== 'ACTIVE' || teamDocB.status !== 'ACTIVE') {
    const error = new Error('Both teams must be active to be scheduled in a match');
    error.statusCode = 400;
    throw error;
  }

  // Prevent duplicate team-vs-team match inside the same round
  const existingMatch = await TeamMatch.findOne({
    round: roundId,
    $or: [
      { teamA, teamB },
      { teamA: teamB, teamB: teamA },
    ],
    status: { $ne: 'CANCELLED' },
  });

  if (existingMatch) {
    const error = new Error('A match between these two teams already exists in this round');
    error.statusCode = 400;
    throw error;
  }

  // Validate boardCount bounds: 1 to 20
  const parsedBoardCount = parseInt(boardCount, 10);
  if (isNaN(parsedBoardCount) || parsedBoardCount < 1 || parsedBoardCount > 20) {
    const error = new Error('boardCount must be an integer between 1 and 20');
    error.statusCode = 400;
    throw error;
  }

  let cleanScheduledStart = null;
  if (scheduledStart) {
    const parsedDate = new Date(scheduledStart);
    if (isNaN(parsedDate.getTime())) {
      const error = new Error('Invalid scheduledStart date format');
      error.statusCode = 400;
      throw error;
    }
    cleanScheduledStart = parsedDate;
  } else if (round.scheduledStart) {
    cleanScheduledStart = round.scheduledStart;
  }

  const initialStatus = round.status === 'LINEUP' ? 'LINEUP' : 'DRAFT';

  const match = await TeamMatch.create({
    competition: competitionId,
    round: roundId,
    teamA,
    teamB,
    boardCount: parsedBoardCount,
    status: initialStatus,
    scheduledStart: cleanScheduledStart,
    createdBy: userId,
  });

  // Automatically create sequential boards 1 to boardCount
  const boardsToCreate = [];
  for (let i = 1; i <= parsedBoardCount; i++) {
    boardsToCreate.push({
      match: match._id,
      boardNumber: i,
      teamAPlayer: null,
      teamBPlayer: null,
      teamAReady: false,
      teamBReady: false,
      locked: false,
    });
  }

  const createdBoards = await TeamMatchBoard.insertMany(boardsToCreate);

  const populatedMatch = await TeamMatch.findById(match._id)
    .populate('teamA', '_id name captain status')
    .populate('teamB', '_id name captain status')
    .populate('round', '_id roundNumber name status scheduledStart')
    .lean();

  return {
    ...populatedMatch,
    boards: createdBoards,
  };
};

/**
 * Get all matches for a competition or round.
 */
export const getMatches = async (competitionId, { roundId = null } = {}) => {
  validateObjectId(competitionId, 'competition ID');

  const query = { competition: competitionId };
  if (roundId) {
    validateObjectId(roundId, 'round ID');
    query.round = roundId;
  }

  const matches = await TeamMatch.find(query)
    .populate('teamA', '_id name captain status')
    .populate('teamB', '_id name captain status')
    .populate('round', '_id roundNumber name status scheduledStart')
    .sort({ createdAt: 1 })
    .lean();

  return matches;
};

/**
 * Get single match details with boards and user context.
 */
export const getMatchById = async (competitionId, matchId, currentUserId = null) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');

  const match = await TeamMatch.findOne({
    _id: matchId,
    competition: competitionId,
  })
    .populate('round', '_id roundNumber name status scheduledStart')
    .populate({
      path: 'teamA',
      select: '_id name captain status',
      populate: { path: 'captain', select: '_id name email avatar lichessUsername' },
    })
    .populate({
      path: 'teamB',
      select: '_id name captain status',
      populate: { path: 'captain', select: '_id name email avatar lichessUsername' },
    })
    .populate('winnerTeam', '_id name')
    .lean();

  if (!match) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  const boards = await TeamMatchBoard.find({ match: matchId })
    .populate('teamAPlayer', '_id name email avatar lichessUsername')
    .populate('teamBPlayer', '_id name email avatar lichessUsername')
    .populate('whitePlayer', '_id name email avatar lichessUsername')
    .populate('blackPlayer', '_id name email avatar lichessUsername')
    .populate('resolvedBy', '_id name email')
    .sort({ boardNumber: 1 })
    .lean();

  // Compute viewer permissions and context
  let userContext = {
    isOrganizer: false,
    isCaptainA: false,
    isCaptainB: false,
    isCaptain: false,
    isPlayer: false,
    assignedBoardNumber: null,
    userTeamSide: null,
  };

  if (currentUserId && mongoose.isValidObjectId(currentUserId)) {
    const userIdStr = currentUserId.toString();
    const competition = await TeamCompetition.findById(competitionId).select('organizer').lean();
    const isOrganizer = competition?.organizer?.toString() === userIdStr;

    const isCaptainA = toIdString(match.teamA?.captain) === userIdStr;
    const isCaptainB = toIdString(match.teamB?.captain) === userIdStr;

    let assignedBoardNumber = null;
    let userTeamSide = null;

    for (const b of boards) {
      if (toIdString(b.teamAPlayer) === userIdStr) {
        assignedBoardNumber = b.boardNumber;
        userTeamSide = 'A';
        break;
      } else if (toIdString(b.teamBPlayer) === userIdStr) {
        assignedBoardNumber = b.boardNumber;
        userTeamSide = 'B';
        break;
      }
    }

    if (!userTeamSide) {
      if (isCaptainA) userTeamSide = 'A';
      else if (isCaptainB) userTeamSide = 'B';
    }

    userContext = {
      isOrganizer,
      isCaptainA,
      isCaptainB,
      isCaptain: isCaptainA || isCaptainB,
      isPlayer: assignedBoardNumber !== null,
      assignedBoardNumber,
      userTeamSide,
    };
  }

  return {
    ...match,
    boards,
    userContext,
  };
};

/**
 * Get boards for a match.
 */
export const getMatchBoards = async (competitionId, matchId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');

  const match = await TeamMatch.findOne({ _id: matchId, competition: competitionId });
  if (!match) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  const boards = await TeamMatchBoard.find({ match: matchId })
    .populate('teamAPlayer', '_id name email avatar lichessUsername')
    .populate('teamBPlayer', '_id name email avatar lichessUsername')
    .populate('whitePlayer', '_id name email avatar lichessUsername')
    .populate('blackPlayer', '_id name email avatar lichessUsername')
    .sort({ boardNumber: 1 })
    .lean();

  return boards;
};

/**
 * Update match scheduling or transition status (Organizer only).
 */
export const updateMatch = async (competitionId, matchId, updateData, userId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');
  validateObjectId(userId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (toIdString(competition.organizer) !== userId.toString()) {
    const error = new Error('Forbidden: Only the competition organizer can update match details');
    error.statusCode = 403;
    throw error;
  }

  const match = await TeamMatch.findOne({ _id: matchId, competition: competitionId });
  if (!match) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  if (match.status === 'CANCELLED') {
    const error = new Error('Cannot modify a cancelled match');
    error.statusCode = 400;
    throw error;
  }

  if (match.status === 'COMPLETED') {
    const error = new Error('Cannot modify a completed match');
    error.statusCode = 400;
    throw error;
  }

  if (updateData.scheduledStart !== undefined) {
    if (updateData.scheduledStart === null || updateData.scheduledStart === '') {
      match.scheduledStart = null;
    } else {
      const parsedDate = new Date(updateData.scheduledStart);
      if (isNaN(parsedDate.getTime())) {
        const error = new Error('Invalid scheduledStart date format');
        error.statusCode = 400;
        throw error;
      }
      match.scheduledStart = parsedDate;
    }
  }

  if (updateData.status !== undefined) {
    if (updateData.status === 'LINEUP' && match.status === 'DRAFT') {
      match.status = 'LINEUP';
    } else if (updateData.status !== match.status) {
      const error = new Error(`Cannot manually set match status to '${updateData.status}'`);
      error.statusCode = 400;
      throw error;
    }
  }

  await match.save();
  return match;
};

/**
 * Cancel a match (Organizer only).
 */
export const cancelMatch = async (competitionId, matchId, userId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');
  validateObjectId(userId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (toIdString(competition.organizer) !== userId.toString()) {
    const error = new Error('Forbidden: Only the competition organizer can cancel matches');
    error.statusCode = 403;
    throw error;
  }

  const match = await TeamMatch.findOne({ _id: matchId, competition: competitionId });
  if (!match) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  if (match.status === 'CANCELLED') {
    const error = new Error('Match is already cancelled');
    error.statusCode = 400;
    throw error;
  }

  if (match.status === 'COMPLETED') {
    const error = new Error('Cannot cancel a completed match');
    error.statusCode = 400;
    throw error;
  }

  match.status = 'CANCELLED';
  await match.save();

  return match;
};

/**
 * Lineup Management (Team Captain only).
 * Team captains manage only their own side of the lineup.
 * Supports bulk assignment array: [{ boardNumber, playerId }] or single board assignment.
 */
export const updateLineup = async (competitionId, matchId, { teamId, assignments }, userId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');
  validateObjectId(teamId, 'team ID');
  validateObjectId(userId, 'user ID');

  const match = await TeamMatch.findOne({ _id: matchId, competition: competitionId })
    .populate('teamA', '_id name captain status')
    .populate('teamB', '_id name captain status');

  if (!match) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  if (['CANCELLED', 'COMPLETED', 'STARTING', 'IN_PROGRESS'].includes(match.status)) {
    const error = new Error(`Cannot modify lineup for a ${match.status.toLowerCase()} match`);
    error.statusCode = 400;
    throw error;
  }

  if (match.status === 'READY') {
    const error = new Error('Lineup cannot be modified while match is READY. Unlock the lineup first.');
    error.statusCode = 400;
    throw error;
  }

  // Determine which side of the match the team is on
  const isTeamA = match.teamA._id.toString() === teamId.toString();
  const isTeamB = match.teamB._id.toString() === teamId.toString();

  if (!isTeamA && !isTeamB) {
    const error = new Error('Selected team is not part of this match');
    error.statusCode = 400;
    throw error;
  }

  const team = isTeamA ? match.teamA : match.teamB;
  const opponentTeam = isTeamA ? match.teamB : match.teamA;

  // Authorization: Only the captain of that team can edit their team lineup!
  if (toIdString(team.captain) !== userId.toString()) {
    const error = new Error('Forbidden: Only the team captain can manage this team lineup');
    error.statusCode = 403;
    throw error;
  }

  // Check if lineup is locked
  const isLocked = isTeamA ? match.teamALineupLocked : match.teamBLineupLocked;
  if (isLocked) {
    const error = new Error('Team lineup is locked. Unlock before modifying assignments.');
    error.statusCode = 400;
    throw error;
  }

  // Normalize assignments into an array of { boardNumber, playerId }
  let assignmentList = [];
  if (Array.isArray(assignments)) {
    assignmentList = assignments;
  } else if (assignments && typeof assignments === 'object') {
    // If single object passed
    assignmentList = [assignments];
  } else {
    const error = new Error('assignments must be an array of board assignments');
    error.statusCode = 400;
    throw error;
  }

  // Fetch current boards
  const currentBoards = await TeamMatchBoard.find({ match: matchId }).sort({ boardNumber: 1 });

  // Map existing board assignments for this team
  const boardMap = {};
  currentBoards.forEach((b) => {
    boardMap[b.boardNumber] = {
      board: b,
      currentPlayerId: isTeamA ? toIdString(b.teamAPlayer) : toIdString(b.teamBPlayer),
      opponentPlayerId: isTeamA ? toIdString(b.teamBPlayer) : toIdString(b.teamAPlayer),
    };
  });

  // Verify all assignments
  const newAssignmentsByBoard = {};

  for (const item of assignmentList) {
    const boardNum = parseInt(item.boardNumber, 10);
    if (isNaN(boardNum) || boardNum < 1 || boardNum > match.boardCount) {
      const error = new Error(`Invalid board number: ${item.boardNumber}. Must be between 1 and ${match.boardCount}`);
      error.statusCode = 400;
      throw error;
    }

    const playerId = item.playerId ? item.playerId.toString() : null;

    if (playerId) {
      if (!mongoose.isValidObjectId(playerId)) {
        const error = new Error(`Invalid player ID: ${playerId}`);
        error.statusCode = 400;
        throw error;
      }

      // 1. Verify player is ACTIVE member of this team in this competition
      const membership = await TeamCompetitionMember.findOne({
        competition: competitionId,
        team: team._id,
        user: playerId,
        status: 'ACTIVE',
      });

      if (!membership) {
        const error = new Error('Selected player is not an active member of this team in this competition');
        error.statusCode = 400;
        throw error;
      }

      // 2. Verify player is NOT assigned to the opposing team on ANY board of this match
      for (const b of currentBoards) {
        const oppId = isTeamA ? toIdString(b.teamBPlayer) : toIdString(b.teamAPlayer);
        if (oppId === playerId) {
          const error = new Error('Player cannot be assigned to both sides in the same match');
          error.statusCode = 400;
          throw error;
        }
      }
    }

    newAssignmentsByBoard[boardNum] = playerId;
  }

  // Construct projected final player IDs per board for this team
  const finalAssignments = {};
  for (let bNum = 1; bNum <= match.boardCount; bNum++) {
    if (Object.prototype.hasOwnProperty.call(newAssignmentsByBoard, bNum)) {
      finalAssignments[bNum] = newAssignmentsByBoard[bNum];
    } else {
      finalAssignments[bNum] = boardMap[bNum]?.currentPlayerId || null;
    }
  }

  // Duplicate player check: A player cannot occupy multiple boards in the same match
  const assignedPlayerIds = Object.values(finalAssignments).filter(Boolean);
  const uniquePlayerIds = new Set(assignedPlayerIds);
  if (uniquePlayerIds.size !== assignedPlayerIds.length) {
    const error = new Error('A player cannot occupy multiple boards in the same match');
    error.statusCode = 400;
    throw error;
  }

  // Apply updates to boards
  const newlyAssigned = [];

  for (let bNum = 1; bNum <= match.boardCount; bNum++) {
    const existing = boardMap[bNum];
    if (!existing) continue;

    const currentPId = existing.currentPlayerId;
    const nextPId = finalAssignments[bNum];

    if (currentPId !== nextPId) {
      const boardDoc = existing.board;
      if (isTeamA) {
        boardDoc.teamAPlayer = nextPId || null;
        boardDoc.teamAReady = false; // Reset readiness upon change
      } else {
        boardDoc.teamBPlayer = nextPId || null;
        boardDoc.teamBReady = false; // Reset readiness upon change
      }
      await boardDoc.save();

      if (nextPId) {
        newlyAssigned.push({
          boardNumber: bNum,
          playerId: nextPId,
        });
      }
    }
  }

  // If match was in DRAFT, advance it to LINEUP
  if (match.status === 'DRAFT') {
    match.status = 'LINEUP';
    await match.save();
  }

  // Send notification to newly assigned players
  for (const assign of newlyAssigned) {
    try {
      await notificationService.createNotification({
        recipient: assign.playerId,
        type: 'TEAM_MATCH_BOARD_ASSIGNED',
        title: `Board Assignment: Board ${assign.boardNumber}`,
        message: `You have been assigned to Board ${assign.boardNumber} for ${team.name} against ${opponentTeam.name}.`,
        teamCompetition: competitionId,
        team: team._id,
        teamMatch: match._id,
        teamRound: match.round,
        metadata: {
          matchId: match._id.toString(),
          boardNumber: assign.boardNumber,
          teamId: team._id.toString(),
          teamName: team.name,
        },
        eventKey: `match_board_${match._id}_${assign.boardNumber}_${assign.playerId}`,
      });
    } catch {
      // Non-fatal notification failure
    }
  }

  const updatedBoards = await TeamMatchBoard.find({ match: matchId })
    .populate('teamAPlayer', '_id name email avatar lichessUsername')
    .populate('teamBPlayer', '_id name email avatar lichessUsername')
    .sort({ boardNumber: 1 })
    .lean();

  return {
    match,
    boards: updatedBoards,
  };
};

/**
 * Two-level readiness: Player or Captain marks player readiness for an assigned board.
 */
export const setPlayerReady = async (competitionId, matchId, { boardNumber, ready }, userId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');
  validateObjectId(userId, 'user ID');

  const match = await TeamMatch.findOne({ _id: matchId, competition: competitionId })
    .populate('teamA', '_id name captain status')
    .populate('teamB', '_id name captain status');

  if (!match) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  if (['CANCELLED', 'COMPLETED', 'STARTING', 'IN_PROGRESS'].includes(match.status)) {
    const error = new Error(`Cannot update readiness for a ${match.status.toLowerCase()} match`);
    error.statusCode = 400;
    throw error;
  }

  const userIdStr = userId.toString();
  const isCaptainA = toIdString(match.teamA?.captain) === userIdStr;
  const isCaptainB = toIdString(match.teamB?.captain) === userIdStr;

  // Find board
  let boardDoc = null;
  if (boardNumber !== undefined && boardNumber !== null) {
    const parsedNum = parseInt(boardNumber, 10);
    boardDoc = await TeamMatchBoard.findOne({ match: matchId, boardNumber: parsedNum });
  } else {
    // Find board where caller is assigned
    boardDoc = await TeamMatchBoard.findOne({
      match: matchId,
      $or: [{ teamAPlayer: userId }, { teamBPlayer: userId }],
    });
  }

  if (!boardDoc) {
    const error = new Error('Board not found for this match');
    error.statusCode = 404;
    throw error;
  }

  const playerAIdStr = toIdString(boardDoc.teamAPlayer);
  const playerBIdStr = toIdString(boardDoc.teamBPlayer);

  const isPlayerA = playerAIdStr === userIdStr;
  const isPlayerB = playerBIdStr === userIdStr;

  const readyVal = Boolean(ready);

  // Authorization checks
  if (isPlayerA) {
    boardDoc.teamAReady = readyVal;
  } else if (isPlayerB) {
    boardDoc.teamBReady = readyVal;
  } else if (isCaptainA && !isCaptainB) {
    boardDoc.teamAReady = readyVal;
  } else if (isCaptainB && !isCaptainA) {
    boardDoc.teamBReady = readyVal;
  } else {
    const error = new Error('Forbidden: You do not have permission to update readiness for this player');
    error.statusCode = 403;
    throw error;
  }

  await boardDoc.save();

  return boardDoc;
};

/**
 * Captain locks their team's lineup.
 * Enforces all board positions filled, active members, unique players, and player readiness.
 * When both teams are locked, transitions match to READY.
 */
export const lockLineup = async (competitionId, matchId, { teamId }, userId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');
  validateObjectId(teamId, 'team ID');
  validateObjectId(userId, 'user ID');

  const match = await TeamMatch.findOne({ _id: matchId, competition: competitionId })
    .populate('teamA', '_id name captain status')
    .populate('teamB', '_id name captain status')
    .populate('round', '_id roundNumber name status');

  if (!match) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  if (['CANCELLED', 'COMPLETED', 'STARTING', 'IN_PROGRESS'].includes(match.status)) {
    const error = new Error(`Cannot lock lineup for a ${match.status.toLowerCase()} match`);
    error.statusCode = 400;
    throw error;
  }

  const isTeamA = match.teamA._id.toString() === teamId.toString();
  const isTeamB = match.teamB._id.toString() === teamId.toString();

  if (!isTeamA && !isTeamB) {
    const error = new Error('Selected team is not part of this match');
    error.statusCode = 400;
    throw error;
  }

  const team = isTeamA ? match.teamA : match.teamB;
  const opponentTeam = isTeamA ? match.teamB : match.teamA;

  // Authorization: Only the captain can lock their team's lineup
  if (toIdString(team.captain) !== userId.toString()) {
    const error = new Error('Forbidden: Only the team captain can lock this team lineup');
    error.statusCode = 403;
    throw error;
  }

  // Fetch all boards
  const boards = await TeamMatchBoard.find({ match: matchId }).sort({ boardNumber: 1 });

  if (boards.length !== match.boardCount) {
    const error = new Error(`Match configuration error: Expected ${match.boardCount} boards, found ${boards.length}`);
    error.statusCode = 400;
    throw error;
  }

  const assignedPlayerIds = [];

  for (const b of boards) {
    const player = isTeamA ? b.teamAPlayer : b.teamBPlayer;
    const isReady = isTeamA ? b.teamAReady : b.teamBReady;

    // 1. All required board positions must have assigned players
    if (!player) {
      const error = new Error(
        `All board positions must be filled before locking lineup (Board ${b.boardNumber} is empty)`
      );
      error.statusCode = 400;
      throw error;
    }

    // 2. Required player readiness condition
    if (!isReady) {
      const error = new Error(
        `All players on your team must be marked ready before locking lineup (Board ${b.boardNumber} is not ready)`
      );
      error.statusCode = 400;
      throw error;
    }

    assignedPlayerIds.push(player.toString());
  }

  // 3. Verify assigned players are valid ACTIVE members
  const activeMembersCount = await TeamCompetitionMember.countDocuments({
    competition: competitionId,
    team: team._id,
    user: { $in: assignedPlayerIds },
    status: 'ACTIVE',
  });

  if (activeMembersCount !== assignedPlayerIds.length) {
    const error = new Error('One or more assigned players are no longer active members of this team');
    error.statusCode = 400;
    throw error;
  }

  // 4. No duplicate players
  const uniqueIds = new Set(assignedPlayerIds);
  if (uniqueIds.size !== assignedPlayerIds.length) {
    const error = new Error('Duplicate players found in lineup');
    error.statusCode = 400;
    throw error;
  }

  // Apply captain lock
  const lockTime = new Date();
  if (isTeamA) {
    match.teamALineupLocked = true;
    match.teamALineupLockedAt = lockTime;
  } else {
    match.teamBLineupLocked = true;
    match.teamBLineupLockedAt = lockTime;
  }

  // Send TEAM_LINEUP_LOCKED notification to opponent captain and organizer
  const compDoc = await TeamCompetition.findById(competitionId).select('organizer').lean();
  const recipientsToNotify = [toIdString(opponentTeam.captain), toIdString(compDoc?.organizer)].filter(Boolean);

  for (const recipientId of recipientsToNotify) {
    try {
      await notificationService.createNotification({
        recipient: recipientId,
        type: 'TEAM_LINEUP_LOCKED',
        title: `${team.name} Lineup Locked`,
        message: `${team.name} has locked their lineup for their match against ${opponentTeam.name}.`,
        teamCompetition: competitionId,
        team: team._id,
        teamMatch: match._id,
        teamRound: match.round?._id || match.round,
        metadata: {
          matchId: match._id.toString(),
          teamId: team._id.toString(),
          teamName: team.name,
        },
        eventKey: `lineup_locked_${match._id}_${team._id}_${recipientId}`,
      });
    } catch {
      // Non-fatal
    }
  }

  // MATCH LEVEL: Match becomes READY only when both captains have locked lineups
  if (match.teamALineupLocked && match.teamBLineupLocked) {
    match.status = 'READY';

    // Lock all individual boards
    await TeamMatchBoard.updateMany({ match: matchId }, { $set: { locked: true } });

    // Notify captains of both teams and all assigned players
    const matchReadyRecipients = new Set();
    if (toIdString(match.teamA.captain)) matchReadyRecipients.add(toIdString(match.teamA.captain));
    if (toIdString(match.teamB.captain)) matchReadyRecipients.add(toIdString(match.teamB.captain));

    boards.forEach((b) => {
      if (b.teamAPlayer) matchReadyRecipients.add(toIdString(b.teamAPlayer));
      if (b.teamBPlayer) matchReadyRecipients.add(toIdString(b.teamBPlayer));
    });

    for (const rId of matchReadyRecipients) {
      try {
        await notificationService.createNotification({
          recipient: rId,
          type: 'TEAM_MATCH_READY',
          title: 'Match Ready: Lineups Confirmed',
          message: `The match between ${match.teamA.name} and ${match.teamB.name} is now READY! All lineups are locked and confirmed.`,
          teamCompetition: competitionId,
          teamMatch: match._id,
          teamRound: match.round?._id || match.round,
          metadata: {
            matchId: match._id.toString(),
            teamAName: match.teamA.name,
            teamBName: match.teamB.name,
          },
          eventKey: `match_ready_${match._id}_${rId}`,
        });
      } catch {
        // Non-fatal
      }
    }
  }

  await match.save();
  return match;
};

/**
 * Captain unlocks their team's lineup (only while match is editable).
 * Reverts match status to LINEUP if it was READY.
 */
export const unlockLineup = async (competitionId, matchId, { teamId }, userId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');
  validateObjectId(teamId, 'team ID');
  validateObjectId(userId, 'user ID');

  const match = await TeamMatch.findOne({ _id: matchId, competition: competitionId })
    .populate('teamA', '_id name captain status')
    .populate('teamB', '_id name captain status');

  if (!match) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  if (['CANCELLED', 'COMPLETED', 'STARTING', 'IN_PROGRESS'].includes(match.status)) {
    const error = new Error(`Cannot unlock lineup for a ${match.status.toLowerCase()} match`);
    error.statusCode = 400;
    throw error;
  }

  const isTeamA = match.teamA._id.toString() === teamId.toString();
  const isTeamB = match.teamB._id.toString() === teamId.toString();

  if (!isTeamA && !isTeamB) {
    const error = new Error('Selected team is not part of this match');
    error.statusCode = 400;
    throw error;
  }

  const team = isTeamA ? match.teamA : match.teamB;

  if (toIdString(team.captain) !== userId.toString()) {
    const error = new Error('Forbidden: Only the team captain can unlock this team lineup');
    error.statusCode = 403;
    throw error;
  }

  if (isTeamA) {
    match.teamALineupLocked = false;
    match.teamALineupLockedAt = null;
  } else {
    match.teamBLineupLocked = false;
    match.teamBLineupLockedAt = null;
  }

  // Revert match status to LINEUP if it was READY
  if (match.status === 'READY') {
    match.status = 'LINEUP';
    await TeamMatchBoard.updateMany({ match: matchId }, { $set: { locked: false } });
  }

  await match.save();
  return match;
};

/**
 * Start a READY team match and create Lichess games for all boards (Organizer only).
 * Validates locked lineups, active members, player Lichess credentials, and prevents duplicate games.
 * Alternates colors across boards (Odd: A=White, B=Black; Even: B=White, A=Black).
 */
export const startMatch = async (competitionId, matchId, userId, options = {}) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');
  validateObjectId(userId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (toIdString(competition.organizer) !== userId.toString()) {
    const error = new Error('Forbidden: Only the competition organizer can start the match');
    error.statusCode = 403;
    throw error;
  }

  const match = await TeamMatch.findById(matchId);
  if (!match) {
    const error = new Error('Match not found');
    error.statusCode = 404;
    throw error;
  }

  if (match.competition.toString() !== competitionId.toString()) {
    const error = new Error('Match does not belong to this competition');
    error.statusCode = 400;
    throw error;
  }

  const round = await TeamCompetitionRound.findById(match.round);
  if (!round || round.competition.toString() !== competitionId.toString()) {
    const error = new Error('Round does not belong to this competition');
    error.statusCode = 400;
    throw error;
  }

  if (match.status !== 'READY') {
    const error = new Error(`Cannot start match in status "${match.status}". Match must be in READY status.`);
    error.statusCode = 400;
    throw error;
  }

  if (!match.teamALineupLocked || !match.teamBLineupLocked) {
    const error = new Error('Both team captains must lock their lineups before the match can be started.');
    error.statusCode = 400;
    throw error;
  }

  const teamA = await TeamCompetitionTeam.findById(match.teamA);
  const teamB = await TeamCompetitionTeam.findById(match.teamB);
  if (
    !teamA ||
    !teamB ||
    teamA.competition.toString() !== competitionId.toString() ||
    teamB.competition.toString() !== competitionId.toString()
  ) {
    const error = new Error('Match teams do not belong to this competition');
    error.statusCode = 400;
    throw error;
  }

  if (teamA.status !== 'ACTIVE' || teamB.status !== 'ACTIVE') {
    const error = new Error('Both teams must be active to start the match');
    error.statusCode = 400;
    throw error;
  }

  const boards = await TeamMatchBoard.find({ match: matchId }).sort({ boardNumber: 1 });
  if (boards.length !== match.boardCount) {
    const error = new Error(`Match has ${boards.length} boards configured, expected ${match.boardCount}`);
    error.statusCode = 400;
    throw error;
  }

  const teamAPlayerIds = new Set();
  const teamBPlayerIds = new Set();
  const allPlayerIds = [];

  for (const board of boards) {
    if (!board.teamAPlayer) {
      const error = new Error(`Board ${board.boardNumber} is missing Team A player assignment.`);
      error.statusCode = 400;
      throw error;
    }
    if (!board.teamBPlayer) {
      const error = new Error(`Board ${board.boardNumber} is missing Team B player assignment.`);
      error.statusCode = 400;
      throw error;
    }
    if (board.lichessGameId) {
      const error = new Error(`Board ${board.boardNumber} already has a Lichess game created.`);
      error.statusCode = 400;
      throw error;
    }

    const pA = board.teamAPlayer.toString();
    const pB = board.teamBPlayer.toString();

    if (pA === pB) {
      const error = new Error(`Board ${board.boardNumber} has the same player assigned to both teams.`);
      error.statusCode = 400;
      throw error;
    }
    if (teamAPlayerIds.has(pA)) {
      const error = new Error(`Player assigned to Board ${board.boardNumber} is already assigned on another board for Team A.`);
      error.statusCode = 400;
      throw error;
    }
    if (teamBPlayerIds.has(pB)) {
      const error = new Error(`Player assigned to Board ${board.boardNumber} is already assigned on another board for Team B.`);
      error.statusCode = 400;
      throw error;
    }

    teamAPlayerIds.add(pA);
    teamBPlayerIds.add(pB);
    allPlayerIds.push(pA, pB);
  }

  // Verify all players are active members in their respective teams
  const memberships = await TeamCompetitionMember.find({
    team: { $in: [match.teamA, match.teamB] },
    user: { $in: allPlayerIds },
    status: 'ACTIVE',
  }).lean();

  const memberMap = new Map();
  memberships.forEach((m) => {
    memberMap.set(`${m.team.toString()}_${m.user.toString()}`, true);
  });

  for (const board of boards) {
    const pA = board.teamAPlayer.toString();
    const pB = board.teamBPlayer.toString();
    if (!memberMap.has(`${match.teamA.toString()}_${pA}`)) {
      const error = new Error(`Team A player on Board ${board.boardNumber} is not an active team member.`);
      error.statusCode = 400;
      throw error;
    }
    if (!memberMap.has(`${match.teamB.toString()}_${pB}`)) {
      const error = new Error(`Team B player on Board ${board.boardNumber} is not an active team member.`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Pre-validate Lichess authorization for every player before state transition
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDevBridge = !isProduction && Boolean(options.allowDevBridge ?? true);

  for (const board of boards) {
    for (const [side, playerId] of [['Team A', board.teamAPlayer], ['Team B', board.teamBPlayer]]) {
      try {
        await lichessOAuthService.resolveLichessPlayerCredentials(playerId, {
          allowDevBridge,
          requiredScopes: ['challenge:bulk'],
        });
      } catch (authErr) {
        const userDoc = await User.findById(playerId).select('name lichessUsername');
        const displayName = userDoc?.name || userDoc?.lichessUsername || playerId;
        const error = new Error(`Lichess connection required for ${side} player ${displayName}: ${authErr.message}`);
        error.statusCode = 400;
        error.code = authErr.code || 'LICHESS_AUTH_REQUIRED';
        error.playerId = playerId.toString();
        throw error;
      }
    }
  }

  // Atomic state transition to STARTING to protect against double-click and concurrent calls
  const startingMatch = await TeamMatch.findOneAndUpdate(
    { _id: matchId, competition: competitionId, status: 'READY' },
    { $set: { status: 'STARTING' } },
    { new: true }
  );

  if (!startingMatch) {
    const error = new Error('Match could not be started. It may have already been started or is no longer READY.');
    error.statusCode = 400;
    throw error;
  }

  const successfulBoards = [];
  const failedBoards = [];
  const createdLichessGameIds = [];

  for (const board of boards) {
    // Alternating colors: Odd -> Team A White, Team B Black; Even -> Team B White, Team A Black
    const isOdd = board.boardNumber % 2 === 1;
    const whitePlayerId = isOdd ? board.teamAPlayer : board.teamBPlayer;
    const blackPlayerId = isOdd ? board.teamBPlayer : board.teamAPlayer;

    board.whitePlayer = whitePlayerId;
    board.blackPlayer = blackPlayerId;
    board.lichessStatus = 'CREATING';
    await board.save();

    try {
      if (options?.failBoards && options.failBoards.includes(board.boardNumber)) {
        throw new Error(`Simulated failure on Board ${board.boardNumber}`);
      }

      const whiteCreds = await lichessOAuthService.resolveLichessPlayerCredentials(whitePlayerId, {
        allowDevBridge,
        requiredScopes: ['challenge:bulk'],
      });
      const blackCreds = await lichessOAuthService.resolveLichessPlayerCredentials(blackPlayerId, {
        allowDevBridge,
        requiredScopes: ['challenge:bulk'],
      });

      const { gameId, gameUrl } = await lichessService.createGame({
        whiteUsername: whiteCreds.lichessUsername,
        blackUsername: blackCreds.lichessUsername,
        clockLimit: options.clockLimit || 300,
        increment: options.increment || 0,
        rated: options.rated || false,
        token: options.token,
        whiteToken: options.whiteToken || whiteCreds.accessToken,
        blackToken: options.blackToken || blackCreds.accessToken,
      });

      board.lichessGameId = gameId;
      board.lichessUrl = gameUrl || `https://lichess.org/${gameId}`;
      board.lichessWhiteUsername = whiteCreds.lichessUsername;
      board.lichessBlackUsername = blackCreds.lichessUsername;
      board.lichessStatus = 'ACTIVE';
      board.gameStartedAt = new Date();
      board.resultReason = null;
      await board.save();

      successfulBoards.push(board);
      createdLichessGameIds.push(gameId);

      // Start stream if realtime gameStreamManager is active
      try {
        const { startStream } = await import('../realtime/gameStreamManager.js');
        startStream({
          tournamentId: competitionId.toString(),
          roundNumber: match.round?.toString(),
          pairingId: board._id.toString(),
          lichessGameId: gameId,
          token: whiteCreds.accessToken || blackCreds.accessToken,
        }).catch(() => {});
      } catch {
        // Stream warning non-fatal
      }

      // Notify assigned players
      for (const pid of [whitePlayerId, blackPlayerId]) {
        try {
          await notificationService.createNotification({
            recipient: pid,
            type: 'TEAM_MATCH_STARTED',
            title: 'Team Match Started',
            message: `Your team match has started. Board ${board.boardNumber} is ready on Lichess.`,
            teamCompetition: competitionId,
            teamMatch: matchId,
            teamRound: match.round,
            metadata: {
              matchId: matchId.toString(),
              boardNumber: board.boardNumber,
              lichessUrl: board.lichessUrl,
              lichessGameId: gameId,
            },
            eventKey: `team_match_started_${matchId}_${board.boardNumber}_${pid}`,
          });
        } catch {
          // Notification failure non-fatal
        }
      }
    } catch (boardErr) {
      board.lichessStatus = 'ERROR';
      board.resultReason = boardErr.message || 'Game creation failed';
      await board.save();
      failedBoards.push({
        boardNumber: board.boardNumber,
        error: boardErr.message,
      });
    }
  }

  // Update match lifecycle according to board creation outcomes
  if (successfulBoards.length > 0) {
    startingMatch.status = 'IN_PROGRESS';
    await startingMatch.save();
  } else {
    // If every board failed, revert to READY so organizer can resolve and retry
    startingMatch.status = 'READY';
    await startingMatch.save();
  }

  // Realtime broadcast of match start status
  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      io.to(`competition:${competitionId}`).emit('team-match:started', {
        matchId: matchId.toString(),
        status: startingMatch.status,
        successfulBoards: successfulBoards.map((b) => b.boardNumber),
        failedBoards: failedBoards.map((f) => f.boardNumber),
      });
    }
  } catch {
    // Non-fatal
  }

  return {
    match: startingMatch,
    status: startingMatch.status,
    successfulBoards: successfulBoards.map((b) => b.boardNumber),
    failedBoards,
    createdLichessGameIds,
    retryableBoards: failedBoards.map((f) => f.boardNumber),
  };
};

/**
 * Retry failed / not-yet-created boards for a team match (Organizer only).
 * Never recreates already-created games.
 */
export const retryFailedBoards = async (competitionId, matchId, userId, options = {}) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');
  validateObjectId(userId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (toIdString(competition.organizer) !== userId.toString()) {
    const error = new Error('Forbidden: Only the competition organizer can retry failed boards');
    error.statusCode = 403;
    throw error;
  }

  const match = await TeamMatch.findById(matchId);
  if (!match || match.competition.toString() !== competitionId.toString()) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  if (['COMPLETED', 'CANCELLED'].includes(match.status)) {
    const error = new Error(`Cannot retry boards for a ${match.status.toLowerCase()} match`);
    error.statusCode = 400;
    throw error;
  }

  const boards = await TeamMatchBoard.find({ match: matchId }).sort({ boardNumber: 1 });

  // Race condition defense: check if any board is actively creating
  if (boards.some((b) => b.lichessStatus === 'CREATING')) {
    const error = new Error('Boards are currently being created. Please wait for current attempt to finish.');
    error.statusCode = 409;
    throw error;
  }

  const retryableBoards = boards.filter(
    (b) => !b.lichessGameId || ['ERROR', 'NOT_STARTED'].includes(b.lichessStatus)
  );

  if (retryableBoards.length === 0) {
    return {
      match,
      status: match.status,
      message: 'No failed boards to retry',
      retried: 0,
      successfulBoards: [],
      failedBoards: [],
      createdLichessGameIds: [],
      retryableBoards: [],
    };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const allowDevBridge = !isProduction && Boolean(options.allowDevBridge ?? true);

  const retrySuccessful = [];
  const retryFailed = [];
  const retryCreatedIds = [];

  for (const board of retryableBoards) {
    const isOdd = board.boardNumber % 2 === 1;
    const whitePlayerId = isOdd ? board.teamAPlayer : board.teamBPlayer;
    const blackPlayerId = isOdd ? board.teamBPlayer : board.teamAPlayer;

    board.whitePlayer = whitePlayerId;
    board.blackPlayer = blackPlayerId;
    board.lichessStatus = 'CREATING';
    await board.save();

    try {
      if (options?.failBoards && options.failBoards.includes(board.boardNumber)) {
        throw new Error(`Simulated retry failure on Board ${board.boardNumber}`);
      }

      const whiteCreds = await lichessOAuthService.resolveLichessPlayerCredentials(whitePlayerId, {
        allowDevBridge,
        requiredScopes: ['challenge:bulk'],
      });
      const blackCreds = await lichessOAuthService.resolveLichessPlayerCredentials(blackPlayerId, {
        allowDevBridge,
        requiredScopes: ['challenge:bulk'],
      });

      const { gameId, gameUrl } = await lichessService.createGame({
        whiteUsername: whiteCreds.lichessUsername,
        blackUsername: blackCreds.lichessUsername,
        clockLimit: options.clockLimit || 300,
        increment: options.increment || 0,
        rated: options.rated || false,
        token: options.token,
        whiteToken: options.whiteToken || whiteCreds.accessToken,
        blackToken: options.blackToken || blackCreds.accessToken,
      });

      board.lichessGameId = gameId;
      board.lichessUrl = gameUrl || `https://lichess.org/${gameId}`;
      board.lichessWhiteUsername = whiteCreds.lichessUsername;
      board.lichessBlackUsername = blackCreds.lichessUsername;
      board.lichessStatus = 'ACTIVE';
      board.gameStartedAt = new Date();
      board.resultReason = null;
      await board.save();

      retrySuccessful.push(board);
      retryCreatedIds.push(gameId);

      // Start stream if realtime gameStreamManager is active
      try {
        const { startStream } = await import('../realtime/gameStreamManager.js');
        startStream({
          tournamentId: competitionId.toString(),
          roundNumber: match.round?.toString(),
          pairingId: board._id.toString(),
          lichessGameId: gameId,
          token: whiteCreds.accessToken || blackCreds.accessToken,
        }).catch(() => {});
      } catch {
        // Non-fatal
      }

      // Notify assigned players
      for (const pid of [whitePlayerId, blackPlayerId]) {
        try {
          await notificationService.createNotification({
            recipient: pid,
            type: 'TEAM_MATCH_STARTED',
            title: 'Team Match Started',
            message: `Your team match has started. Board ${board.boardNumber} is ready on Lichess.`,
            teamCompetition: competitionId,
            teamMatch: matchId,
            teamRound: match.round,
            metadata: {
              matchId: matchId.toString(),
              boardNumber: board.boardNumber,
              lichessUrl: board.lichessUrl,
              lichessGameId: gameId,
            },
            eventKey: `team_match_started_${matchId}_${board.boardNumber}_${pid}`,
          });
        } catch {
          // Non-fatal
        }
      }
    } catch (retryErr) {
      board.lichessStatus = 'ERROR';
      board.resultReason = retryErr.message || 'Retry game creation failed';
      await board.save();
      retryFailed.push({
        boardNumber: board.boardNumber,
        error: retryErr.message,
      });
    }
  }

  // If match was READY or STARTING, transition to IN_PROGRESS if any board is now active
  const allBoardsAfterRetry = await TeamMatchBoard.find({ match: matchId });
  const hasActiveBoard = allBoardsAfterRetry.some(
    (b) => b.lichessGameId && ['ACTIVE', 'FINISHED', 'ABORTED'].includes(b.lichessStatus)
  );

  if (hasActiveBoard && match.status !== 'IN_PROGRESS' && match.status !== 'COMPLETED') {
    match.status = 'IN_PROGRESS';
    await match.save();
  }

  return {
    match,
    status: match.status,
    retried: retryableBoards.length,
    successfulBoards: retrySuccessful.map((b) => b.boardNumber),
    failedBoards: retryFailed,
    createdLichessGameIds: retryCreatedIds,
    retryableBoards: retryFailed.map((f) => f.boardNumber),
  };
};

/**
 * Synchronize Lichess game results for all boards in a team match.
 * Idempotent: repeated synchronization of terminal games produces the same result.
 * When all boards reach terminal state, transitions match to COMPLETED.
 */
export const syncMatchResults = async (competitionId, matchId, userId = null, options = {}) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');

  const match = await TeamMatch.findById(matchId);
  if (!match || match.competition.toString() !== competitionId.toString()) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  // If match is already completed and not force, return current state
  if (match.status === 'COMPLETED' && !options?.force) {
    const boards = await TeamMatchBoard.find({ match: matchId }).sort({ boardNumber: 1 });
    return {
      match,
      boards,
      syncedBoards: 0,
      completed: true,
    };
  }

  const boards = await TeamMatchBoard.find({ match: matchId }).sort({ boardNumber: 1 });
  let syncedCount = 0;

  for (const board of boards) {
    if (!board.lichessGameId) {
      continue;
    }

    // Idempotency: skip already terminal boards unless forced
    const isTerminal =
      ['FINISHED', 'ABORTED'].includes(board.lichessStatus) &&
      ['1-0', '0-1', '1/2-1/2', 'ABORTED'].includes(board.result);

    if (isTerminal && !options?.force) {
      continue;
    }

    try {
      const gameData = await lichessService.getGameResult(board.lichessGameId, options);
      board.lastSyncedAt = new Date();

      if (gameData.completed) {
        board.lichessStatus = gameData.pairingStatus; // 'FINISHED' or 'ABORTED'
        board.result = gameData.result; // '1-0', '0-1', '1/2-1/2', 'ABORTED'
        board.resultReason = gameData.status || null;
        if (!board.gameFinishedAt) {
          board.gameFinishedAt = new Date();
        }

        // V4 deterministic board scoring
        const bScore = calculateBoardScore(board);
        board.teamAPoints = bScore.teamAPoints;
        board.teamBPoints = bScore.teamBPoints;
      } else {
        board.lichessStatus = 'ACTIVE';
      }

      await board.save();
      syncedCount++;
    } catch (syncErr) {
      console.warn(`[Sync] Failed to sync Board ${board.boardNumber} (${board.lichessGameId}):`, syncErr.message);
    }
  }

  // Check match completion: All boards must have terminal state
  const updatedBoards = await TeamMatchBoard.find({ match: matchId }).sort({ boardNumber: 1 });
  const allTerminal =
    updatedBoards.length > 0 &&
    updatedBoards.every(
      (b) => ['FINISHED', 'ABORTED'].includes(b.lichessStatus) && (b.result !== null || b.overrideResult !== null)
    );

  if (allTerminal) {
    const matchCalc = calculateMatchScore(match, updatedBoards);
    const wasNotFinal = match.scoringStatus !== 'FINAL';

    match.status = 'COMPLETED';
    match.completedAt = match.completedAt || new Date();
    match.scoringStatus = matchCalc.scoringStatus;
    match.teamAScore = matchCalc.teamAScore;
    match.teamBScore = matchCalc.teamBScore;

    if (matchCalc.scoringStatus === 'FINAL') {
      match.teamAResult = matchCalc.teamAResult;
      match.teamBResult = matchCalc.teamBResult;
      match.winnerTeam = matchCalc.winnerTeam;
      match.teamAMatchPoints = matchCalc.teamAMatchPoints;
      match.teamBMatchPoints = matchCalc.teamBMatchPoints;
      match.finalizedAt = match.finalizedAt || new Date();
    } else {
      // REVIEW_REQUIRED: preserve partial board scores, but do not award winner or final match points
      match.teamAResult = null;
      match.teamBResult = null;
      match.winnerTeam = null;
      match.teamAMatchPoints = 0;
      match.teamBMatchPoints = 0;
    }

    await match.save();

    // If match is FINAL, rebuild competition standings and notify participants
    if (matchCalc.scoringStatus === 'FINAL') {
      await rebuildCompetitionStandings(competitionId);
      if (wasNotFinal) {
        await notifyMatchCompletion(match, competitionId);
      }
    }

    // Check round completion: If all non-cancelled matches in round are completed
    if (match.round) {
      const roundMatches = await TeamMatch.find({
        round: match.round,
        status: { $ne: 'CANCELLED' },
      });
      const allRoundCompleted =
        roundMatches.length > 0 && roundMatches.every((m) => m.status === 'COMPLETED');
      if (allRoundCompleted) {
        await TeamCompetitionRound.findByIdAndUpdate(match.round, {
          $set: { status: 'COMPLETED' },
        });
      }
    }

    // Realtime broadcast of match completion & standings update
    try {
      const { getIo } = await import('../realtime/socket.js');
      const io = getIo();
      if (io) {
        io.to(`competition:${competitionId}`).emit('team-match:completed', {
          matchId: matchId.toString(),
          status: 'COMPLETED',
          scoringStatus: match.scoringStatus,
          teamAScore: match.teamAScore,
          teamBScore: match.teamBScore,
          winnerTeam: match.winnerTeam,
        });
        if (match.scoringStatus === 'FINAL') {
          io.to(`competition:${competitionId}`).emit('team-competition:standings-updated', {
            competitionId: competitionId.toString(),
          });
        }
      }
    } catch {
      // Non-fatal
    }
  }

  return {
    match,
    boards: updatedBoards,
    syncedBoards: syncedCount,
    completed: match.status === 'COMPLETED',
  };
};

/**
 * Dispatch match completion notification to captains, players, and organizer.
 * Uses deterministic eventKey to prevent duplicate notifications.
 */
export const notifyMatchCompletion = async (match, competitionId) => {
  try {
    const compDoc = await TeamCompetition.findById(competitionId).select('name organizer');
    const teamADoc = await TeamCompetitionTeam.findById(match.teamA).select('name captain');
    const teamBDoc = await TeamCompetitionTeam.findById(match.teamB).select('name captain');

    const nameA = teamADoc?.name || 'Team A';
    const nameB = teamBDoc?.name || 'Team B';

    let outcomeMsg = '';
    if (match.teamAResult === 'WIN') {
      outcomeMsg = `${nameA} defeated ${nameB} (${match.teamAScore} - ${match.teamBScore})`;
    } else if (match.teamBResult === 'WIN') {
      outcomeMsg = `${nameB} defeated ${nameA} (${match.teamBScore} - ${match.teamAScore})`;
    } else {
      outcomeMsg = `${nameA} drew with ${nameB} (${match.teamAScore} - ${match.teamBScore})`;
    }

    const recipientIds = new Set();
    if (teamADoc?.captain) recipientIds.add(teamADoc.captain.toString());
    if (teamBDoc?.captain) recipientIds.add(teamBDoc.captain.toString());
    if (compDoc?.organizer) recipientIds.add(compDoc.organizer.toString());

    const boards = await TeamMatchBoard.find({ match: match._id });
    boards.forEach((b) => {
      if (b.teamAPlayer) recipientIds.add(b.teamAPlayer.toString());
      if (b.teamBPlayer) recipientIds.add(b.teamBPlayer.toString());
    });

    for (const recipientId of recipientIds) {
      try {
        await notificationService.createNotification({
          recipient: recipientId,
          type: 'TEAM_MATCH_COMPLETED',
          title: 'Team Match Completed',
          message: `Match finished: ${outcomeMsg}`,
          teamCompetition: competitionId,
          teamMatch: match._id,
          teamRound: match.round,
          metadata: {
            matchId: match._id.toString(),
            teamAScore: match.teamAScore,
            teamBScore: match.teamBScore,
            teamAResult: match.teamAResult,
            teamBResult: match.teamBResult,
            winnerTeam: match.winnerTeam?.toString() || null,
          },
          eventKey: `team_match_completed_${match._id}_${recipientId}`,
        });
      } catch {
        // Ignored if duplicate or non-fatal
      }
    }
  } catch (err) {
    console.warn('[Notification] Failed to send match completion notifications:', err.message);
  }
};

/**
 * Resolve an aborted or disputed board result (Organizer only).
 * Recalculates match scoring and updates competition standings if match becomes FINAL.
 */
export const resolveMatchResult = async (
  competitionId,
  matchId,
  { boardNumber, result, reason },
  userId
) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');
  validateObjectId(userId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (toIdString(competition.organizer) !== userId.toString()) {
    const error = new Error('Forbidden: Only the competition organizer can resolve match results');
    error.statusCode = 403;
    throw error;
  }

  const match = await TeamMatch.findById(matchId);
  if (!match || match.competition.toString() !== competitionId.toString()) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  if (match.status === 'CANCELLED') {
    const error = new Error('Cannot resolve results for a cancelled match');
    error.statusCode = 400;
    throw error;
  }

  const parsedBoardNumber = parseInt(boardNumber, 10);
  if (isNaN(parsedBoardNumber) || parsedBoardNumber < 1) {
    const error = new Error('boardNumber must be a positive integer');
    error.statusCode = 400;
    throw error;
  }

  const allowedResults = ['1-0', '0-1', '1/2-1/2'];
  if (!allowedResults.includes(result)) {
    const error = new Error(`Invalid result: '${result}'. Allowed values: ${allowedResults.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const board = await TeamMatchBoard.findOne({ match: matchId, boardNumber: parsedBoardNumber });
  if (!board) {
    const error = new Error(`Board ${parsedBoardNumber} not found in this match`);
    error.statusCode = 404;
    throw error;
  }

  // Update board resolution override
  board.overrideResult = result;
  board.overrideReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'Organizer decision';
  board.resolvedBy = userId;
  board.resolvedAt = new Date();

  if (!['FINISHED', 'ABORTED'].includes(board.lichessStatus)) {
    board.lichessStatus = 'FINISHED';
  }
  if (!board.gameFinishedAt) {
    board.gameFinishedAt = new Date();
  }

  const bScore = calculateBoardScore(board);
  board.teamAPoints = bScore.teamAPoints;
  board.teamBPoints = bScore.teamBPoints;
  await board.save();

  // Recalculate match scoring across all boards
  const allBoards = await TeamMatchBoard.find({ match: matchId }).sort({ boardNumber: 1 });
  const matchCalc = calculateMatchScore(match, allBoards);
  const wasNotFinal = match.scoringStatus !== 'FINAL';

  match.status = 'COMPLETED';
  match.completedAt = match.completedAt || new Date();
  match.scoringStatus = matchCalc.scoringStatus;
  match.teamAScore = matchCalc.teamAScore;
  match.teamBScore = matchCalc.teamBScore;

  if (matchCalc.scoringStatus === 'FINAL') {
    match.teamAResult = matchCalc.teamAResult;
    match.teamBResult = matchCalc.teamBResult;
    match.winnerTeam = matchCalc.winnerTeam;
    match.teamAMatchPoints = matchCalc.teamAMatchPoints;
    match.teamBMatchPoints = matchCalc.teamBMatchPoints;
    match.finalizedAt = new Date();
  } else {
    match.teamAResult = null;
    match.teamBResult = null;
    match.winnerTeam = null;
    match.teamAMatchPoints = 0;
    match.teamBMatchPoints = 0;
  }

  await match.save();

  const standingsData = await rebuildCompetitionStandings(competitionId);
  const standings = standingsData.standings;
  if (matchCalc.scoringStatus === 'FINAL' && wasNotFinal) {
    await notifyMatchCompletion(match, competitionId);
  }

  // Realtime broadcast of resolution & updated standings
  try {
    const { getIo } = await import('../realtime/socket.js');
    const io = getIo();
    if (io) {
      io.to(`competition:${competitionId}`).emit('team-match:completed', {
        matchId: matchId.toString(),
        status: 'COMPLETED',
        scoringStatus: match.scoringStatus,
        teamAScore: match.teamAScore,
        teamBScore: match.teamBScore,
        winnerTeam: match.winnerTeam,
      });
      if (match.scoringStatus === 'FINAL') {
        io.to(`competition:${competitionId}`).emit('team-competition:standings-updated', {
          competitionId: competitionId.toString(),
        });
      }
    }
  } catch {
    // Non-fatal
  }

  return {
    match,
    boards: allBoards,
    resolvedBoard: board,
    scoringStatus: match.scoringStatus,
    standings,
  };
};

/**
 * Get match result breakdown.
 */
export const getMatchResult = async (competitionId, matchId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(matchId, 'match ID');

  const match = await TeamMatch.findOne({ _id: matchId, competition: competitionId })
    .populate('teamA', '_id name captain status')
    .populate('teamB', '_id name captain status')
    .populate('winnerTeam', '_id name')
    .populate('round', '_id roundNumber name status')
    .lean();

  if (!match) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  const boards = await TeamMatchBoard.find({ match: matchId })
    .populate('teamAPlayer', '_id name email avatar lichessUsername')
    .populate('teamBPlayer', '_id name email avatar lichessUsername')
    .populate('whitePlayer', '_id name email avatar lichessUsername')
    .populate('blackPlayer', '_id name email avatar lichessUsername')
    .populate('resolvedBy', '_id name email')
    .sort({ boardNumber: 1 })
    .lean();

  return {
    matchId: match._id,
    competition: match.competition,
    round: match.round,
    teamA: match.teamA,
    teamB: match.teamB,
    teamAScore: match.teamAScore || 0,
    teamBScore: match.teamBScore || 0,
    teamAMatchPoints: match.teamAMatchPoints || 0,
    teamBMatchPoints: match.teamBMatchPoints || 0,
    teamAResult: match.teamAResult,
    teamBResult: match.teamBResult,
    winnerTeam: match.winnerTeam,
    scoringStatus: match.scoringStatus || 'PENDING',
    status: match.status,
    boardCount: match.boardCount,
    completedAt: match.completedAt,
    finalizedAt: match.finalizedAt,
    boards: boards.map((b) => {
      const bScore = calculateBoardScore(b);
      return {
        _id: b._id,
        boardNumber: b.boardNumber,
        teamAPlayer: b.teamAPlayer,
        teamBPlayer: b.teamBPlayer,
        whitePlayer: b.whitePlayer,
        blackPlayer: b.blackPlayer,
        result: b.result,
        overrideResult: b.overrideResult,
        overrideReason: b.overrideReason,
        resolvedBy: b.resolvedBy,
        resolvedAt: b.resolvedAt,
        effectiveResult: bScore.effectiveResult,
        teamAPoints: bScore.isScoreable ? bScore.teamAPoints : null,
        teamBPoints: bScore.isScoreable ? bScore.teamBPoints : null,
        lichessStatus: b.lichessStatus,
        lichessUrl: b.lichessUrl,
        isAborted: bScore.isAborted,
        isScoreable: bScore.isScoreable,
      };
    }),
  };
};

/**
 * Get round results including all matches and scoring status.
 */
export const getRoundResults = async (competitionId, roundId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(roundId, 'round ID');

  const round = await TeamCompetitionRound.findOne({ _id: roundId, competition: competitionId }).lean();
  if (!round) {
    const error = new Error('Round not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  const matches = await TeamMatch.find({ round: roundId, competition: competitionId })
    .populate('teamA', '_id name captain status')
    .populate('teamB', '_id name captain status')
    .populate('winnerTeam', '_id name')
    .sort({ createdAt: 1 })
    .lean();

  return {
    round: {
      _id: round._id,
      roundNumber: round.roundNumber,
      name: round.name,
      status: round.status,
      scheduledStart: round.scheduledStart,
    },
    matches: matches.map((m) => ({
      matchId: m._id,
      roundId: m.round,
      teamA: m.teamA,
      teamB: m.teamB,
      teamAScore: m.teamAScore || 0,
      teamBScore: m.teamBScore || 0,
      teamAMatchPoints: m.teamAMatchPoints || 0,
      teamBMatchPoints: m.teamBMatchPoints || 0,
      teamAResult: m.teamAResult,
      teamBResult: m.teamBResult,
      winner: m.winnerTeam,
      scoringStatus: m.scoringStatus || 'PENDING',
      status: m.status,
      boardCount: m.boardCount,
      completedAt: m.completedAt,
    })),
  };
};

/**
 * Get Round Robin schedule preview including team counts, rounds, matches, and BYEs.
 */
export const getRoundRobinPreview = async (competitionId, userId = null) => {
  validateObjectId(competitionId, 'competition ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  const activeTeams = await TeamCompetitionTeam.find({
    competition: competitionId,
    status: 'ACTIVE',
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const existingRoundsCount = await TeamCompetitionRound.countDocuments({
    competition: competitionId,
  });
  const existingMatchesCount = await TeamMatch.countDocuments({
    competition: competitionId,
  });
  const hasExistingSchedule = existingRoundsCount > 0 || existingMatchesCount > 0;

  const hasStartedMatches = hasExistingSchedule
    ? (await TeamMatch.countDocuments({
        competition: competitionId,
        status: { $in: ['STARTING', 'IN_PROGRESS', 'COMPLETED'] },
      })) > 0
    : false;

  const isOrganizer = userId
    ? toIdString(competition.organizer) === userId.toString()
    : false;

  if (activeTeams.length < 2) {
    return {
      competitionId: competition._id,
      competitionName: competition.name,
      status: competition.status,
      eligibleTeamsCount: activeTeams.length,
      roundsCount: 0,
      matchesCount: 0,
      byesPerRound: 0,
      totalByes: 0,
      hasExistingSchedule,
      canGenerate: false,
      canRegenerate: false,
      reason: `At least 2 active teams are required. Current active teams: ${activeTeams.length}`,
      teams: activeTeams.map((t) => ({
        _id: t._id,
        name: t.name,
        captain: t.captain,
      })),
      previewRounds: [],
    };
  }

  const previewSchedule = generateTeamRoundRobinSchedule(activeTeams);
  const teamMap = new Map();
  activeTeams.forEach((t) => teamMap.set(t._id.toString(), t));

  return {
    competitionId: competition._id,
    competitionName: competition.name,
    status: competition.status,
    eligibleTeamsCount: previewSchedule.totalTeams,
    roundsCount: previewSchedule.totalRounds,
    matchesCount: previewSchedule.totalMatches,
    byesPerRound: activeTeams.length % 2 !== 0 ? 1 : 0,
    totalByes: previewSchedule.byesCount,
    hasExistingSchedule,
    canGenerate: !hasExistingSchedule && isOrganizer,
    canRegenerate: hasExistingSchedule && !hasStartedMatches && isOrganizer,
    teams: activeTeams.map((t) => ({
      _id: t._id,
      name: t.name,
      captain: t.captain,
    })),
    previewRounds: previewSchedule.rounds.map((r) => ({
      roundNumber: r.roundNumber,
      matchesCount: r.matches.length,
      byeTeam: r.byeTeam ? teamMap.get(r.byeTeam) || { _id: r.byeTeam } : null,
      matches: r.matches.map((m) => ({
        teamA: teamMap.get(m.teamA) || { _id: m.teamA },
        teamB: teamMap.get(m.teamB) || { _id: m.teamB },
      })),
    })),
  };
};

/**
 * Generate a deterministic Round Robin schedule for a Team Competition (Organizer only).
 * Creates all rounds and matches using the circle-method algorithm.
 */
export const generateRoundRobinSchedule = async (
  competitionId,
  options = {},
  userId
) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(userId, 'user ID');

  const lockKey = competitionId.toString();
  if (activeScheduleGenerations.has(lockKey)) {
    const error = new Error('Schedule generation is already in progress for this competition');
    error.statusCode = 409;
    throw error;
  }
  activeScheduleGenerations.add(lockKey);

  let session = null;
  try {
    const competition = await TeamCompetition.findById(competitionId);
    if (!competition) {
      const error = new Error('Competition not found');
      error.statusCode = 404;
      throw error;
    }

    if (toIdString(competition.organizer) !== userId.toString()) {
      const error = new Error('Forbidden: Only the competition organizer can generate the schedule');
      error.statusCode = 403;
      throw error;
    }

    const ALLOWED_COMPETITION_STATUSES = ['REGISTRATION', 'READY', 'IN_PROGRESS'];
    if (!ALLOWED_COMPETITION_STATUSES.includes(competition.status)) {
      const error = new Error(
        `Cannot generate schedule for a ${competition.status.toLowerCase()} competition`
      );
      error.statusCode = 400;
      throw error;
    }

    // Fetch eligible active teams only
    const activeTeams = await TeamCompetitionTeam.find({
      competition: competitionId,
      status: 'ACTIVE',
    }).lean();

    if (activeTeams.length < 2) {
      const error = new Error(
        `Round Robin scheduling requires at least 2 active teams. Current active teams: ${activeTeams.length}`
      );
      error.statusCode = 400;
      throw error;
    }

    // Validate boardCount
    let parsedBoardCount = 4;
    if (options.boardCount !== undefined && options.boardCount !== null) {
      parsedBoardCount = parseInt(options.boardCount, 10);
      if (isNaN(parsedBoardCount) || parsedBoardCount < 1 || parsedBoardCount > 20) {
        const error = new Error('boardCount must be an integer between 1 and 20');
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate scheduledStart
    let cleanScheduledStart = null;
    if (options.scheduledStart) {
      const parsedDate = new Date(options.scheduledStart);
      if (isNaN(parsedDate.getTime())) {
        const error = new Error('Invalid scheduledStart date format');
        error.statusCode = 400;
        throw error;
      }
      cleanScheduledStart = parsedDate;
    }

    // Generate schedule via circle method
    const scheduleResult = generateTeamRoundRobinSchedule(activeTeams);

    const teamMap = new Map();
    activeTeams.forEach((t) => teamMap.set(t._id.toString(), t));

    // Support MongoDB transactions when supported by deployment topology (e.g. ReplicaSet)
    session = null;
    let isTransactionActive = false;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      isTransactionActive = true;
    } catch {
      if (session) {
        try {
          await session.endSession();
        } catch {}
        session = null;
      }
      isTransactionActive = false;
    }
    const queryOpts = isTransactionActive && session ? { session } : {};

    // Transactional creation with rollback cleanup on error
    const createdRoundIds = [];
    const createdMatchIds = [];
    const createdBoardIds = [];

    try {
      // Check existing schedule
      const existingRoundsCount = await TeamCompetitionRound.countDocuments({
        competition: competitionId,
      });
      const existingMatchesCount = await TeamMatch.countDocuments({
        competition: competitionId,
      });
      const hasExistingSchedule = existingRoundsCount > 0 || existingMatchesCount > 0;

      if (hasExistingSchedule) {
        if (!options.regenerate) {
          const error = new Error('A schedule already exists for this competition');
          error.statusCode = 400;
          throw error;
        }

        // Safe regeneration check: ensure no matches have progressed past pre-start
        const activeOrCompletedCount = await TeamMatch.countDocuments({
          competition: competitionId,
          status: { $in: ['STARTING', 'IN_PROGRESS', 'COMPLETED'] },
        });

        if (activeOrCompletedCount > 0) {
          const error = new Error(
            'Cannot regenerate schedule: one or more matches have already started or completed'
          );
          error.statusCode = 400;
          throw error;
        }

        // Delete existing pre-start fixtures safely
        const safeMatches = await TeamMatch.find(
          {
            competition: competitionId,
            status: { $in: ['DRAFT', 'LINEUP', 'READY', 'SCHEDULED'] },
          },
          null,
          queryOpts
        ).select('_id');
        const safeMatchIds = safeMatches.map((m) => m._id);
        if (safeMatchIds.length > 0) {
          await TeamMatchBoard.deleteMany({ match: { $in: safeMatchIds } }, queryOpts);
          await TeamMatch.deleteMany({ _id: { $in: safeMatchIds } }, queryOpts);
        }
        await TeamCompetitionRound.deleteMany(
          {
            competition: competitionId,
            status: { $in: ['DRAFT', 'SCHEDULED'] },
          },
          queryOpts
        );
      }

      for (const r of scheduleResult.rounds) {
        const [roundDoc] = await TeamCompetitionRound.create(
          [
            {
              competition: competitionId,
              roundNumber: r.roundNumber,
              name: `Round ${r.roundNumber}`,
              status: 'DRAFT',
              scheduledStart: cleanScheduledStart,
              byeTeam: r.byeTeam ? r.byeTeam : null,
              createdBy: userId,
            },
          ],
          queryOpts
        );
        createdRoundIds.push(roundDoc._id);

        for (const pairing of r.matches) {
          const [matchDoc] = await TeamMatch.create(
            [
              {
                competition: competitionId,
                round: roundDoc._id,
                teamA: pairing.teamA,
                teamB: pairing.teamB,
                boardCount: parsedBoardCount,
                status: 'DRAFT',
                scoringStatus: 'PENDING',
                scheduledStart: cleanScheduledStart,
                createdBy: userId,
              },
            ],
            queryOpts
          );
          createdMatchIds.push(matchDoc._id);

          const boardsToInsert = [];
          for (let b = 1; b <= parsedBoardCount; b++) {
            boardsToInsert.push({
              match: matchDoc._id,
              boardNumber: b,
              teamAPlayer: null,
              teamBPlayer: null,
              teamAReady: false,
              teamBReady: false,
              locked: false,
            });
          }
          const insertedBoards = await TeamMatchBoard.insertMany(boardsToInsert, queryOpts);
          insertedBoards.forEach((board) => createdBoardIds.push(board._id));
        }
      }

      // Advance competition status to READY if currently in REGISTRATION
      if (competition.status === 'REGISTRATION') {
        competition.status = 'READY';
        await competition.save(queryOpts);
      }

      if (isTransactionActive && session) {
        await session.commitTransaction();
        await session.endSession();
        session = null;
        isTransactionActive = false;
      }
    } catch (creationError) {
      if (isTransactionActive && session) {
        try {
          await session.abortTransaction();
        } catch {}
        try {
          await session.endSession();
        } catch {}
        session = null;
        isTransactionActive = false;
      } else {
        // Safe compensating rollback for non-transactional environments:
        // cleanly delete only the specific record IDs created during this execution
        if (createdBoardIds.length > 0) {
          await TeamMatchBoard.deleteMany({ _id: { $in: createdBoardIds } }).catch(() => {});
        }
        if (createdMatchIds.length > 0) {
          await TeamMatch.deleteMany({ _id: { $in: createdMatchIds } }).catch(() => {});
        }
        if (createdRoundIds.length > 0) {
          await TeamCompetitionRound.deleteMany({ _id: { $in: createdRoundIds } }).catch(() => {});
        }
      }

      if (creationError.code === 11000) {
        const conflictError = new Error(
          'A schedule already exists or is being generated concurrently for this competition'
        );
        conflictError.statusCode = 409;
        throw conflictError;
      }

      throw creationError;
    }

    // Broadcast schedule generation event via Socket.IO
    try {
      const { getIo } = await import('../realtime/socket.js');
      const io = getIo();
      if (io) {
        io.to(`competition:${competitionId}`).emit('team-competition:schedule-generated', {
          competitionId: competitionId.toString(),
          totalRounds: scheduleResult.totalRounds,
          totalMatches: scheduleResult.totalMatches,
        });
      }
    } catch {
      // Non-fatal
    }

    return {
      competitionId: competition._id,
      competitionName: competition.name,
      competitionStatus: competition.status,
      totalTeams: scheduleResult.totalTeams,
      totalRounds: scheduleResult.totalRounds,
      totalMatches: scheduleResult.totalMatches,
      byesCount: scheduleResult.byesCount,
      boardCount: parsedBoardCount,
      rounds: scheduleResult.rounds.map((r, idx) => ({
        roundNumber: r.roundNumber,
        roundId: createdRoundIds[idx],
        name: `Round ${r.roundNumber}`,
        matchesCount: r.matches.length,
        byeTeam: r.byeTeam ? teamMap.get(r.byeTeam) || { _id: r.byeTeam } : null,
        matches: r.matches.map((m) => ({
          teamA: teamMap.get(m.teamA) || { _id: m.teamA },
          teamB: teamMap.get(m.teamB) || { _id: m.teamB },
          boardCount: parsedBoardCount,
          status: 'DRAFT',
        })),
      })),
    };
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch {}
    }
    activeScheduleGenerations.delete(lockKey);
  }
};

export { getCompetitionStandings, rebuildCompetitionStandings };

export default {
  validateObjectId,
  createRound,
  getRounds,
  getRoundById,
  updateRound,
  createMatch,
  getMatches,
  getMatchById,
  getMatchBoards,
  updateMatch,
  cancelMatch,
  updateLineup,
  setPlayerReady,
  lockLineup,
  unlockLineup,
  startMatch,
  retryFailedBoards,
  syncMatchResults,
  notifyMatchCompletion,
  resolveMatchResult,
  getMatchResult,
  getRoundResults,
  getCompetitionStandings,
  rebuildCompetitionStandings,
  getRoundRobinPreview,
  generateRoundRobinSchedule,
};



