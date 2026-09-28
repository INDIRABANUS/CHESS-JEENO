import mongoose from 'mongoose';

const roundSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: [true, 'Tournament ID is required'],
      index: true,
    },
    roundNumber: {
      type: Number,
      required: [true, 'Round number is required'],
      min: [1, 'Round number must be at least 1'],
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'RUNNING', 'COMPLETED'],
        message: '{VALUE} is not a valid round status',
      },
      default: 'PENDING',
    },
    byePlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    stageName: {
      type: String,
      default: null,
      trim: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring each round number is unique per tournament
roundSchema.index({ tournamentId: 1, roundNumber: 1 }, { unique: true });

const Round = mongoose.model('Round', roundSchema);

export default Round;
