/**
 * Google OAuth 2.0 OpenID Connect Configuration
 *
 * Implements server-side authorization code flow according to Google Identity specifications:
 * - Authorization Endpoint: https://accounts.google.com/o/oauth2/v2/auth
 * - Token Endpoint: https://oauth2.googleapis.com/token
 * - UserInfo Endpoint: https://openidconnect.googleapis.com/v1/userinfo
 * - Identity Scopes: openid, email, profile
 */

export const GOOGLE_OAUTH_CONFIG = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
  responseType: 'code',
  defaultScopes: ['openid', 'email', 'profile'],
  accessType: 'online',
  prompt: 'select_account',
};

export const getGoogleClientId = () => {
  return (process.env.GOOGLE_CLIENT_ID || '').trim();
};

export const getGoogleClientSecret = () => {
  return (process.env.GOOGLE_CLIENT_SECRET || '').trim();
};

export const getGoogleRedirectUri = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const defaultUri = isProduction
    ? 'https://chess-jeeno.onrender.com/api/auth/google/callback'
    : 'http://localhost:5000/api/auth/google/callback';
  const uri = process.env.GOOGLE_OAUTH_REDIRECT_URI || defaultUri;
  return uri.trim();
};

export const getFrontendClientUrl = () => {
  const url = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',')[0].trim()
    : 'http://localhost:5173';
  return url.replace(/\/+$/, '');
};

export default {
  ...GOOGLE_OAUTH_CONFIG,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRedirectUri,
  getFrontendClientUrl,
};
