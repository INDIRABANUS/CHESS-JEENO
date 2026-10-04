import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';

dotenv.config();

/**
 * Promotes an existing registered user to the platform ADMIN role.
 * 
 * Safety invariants:
 * - Standalone server-side utility; never callable through an HTTP endpoint
 * - Strict email format validation and normalization
 * - Fails clearly if the user account does not already exist (never creates arbitrary users)
 * - Safe logging only; never reveals credentials, password hashes, or OAuth tokens
 * - Only changes the matching user's role to 'ADMIN'
 * 
 * @param {Object} params
 * @param {string} params.email - The registered email address of the user to promote
 * @returns {Promise<{ success: boolean, message: string, user: { id: string, name: string, email: string, role: string } }>}
 */
export const promoteUserToAdmin = async ({ email } = {}) => {
  if (!email || typeof email !== 'string' || !email.trim()) {
    const error = new Error('Email is required to promote a user to ADMIN.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    const error = new Error('Invalid email format for admin bootstrap.');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const error = new Error(
      `Cannot promote user: No account found with email "${normalizedEmail}". Admin bootstrap does not create arbitrary accounts. The user must register first.`
    );
    error.statusCode = 404;
    throw error;
  }

  if (user.role === 'ADMIN') {
    return {
      success: true,
      message: `User "${normalizedEmail}" is already an ADMIN.`,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  user.role = 'ADMIN';
  await user.save();

  return {
    success: true,
    message: `User "${normalizedEmail}" has been successfully promoted to ADMIN.`,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

/**
 * CLI execution wrapper.
 * Resolves target email from ADMIN_BOOTSTRAP_EMAIL environment variable or CLI argument.
 */
const runBootstrapCli = async () => {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL || process.argv[2];

  if (!email) {
    console.error('❌ Error: ADMIN_BOOTSTRAP_EMAIL environment variable (or email argument) is required.');
    console.error('\nUsage:');
    console.error('  ADMIN_BOOTSTRAP_EMAIL=admin@example.com npm --prefix server run bootstrap:admin');
    console.error('  or: node src/utils/bootstrapAdmin.js admin@example.com\n');
    process.exit(1);
  }

  try {
    await connectDB();
    const result = await promoteUserToAdmin({ email });
    console.log(`✅ [Admin Bootstrap Success] ${result.message}`);
    console.log(`   User ID: ${result.user.id}`);
    console.log(`   Email:   ${result.user.email}`);
    console.log(`   Role:    ${result.user.role}`);
  } catch (error) {
    console.error(`❌ [Admin Bootstrap Error] ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

// Check if running as direct CLI entry point
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBootstrapCli();
}

export default {
  promoteUserToAdmin,
};
