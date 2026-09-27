import mongoose from 'mongoose';

/**
 * Get human-readable MongoDB connection state.
 * @returns {'connected' | 'connecting' | 'disconnecting' | 'disconnected'}
 */
export const getDatabaseStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'disconnected';
};

/**
 * Check if MongoDB connection is active.
 * @returns {boolean}
 */
export const isDatabaseConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Connect to MongoDB database using Mongoose.
 * Exits process if MONGODB_URI is missing unless ALLOW_DEV_WITHOUT_DB=true is configured.
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI?.trim();
  const allowDevWithoutDb = process.env.ALLOW_DEV_WITHOUT_DB === 'true';

  if (!uri) {
    if (allowDevWithoutDb) {
      console.warn('⚠️  MONGODB_URI is missing. Running in development mode without MongoDB connection (ALLOW_DEV_WITHOUT_DB=true).');
      return null;
    } else {
      console.error('❌ MONGODB_URI environment variable is missing.');
      console.error('   To run in development without MongoDB, set ALLOW_DEV_WITHOUT_DB=true in your .env file.');
      process.exit(1);
    }
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    if (allowDevWithoutDb) {
      console.warn('⚠️  Continuing server execution in development mode without active database connection.');
      return null;
    } else {
      process.exit(1);
    }
  }
};

export default {
  connectDB,
  getDatabaseStatus,
  isDatabaseConnected,
};
