import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:        { type: String, required: true },
    role:            { type: String, enum: ['user','admin','moderator'], default: 'user' },
    twoFactorEnabled:  { type: Boolean, default: false },
    twoFactorSecret:   { type: String, default: null },
    pending2FASecret:  { type: String, default: null },
    recoveryCodes:     { type: [String], default: [] },
    isActive:          { type: Boolean, default: true },
    lastLoginAt:       { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);
userSchema.index({ email: 1 });
export const User = mongoose.model('User', userSchema);

const refreshTokenSchema = new mongoose.Schema(
  {
    token:              { type: String, required: true, unique: true, index: true },
    userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt:          { type: Date, required: true },
    twoFactorVerified:  { type: Boolean, default: false },
    userAgent:          { type: String, default: null },
    ip:                 { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
