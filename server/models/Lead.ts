import mongoose, { Schema, Document } from 'mongoose';
import { ILead } from '../types/index.ts';

export interface LeadDocument extends ILead, Document {}

const LeadSchema: Schema = new Schema(
  {
    leadId: {
      type: String,
      required: [true, 'Lead ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    partnerId: {
      type: String,
      required: [true, 'Partner ID is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    campaignId: {
      type: String,
      required: [true, 'Campaign ID is required'],
      trim: true,
      index: true,
    },
    campaignName: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
    },
    campaignType: {
      type: String,
      trim: true,
    },
    clientName: {
      type: String,
      default: '',
      trim: true,
    },
    clientMobile: {
      type: String,
      default: '',
      trim: true,
    },
    accountId: {
      type: String,
      required: [true, 'Account/Reference ID is required'],
      trim: true,
    },
    vendorClickId: { type: String, default: '', index: true },
    vendorConversionKey: { type: String, unique: true, sparse: true },
    action: {
      type: String,
      required: [true, 'Campaign action is required'],
      trim: true,
    },
    submittedData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED', 'PAID'],
      default: 'PENDING',
      index: true,
    },
    payoutSnapshot: {
      type: Number,
      required: [true, 'Payout snapshot is required'],
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    verifiedAt: {
      type: Date,
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    reviewedBy: {
      type: String,
      default: '',
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret: Record<string, any>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Prevent duplicate submission of the same account/reference ID for the same campaign by the same partner
LeadSchema.index({ partnerId: 1, campaignId: 1, accountId: 1 }, { unique: true });

export const Lead = mongoose.models.Lead || mongoose.model<LeadDocument>('Lead', LeadSchema);
