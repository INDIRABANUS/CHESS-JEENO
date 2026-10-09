import mongoose from 'mongoose';

const teamCompetitionStandingSchema = new mongoose.Schema(
  {
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetition',
      required: [true, 'Competition ID is required'],
      index: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetitionTeam',
      required: [true, 'Team ID is required'],
      index: true,
    },
    played: {
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
    matchPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    boardPointsFor: {
      type: Number,
      default: 0,
      min: 0,
    },
    boardPointsAgainst: {
      type: Number,
      default: 0,
      min: 0,
    },
    boardPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    scoreDifference: {
      type: Number,
      default: 0,
    },
    rank: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

teamCompetitionStandingSchema.index({ competition: 1, team: 1 }, { unique: true });
teamCompetitionStandingSchema.index({ competition: 1, rank: 1 });
teamCompetitionStandingSchema.index({ competition: 1, matchPoints: -1, boardPoints: -1 });

const TeamCompetitionStanding = mongoose.model(
  'TeamCompetitionStanding',
  teamCompetitionStandingSchema
);

export default TeamCompetitionStanding;
