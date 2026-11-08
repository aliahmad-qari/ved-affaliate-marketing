import mongoose, { Schema } from 'mongoose';

// Collection/index creation and historical coverage are owned by a separately
// approved migration. Normal API startup must never create either implicitly.
const schema = new Schema({
  canonicalCampaignId: { type: String, required: true },
  normalizedMobile: { type: String, required: true, match: /^[6-9]\d{9}$/, select: false },
  leadId: { type: String },
  partnerId: { type: String, select: false },
  state: { type: String, enum: ['CLAIMED', 'HISTORICAL_CONFLICT'], required: true },
  historicalCount: { type: Number, default: 1 },
}, { timestamps: true, autoIndex: false, autoCreate: false });
schema.index({ canonicalCampaignId: 1, normalizedMobile: 1 }, { unique: true, name: 'unique_campaign_mobile' });

export const CampaignMobileClaim = mongoose.models.CampaignMobileClaim
  || mongoose.model('CampaignMobileClaim', schema);
