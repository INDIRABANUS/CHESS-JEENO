import mongoose from 'mongoose';

const teamMatchBoardSchema = new mongoose.Schema(
  {
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamMatch',
      required: [true, 'Match ID is required'],
      index: true,
    },
    boardNumber: {
      type: Number,
      required: [true, 'Board number is required'],
      min: [1, 'Board number must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Board number must be an integer',
      },
    },
    teamAPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    teamBPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    teamAReady: {
      type: Boolean,
      default: false,
    },
    teamBReady: {
      type: Boolean,
      default: false,
    },
    locked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Board numbers must be unique within a match
teamMatchBoardSchema.index({ match: 1, boardNumber: 1 }, { unique: true });
teamMatchBoardSchema.index({ match: 1, teamAPlayer: 1 });
teamMatchBoardSchema.index({ match: 1, teamBPlayer: 1 });

const TeamMatchBoard = mongoose.model('TeamMatchBoard', teamMatchBoardSchema);

export default TeamMatchBoard;
