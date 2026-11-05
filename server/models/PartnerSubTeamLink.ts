import mongoose, { Document, Schema } from 'mongoose';

export interface PartnerSubTeamLinkDocument extends Document {
  partnerId: string;
  campaignId: string;
  campaignSlug: string;
  name: string;
  trackingId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  clickCount: number;
}

const PartnerSubTeamLinkSchema = new Schema<PartnerSubTeamLinkDocument>({
  partnerId: { type: String, required: true, uppercase: true, trim: true },
  campaignId: { type: String, required: true, trim: true },
  campaignSlug: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  trackingId: { type: String, required: true, immutable: true },
  status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE', required: true },
  clickCount: { type: Number, default: 0, min: 0, required: true },
}, { timestamps: true });

PartnerSubTeamLinkSchema.index({ trackingId: 1 }, { unique: true, name: 'partner_subteam_tracking_id_unique' });
PartnerSubTeamLinkSchema.index({ partnerId: 1, createdAt: -1 }, { name: 'partner_subteam_owner_created' });
PartnerSubTeamLinkSchema.index({ campaignId: 1, status: 1 }, { name: 'partner_subteam_campaign_status' });

export const PartnerSubTeamLink = mongoose.models.PartnerSubTeamLink
  || mongoose.model<PartnerSubTeamLinkDocument>('PartnerSubTeamLink', PartnerSubTeamLinkSchema);
