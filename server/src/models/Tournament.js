import mongoose from 'mongoose';

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tournament name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user ID is required'],
      index: true,
    },
    format: {
      type: String,
      enum: {
        values: ['ROUND_ROBIN', 'SWISS', 'KNOCKOUT'],
        message: '{VALUE} is not a valid tournament format',
      },
      required: [true, 'Tournament format is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['DRAFT', 'REGISTRATION', 'RUNNING', 'FINISHED', 'CANCELLED'],
        message: '{VALUE} is not a valid tournament status',
      },
      default: 'REGISTRATION',
      index: true,
    },
    rated: {
      type: Boolean,
      default: false,
    },
    clockLimit: {
      type: Number,
      required: [true, 'Clock limit is required'],
      min: [1, 'Clock limit must be at least 1'],
    },
    increment: {
      type: Number,
      required: [true, 'Increment is required'],
      min: [0, 'Increment must be at least 0'],
      default: 0,
    },
    startTime: {
      type: Date,
      default: null,
      index: true,
    },
    maxPlayers: {
      type: Number,
      min: [2, 'maxPlayers must be at least 2'],
      default: null,
    },
    totalRounds: {
      type: Number,
      default: null,
      min: [1, 'Total rounds must be at least 1'],
      max: [20, 'Total rounds cannot exceed 20'],
    },
  },
  {
    timestamps: true,
  }
);

const Tournament = mongoose.model('Tournament', tournamentSchema);

export default Tournament;
