/**
 * Validates critical environment variables at application startup.
 * In production mode, missing required variables halts execution with a clear error.
 * In development/test mode, issues warnings and applies safe development defaults.
 * 
 * Never logs or reveals secret values.
 * 
 * @returns {{ valid: boolean, missing: string[] }}
 */
export const validateEnvironment = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = [];

  // MongoDB URI
  if (!process.env.MONGODB_URI) {
    missing.push('MONGODB_URI');
  }

  // JWT Secret
  if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16)) {
    missing.push('JWT_SECRET (must be >= 16 characters in production)');
  }

  // Frontend Client URL
  if (isProduction && !process.env.CLIENT_URL) {
    missing.push('CLIENT_URL');
  }

    // Lichess OAuth configuration checks
    if (!process.env.LICHESS_OAUTH_CLIENT_ID) {
      missing.push('LICHESS_OAUTH_CLIENT_ID');
    }
    if (!process.env.LICHESS_OAUTH_REDIRECT_URI) {
      missing.push('LICHESS_OAUTH_REDIRECT_URI');
    }

    // Google OAuth configuration checks
    if (!process.env.GOOGLE_CLIENT_ID) {
      missing.push('GOOGLE_CLIENT_ID');
    }
    if (!process.env.GOOGLE_CLIENT_SECRET) {
      missing.push('GOOGLE_CLIENT_SECRET');
    }
    if (!process.env.GOOGLE_OAUTH_REDIRECT_URI) {
      missing.push('GOOGLE_OAUTH_REDIRECT_URI');
    }
  }

  if (missing.length > 0) {
    const message = `Required environment variable(s) missing or insecure: ${missing.join(', ')}`;
    if (isProduction) {
      console.error(`❌ [Production Hardening Error] ${message}`);
      throw new Error(message);
    } else {
      console.warn(`⚠️  [Environment Warning] ${message}. Safe development defaults will be used.`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
};

export default validateEnvironment;
