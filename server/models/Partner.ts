import mongoose, { Schema, Document } from 'mongoose';
import { IPartner } from '../types/index.ts';

export interface PartnerDocument extends IPartner, Document {}

// Helper to mask PAN: e.g. ABCDE1234F -> ABCDE****F
export function maskPan(pan: string): string {
  if (!pan || pan.length < 10) return '**********';
  return `${pan.substring(0, 5)}****${pan.substring(9)}`;
}

// Helper to mask Bank Account: e.g. 123456789012 -> ********9012
export function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 4) return '****';
  const visible = acc.slice(-4);
  return `${'*'.repeat(Math.max(4, acc.length - 4))}${visible}`;
}

const BankDetailsSchema = new Schema(
  {
    accountHolderName: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
    },
    accountNumber: {
      type: String,
      required: [true, 'Bank account number is required'],
      trim: true,
    },
    ifscCode: {
      type: String,
      required: [true, 'Bank IFSC code is required'],
      uppercase: true,
      trim: true,
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
    },
  },
  { _id: false }
);

const PartnerSchema: Schema = new Schema(
  {
    partnerId: {
      type: String,
      required: [true, 'Partner ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    pan: {
      type: String,
      required: [true, 'PAN is required'],
      uppercase: true,
      trim: true,
    },
    bankDetails: {
      type: BankDetailsSchema,
      required: [true, 'Bank details are required'],
    },
    upiId: {
      type: String,
      required: [true, 'UPI ID is required'],
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      enum: ['PARTNER', 'ADMIN'],
      default: 'PARTNER',
      index: true,
    },
    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'],
      default: 'ACTIVE',
      index: true,
    },
    kycStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    kycRejectionReason: {
      type: String,
      default: '',
    },
    referralCode: {
      type: String,
      required: [true, 'Referral code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    referredBy: {
      type: String,
      default: '',
      trim: true,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    sessionsInvalidatedAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret: Record<string, any>) {
        // Strip sensitive internal & authentication secrets
        delete ret.passwordHash;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.sessionsInvalidatedAt;
        delete ret.__v;

        // Mask sensitive financial identifiers for privacy
        if (ret.pan) {
          ret.maskedPan = maskPan(ret.pan);
          delete ret.pan;
        }
        if (ret.bankDetails && ret.bankDetails.accountNumber) {
          ret.bankDetails.maskedAccountNumber = maskAccountNumber(ret.bankDetails.accountNumber);
          delete ret.bankDetails.accountNumber;
        }

        return ret;
      },
    },
  }
);

export const Partner = mongoose.models.Partner || mongoose.model<PartnerDocument>('Partner', PartnerSchema);
