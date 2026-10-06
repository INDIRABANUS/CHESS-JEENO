import mongoose from 'mongoose';
import TeamCompetition, { COMPETITION_STATUSES } from '../models/TeamCompetition.js';
import TeamCompetitionTeam, { TEAM_STATUSES } from '../models/TeamCompetitionTeam.js';
import TeamCompetitionMember, { MEMBER_ROLES, MEMBER_STATUSES } from '../models/TeamCompetitionMember.js';
import User from '../models/User.js';
import * as notificationService from './notificationService.js';

const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Validates that an ID is a valid MongoDB ObjectId.
 * Throws 400 Bad Request error if invalid.
 */
export const validateObjectId = (id, fieldName = 'ID') => {
  if (!id || !mongoose.isValidObjectId(id)) {
    const error = new Error(`Invalid ${fieldName}`);
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Create a new Team Competition.
 */
export const createCompetition = async (
  { name, description = '', maxTeams = null, maxPlayersPerTeam = null, status = 'REGISTRATION' },
  organizerId
) => {
  validateObjectId(organizerId, 'organizer ID');

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    const error = new Error('Competition name is required');
    error.statusCode = 400;
    throw error;
  }

  if (trimmedName.length > 100) {
    const error = new Error('Competition name cannot exceed 100 characters');
    error.statusCode = 400;
    throw error;
  }

  const trimmedDesc = typeof description === 'string' ? description.trim() : '';
  if (trimmedDesc.length > 1000) {
    const error = new Error('Description cannot exceed 1000 characters');
    error.statusCode = 400;
    throw error;
  }

  let parsedMaxTeams = null;
  if (maxTeams !== null && maxTeams !== undefined && maxTeams !== '') {
    parsedMaxTeams = parseInt(maxTeams, 10);
    if (isNaN(parsedMaxTeams) || parsedMaxTeams < 2 || parsedMaxTeams > 64) {
      const error = new Error('maxTeams must be a number between 2 and 64');
      error.statusCode = 400;
      throw error;
    }
  }

  let parsedMaxPlayers = null;
  if (maxPlayersPerTeam !== null && maxPlayersPerTeam !== undefined && maxPlayersPerTeam !== '') {
    parsedMaxPlayers = parseInt(maxPlayersPerTeam, 10);
    if (isNaN(parsedMaxPlayers) || parsedMaxPlayers < 1 || parsedMaxPlayers > 50) {
      const error = new Error('maxPlayersPerTeam must be a number between 1 and 50');
      error.statusCode = 400;
      throw error;
    }
  }

  const initialStatus = status === 'DRAFT' ? 'DRAFT' : 'REGISTRATION';

  const competition = await TeamCompetition.create({
    name: trimmedName,
    description: trimmedDesc,
    organizer: organizerId,
    status: initialStatus,
    maxTeams: parsedMaxTeams,
    maxPlayersPerTeam: parsedMaxPlayers,
  });

  return competition.populate('organizer', '_id name email avatar lichessUsername');
};

/**
 * Get paginated list of competitions with filters.
 */
export const getCompetitions = async ({
  status,
  view = 'all',
  search = '',
  currentUserId = null,
  page = 1,
  limit = 10,
}) => {
  const query = {};

  if (status && COMPETITION_STATUSES.includes(status)) {
    query.status = status;
  }

  const trimmedSearch = typeof search === 'string' ? search.trim() : '';
  if (trimmedSearch) {
    const escaped = escapeRegex(trimmedSearch);
    query.name = { $regex: new RegExp(escaped, 'i') };
  }

  if (view === 'my') {
    if (!currentUserId) {
      const error = new Error('Authentication required for My Competitions');
      error.statusCode = 401;
      throw error;
    }

    validateObjectId(currentUserId, 'user ID');

    // Find competition IDs where user is organizer
    const organizerCompIds = await TeamCompetition.find({ organizer: currentUserId }).distinct('_id');

    // Find competition IDs where user is a team member
    const memberCompIds = await TeamCompetitionMember.find({
      user: currentUserId,
      status: { $in: ['ACTIVE', 'INVITED'] },
    }).distinct('competition');

    const combinedIds = [...new Set([...organizerCompIds.map(String), ...memberCompIds.map(String)])];
    query._id = { $in: combinedIds };
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);
  const skip = (pageNum - 1) * limitNum;

  const [competitions, totalCount] = await Promise.all([
    TeamCompetition.find(query)
      .populate('organizer', '_id name email avatar lichessUsername')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    TeamCompetition.countDocuments(query),
  ]);

  // Aggregate active teams count for each competition in the page
  const compIds = competitions.map((c) => c._id);
  const teamCounts = await TeamCompetitionTeam.aggregate([
    { $match: { competition: { $in: compIds }, status: 'ACTIVE' } },
    { $group: { _id: '$competition', count: { $sum: 1 } } },
  ]);

  const teamCountMap = {};
  teamCounts.forEach((tc) => {
    teamCountMap[tc._id.toString()] = tc.count;
  });

  const enrichedCompetitions = competitions.map((comp) => ({
    ...comp,
    activeTeamsCount: teamCountMap[comp._id.toString()] || 0,
  }));

  return {
    competitions: enrichedCompetitions,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      hasNext: skip + competitions.length < totalCount,
      hasPrev: pageNum > 1,
    },
  };
};

/**
 * Get single competition details by ID, including user context.
 */
export const getCompetitionById = async (competitionId, currentUserId = null) => {
  validateObjectId(competitionId, 'competition ID');

  const competition = await TeamCompetition.findById(competitionId)
    .populate('organizer', '_id name email avatar lichessUsername')
    .lean();

  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  const activeTeamsCount = await TeamCompetitionTeam.countDocuments({
    competition: competitionId,
    status: 'ACTIVE',
  });

  let userContext = {
    isOrganizer: false,
    userTeams: [],
    pendingInvitations: [],
  };

  if (currentUserId && mongoose.isValidObjectId(currentUserId)) {
    const currentUserIdStr = currentUserId.toString();
    const isOrganizer = competition.organizer?._id?.toString() === currentUserIdStr;

    // Find user memberships in this competition
    const memberships = await TeamCompetitionMember.find({
      competition: competitionId,
      user: currentUserId,
    })
      .populate('team', '_id name captain status')
      .populate('invitedBy', '_id name avatar')
      .lean();

    const userTeams = memberships
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({
        teamId: m.team?._id,
        teamName: m.team?.name,
        role: m.role,
        isCaptain: m.role === 'CAPTAIN',
        joinedAt: m.joinedAt,
      }));

    const pendingInvitations = memberships
      .filter((m) => m.status === 'INVITED')
      .map((m) => ({
        invitationId: m._id,
        teamId: m.team?._id,
        teamName: m.team?.name,
        invitedBy: m.invitedBy,
        createdAt: m.createdAt,
      }));

    userContext = {
      isOrganizer,
      userTeams,
      pendingInvitations,
    };
  }

  return {
    ...competition,
    activeTeamsCount,
    userContext,
  };
};

/**
 * Update competition settings (Organizer only).
 */
export const updateCompetition = async (competitionId, updateData, currentUserId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(currentUserId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (competition.organizer.toString() !== currentUserId.toString()) {
    const error = new Error('Forbidden: Only the competition organizer can update this competition');
    error.statusCode = 403;
    throw error;
  }

  if (competition.status === 'CANCELLED') {
    const error = new Error('Cannot modify a cancelled competition');
    error.statusCode = 400;
    throw error;
  }

  if (competition.status === 'COMPLETED') {
    const error = new Error('Cannot modify a completed competition');
    error.statusCode = 400;
    throw error;
  }

  if (updateData.name !== undefined) {
    const trimmed = typeof updateData.name === 'string' ? updateData.name.trim() : '';
    if (!trimmed) {
      const error = new Error('Competition name cannot be empty');
      error.statusCode = 400;
      throw error;
    }
    if (trimmed.length > 100) {
      const error = new Error('Competition name cannot exceed 100 characters');
      error.statusCode = 400;
      throw error;
    }
    competition.name = trimmed;
  }

  if (updateData.description !== undefined) {
    const trimmedDesc = typeof updateData.description === 'string' ? updateData.description.trim() : '';
    if (trimmedDesc.length > 1000) {
      const error = new Error('Description cannot exceed 1000 characters');
      error.statusCode = 400;
      throw error;
    }
    competition.description = trimmedDesc;
  }

  if (updateData.maxTeams !== undefined) {
    if (updateData.maxTeams === null || updateData.maxTeams === '') {
      competition.maxTeams = null;
    } else {
      const parsedMax = parseInt(updateData.maxTeams, 10);
      if (isNaN(parsedMax) || parsedMax < 2 || parsedMax > 64) {
        const error = new Error('maxTeams must be a number between 2 and 64');
        error.statusCode = 400;
        throw error;
      }

      // Check current active teams count
      const activeTeamsCount = await TeamCompetitionTeam.countDocuments({
        competition: competitionId,
        status: 'ACTIVE',
      });
      if (parsedMax < activeTeamsCount) {
        const error = new Error(
          `Cannot reduce maxTeams to ${parsedMax} below current active teams count (${activeTeamsCount})`
        );
        error.statusCode = 400;
        throw error;
      }
      competition.maxTeams = parsedMax;
    }
  }

  if (updateData.maxPlayersPerTeam !== undefined) {
    if (updateData.maxPlayersPerTeam === null || updateData.maxPlayersPerTeam === '') {
      competition.maxPlayersPerTeam = null;
    } else {
      const parsedMaxPlayers = parseInt(updateData.maxPlayersPerTeam, 10);
      if (isNaN(parsedMaxPlayers) || parsedMaxPlayers < 1 || parsedMaxPlayers > 50) {
        const error = new Error('maxPlayersPerTeam must be a number between 1 and 50');
        error.statusCode = 400;
        throw error;
      }
      competition.maxPlayersPerTeam = parsedMaxPlayers;
    }
  }

  await competition.save();
  return competition.populate('organizer', '_id name email avatar lichessUsername');
};

/**
 * Transition DRAFT -> REGISTRATION (Organizer only).
 */
export const openRegistration = async (competitionId, currentUserId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(currentUserId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (competition.organizer.toString() !== currentUserId.toString()) {
    const error = new Error('Forbidden: Only the organizer can open registration');
    error.statusCode = 403;
    throw error;
  }

  if (competition.status === 'REGISTRATION') {
    return competition;
  }

  if (competition.status !== 'DRAFT') {
    const error = new Error(`Cannot open registration from status '${competition.status}'`);
    error.statusCode = 400;
    throw error;
  }

  competition.status = 'REGISTRATION';
  await competition.save();
  return competition.populate('organizer', '_id name email avatar lichessUsername');
};

/**
 * Transition REGISTRATION -> READY (Organizer only).
 * Validates readiness conditions:
 * - At least 2 ACTIVE teams
 * - Every ACTIVE team has exactly one captain who is an ACTIVE member
 * - No active team in an invalid state
 */
export const setCompetitionReady = async (competitionId, currentUserId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(currentUserId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (competition.organizer.toString() !== currentUserId.toString()) {
    const error = new Error('Forbidden: Only the organizer can set the competition to READY');
    error.statusCode = 403;
    throw error;
  }

  if (competition.status !== 'REGISTRATION') {
    const error = new Error(`Cannot transition to READY from status '${competition.status}'`);
    error.statusCode = 400;
    throw error;
  }

  // 1. Fetch all ACTIVE teams
  const activeTeams = await TeamCompetitionTeam.find({
    competition: competitionId,
    status: 'ACTIVE',
  });

  if (activeTeams.length < 2) {
    const error = new Error(
      `Competition requires at least 2 active teams to be READY. Current active teams: ${activeTeams.length}`
    );
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate every active team has exactly one captain with ACTIVE membership
  for (const team of activeTeams) {
    if (!team.captain) {
      const error = new Error(`Team '${team.name}' has no assigned captain`);
      error.statusCode = 400;
      throw error;
    }

    const captainMember = await TeamCompetitionMember.findOne({
      team: team._id,
      user: team.captain,
      role: 'CAPTAIN',
      status: 'ACTIVE',
    });

    if (!captainMember) {
      const error = new Error(`Team '${team.name}' does not have an active captain membership`);
      error.statusCode = 400;
      throw error;
    }
  }

  competition.status = 'READY';
  await competition.save();
  return competition.populate('organizer', '_id name email avatar lichessUsername');
};

/**
 * Cancel competition (Organizer only).
 * Allowed from DRAFT, REGISTRATION, READY.
 */
export const cancelCompetition = async (competitionId, currentUserId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(currentUserId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (competition.organizer.toString() !== currentUserId.toString()) {
    const error = new Error('Forbidden: Only the organizer can cancel this competition');
    error.statusCode = 403;
    throw error;
  }

  const allowedStatuses = ['DRAFT', 'REGISTRATION', 'READY'];
  if (!allowedStatuses.includes(competition.status)) {
    const error = new Error(`Cannot cancel competition in '${competition.status}' status`);
    error.statusCode = 400;
    throw error;
  }

  competition.status = 'CANCELLED';
  await competition.save();
  return competition.populate('organizer', '_id name email avatar lichessUsername');
};

/**
 * Create a team in a competition.
 * - In REGISTRATION status, any authenticated user can register a team (they become captain).
 * - Organizer can create a team in DRAFT or REGISTRATION and assign a captain.
 */
export const createTeam = async (competitionId, { name, captainId = null }, currentUserId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(currentUserId, 'user ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  const isOrganizer = competition.organizer.toString() === currentUserId.toString();

  // Status check
  if (!isOrganizer && competition.status !== 'REGISTRATION') {
    const error = new Error('Team registration is currently closed for this competition');
    error.statusCode = 400;
    throw error;
  }

  if (isOrganizer && !['DRAFT', 'REGISTRATION'].includes(competition.status)) {
    const error = new Error(`Cannot add teams when competition is in '${competition.status}' status`);
    error.statusCode = 400;
    throw error;
  }

  // Capacity check
  if (competition.maxTeams) {
    const activeTeamsCount = await TeamCompetitionTeam.countDocuments({
      competition: competitionId,
      status: 'ACTIVE',
    });
    if (activeTeamsCount >= competition.maxTeams) {
      const error = new Error(`Competition has reached the maximum capacity of ${competition.maxTeams} teams`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Name validation
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    const error = new Error('Team name is required');
    error.statusCode = 400;
    throw error;
  }

  if (trimmedName.length > 60) {
    const error = new Error('Team name cannot exceed 60 characters');
    error.statusCode = 400;
    throw error;
  }

  // Team name uniqueness within competition (case-insensitive)
  const existingTeam = await TeamCompetitionTeam.findOne({
    competition: competitionId,
    name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i') },
  });

  if (existingTeam) {
    const error = new Error(`Team name '${trimmedName}' is already taken in this competition`);
    error.statusCode = 400;
    throw error;
  }

  // Determine captain
  let assignedCaptainId = currentUserId;
  if (isOrganizer && captainId) {
    validateObjectId(captainId, 'captain ID');
    const captainUser = await User.findById(captainId);
    if (!captainUser) {
      const error = new Error('Assigned captain user does not exist');
      error.statusCode = 404;
      throw error;
    }
    assignedCaptainId = captainId;
  }

  // Check captain is not already ACTIVE in any team in this competition
  const existingActive = await TeamCompetitionMember.findOne({
    competition: competitionId,
    user: assignedCaptainId,
    status: 'ACTIVE',
  });

  if (existingActive) {
    const error = new Error('User is already an active member of another team in this competition');
    error.statusCode = 400;
    throw error;
  }

  // Create team
  const team = await TeamCompetitionTeam.create({
    competition: competitionId,
    name: trimmedName,
    captain: assignedCaptainId,
    status: 'ACTIVE',
  });

  // Automatically assign captain membership (CAPTAIN + ACTIVE)
  await TeamCompetitionMember.create({
    competition: competitionId,
    team: team._id,
    user: assignedCaptainId,
    role: 'CAPTAIN',
    status: 'ACTIVE',
    joinedAt: new Date(),
  });

  return team.populate('captain', '_id name email avatar lichessUsername');
};

/**
 * Get all teams in a competition.
 */
export const getTeams = async (competitionId, currentUserId = null) => {
  validateObjectId(competitionId, 'competition ID');

  const competition = await TeamCompetition.findById(competitionId);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  const isOrganizer = currentUserId && competition.organizer.toString() === currentUserId.toString();

  // If organizer, show all teams including REMOVED; otherwise show ACTIVE and PENDING
  const teamQuery = { competition: competitionId };
  if (!isOrganizer) {
    teamQuery.status = { $in: ['ACTIVE', 'PENDING'] };
  }

  const teams = await TeamCompetitionTeam.find(teamQuery)
    .populate('captain', '_id name email avatar lichessUsername')
    .sort({ createdAt: 1 })
    .lean();

  const teamIds = teams.map((t) => t._id);

  // Active member counts
  const memberCounts = await TeamCompetitionMember.aggregate([
    { $match: { team: { $in: teamIds }, status: 'ACTIVE' } },
    { $group: { _id: '$team', count: { $sum: 1 } } },
  ]);

  const countMap = {};
  memberCounts.forEach((mc) => {
    countMap[mc._id.toString()] = mc.count;
  });

  // Current user memberships across these teams
  let userMembershipMap = {};
  if (currentUserId && mongoose.isValidObjectId(currentUserId)) {
    const memberships = await TeamCompetitionMember.find({
      team: { $in: teamIds },
      user: currentUserId,
    }).lean();

    memberships.forEach((m) => {
      userMembershipMap[m.team.toString()] = {
        role: m.role,
        status: m.status,
        invitationId: m._id,
      };
    });
  }

  return teams.map((team) => ({
    ...team,
    activeMembersCount: countMap[team._id.toString()] || 0,
    currentUserMembership: userMembershipMap[team._id.toString()] || null,
  }));
};

/**
 * Get single team details by ID.
 */
export const getTeamById = async (competitionId, teamId, currentUserId = null) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(teamId, 'team ID');

  const team = await TeamCompetitionTeam.findOne({
    _id: teamId,
    competition: competitionId,
  })
    .populate('captain', '_id name email avatar lichessUsername')
    .lean();

  if (!team) {
    const error = new Error('Team not found in this competition');
    error.statusCode = 404;
    throw error;
  }

  const activeMembersCount = await TeamCompetitionMember.countDocuments({
    team: teamId,
    status: 'ACTIVE',
  });

  let currentUserMembership = null;
  if (currentUserId && mongoose.isValidObjectId(currentUserId)) {
    const m = await TeamCompetitionMember.findOne({
      team: teamId,
      user: currentUserId,
    }).lean();

    if (m) {
      currentUserMembership = {
        role: m.role,
        status: m.status,
        invitationId: m._id,
      };
    }
  }

  return {
    ...team,
    activeMembersCount,
    currentUserMembership,
  };
};

/**
 * Update team name (Captain or Organizer).
 */
export const updateTeam = async (competitionId, teamId, { name }, currentUserId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(teamId, 'team ID');
  validateObjectId(currentUserId, 'user ID');

  const [competition, team] = await Promise.all([
    TeamCompetition.findById(competitionId),
    TeamCompetitionTeam.findOne({ _id: teamId, competition: competitionId }),
  ]);

  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (!team) {
    const error = new Error('Team not found');
    error.statusCode = 404;
    throw error;
  }

  const isOrganizer = competition.organizer.toString() === currentUserId.toString();
  const isCaptain = team.captain.toString() === currentUserId.toString();

  if (!isOrganizer && !isCaptain) {
    const error = new Error('Forbidden: Only the team captain or organizer can update the team');
    error.statusCode = 403;
    throw error;
  }

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    const error = new Error('Team name cannot be empty');
    error.statusCode = 400;
    throw error;
  }

  if (trimmedName.length > 60) {
    const error = new Error('Team name cannot exceed 60 characters');
    error.statusCode = 400;
    throw error;
  }

  // Check unique name if changed
  if (trimmedName.toLowerCase() !== team.name.toLowerCase()) {
    const existing = await TeamCompetitionTeam.findOne({
      competition: competitionId,
      _id: { $ne: teamId },
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i') },
    });
    if (existing) {
      const error = new Error(`Team name '${trimmedName}' is already taken in this competition`);
      error.statusCode = 400;
      throw error;
    }
  }

  team.name = trimmedName;
  await team.save();
  return team.populate('captain', '_id name email avatar lichessUsername');
};

/**
 * Remove team (Organizer only).
 * Sets team status to REMOVED and updates team members' active statuses to REMOVED.
 */
export const removeTeam = async (competitionId, teamId, currentUserId) => {
  validateObjectId(competitionId, 'competition ID');
  validateObjectId(teamId, 'team ID');
  validateObjectId(currentUserId, 'user ID');

  const [competition, team] = await Promise.all([
    TeamCompetition.findById(competitionId),
    TeamCompetitionTeam.findOne({ _id: teamId, competition: competitionId }),
  ]);

  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  if (!team) {
    const error = new Error('Team not found');
    error.statusCode = 404;
    throw error;
  }

  const isOrganizer = competition.organizer.toString() === currentUserId.toString();
  if (!isOrganizer) {
    const error = new Error('Forbidden: Only the competition organizer can remove a team');
    error.statusCode = 403;
    throw error;
  }

  team.status = 'REMOVED';
  await team.save();

  // Mark all members of this team as REMOVED so their active slots are released
  await TeamCompetitionMember.updateMany(
    { team: teamId, status: { $in: ['ACTIVE', 'INVITED'] } },
    { $set: { status: 'REMOVED' } }
  );

  return team;
};

/**
 * Invite player to team roster (Captain or Organizer).
 */
export const invitePlayer = async (teamId, { userId }, currentUserId) => {
  validateObjectId(teamId, 'team ID');
  validateObjectId(userId, 'target user ID');
  validateObjectId(currentUserId, 'inviter user ID');

  const team = await TeamCompetitionTeam.findById(teamId);
  if (!team) {
    const error = new Error('Team not found');
    error.statusCode = 404;
    throw error;
  }

  if (team.status !== 'ACTIVE') {
    const error = new Error('Cannot invite players to an inactive or removed team');
    error.statusCode = 400;
    throw error;
  }

  const competition = await TeamCompetition.findById(team.competition);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  const isOrganizer = competition.organizer.toString() === currentUserId.toString();
  const isCaptain = team.captain.toString() === currentUserId.toString();

  if (!isOrganizer && !isCaptain) {
    const error = new Error('Forbidden: Only the team captain or competition organizer can invite players');
    error.statusCode = 403;
    throw error;
  }

  if (competition.status === 'CANCELLED') {
    const error = new Error('Cannot invite players to a cancelled competition');
    error.statusCode = 400;
    throw error;
  }

  // Validate target user exists
  const targetUser = await User.findById(userId).select('_id name email avatar lichessUsername');
  if (!targetUser) {
    const error = new Error('Target player user does not exist');
    error.statusCode = 404;
    throw error;
  }

  // Check team player capacity if configured
  if (competition.maxPlayersPerTeam) {
    const activeCount = await TeamCompetitionMember.countDocuments({
      team: teamId,
      status: 'ACTIVE',
    });
    if (activeCount >= competition.maxPlayersPerTeam) {
      const error = new Error(
        `Team has reached maximum capacity of ${competition.maxPlayersPerTeam} players`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // Check if target user is ALREADY ACTIVE in any team in this competition
  const activeInCompetition = await TeamCompetitionMember.findOne({
    competition: competition._id,
    user: userId,
    status: 'ACTIVE',
  });

  if (activeInCompetition) {
    const error = new Error('User is already an active member of a team in this competition');
    error.statusCode = 400;
    throw error;
  }

  // Check existing membership in this specific team
  let member = await TeamCompetitionMember.findOne({
    team: teamId,
    user: userId,
  });

  if (member) {
    if (member.status === 'ACTIVE') {
      const error = new Error('User is already an active member of this team');
      error.statusCode = 400;
      throw error;
    }
    if (member.status === 'INVITED') {
      const error = new Error('User already has a pending invitation to this team');
      error.statusCode = 400;
      throw error;
    }

    // Reset DECLINED or REMOVED invitation
    member.status = 'INVITED';
    member.role = 'PLAYER';
    member.invitedBy = currentUserId;
    member.joinedAt = null;
    await member.save();
  } else {
    // Create new invitation
    member = await TeamCompetitionMember.create({
      competition: competition._id,
      team: teamId,
      user: userId,
      role: 'PLAYER',
      status: 'INVITED',
      invitedBy: currentUserId,
    });
  }

  // Send in-app notification to invited player
  try {
    const eventKey = `team_invite_${team._id.toString()}_${userId.toString()}`;
    await notificationService.createNotification({
      recipient: userId,
      type: 'TEAM_INVITATION',
      title: 'Team Invitation',
      message: `You have been invited to join ${team.name} in ${competition.name}.`,
      metadata: {
        competitionId: competition._id.toString(),
        teamId: team._id.toString(),
        invitationId: member._id.toString(),
        teamName: team.name,
        competitionName: competition.name,
      },
      eventKey,
    });
  } catch (notifErr) {
    // Notification error non-fatal
  }

  return member.populate('user', '_id name email avatar lichessUsername');
};

/**
 * Get all members of a team.
 * Captain and Organizer can see all statuses (INVITED, ACTIVE, DECLINED, REMOVED).
 * Other users see ACTIVE members.
 */
export const getTeamMembers = async (teamId, currentUserId = null) => {
  validateObjectId(teamId, 'team ID');

  const team = await TeamCompetitionTeam.findById(teamId);
  if (!team) {
    const error = new Error('Team not found');
    error.statusCode = 404;
    throw error;
  }

  const competition = await TeamCompetition.findById(team.competition);
  const isOrganizer = currentUserId && competition && competition.organizer.toString() === currentUserId.toString();
  const isCaptain = currentUserId && team.captain.toString() === currentUserId.toString();

  const query = { team: teamId };
  if (!isOrganizer && !isCaptain) {
    query.status = 'ACTIVE';
  }

  const members = await TeamCompetitionMember.find(query)
    .populate('user', '_id name email avatar lichessUsername')
    .populate('invitedBy', '_id name avatar')
    .sort({ role: 1, joinedAt: 1, createdAt: 1 })
    .lean();

  return members;
};

/**
 * Remove a member from team roster (Captain or Organizer or Player themselves).
 * Cannot remove team captain via this method (transfer captaincy first).
 */
export const removeMember = async (teamId, targetUserId, currentUserId) => {
  validateObjectId(teamId, 'team ID');
  validateObjectId(targetUserId, 'target user ID');
  validateObjectId(currentUserId, 'current user ID');

  const team = await TeamCompetitionTeam.findById(teamId);
  if (!team) {
    const error = new Error('Team not found');
    error.statusCode = 404;
    throw error;
  }

  const competition = await TeamCompetition.findById(team.competition);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  const isOrganizer = competition.organizer.toString() === currentUserId.toString();
  const isCaptain = team.captain.toString() === currentUserId.toString();
  const isSelf = targetUserId.toString() === currentUserId.toString();

  if (!isOrganizer && !isCaptain && !isSelf) {
    const error = new Error('Forbidden: You do not have permission to remove this member');
    error.statusCode = 403;
    throw error;
  }

  // Protect captain
  if (team.captain.toString() === targetUserId.toString()) {
    const error = new Error('Cannot remove the team captain. Transfer captaincy first.');
    error.statusCode = 400;
    throw error;
  }

  const member = await TeamCompetitionMember.findOne({
    team: teamId,
    user: targetUserId,
  });

  if (!member) {
    const error = new Error('Team member not found');
    error.statusCode = 404;
    throw error;
  }

  member.status = 'REMOVED';
  await member.save();

  return member;
};

/**
 * Accept a team invitation (strictly the invited user).
 */
export const acceptInvitation = async (invitationId, currentUserId) => {
  validateObjectId(invitationId, 'invitation ID');
  validateObjectId(currentUserId, 'user ID');

  const member = await TeamCompetitionMember.findById(invitationId);
  if (!member) {
    const error = new Error('Invitation not found');
    error.statusCode = 404;
    throw error;
  }

  if (member.user.toString() !== currentUserId.toString()) {
    const error = new Error('Forbidden: You can only respond to your own invitation');
    error.statusCode = 403;
    throw error;
  }

  if (member.status !== 'INVITED') {
    const error = new Error(`Invitation is no longer pending (current status: '${member.status}')`);
    error.statusCode = 400;
    throw error;
  }

  const team = await TeamCompetitionTeam.findById(member.team);
  if (!team || team.status !== 'ACTIVE') {
    const error = new Error('Team does not exist or is no longer active');
    error.statusCode = 400;
    throw error;
  }

  const competition = await TeamCompetition.findById(member.competition);
  if (!competition || competition.status === 'CANCELLED') {
    const error = new Error('Competition is cancelled or no longer accepts members');
    error.statusCode = 400;
    throw error;
  }

  // Check if player is ALREADY ACTIVE in any team in this competition
  const activeInCompetition = await TeamCompetitionMember.findOne({
    competition: competition._id,
    user: currentUserId,
    status: 'ACTIVE',
  });

  if (activeInCompetition) {
    const error = new Error('You are already an active member of another team in this competition');
    error.statusCode = 400;
    throw error;
  }

  // Check capacity
  if (competition.maxPlayersPerTeam) {
    const activeCount = await TeamCompetitionMember.countDocuments({
      team: team._id,
      status: 'ACTIVE',
    });
    if (activeCount >= competition.maxPlayersPerTeam) {
      const error = new Error(
        `Team has reached maximum capacity of ${competition.maxPlayersPerTeam} players`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  member.status = 'ACTIVE';
  member.joinedAt = new Date();
  await member.save();

  // Notify Team Captain
  try {
    const currentUser = await User.findById(currentUserId).select('name');
    const eventKey = `team_accept_${team._id.toString()}_${currentUserId.toString()}`;
    await notificationService.createNotification({
      recipient: team.captain,
      type: 'TEAM_INVITATION_ACCEPTED',
      title: 'Invitation Accepted',
      message: `${currentUser?.name || 'A player'} accepted the invitation to join ${team.name}.`,
      metadata: {
        competitionId: competition._id.toString(),
        teamId: team._id.toString(),
        userId: currentUserId.toString(),
        teamName: team.name,
        competitionName: competition.name,
      },
      eventKey,
    });
  } catch (notifErr) {
    // Non-fatal
  }

  return member.populate('user', '_id name email avatar lichessUsername');
};

/**
 * Decline a team invitation (strictly the invited user).
 */
export const declineInvitation = async (invitationId, currentUserId) => {
  validateObjectId(invitationId, 'invitation ID');
  validateObjectId(currentUserId, 'user ID');

  const member = await TeamCompetitionMember.findById(invitationId);
  if (!member) {
    const error = new Error('Invitation not found');
    error.statusCode = 404;
    throw error;
  }

  if (member.user.toString() !== currentUserId.toString()) {
    const error = new Error('Forbidden: You can only respond to your own invitation');
    error.statusCode = 403;
    throw error;
  }

  if (member.status !== 'INVITED') {
    const error = new Error(`Invitation is no longer pending (current status: '${member.status}')`);
    error.statusCode = 400;
    throw error;
  }

  const team = await TeamCompetitionTeam.findById(member.team);

  member.status = 'DECLINED';
  await member.save();

  // Notify Captain
  if (team) {
    try {
      const currentUser = await User.findById(currentUserId).select('name');
      const eventKey = `team_decline_${team._id.toString()}_${currentUserId.toString()}`;
      await notificationService.createNotification({
        recipient: team.captain,
        type: 'TEAM_INVITATION_DECLINED',
        title: 'Invitation Declined',
        message: `${currentUser?.name || 'A player'} declined the invitation to join ${team.name}.`,
        metadata: {
          teamId: team._id.toString(),
          userId: currentUserId.toString(),
          teamName: team.name,
        },
        eventKey,
      });
    } catch (notifErr) {
      // Non-fatal
    }
  }

  return member;
};

/**
 * Transfer captaincy to an active teammate (Captain or Organizer).
 */
export const transferCaptain = async (teamId, { newCaptainId }, currentUserId) => {
  validateObjectId(teamId, 'team ID');
  validateObjectId(newCaptainId, 'new captain ID');
  validateObjectId(currentUserId, 'current user ID');

  const team = await TeamCompetitionTeam.findById(teamId);
  if (!team) {
    const error = new Error('Team not found');
    error.statusCode = 404;
    throw error;
  }

  const competition = await TeamCompetition.findById(team.competition);
  if (!competition) {
    const error = new Error('Competition not found');
    error.statusCode = 404;
    throw error;
  }

  const isOrganizer = competition.organizer.toString() === currentUserId.toString();
  const isCaptain = team.captain.toString() === currentUserId.toString();

  if (!isOrganizer && !isCaptain) {
    const error = new Error('Forbidden: Only the current captain or competition organizer can transfer captaincy');
    error.statusCode = 403;
    throw error;
  }

  if (team.captain.toString() === newCaptainId.toString()) {
    const error = new Error('Selected player is already the captain');
    error.statusCode = 400;
    throw error;
  }

  // Validate new captain is an ACTIVE member of this team
  const newCaptainMember = await TeamCompetitionMember.findOne({
    team: teamId,
    user: newCaptainId,
    status: 'ACTIVE',
  });

  if (!newCaptainMember) {
    const error = new Error('New captain must already be an active member of this team');
    error.statusCode = 400;
    throw error;
  }

  // Demote previous captain member to PLAYER
  const oldCaptainMember = await TeamCompetitionMember.findOne({
    team: teamId,
    user: team.captain,
  });

  if (oldCaptainMember) {
    oldCaptainMember.role = 'PLAYER';
    await oldCaptainMember.save();
  }

  // Promote new captain member
  newCaptainMember.role = 'CAPTAIN';
  await newCaptainMember.save();

  // Update team document
  team.captain = newCaptainId;
  await team.save();

  // Notify new captain
  try {
    const eventKey = `team_captain_${team._id.toString()}_${newCaptainId.toString()}_${Date.now()}`;
    await notificationService.createNotification({
      recipient: newCaptainId,
      type: 'TEAM_CAPTAIN_TRANSFERRED',
      title: 'Captaincy Assigned',
      message: `You are now the captain of ${team.name} in ${competition.name}.`,
      metadata: {
        competitionId: competition._id.toString(),
        teamId: team._id.toString(),
        teamName: team.name,
        competitionName: competition.name,
      },
      eventKey,
    });
  } catch (notifErr) {
    // Non-fatal
  }

  return team.populate('captain', '_id name email avatar lichessUsername');
};

/**
 * Retrieve pending invitations for authenticated user.
 */
export const getUserPendingInvitations = async (currentUserId) => {
  validateObjectId(currentUserId, 'user ID');

  const invitations = await TeamCompetitionMember.find({
    user: currentUserId,
    status: 'INVITED',
  })
    .populate({
      path: 'team',
      select: '_id name captain status',
      populate: { path: 'captain', select: '_id name email avatar lichessUsername' },
    })
    .populate('competition', '_id name status organizer')
    .populate('invitedBy', '_id name avatar')
    .sort({ createdAt: -1 })
    .lean();

  // Filter out invitations for deleted or cancelled competitions / removed teams
  const validInvitations = invitations.filter(
    (inv) =>
      inv.team &&
      inv.team.status === 'ACTIVE' &&
      inv.competition &&
      inv.competition.status !== 'CANCELLED'
  );

  return validInvitations;
};

export default {
  validateObjectId,
  createCompetition,
  getCompetitions,
  getCompetitionById,
  updateCompetition,
  openRegistration,
  setCompetitionReady,
  cancelCompetition,
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  removeTeam,
  invitePlayer,
  getTeamMembers,
  removeMember,
  acceptInvitation,
  declineInvitation,
  transferCaptain,
  getUserPendingInvitations,
};
