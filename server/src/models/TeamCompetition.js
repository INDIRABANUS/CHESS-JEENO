import mongoose from 'mongoose';

export const COMPETITION_STATUSES = [
  'DRAFT',
  'REGISTRATION',
  'READY',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const teamCompetitionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Competition name is required'],
      trim: true,
      maxlength: [100, 'Competition name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer user ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: COMPETITION_STATUSES,
        message: '{VALUE} is not a valid competition status',
      },
      default: 'REGISTRATION',
      index: true,
    },
    maxTeams: {
      type: Number,
      default: null,
      min: [2, 'maxTeams must be at least 2'],
      max: [64, 'maxTeams cannot exceed 64'],
    },
    maxPlayersPerTeam: {
      type: Number,
      default: null,
      min: [1, 'maxPlayersPerTeam must be at least 1'],
      max: [50, 'maxPlayersPerTeam cannot exceed 50'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
teamCompetitionSchema.index({ status: 1, createdAt: -1 });
teamCompetitionSchema.index({ organizer: 1, createdAt: -1 });

const TeamCompetition = mongoose.model('TeamCompetition', teamCompetitionSchema);

export default TeamCompetition;
