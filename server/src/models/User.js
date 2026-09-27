import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: {
        values: ['google', 'lichess', 'local'],
        message: '{VALUE} is not a valid auth provider',
      },
      required: [true, 'Auth provider is required'],
    },
    googleId: {
      type: String,
      sparse: true,
      default: null,
    },
    lichessUsername: {
      type: String,
      sparse: true,
      trim: true,
      index: true,
      default: null,
    },
    lichessUserId: {
      type: String,
      sparse: true,
      trim: true,
      index: true,
      default: null,
    },
    passwordHash: {
      type: String,
      select: false,
      default: null,
    },
    lichessOAuth: {
      accessToken: {
        type: String,
        select: false,
        default: null,
      },
      refreshToken: {
        type: String,
        select: false,
        default: null,
      },
      expiresAt: {
        type: Date,
        select: false,
        default: null,
      },
      tokenType: {
        type: String,
        select: false,
        default: null,
      },
      scope: {
        type: String,
        select: false,
        default: null,
      },
      connectedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Ensure sensitive credentials are never leaked in JSON outputs
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    if (ret.lichessOAuth) {
      delete ret.lichessOAuth.accessToken;
      delete ret.lichessOAuth.refreshToken;
      delete ret.lichessOAuth.expiresAt;
      delete ret.lichessOAuth.tokenType;
      delete ret.lichessOAuth.scope;
    }
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

export default User;
