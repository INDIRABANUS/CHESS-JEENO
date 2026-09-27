import api from './api';

/**
 * Register a new user account.
 * Stores JWT in localStorage upon success.
 */
export const register = async ({ name, email, password, lichessUsername }) => {
  const response = await api.post('/auth/register', {
    name,
    email,
    password,
    lichessUsername,
  });
  if (response.data?.data?.token) {
    localStorage.setItem('token', response.data.data.token);
  }
  return response.data?.data;
};

/**
 * Log in with email and password.
 * Stores JWT in localStorage upon success.
 */
export const login = async ({ email, password }) => {
  const response = await api.post('/auth/login', {
    email,
    password,
  });
  if (response.data?.data?.token) {
    localStorage.setItem('token', response.data.data.token);
  }
  return response.data?.data;
};

/**
 * Fetch current authenticated user profile using stored JWT.
 */
export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data?.data?.user;
};

/**
 * Log out and clear stored JWT token.
 */
export const logout = () => {
  localStorage.removeItem('token');
};

/**
 * Get current stored JWT token.
 */
export const getToken = () => {
  return localStorage.getItem('token');
};

export default {
  register,
  login,
  getCurrentUser,
  logout,
  getToken,
};
