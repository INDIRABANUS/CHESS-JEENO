import mongoose from 'mongoose';

export const MEMBER_ROLES = ['CAPTAIN', 'PLAYER'];
export const MEMBER_STATUSES = ['INVITED', 'ACTIVE', 'DECLINED', 'REMOVED'];

const teamCompetitionMemberSchema = new mongoose.Schema(
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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    role: {
      type: String,
      enum: {
        values: MEMBER_ROLES,
        message: '{VALUE} is not a valid team role',
      },
      default: 'PLAYER',
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: MEMBER_STATUSES,
        message: '{VALUE} is not a valid membership status',
      },
      default: 'INVITED',
      required: true,
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// 1. A user must not have duplicate membership in the same team
teamCompetitionMemberSchema.index({ team: 1, user: 1 }, { unique: true });

// 2. A user must not be simultaneously ACTIVE in two teams in the same competition
teamCompetitionMemberSchema.index(
  { competition: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' },
  }
);

// Query indexes
teamCompetitionMemberSchema.index({ user: 1, status: 1, createdAt: -1 });
teamCompetitionMemberSchema.index({ team: 1, status: 1, role: 1 });

const TeamCompetitionMember = mongoose.model(
  'TeamCompetitionMember',
  teamCompetitionMemberSchema
);

export default TeamCompetitionMember;
