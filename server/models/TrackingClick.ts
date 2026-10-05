import mongoose, { Schema, Document } from 'mongoose';

export interface TrackingClickDocument extends Document {
  clickId: string;
  partnerId: string;
  campaignId: string;
  campaignSlug: string;
  payoutSnapshot: number;
  currency: string;
  expiresAt: Date;
}

const TrackingClickSchema = new Schema<TrackingClickDocument>(
  {
    clickId: { type: String, required: true, unique: true, index: true },
    partnerId: { type: String, required: true, uppercase: true, index: true },
    campaignId: { type: String, required: true, index: true },
    campaignSlug: { type: String, required: true },
    payoutSnapshot: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export const TrackingClick = mongoose.models.TrackingClick || mongoose.model<TrackingClickDocument>('TrackingClick', TrackingClickSchema);