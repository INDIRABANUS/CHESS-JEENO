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
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

export default User;
