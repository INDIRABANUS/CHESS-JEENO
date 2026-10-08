import mongoose from 'mongoose';
import TeamCompetition from '../models/TeamCompetition.js';
import TeamCompetitionTeam from '../models/TeamCompetitionTeam.js';
import TeamCompetitionMember from '../models/TeamCompetitionMember.js';
import TeamCompetitionRound, { ROUND_STATUSES } from '../models/TeamCompetitionRound.js';
import TeamMatch, { MATCH_STATUSES } from '../models/TeamMatch.js';
import TeamMatchBoard from '../models/TeamMatchBoard.js';
import * as notificationService from './notificationService.js';

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
  }).lean();

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
    .lean();

  if (!match) {
    const error = new Error('Match not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  const boards = await TeamMatchBoard.find({ match: matchId })
    .populate('teamAPlayer', '_id name email avatar lichessUsername')
    .populate('teamBPlayer', '_id name email avatar lichessUsername')
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

  if (match.status === 'CANCELLED') {
    const error = new Error('Cannot modify lineup for a cancelled match');
    error.statusCode = 400;
    throw error;
  }

  if (match.status === 'COMPLETED') {
    const error = new Error('Cannot modify lineup for a completed match');
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

  if (match.status === 'CANCELLED' || match.status === 'COMPLETED') {
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

  if (match.status === 'CANCELLED' || match.status === 'COMPLETED') {
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

  if (match.status === 'CANCELLED' || match.status === 'COMPLETED' || match.status === 'IN_PROGRESS') {
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
};
