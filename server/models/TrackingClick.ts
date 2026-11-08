import mongoose, { Schema, Document } from 'mongoose';

export interface TrackingClickDocument extends Document {
  clickId: string;
  partnerId: string;
  campaignId: string;
  campaignSlug: string;
  campaignNameSnapshot?: string;
  referralCodeSnapshot?: string;
  trackingLink?: string;
  subTeamTrackingId?: string;
  clickedAt?: Date;
  subTeamLinkId?: string;
  payoutSnapshot: number;
  payoutTypeSnapshot?: 'FIXED' | 'PERCENTAGE';
  payoutBasisSnapshot?: 'LOAN_DISBURSED_AMOUNT' | 'INSURANCE_ELIGIBLE_PREMIUM';
  payoutRateSnapshot?: number | null;
  payoutTermsSnapshot?: string;
  payoutEligibilitySnapshot?: Record<string, string>;
  currency: string;
  expiresAt: Date;
}

const TrackingClickSchema = new Schema<TrackingClickDocument>(
  {
    clickId: { type: String, required: true, unique: true, index: true },
    partnerId: { type: String, required: true, uppercase: true, index: true },
    campaignId: { type: String, required: true, index: true },
    campaignSlug: { type: String, required: true },
    campaignNameSnapshot: { type: String, trim: true, maxlength: 200 },
    referralCodeSnapshot: { type: String, trim: true },
    trackingLink: { type: String, maxlength: 2048 },
    subTeamTrackingId: { type: String, trim: true, maxlength: 120 },
    clickedAt: { type: Date, default: Date.now },
    subTeamLinkId: { type: String, trim: true },
    payoutSnapshot: { type: Number, required: true, min: 0 },
    payoutTypeSnapshot: { type: String, enum: ['FIXED', 'PERCENTAGE'], default: 'FIXED' },
    payoutBasisSnapshot: { type: String, enum: ['LOAN_DISBURSED_AMOUNT', 'INSURANCE_ELIGIBLE_PREMIUM'] },
    payoutRateSnapshot: { type: Number, min: 0, max: 100 },
    payoutTermsSnapshot: { type: String, trim: true, maxlength: 2000 },
    payoutEligibilitySnapshot: { type: Schema.Types.Mixed, default: {} },
    currency: { type: String, required: true, default: 'INR' },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export const TrackingClick = mongoose.models.TrackingClick || mongoose.model<TrackingClickDocument>('TrackingClick', TrackingClickSchema);
