import User from '../models/User.js';
import { DEFAULT_DEV_PLAYERS } from '../config/lichess.js';

let cachedDevUserId = null;

/**
 * Gets or creates the primary development host user (Player 1).
 * 
 * @returns {Promise<mongoose.Types.ObjectId>} The ObjectId of the dev user
 */
export const getDevUserId = async () => {
  if (cachedDevUserId) {
    const existing = await User.findById(cachedDevUserId).select('_id');
    if (existing) {
      return existing._id;
    }
  }

  const devEmail = process.env.DEV_USER_EMAIL || 'host@chessjeeno.local';
  const lichessUsername = (process.env.LICHESS_USER_PLAYER_1 || 'pavakka_ib').trim();
  let devUser = await User.findOne({ email: devEmail });

  if (!devUser) {
    devUser = await User.create({
      name: 'CHESS JEENO Host',
      email: devEmail,
      authProvider: 'local',
      lichessUsername,
    });
  } else if (devUser.lichessUsername !== lichessUsername) {
    devUser.lichessUsername = lichessUsername;
    await devUser.save();
  }

  cachedDevUserId = devUser._id;
  return devUser._id;
};

/**
 * Gets or creates the second development user (Player 2).
 * 
 * @returns {Promise<mongoose.Types.ObjectId>} The ObjectId of the second dev user
 */
export const getSecondDevUserId = async () => {
  return await getDevUserByIndex(2);
};

/**
 * Gets or creates a development user by player index (1 to 4).
 * 
 * @param {number} index - Player index (1, 2, 3, or 4)
 * @returns {Promise<mongoose.Types.ObjectId>}
 */
export const getDevUserByIndex = async (index) => {
  const i = Math.max(1, Math.min(4, Number(index) || 1));
  const defaultInfo = DEFAULT_DEV_PLAYERS[i] || { username: `player${i}`, name: `Dev Player ${i}` };

  const email = i === 1
    ? (process.env.DEV_USER_EMAIL || 'host@chessjeeno.local')
    : (process.env[`DEV_USER_EMAIL_${i}`] || `player${i}@chessjeeno.local`);

  const lichessUsername = (process.env[`LICHESS_USER_PLAYER_${i}`] || defaultInfo.username).trim();
  const name = i === 1 ? 'CHESS JEENO Host' : (defaultInfo.name || `Dev Player ${i}`);

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name,
      email,
      authProvider: 'local',
      lichessUsername,
    });
  } else if (user.lichessUsername !== lichessUsername) {
    user.lichessUsername = lichessUsername;
    await user.save();
  }

  return user._id;
};

/**
 * Ensures all four development users exist and have up-to-date Lichess usernames.
 * 
 * @returns {Promise<Array<Object>>} List of populated dev user records
 */
export const ensureDevUsers = async () => {
  const users = [];
  for (let i = 1; i <= 4; i++) {
    const id = await getDevUserByIndex(i);
    const u = await User.findById(id).select('name email lichessUsername');
    users.push({ index: i, user: u });
  }
  return users;
};

/**
 * Resolves the creator ID for a request.
 * Prioritizes req.user._id if authentication is active,
 * otherwise falls back to the isolated dev user.
 * 
 * @param {import('express').Request} req
 * @returns {Promise<mongoose.Types.ObjectId>}
 */
export const resolveCreatorId = async (req) => {
  if (req.user && req.user._id) {
    return req.user._id;
  }
  return await getDevUserId();
};

export default {
  getDevUserId,
  getSecondDevUserId,
  getDevUserByIndex,
  ensureDevUsers,
  resolveCreatorId,
};
