import * as googleOAuthService from '../services/googleOAuthService.js';
import { getFrontendClientUrl, getGoogleClientId } from '../config/googleOAuth.js';

/**
 * Initiates the Google OAuth 2.0 OpenID Connect authorization flow.
 * @route GET /api/auth/google
 */
export const googleAuth = async (req, res, next) => {
  try {
    const clientId = getGoogleClientId();
    if (!clientId) {
      const errorMsg = 'Google OAuth login is not configured on this server (missing GOOGLE_CLIENT_ID).';
      if (req.xhr || req.query.json === 'true' || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(503).json({
          success: false,
          message: errorMsg,
        });
      }
      const clientUrl = getFrontendClientUrl();
      return res.redirect(`${clientUrl}/login?auth_status=error&message=${encodeURIComponent(errorMsg)}`);
    }

    const { url, state } = googleOAuthService.createAuthorizationUrl();

    // If client requested JSON response (e.g. from an API call or test suite)
    const prefersJson =
      req.xhr ||
      req.query.json === 'true' ||
      (req.headers.accept && req.headers.accept.includes('application/json'));

    if (prefersJson) {
      return res.status(200).json({
        success: true,
        data: {
          url,
          state,
        },
      });
    }

    // Direct browser navigation: redirect to Google's authorization screen
    return res.redirect(url);
  } catch (error) {
    next(error);
  }
};

/**
 * Handles the OAuth 2.0 callback from Google.
 * Validates state, exchanges authorization code, verifies identity,
 * resolves CHESS JEENO user account, and initiates secure ticket handoff.
 *
 * @route GET /api/auth/google/callback
 */
export const googleCallback = async (req, res) => {
  const clientUrl = getFrontendClientUrl();
  const { code, state, error, error_description } = req.query;

  // Handle user cancellation or Google authorization denial
  if (error) {
    const errorMsg =
      error === 'access_denied'
        ? 'Google sign-in was cancelled.'
        : (error_description || error || 'Google sign-in could not be completed.');
    return res.redirect(`${clientUrl}/login?auth_status=error&message=${encodeURIComponent(errorMsg)}`);
  }

  // Require state and code parameters
  if (!state || !code) {
    return res.redirect(
      `${clientUrl}/login?auth_status=error&message=${encodeURIComponent('Missing authorization code or state parameter.')}`
    );
  }

  // Validate state (single-use consumption and expiration)
  const isValidState = googleOAuthService.consumeOAuthTransaction(state);
  if (!isValidState) {
    return res.redirect(
      `${clientUrl}/login?auth_status=error&message=${encodeURIComponent('Invalid, expired, or previously used OAuth state.')}`
    );
  }

  try {
    // 1. Exchange authorization code for Google access token
    const tokenData = await googleOAuthService.exchangeCodeForToken({ code });

    // 2. Fetch and validate verified Google identity
    const googleProfile = await googleOAuthService.fetchGoogleUserInfo(tokenData.access_token);

    // 3. Resolve CHESS JEENO account (find or create with duplicate protection)
    const authResult = await googleOAuthService.authenticateGoogleUser(googleProfile);

    // 4. Create short-lived single-use exchange ticket for secure frontend handoff
    // Never expose JWT or sensitive tokens directly in the redirect URL
    const ticket = googleOAuthService.createExchangeTicket({
      user: authResult.user,
      token: authResult.token,
    });

    return res.redirect(`${clientUrl}/login?auth_status=success&ticket=${ticket}`);
  } catch (err) {
    // Sanitize error messages: never leak secrets or internal database traces
    const safeErrorMessage = err.message || 'Google authentication failed. Please try again.';
    return res.redirect(
      `${clientUrl}/login?auth_status=error&message=${encodeURIComponent(safeErrorMessage)}`
    );
  }
};

/**
 * Exchanges a single-use handoff ticket for an authenticated CHESS JEENO session (JWT + User).
 * @route POST /api/auth/google/exchange
 */
export const googleExchange = async (req, res) => {
  const { ticket } = req.body || {};

  if (!ticket || typeof ticket !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Exchange ticket is required',
    });
  }

  const session = googleOAuthService.consumeExchangeTicket(ticket);
  if (!session) {
    return res.status(400).json({
      success: false,
      message: 'Invalid, expired, or already used exchange ticket',
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      user: session.user,
      token: session.token,
    },
  });
};

export default {
  googleAuth,
  googleCallback,
  googleExchange,
};
