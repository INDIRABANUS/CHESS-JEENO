import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const getJwtSecret = () => process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

/**
 * Middleware that authenticates requests using Bearer JWT.
 * Attaches the authenticated User document to req.user.
 * Supports token via Authorization header or query parameter (e.g. for browser redirects).
 */
export const requireAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      const error = new Error('Authentication required. Missing or malformed Authorization header.');
      error.statusCode = 401;
      return next(error);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (err) {
      const error = new Error('Invalid or expired authentication token');
      error.statusCode = 401;
      return next(error);
    }

    if (!decoded || !decoded.userId) {
      const error = new Error('Invalid authentication token payload');
      error.statusCode = 401;
      return next(error);
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      const error = new Error('User account not found');
      error.statusCode = 401;
      return next(error);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware:
 * If a valid token is present, attaches user to req.user.
 * If no token or invalid token, continues without failing.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) return next();

    try {
      const decoded = jwt.verify(token, getJwtSecret());
      if (decoded && decoded.userId) {
        const user = await User.findById(decoded.userId);
        if (user) {
          req.user = user;
        }
      }
    } catch {
      // Ignore token verification errors in optional mode
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default {
  requireAuth,
  optionalAuth,
};
