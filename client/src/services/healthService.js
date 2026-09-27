import api from './api';

/**
 * Health check API service
 * Fetches status from GET /api/health
 */
export const checkApiHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};
