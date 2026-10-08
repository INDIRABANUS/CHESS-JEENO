import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'JOIN_REQUEST_RECEIVED',
  'JOIN_REQUEST_APPROVED',
  'JOIN_REQUEST_REJECTED',
  'TOURNAMENT_INVITATION',
  'TOURNAMENT_STARTING',
  'ROUND_READY',
  'PAIRING_CREATED',
  'GAME_RESULT',
  'TOURNAMENT_COMPLETED',
  'TEAM_INVITATION',
  'TEAM_INVITATION_ACCEPTED',
  'TEAM_INVITATION_DECLINED',
  'TEAM_CAPTAIN_TRANSFERRED',
  'TEAM_MATCH_BOARD_ASSIGNED',
  'TEAM_LINEUP_LOCKED',
  'TEAM_MATCH_READY',
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      default: null,
    },
    teamCompetition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetition',
      default: null,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetitionTeam',
      default: null,
    },
    teamMatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamMatch',
      default: null,
    },
    teamRound: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamCompetitionRound',
      default: null,
    },
    pairing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pairing',
      default: null,
    },
    round: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Round',
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    eventKey: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Primary query index: fetch user notifications ordered by newest first
notificationSchema.index({ recipient: 1, createdAt: -1 });

// Unread notifications query index: fetch unread notifications count or list
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// Deterministic deduplication index: prevents duplicate notifications for the same eventKey per recipient
notificationSchema.index(
  { recipient: 1, eventKey: 1 },
  { unique: true, partialFilterExpression: { eventKey: { $type: 'string' } } }
);

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
