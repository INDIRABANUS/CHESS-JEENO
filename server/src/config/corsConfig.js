/**
 * Centralized CORS and Origin Management for Express and Socket.IO.
 * 
 * Supports:
 * - Single or comma-separated CLIENT_URL values (e.g. "https://app.vercel.app,https://staging.vercel.app")
 * - Automatic trailing slash normalization
 * - Safe development localhost fallbacks in non-production
 * - Strict origin checking in production (NODE_ENV === 'production')
 */

/**
 * Returns the list of sanitized allowed origins.
 * @returns {string[]}
 */
export const getAllowedOrigins = () => {
  const configuredOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',')
        .map((url) => url.trim().replace(/\/+$/, ''))
        .filter(Boolean)
    : [];

  if (process.env.NODE_ENV === 'production') {
    return configuredOrigins;
  }

  // In non-production, permit standard local development origins
  const devOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:3000',
  ];

  return Array.from(new Set([...configuredOrigins, ...devOrigins])).filter(Boolean);
};

/**
 * Validates an incoming origin against allowed origins.
 * 
 * @param {string|undefined} origin
 * @param {Function} callback (err, allow)
 */
export const corsOriginValidator = (origin, callback) => {
  // Allow requests with no origin (such as server-to-server, curl, or mobile app native)
  if (!origin) {
    return callback(null, true);
  }

  const allowedOrigins = getAllowedOrigins();
  const cleanOrigin = origin.trim().replace(/\/+$/, '');

  if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  // In production, reject unapproved origins
  if (process.env.NODE_ENV === 'production') {
    const error = new Error('Not allowed by CORS policy');
    error.statusCode = 403;
    return callback(error);
  }

  // In development, permit local origins
  return callback(null, true);
};

export const corsOptions = {
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export default {
  getAllowedOrigins,
  corsOriginValidator,
  corsOptions,
};
