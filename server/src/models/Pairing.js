import mongoose from 'mongoose';

const pairingSchema = new mongoose.Schema(
  {
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Round',
      required: [true, 'Round ID is required'],
      index: true,
    },
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: [true, 'Tournament ID is required'],
      index: true,
    },
    whitePlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'White player reference is required'],
      index: true,
    },
    blackPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.status !== 'BYE';
      },
      index: true,
      default: null,
    },
    lichessGameId: {
      type: String,
      sparse: true,
      trim: true,
      default: null,
      index: true,
    },
    lichessGameUrl: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'CREATED', 'ACTIVE', 'READY', 'RUNNING', 'COMPLETED', 'FINISHED', 'CANCELLED', 'ABORTED', 'BYE'],
        message: '{VALUE} is not a valid pairing status',
      },
      default: 'PENDING',
    },
    result: {
      type: String,
      enum: {
        values: ['PENDING', '1-0', '0-1', '1/2-1/2', 'WHITE_WIN', 'BLACK_WIN', 'DRAW', 'ABORTED', 'BYE'],
        message: '{VALUE} is not a valid match result',
      },
      default: 'PENDING',
    },
    lichessStatus: {
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

const Pairing = mongoose.model('Pairing', pairingSchema);

export default Pairing;
