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

export default {
  getAdminOverview,
};
