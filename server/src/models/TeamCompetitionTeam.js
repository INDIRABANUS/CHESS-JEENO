import mongoose from 'mongoose';

export const TEAM_STATUSES = ['PENDING', 'ACTIVE', 'REMOVED'];

const teamCompetitionTeamSchema = new mongoose.Schema(
  {
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetition',
      required: [true, 'Competition ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      maxlength: [60, 'Team name cannot exceed 60 characters'],
    },
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Team captain user ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: TEAM_STATUSES,
        message: '{VALUE} is not a valid team status',
      },
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: team name must be unique within a competition
teamCompetitionTeamSchema.index({ competition: 1, name: 1 }, { unique: true });
teamCompetitionTeamSchema.index({ competition: 1, status: 1 });
teamCompetitionTeamSchema.index({ captain: 1, status: 1 });

const TeamCompetitionTeam = mongoose.model('TeamCompetitionTeam', teamCompetitionTeamSchema);

export default TeamCompetitionTeam;
