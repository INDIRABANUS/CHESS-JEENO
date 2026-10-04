import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const getJwtSecret = () => process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

/**
 * Middleware that authenticates requests using strictly Bearer JWT in the Authorization header.
 * Attaches the authenticated User document to req.user.
 * Query parameter tokens are strictly prohibited.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Authentication required. Missing or malformed Authorization header.');
      error.statusCode = 401;
      return next(error);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      const error = new Error('Authentication token required');
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
 * If a valid Bearer token is present in the Authorization header, attaches user to req.user.
 * If no token or invalid token, continues without failing.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
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

/**
 * Middleware that strictly restricts route access to users with persisted ADMIN role.
 * 
 * Guarantees:
 * 1. Requires normal authentication first (runs requireAuth if req.user is not yet attached).
 * 2. Authenticated user is resolved from database by ID.
 * 3. Checks that the user's persisted role in the database is strictly 'ADMIN'.
 * 4. Rejects non-admin users with HTTP 403 Forbidden.
 * 5. Rejects unauthenticated/invalid/deleted users with standard 401 error.
 * 6. Never trusts client-supplied roles in body, query, or path.
 * 7. Avoids leaking internal implementation details.
 */
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return requireAuth(req, res, (err) => {
        if (err) return next(err);
        return verifyAdminRole(req, res, next);
      });
    }

    return verifyAdminRole(req, res, next);
  } catch (error) {
    next(error);
  }
};

const verifyAdminRole = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    const error = new Error('Access denied. Administrator privileges required.');
    error.statusCode = 403;
    return next(error);
  }

  next();
};

export default {
  requireAuth,
  optionalAuth,
  requireAdmin,
};
