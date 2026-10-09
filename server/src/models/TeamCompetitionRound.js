import mongoose from 'mongoose';

export const ROUND_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'LINEUP',
  'READY',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const teamCompetitionRoundSchema = new mongoose.Schema(
  {
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetition',
      required: [true, 'Competition ID is required'],
      index: true,
    },
    roundNumber: {
      type: Number,
      required: [true, 'Round number is required'],
      min: [1, 'Round number must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Round number must be an integer',
      },
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Round name cannot exceed 100 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ROUND_STATUSES,
        message: '{VALUE} is not a valid round status',
      },
      default: 'DRAFT',
      index: true,
    },
    scheduledStart: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user ID is required'],
    },
    // V5 Round Robin BYE Assignment
    byeTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetitionTeam',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Round number must be unique within a competition
teamCompetitionRoundSchema.index({ competition: 1, roundNumber: 1 }, { unique: true });
teamCompetitionRoundSchema.index({ competition: 1, status: 1 });
teamCompetitionRoundSchema.index({ competition: 1, byeTeam: 1 });

const TeamCompetitionRound = mongoose.model(
  'TeamCompetitionRound',
  teamCompetitionRoundSchema
);

export default TeamCompetitionRound;
