import api from './api';

/**
 * Fetch current authenticated user's profile from /api/users/me.
 *
 * @returns {Promise<Object>}
 */
export const getProfile = async () => {
  const response = await api.get('/users/me');
  return response.data?.data?.user;
};

/**
 * Update current authenticated user's profile via PATCH /api/users/me.
 *
 * @param {Object} data
 * @param {string} [data.name]
 * @param {string} [data.bio]
 * @param {string|null} [data.avatar]
 * @returns {Promise<Object>}
 */
export const updateProfile = async (data) => {
  const response = await api.patch('/users/me', data);
  return response.data?.data?.user;
};

/**
 * Fetch current authenticated user's dashboard data from /api/users/dashboard.
 *
 * @returns {Promise<Object>}
 */
export const getDashboard = async () => {
  const response = await api.get('/users/dashboard');
  return response.data?.data;
};

export default {
  getProfile,
  updateProfile,
  getDashboard,
};

