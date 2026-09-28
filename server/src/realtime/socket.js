import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { handleJoinTournament, handleLeaveTournament } from './tournamentRoom.js';

const getJwtSecret = () => process.env.JWT_SECRET || 'REMOVED_JWT_SECRET';

let io = null;

/**
 * Socket.IO authentication middleware.
 * Authenticates users using strictly CHESS JEENO Bearer JWT in handshake auth or headers.
 * 
 * Strict Rules:
 * - Query parameter ?token= is strictly rejected with an explicit error.
 * - Missing token is rejected with an explicit error.
 * - Invalid or expired token is rejected.
 * - User must exist in the database.
 * - Lichess OAuth tokens are never accepted here.
 * 
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
export const socketAuthMiddleware = async (socket, next) => {
  try {
    // 1. Strictly forbid query parameter tokens (?token=...)
    const queryToken = socket.handshake.query?.token;
    const urlHasToken = typeof socket.handshake.url === 'string' && socket.handshake.url.includes('token=');

    if (queryToken || urlHasToken) {
      const error = new Error('Query-token authentication is prohibited. Please use handshake auth.');
      error.data = { code: 'QUERY_TOKEN_FORBIDDEN' };
      return next(error);
    }

    // 2. Extract token from handshake auth or headers
    let token = socket.handshake.auth?.token;
    if (!token && socket.handshake.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token || typeof token !== 'string' || !token.trim()) {
      const error = new Error('Authentication required. Missing token.');
      error.data = { code: 'AUTH_REQUIRED' };
      return next(error);
    }

    const cleanToken = token.trim();

    // 3. Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(cleanToken, getJwtSecret());
    } catch (err) {
      const error = new Error('Invalid or expired authentication token.');
      error.data = { code: 'INVALID_TOKEN' };
      return next(error);
    }

    if (!decoded || !decoded.userId) {
      const error = new Error('Invalid authentication token payload.');
      error.data = { code: 'INVALID_PAYLOAD' };
      return next(error);
    }

    // 4. Verify User exists in database
    const user = await User.findById(decoded.userId);
    if (!user) {
      const error = new Error('User account not found.');
      error.data = { code: 'USER_NOT_FOUND' };
      return next(error);
    }

    // 5. Attach authenticated user details to socket
    socket.user = user;
    socket.userId = user._id.toString();

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Initializes the Socket.IO server on an existing HTTP server instance.
 * 
 * @param {import('http').Server} httpServer
 * @param {Object} [options]
 * @returns {import('socket.io').Server}
 */
export const initSocketServer = (httpServer, options = {}) => {
  if (io) {
    return io;
  }

  const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    },
    ...options,
  });

  // Attach authentication middleware
  io.use(socketAuthMiddleware);

  // Connection handler
  io.on('connection', (socket) => {
    // 1. Tournament room subscription events
    socket.on('joinTournament', (data, callback) => {
      handleJoinTournament(socket, data, callback);
    });

    socket.on('leaveTournament', (data, callback) => {
      handleLeaveTournament(socket, data, callback);
    });

    // 2. Disconnect handler
    socket.on('disconnect', (reason) => {
      // Socket.IO automatically removes socket from all rooms
    });

    // 3. Security Audit: Server receives NO authoritative game state, results,
    //    or scores from clients. Any unrecognized mutation event is safely ignored.
  });

  return io;
};

/**
 * Retrieves the current Socket.IO server instance.
 * 
 * @returns {import('socket.io').Server|null}
 */
export const getIo = () => {
  return io;
};

/**
 * Closes the Socket.IO server (used in tests or server shutdown).
 */
export const closeSocketServer = async () => {
  if (io) {
    await new Promise((resolve) => io.close(resolve));
    io = null;
  }
};

export default {
  initSocketServer,
  getIo,
  closeSocketServer,
  socketAuthMiddleware,
};
