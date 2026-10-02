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

export default {
  getProfile,
  updateProfile,
};
