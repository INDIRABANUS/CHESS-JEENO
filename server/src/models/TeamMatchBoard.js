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
    // Lichess Match Execution & Result fields
    lichessGameId: {
      type: String,
      default: null,
      trim: true,
    },
    lichessUrl: {
      type: String,
      default: null,
      trim: true,
    },
    lichessStatus: {
      type: String,
      enum: [
        'NOT_STARTED',
        'CREATING',
        'CREATED',
        'ACTIVE',
        'FINISHED',
        'ABORTED',
        'ERROR',
      ],
      default: 'NOT_STARTED',
      index: true,
    },
    whitePlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    blackPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lichessWhiteUsername: {
      type: String,
      default: null,
      trim: true,
    },
    lichessBlackUsername: {
      type: String,
      default: null,
      trim: true,
    },
    gameStartedAt: {
      type: Date,
      default: null,
    },
    gameFinishedAt: {
      type: Date,
      default: null,
    },
    result: {
      type: String,
      enum: ['1-0', '0-1', '1/2-1/2', 'ABORTED', null],
      default: null,
    },
    resultReason: {
      type: String,
      default: null,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    // V4 Scoring & Resolution fields
    teamAPoints: {
      type: Number,
      default: null,
    },
    teamBPoints: {
      type: Number,
      default: null,
    },
    overrideResult: {
      type: String,
      enum: ['1-0', '0-1', '1/2-1/2', null],
      default: null,
    },
    overrideReason: {
      type: String,
      default: null,
      trim: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Board numbers must be unique within a match
teamMatchBoardSchema.index({ match: 1, boardNumber: 1 }, { unique: true });
teamMatchBoardSchema.index({ match: 1, lichessGameId: 1 });
teamMatchBoardSchema.index(
  { lichessGameId: 1 },
  { unique: true, partialFilterExpression: { lichessGameId: { $type: 'string' } } }
);
teamMatchBoardSchema.index({ match: 1, teamAPlayer: 1 });
teamMatchBoardSchema.index({ match: 1, teamBPlayer: 1 });

const TeamMatchBoard = mongoose.model('TeamMatchBoard', teamMatchBoardSchema);

export default TeamMatchBoard;
