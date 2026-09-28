/**
 * Lichess OAuth 2.0 PKCE Configuration
 * 
 * Verified against official Lichess API specifications:
 * - Authorization Endpoint: https://lichess.org/oauth
 * - Token Endpoint: https://lichess.org/api/token
 * - Account Endpoint: https://lichess.org/api/account
 * - PKCE Method: S256
 */

export const LICHESS_OAUTH_CONFIG = {
  authorizationEndpoint: 'https://lichess.org/oauth',
  tokenEndpoint: 'https://lichess.org/api/token',
  accountEndpoint: 'https://lichess.org/api/account',
  codeChallengeMethod: 'S256',
  responseType: 'code',
  defaultScopes: [
    'preference:read',
    'challenge:read',
    'challenge:write',
    'board:play',
  ],
};

export const getOAuthClientId = () => {
  return process.env.LICHESS_OAUTH_CLIENT_ID || 'chess-jeeno';
};

export const getOAuthRedirectUri = () => {
  const uri = process.env.LICHESS_OAUTH_REDIRECT_URI || 'http://localhost:5000/api/lichess/callback';
  return uri.trim();
};

export const getFrontendClientUrl = () => {
  const url = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',')[0].trim() : 'http://localhost:5173';
  return url.replace(/\/+$/, '');
};


export default {
  ...LICHESS_OAUTH_CONFIG,
  getOAuthClientId,
  getOAuthRedirectUri,
  getFrontendClientUrl,
};
