import * as teamCompetitionService from '../services/teamCompetitionService.js';

/**
 * Create a new team competition.
 * @route POST /api/team-competitions
 */
export const createCompetition = async (req, res, next) => {
  try {
    const organizerId = req.user._id;
    const competition = await teamCompetitionService.createCompetition(req.body, organizerId);

    res.status(201).json({
      success: true,
      message: 'Team competition created successfully',
      data: competition,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated team competitions.
 * @route GET /api/team-competitions
 */
export const getCompetitions = async (req, res, next) => {
  try {
    const { status, view, search, page, limit } = req.query;
    const currentUserId = req.user ? req.user._id : null;

    const result = await teamCompetitionService.getCompetitions({
      status,
      view,
      search,
      currentUserId,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result.competitions,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single team competition by ID.
 * @route GET /api/team-competitions/:id
 */
export const getCompetitionById = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user._id : null;
    const competition = await teamCompetitionService.getCompetitionById(
      req.params.id,
      currentUserId
    );

    res.status(200).json({
      success: true,
      data: competition,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update team competition (Organizer only).
 * @route PATCH /api/team-competitions/:id
 */
export const updateCompetition = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const updated = await teamCompetitionService.updateCompetition(
      req.params.id,
      req.body,
      currentUserId
    );

    res.status(200).json({
      success: true,
      message: 'Competition updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Open registration (Organizer only).
 * @route POST /api/team-competitions/:id/registration
 */
export const openRegistration = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const updated = await teamCompetitionService.openRegistration(req.params.id, currentUserId);

    res.status(200).json({
      success: true,
      message: 'Registration opened successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark competition as READY (Organizer only).
 * @route POST /api/team-competitions/:id/ready
 */
export const setReady = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const updated = await teamCompetitionService.setCompetitionReady(req.params.id, currentUserId);

    res.status(200).json({
      success: true,
      message: 'Competition is now ready',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel competition (Organizer only).
 * @route POST /api/team-competitions/:id/cancel
 */
export const cancelCompetition = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const updated = await teamCompetitionService.cancelCompetition(req.params.id, currentUserId);

    res.status(200).json({
      success: true,
      message: 'Competition cancelled successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a team in a competition.
 * @route POST /api/team-competitions/:competitionId/teams
 */
export const createTeam = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const team = await teamCompetitionService.createTeam(
      req.params.competitionId,
      req.body,
      currentUserId
    );

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all teams in a competition.
 * @route GET /api/team-competitions/:competitionId/teams
 */
export const getTeams = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user._id : null;
    const teams = await teamCompetitionService.getTeams(req.params.competitionId, currentUserId);

    res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single team by ID.
 * @route GET /api/team-competitions/:competitionId/teams/:teamId
 */
export const getTeamById = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user._id : null;
    const team = await teamCompetitionService.getTeamById(
      req.params.competitionId,
      req.params.teamId,
      currentUserId
    );

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update team name (Captain or Organizer).
 * @route PATCH /api/team-competitions/:competitionId/teams/:teamId
 */
export const updateTeam = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const updated = await teamCompetitionService.updateTeam(
      req.params.competitionId,
      req.params.teamId,
      req.body,
      currentUserId
    );

    res.status(200).json({
      success: true,
      message: 'Team updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove team (Organizer only).
 * @route DELETE /api/team-competitions/:competitionId/teams/:teamId
 */
export const removeTeam = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const team = await teamCompetitionService.removeTeam(
      req.params.competitionId,
      req.params.teamId,
      currentUserId
    );

    res.status(200).json({
      success: true,
      message: 'Team removed successfully',
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Invite player to a team roster (Captain or Organizer).
 * @route POST /api/teams/:teamId/invitations
 */
export const invitePlayer = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const member = await teamCompetitionService.invitePlayer(
      req.params.teamId,
      req.body,
      currentUserId
    );

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all members of a team.
 * @route GET /api/teams/:teamId/members
 */
export const getTeamMembers = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user._id : null;
    const members = await teamCompetitionService.getTeamMembers(req.params.teamId, currentUserId);

    res.status(200).json({
      success: true,
      data: members,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove player from team roster (Captain, Organizer, or Player self).
 * @route DELETE /api/teams/:teamId/members/:userId
 */
export const removeMember = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const member = await teamCompetitionService.removeMember(
      req.params.teamId,
      req.params.userId,
      currentUserId
    );

    res.status(200).json({
      success: true,
      message: 'Member removed successfully',
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept a team invitation.
 * @route POST /api/team-invitations/:invitationId/accept
 */
export const acceptInvitation = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const member = await teamCompetitionService.acceptInvitation(
      req.params.invitationId,
      currentUserId
    );

    res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully',
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Decline a team invitation.
 * @route POST /api/team-invitations/:invitationId/decline
 */
export const declineInvitation = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const member = await teamCompetitionService.declineInvitation(
      req.params.invitationId,
      currentUserId
    );

    res.status(200).json({
      success: true,
      message: 'Invitation declined successfully',
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Transfer captaincy.
 * @route POST /api/teams/:teamId/transfer-captain
 */
export const transferCaptain = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const updatedTeam = await teamCompetitionService.transferCaptain(
      req.params.teamId,
      req.body,
      currentUserId
    );

    res.status(200).json({
      success: true,
      message: 'Captain transferred successfully',
      data: updatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending team invitations for current authenticated user.
 * @route GET /api/team-competitions/my/invitations
 */
export const getMyInvitations = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const invitations = await teamCompetitionService.getUserPendingInvitations(currentUserId);

    res.status(200).json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createCompetition,
  getCompetitions,
  getCompetitionById,
  updateCompetition,
  openRegistration,
  setReady,
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
  getMyInvitations,
};
