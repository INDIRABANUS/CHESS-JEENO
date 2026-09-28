/**
 * Production-Hardened Centralized Error Handler Middleware.
 * 
 * Rules:
 * - Always returns { success: false, message: string }
 * - Never exposes stack traces, internal database models, tokens, or filesystem paths to clients
 * - Normalizes MongoDB CastErrors (404 Resource not found) and duplicate key errors (400)
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode !== 200 && res.statusCode !== 201 ? res.statusCode : 500);
  let message = err.message || 'Internal Server Error';

  // Sanitize MongoDB CastError (invalid ObjectId format)
  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Sanitize MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 400;
    message = 'A resource with this record already exists.';
  }

  // Sanitize JSON parse error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON payload.';
  }

  // Ensure message does not expose internal filesystem paths or tokens
  if (typeof message === 'string') {
    // Strip file paths if any (e.g. C:\Users\... or /home/...)
    message = message.replace(/(?:[a-zA-Z]:|\/)[^\s:;"']+/g, '[redacted_path]');
    // Strip potential tokens
    message = message.replace(/(?:bearer\s+|token[=:]\s*)[a-zA-Z0-9_\-\.]{20,}/gi, '[redacted_token]');
  }

  // Safe server logging (avoid logging secret tokens or sensitive credentials)
  const safeLogMsg = typeof err.message === 'string'
    ? err.message.replace(/(?:bearer\s+|token[=:]\s*)[a-zA-Z0-9_\-\.]{20,}/gi, '[redacted_token]')
    : 'Unknown error';
  console.error(`[Error] ${req.method} ${req.originalUrl} (${statusCode}):`, safeLogMsg);

  res.status(statusCode).json({
    success: false,
    message,
  });
};

/**
 * 404 Not Found route handler.
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export default {
  errorHandler,
  notFoundHandler,
};
