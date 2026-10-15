import mongoose from 'mongoose';

export const MATCH_STATUSES = [
  'DRAFT',
  'LINEUP',
  'READY',
  'STARTING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export const SCORING_STATUSES = [
  'PENDING',
  'FINAL',
  'REVIEW_REQUIRED',
];

export const MATCH_RESULTS = [
  'WIN',
  'DRAW',
  'LOSS',
];

const teamMatchSchema = new mongoose.Schema(
  {
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetition',
      required: [true, 'Competition ID is required'],
      index: true,
    },
    round: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetitionRound',
      required: [true, 'Round ID is required'],
      index: true,
    },
    teamA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetitionTeam',
      required: [true, 'Team A ID is required'],
      index: true,
    },
    teamB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetitionTeam',
      required: [true, 'Team B ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: MATCH_STATUSES,
        message: '{VALUE} is not a valid match status',
      },
      default: 'DRAFT',
      index: true,
    },
    scheduledStart: {
      type: Date,
      default: null,
    },
    boardCount: {
      type: Number,
      required: [true, 'Board count is required'],
      min: [1, 'Board count must be at least 1'],
      max: [20, 'Board count cannot exceed 20'],
      default: 4,
      validate: {
        validator: Number.isInteger,
        message: 'Board count must be an integer',
      },
    },
    teamALineupLocked: {
      type: Boolean,
      default: false,
    },
    teamBLineupLocked: {
      type: Boolean,
      default: false,
    },
    teamALineupLockedAt: {
      type: Date,
      default: null,
    },
    teamBLineupLockedAt: {
      type: Date,
      default: null,
    },
    // V4 Scoring & Match Results
    scoringStatus: {
      type: String,
      enum: {
        values: SCORING_STATUSES,
        message: '{VALUE} is not a valid scoring status',
      },
      default: 'PENDING',
      index: true,
    },
    teamAScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    teamBScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    teamAMatchPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    teamBMatchPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    teamAResult: {
      type: String,
      enum: [...MATCH_RESULTS, null],
      default: null,
    },
    teamBResult: {
      type: String,
      enum: [...MATCH_RESULTS, null],
      default: null,
    },
    winnerTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetitionTeam',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

teamMatchSchema.index({ round: 1, status: 1 });
teamMatchSchema.index({ competition: 1, status: 1 });
teamMatchSchema.index({ competition: 1, scoringStatus: 1 });
teamMatchSchema.index({ round: 1, teamA: 1, teamB: 1 });

const TeamMatch = mongoose.model('TeamMatch', teamMatchSchema);

export default TeamMatch;
