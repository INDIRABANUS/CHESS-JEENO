import api from './api';

/**
 * Fetches platform-wide administrative overview statistics,
 * recent user registrations, recent tournaments, and operational health.
 * 
 * Protected by requireAuth and requireAdmin on the backend.
 * 
 * @returns {Promise<Object>} The overview data object
 */
export const getAdminOverview = async () => {
  const response = await api.get('/admin/overview');
  return response.data?.overview;
};

/**
 * Fetches paginated, searchable, and filterable users for administrators.
 * 
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.search='']
 * @param {string} [params.role='']
 * @returns {Promise<Object>} { users, page, limit, total, totalPages }
 */
export const getAdminUsers = async ({ page = 1, limit = 20, search = '', role = '' } = {}) => {
  const params = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (search && search.trim()) params.search = search.trim();
  if (role && role.trim()) params.role = role.trim();

  const response = await api.get('/admin/users', { params });
  return response.data?.data || response.data;
};

/**
 * Fetches safe admin details for a single user by ID.
 * 
 * @param {string} userId
 * @returns {Promise<Object>} Safe user details object
 */
export const getAdminUserDetails = async (userId) => {
  const response = await api.get(`/admin/users/${userId}`);
  return response.data?.user || response.data?.data || response.data;
};

/**
 * Updates a user's role (USER <-> ADMIN).
 * 
 * @param {string} userId
 * @param {string} role - 'USER' or 'ADMIN'
 * @returns {Promise<Object>} Updated user object
 */
export const updateAdminUserRole = async (userId, role) => {
  const response = await api.patch(`/admin/users/${userId}/role`, { role });
  return response.data?.user || response.data?.data || response.data;
};

export default {
  getAdminOverview,
  getAdminUsers,
  getAdminUserDetails,
  updateAdminUserRole,
};

