import mongoose, { Schema, Document } from 'mongoose';
import { ICampaign } from '../types/index.ts';

export interface CampaignDocument extends ICampaign, Document {}

const CampaignSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    companyName: {
      type: String,
      required: [true, 'Company / Brand name is required'],
      trim: true,
    },
    campaignType: {
      type: String,
      required: [true, 'Campaign category is required'],
      enum: ['Demat & Trading', 'Mutual Funds', 'Banking & Credit', 'Fintech & Wallets'],
      default: 'Demat & Trading',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    requiredAction: {
      type: String,
      required: [true, 'Required partner action is required'],
      trim: true,
    },
    payout: {
      type: Number,
      default: null, // Admin-configured, null by default in milestone 1
    },
    currency: {
      type: String,
      default: 'INR',
    },
    payoutTerms: {
      type: String,
      default: 'Subject to Admin manual lead verification',
    },
    rules: {
      type: [String],
      default: [],
    },
    terms: {
      eligibility: { type: String, trim: true, maxlength: 2000, default: '' },
      validationRejection: { type: String, trim: true, maxlength: 2000, default: '' },
      payoutTimeline: { type: String, trim: true, maxlength: 2000, default: '' },
      duplicateFraudRules: { type: String, trim: true, maxlength: 2000, default: '' },
    },
    status: {
      type: String,
      enum: ['LIVE', 'PAUSED', 'DRAFT', 'ENDED'],
      default: 'LIVE',
      index: true,
    },
    logoUrl: {
      type: String,
      default: '',
    },
    baseTrackingUrl: {
      type: String,
      default: '',
      select: false, // Never exposed publicly by default
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret: Record<string, any>) {
        // Strip sensitive internal fields from output
        delete ret.baseTrackingUrl;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Prevent model overwrite in development HMR / reload
export const Campaign = mongoose.models.Campaign || mongoose.model<CampaignDocument>('Campaign', CampaignSchema);
