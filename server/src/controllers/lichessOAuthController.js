import * as lichessOAuthService from '../services/lichessOAuthService.js';
import { getFrontendClientUrl } from '../config/lichessOAuth.js';

/**
 * Initiate Lichess OAuth 2.0 PKCE flow.
 * @route GET /api/lichess/connect
 */
export const connect = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { url, state } = lichessOAuthService.createAuthorizationUrl(userId);

    // If client requested JSON response (e.g. from an API call), return url
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

    // Direct browser navigation: redirect to Lichess authorization page
    res.redirect(url);
  } catch (error) {
    next(error);
  }
};

/**
 * OAuth callback endpoint invoked by Lichess.
 * @route GET /api/lichess/callback
 */
export const callback = async (req, res, next) => {
  const clientUrl = getFrontendClientUrl();
  const { code, state, error, error_description } = req.query;

  // Handle user cancellation or Lichess authorization error
  if (error) {
    const errorMsg = error_description || error || 'Lichess connection was cancelled or could not be completed';
    return res.redirect(`${clientUrl}/profile?lichess_status=error&message=${encodeURIComponent(errorMsg)}`);
  }

  // Require state and code parameters
  if (!state || !code) {
    return res.redirect(`${clientUrl}/profile?lichess_status=error&message=${encodeURIComponent('Missing authorization code or state parameter')}`);
  }

  // Validate state and retrieve bound CHESS JEENO user + PKCE verifier (single-use)
  const transaction = lichessOAuthService.consumeOAuthTransaction(state);
  if (!transaction) {
    return res.redirect(`${clientUrl}/profile?lichess_status=error&message=${encodeURIComponent('Invalid, expired, or previously used OAuth state')}`);
  }

  try {
    // 1. Exchange authorization code + code_verifier for token
    const tokenData = await lichessOAuthService.exchangeCodeForToken({
      code,
      codeVerifier: transaction.codeVerifier,
    });

    // 2. Fetch authenticated Lichess account details
    const account = await lichessOAuthService.fetchLichessAccount(tokenData.access_token);

    // 3. Store connection in CHESS JEENO User document (with duplicate check)
    await lichessOAuthService.storeLichessConnection(transaction.userId, {
      account,
      tokenData,
    });

    // 4. Redirect back to frontend profile with success notification
    return res.redirect(
      `${clientUrl}/profile?lichess_status=success&username=${encodeURIComponent(account.username)}`
    );
  } catch (err) {
    const safeErrorMessage = err.message || 'Failed to complete Lichess account connection';
    return res.redirect(
      `${clientUrl}/profile?lichess_status=error&message=${encodeURIComponent(safeErrorMessage)}`
    );
  }
};

/**
 * Get Lichess connection status for the authenticated user.
 * @route GET /api/lichess/status
 */
export const getStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const status = await lichessOAuthService.getConnectionStatus(userId);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disconnect Lichess account from the authenticated user.
 * @route POST /api/lichess/disconnect
 */
export const disconnect = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await lichessOAuthService.disconnectLichess(userId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  connect,
  callback,
  getStatus,
  disconnect,
};
