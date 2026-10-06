import api from './api';

/**
 * Get paginated team competitions list.
 */
export const getCompetitions = async (params = {}) => {
  const response = await api.get('/team-competitions', { params });
  return response.data;
};

/**
 * Get single team competition by ID.
 */
export const getCompetitionById = async (id) => {
  const response = await api.get(`/team-competitions/${id}`);
  return response.data.data;
};

/**
 * Create a new team competition (Organizer).
 */
export const createCompetition = async (data) => {
  const response = await api.post('/team-competitions', data);
  return response.data.data;
};

/**
 * Update team competition details (Organizer).
 */
export const updateCompetition = async (id, data) => {
  const response = await api.patch(`/team-competitions/${id}`, data);
  return response.data.data;
};

/**
 * Transition DRAFT -> REGISTRATION.
 */
export const openRegistration = async (id) => {
  const response = await api.post(`/team-competitions/${id}/registration`);
  return response.data.data;
};

/**
 * Transition REGISTRATION -> READY.
 */
export const setCompetitionReady = async (id) => {
  const response = await api.post(`/team-competitions/${id}/ready`);
  return response.data.data;
};

/**
 * Cancel team competition.
 */
export const cancelCompetition = async (id) => {
  const response = await api.post(`/team-competitions/${id}/cancel`);
  return response.data.data;
};

/**
 * Get all teams in a competition.
 */
export const getTeams = async (competitionId) => {
  const response = await api.get(`/team-competitions/${competitionId}/teams`);
  return response.data.data;
};

/**
 * Get single team by ID.
 */
export const getTeamById = async (competitionId, teamId) => {
  const response = await api.get(`/team-competitions/${competitionId}/teams/${teamId}`);
  return response.data.data;
};

/**
 * Create/register a new team in a competition.
 */
export const createTeam = async (competitionId, data) => {
  const response = await api.post(`/team-competitions/${competitionId}/teams`, data);
  return response.data.data;
};

/**
 * Update team name.
 */
export const updateTeam = async (competitionId, teamId, data) => {
  const response = await api.patch(
    `/team-competitions/${competitionId}/teams/${teamId}`,
    data
  );
  return response.data.data;
};

/**
 * Remove team (Organizer).
 */
export const removeTeam = async (competitionId, teamId) => {
  const response = await api.delete(`/team-competitions/${competitionId}/teams/${teamId}`);
  return response.data.data;
};

/**
 * Get all members of a team.
 */
export const getTeamMembers = async (teamId) => {
  const response = await api.get(`/teams/${teamId}/members`);
  return response.data.data;
};

/**
 * Invite player to team roster.
 */
export const invitePlayer = async (teamId, { userId }) => {
  const response = await api.post(`/teams/${teamId}/invitations`, { userId });
  return response.data.data;
};

/**
 * Remove player from team roster.
 */
export const removeMember = async (teamId, userId) => {
  const response = await api.delete(`/teams/${teamId}/members/${userId}`);
  return response.data.data;
};

/**
 * Accept a team invitation.
 */
export const acceptInvitation = async (invitationId) => {
  const response = await api.post(`/team-invitations/${invitationId}/accept`);
  return response.data.data;
};

/**
 * Decline a team invitation.
 */
export const declineInvitation = async (invitationId) => {
  const response = await api.post(`/team-invitations/${invitationId}/decline`);
  return response.data.data;
};

/**
 * Transfer captaincy.
 */
export const transferCaptain = async (teamId, { newCaptainId }) => {
  const response = await api.post(`/teams/${teamId}/transfer-captain`, { newCaptainId });
  return response.data.data;
};

/**
 * Get pending team invitations for current user.
 */
export const getMyPendingInvitations = async () => {
  const response = await api.get('/team-competitions/my/invitations');
  return response.data.data;
};

/**
 * Search users by name/email/lichess for invitations.
 */
export const searchUsers = async (query) => {
  const response = await api.get('/users/search', { params: { q: query, limit: 10 } });
  return response.data.data;
};

export default {
  getCompetitions,
  getCompetitionById,
  createCompetition,
  updateCompetition,
  openRegistration,
  setCompetitionReady,
  cancelCompetition,
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  removeTeam,
  getTeamMembers,
  invitePlayer,
  removeMember,
  acceptInvitation,
  declineInvitation,
  transferCaptain,
  getMyPendingInvitations,
  searchUsers,
};
