import mongoose, { Schema } from 'mongoose';

export interface PartnerSignupChallengeDocument {
  _id: string;
  email: string;
  fullName: string;
  mobile: string;
  city: string;
  state: string;
  passwordHash: string;
  referralCodeInput?: string;
  encryptedKyc?: string;
  otpHash: string;
  expiresAt: Date;
  purgeAt: Date;
  lastSentAt: Date;
  sendWindowStartedAt: Date;
  sendsInWindow: number;
  attempts: number;
  verifiedAt?: Date;
  completedAt?: Date;
}

const PartnerSignupChallengeSchema = new Schema({
  _id: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  fullName: { type: String, required: true },
  mobile: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false },
  referralCodeInput: { type: String, default: '' },
  encryptedKyc: { type: String, select: false },
  otpHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  purgeAt: { type: Date, required: true },
  lastSentAt: { type: Date, required: true },
  sendWindowStartedAt: { type: Date, required: true },
  sendsInWindow: { type: Number, required: true, default: 1 },
  attempts: { type: Number, required: true, default: 0 },
  verifiedAt: { type: Date },
  completedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'partnerSignupChallenges',
  autoIndex: false,
  strict: true,
  toJSON: { transform: (_doc, ret: Record<string, any>) => {
    for (const field of ['_id', 'email', 'fullName', 'mobile', 'city', 'state', 'passwordHash', 'referralCodeInput', 'encryptedKyc', 'otpHash', 'expiresAt', 'purgeAt', 'lastSentAt', 'sendWindowStartedAt', 'sendsInWindow', 'attempts', 'verifiedAt', 'completedAt', 'createdAt', 'updatedAt', '__v']) delete ret[field];
    return ret;
  } },
});

// This index is declared for an explicit, reviewed deployment preparation step.
// autoIndex is disabled so importing the application cannot create it silently.
PartnerSignupChallengeSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0, name: 'partner_signup_challenge_purge' });

export const PartnerSignupChallenge = mongoose.models.PartnerSignupChallenge
  || mongoose.model('PartnerSignupChallenge', PartnerSignupChallengeSchema);
