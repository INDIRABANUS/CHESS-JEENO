import mongoose from 'mongoose';

const tournamentPlayerSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: [true, 'Tournament ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    wins: {
      type: Number,
      default: 0,
      min: 0,
    },
    draws: {
      type: Number,
      default: 0,
      min: 0,
    },
    losses: {
      type: Number,
      default: 0,
      min: 0,
    },
    gamesPlayed: {
      type: Number,
      default: 0,
      min: 0,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    isReady: {
      type: Boolean,
      default: false,
    },
    readyAt: {
      type: Date,
      default: null,
    },
    isApproved: {
      type: Boolean,
      default: true,
    },
  },
  {
    // Disable automatic createdAt/updatedAt if not requested, but standard mongoose timestamps: false
    timestamps: false,
  }
);

// Compound unique index to prevent duplicate player registration in the same tournament
tournamentPlayerSchema.index({ tournamentId: 1, userId: 1 }, { unique: true });

const TournamentPlayer = mongoose.model('TournamentPlayer', tournamentPlayerSchema);

export default TournamentPlayer;
