import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';

const VALID_FORMATS = ['ROUND_ROBIN', 'SWISS', 'KNOCKOUT'];
const ALLOWED_UPDATE_FIELDS = [
  'name',
  'description',
  'format',
  'rated',
  'clockLimit',
  'increment',
  'startTime',
  'maxPlayers',
];

/**
 * Validates tournament input fields.
 * Throws an Error with statusCode = 400 if validation fails.
 */
export const validateTournamentPayload = (payload, isPartial = false) => {
  const { name, format, clockLimit, increment, maxPlayers, startTime, rated } = payload;

  // Name validation
  if (!isPartial || name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      const error = new Error('Tournament name is required');
      error.statusCode = 400;
      throw error;
    }
  }

  // Format validation
  if (!isPartial || format !== undefined) {
    if (!format || !VALID_FORMATS.includes(format)) {
      const error = new Error(`Invalid format. Allowed formats: ${VALID_FORMATS.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Clock limit validation
  if (!isPartial || clockLimit !== undefined) {
    const clock = Number(clockLimit);
    if (isNaN(clock) || clock < 1) {
      const error = new Error('Clock limit must be a number greater than or equal to 1');
      error.statusCode = 400;
      throw error;
    }
  }

  // Increment validation
  if (!isPartial || increment !== undefined) {
    const inc = Number(increment);
    if (isNaN(inc) || inc < 0) {
      const error = new Error('Increment must be a number greater than or equal to 0');
      error.statusCode = 400;
      throw error;
    }
  }

  // Max players validation
  if (maxPlayers !== undefined && maxPlayers !== null && maxPlayers !== '') {
    const players = Number(maxPlayers);
    if (isNaN(players) || players < 2) {
      const error = new Error('Maximum players must be at least 2');
      error.statusCode = 400;
      throw error;
    }
  }

  // Start time validation
  if (startTime !== undefined && startTime !== null && startTime !== '') {
    const date = new Date(startTime);
    if (isNaN(date.getTime())) {
      const error = new Error('Start time must be a valid date');
      error.statusCode = 400;
      throw error;
    }
  }

  // Rated validation
  if (rated !== undefined && typeof rated !== 'boolean') {
    const error = new Error('Rated field must be a boolean');
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Creates a new tournament.
 */
export const createTournament = async (payload, creatorId) => {
  validateTournamentPayload(payload, false);

  const {
    name,
    description = '',
    format,
    rated = false,
    clockLimit,
    increment = 0,
    startTime = null,
    maxPlayers = null,
  } = payload;

  const tournament = await Tournament.create({
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    format,
    rated: Boolean(rated),
    clockLimit: Number(clockLimit),
    increment: Number(increment),
    startTime: startTime ? new Date(startTime) : null,
    maxPlayers: maxPlayers ? Number(maxPlayers) : null,
    createdBy: creatorId,
    status: 'REGISTRATION',
  });

  return await tournament.populate('createdBy', 'name email avatar lichessUsername');
};

/**
 * Retrieves a list of tournaments with optional status and format filters.
 * Dynamically computes registered player count from TournamentPlayer collection.
 */
export const getTournaments = async ({ status, format } = {}) => {
  const query = {};

  if (status) {
    query.status = status;
  }

  if (format) {
    query.format = format;
  }

  const tournaments = await Tournament.find(query)
    .sort({ startTime: 1, createdAt: -1 })
    .populate('createdBy', 'name email avatar lichessUsername');

  const tournamentIds = tournaments.map((t) => t._id);
  const playerCounts = await TournamentPlayer.aggregate([
    { $match: { tournamentId: { $in: tournamentIds } } },
    { $group: { _id: '$tournamentId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(playerCounts.map((c) => [c._id.toString(), c.count]));

  return tournaments.map((t) => {
    const obj = t.toObject();
    obj.registeredPlayers = countMap.get(t._id.toString()) || 0;
    return obj;
  });
};

/**
 * Retrieves a single tournament by ID.
 * Dynamically computes registered player count and registration status for current user.
 */
export const getTournamentById = async (id, currentUserId = null) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(id).populate(
    'createdBy',
    'name email avatar lichessUsername'
  );

  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const registeredPlayers = await TournamentPlayer.countDocuments({ tournamentId: id });
  const isRegistered = currentUserId
    ? Boolean(await TournamentPlayer.exists({ tournamentId: id, userId: currentUserId }))
    : false;

  const result = tournament.toObject();
  result.registeredPlayers = registeredPlayers;
  result.isRegistered = isRegistered;

  return result;
};

/**
 * Updates an existing tournament.
 */
export const updateTournament = async (id, updateData, currentUserId = null) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Check if tournament exists
  const existingTournament = await Tournament.findById(id);
  if (!existingTournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Verify ownership if currentUserId is provided
  if (currentUserId && existingTournament.createdBy.toString() !== currentUserId.toString()) {
    const error = new Error('You are not authorized to update this tournament');
    error.statusCode = 403;
    throw error;
  }

  // Prevent status modification through this endpoint
  if (updateData.status !== undefined && updateData.status !== existingTournament.status) {
    const error = new Error('Changing tournament status via this endpoint is not allowed');
    error.statusCode = 400;
    throw error;
  }

  // Filter allowed fields only
  const sanitizedUpdates = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (updateData[field] !== undefined) {
      sanitizedUpdates[field] = updateData[field];
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    const error = new Error('No valid fields provided for update');
    error.statusCode = 400;
    throw error;
  }

  // Validate only provided fields
  validateTournamentPayload(sanitizedUpdates, true);

  if (sanitizedUpdates.name !== undefined) {
    sanitizedUpdates.name = sanitizedUpdates.name.trim();
  }
  if (sanitizedUpdates.description !== undefined) {
    sanitizedUpdates.description = sanitizedUpdates.description.trim();
  }
  if (sanitizedUpdates.clockLimit !== undefined) {
    sanitizedUpdates.clockLimit = Number(sanitizedUpdates.clockLimit);
  }
  if (sanitizedUpdates.increment !== undefined) {
    sanitizedUpdates.increment = Number(sanitizedUpdates.increment);
  }
  if (sanitizedUpdates.maxPlayers !== undefined) {
    sanitizedUpdates.maxPlayers = sanitizedUpdates.maxPlayers
      ? Number(sanitizedUpdates.maxPlayers)
      : null;
  }
  if (sanitizedUpdates.startTime !== undefined) {
    sanitizedUpdates.startTime = sanitizedUpdates.startTime
      ? new Date(sanitizedUpdates.startTime)
      : null;
  }

  const updatedTournament = await Tournament.findByIdAndUpdate(
    id,
    { $set: sanitizedUpdates },
    { new: true, runValidators: true }
  ).populate('createdBy', 'name email avatar lichessUsername');

  return updatedTournament;
};

/**
 * Deletes a tournament if in DRAFT or REGISTRATION status.
 */
export const deleteTournament = async (id, currentUserId = null) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(id);
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // Verify ownership if currentUserId is provided
  if (currentUserId && tournament.createdBy.toString() !== currentUserId.toString()) {
    const error = new Error('You are not authorized to delete this tournament');
    error.statusCode = 403;
    throw error;
  }

  // Safety check: only allow deletion of DRAFT or REGISTRATION tournaments
  if (tournament.status !== 'DRAFT' && tournament.status !== 'REGISTRATION') {
    const error = new Error(
      `Cannot delete tournament with status '${tournament.status}'. Only DRAFT or REGISTRATION tournaments can be deleted.`
    );
    error.statusCode = 400;
    throw error;
  }

  await Tournament.findByIdAndDelete(id);

  return { message: 'Tournament deleted successfully' };
};

export default {
  createTournament,
  getTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
};
