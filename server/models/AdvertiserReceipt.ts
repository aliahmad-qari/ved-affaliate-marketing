import mongoose, { Document, Schema } from 'mongoose';

export interface AdvertiserReceiptDocument extends Document {
  leadId: string;
  campaignId: string;
  referenceKey: string;
  paymentReference: string;
  evidenceReference: string;
  details: string;
  partnerCommissionAmount: number;
  confirmedBy: string;
  confirmedAt: Date;
}

const AdvertiserReceiptSchema = new Schema<AdvertiserReceiptDocument>({
  leadId: { type: String, required: true },
  campaignId: { type: String, required: true },
  referenceKey: { type: String, required: true, select: false },
  paymentReference: { type: String, required: true, trim: true, maxlength: 160 },
  evidenceReference: { type: String, required: true, trim: true, maxlength: 500 },
  details: { type: String, required: true, trim: true, maxlength: 2000 },
  partnerCommissionAmount: { type: Number, required: true, min: 0 },
  confirmedBy: { type: String, required: true },
  confirmedAt: { type: Date, required: true },
}, { timestamps: true, autoIndex: false, autoCreate: false });

AdvertiserReceiptSchema.index({ leadId: 1 }, { unique: true, name: 'advertiser_receipt_unique_lead' });
AdvertiserReceiptSchema.index({ referenceKey: 1 }, { unique: true, name: 'advertiser_receipt_unique_reference' });

export const AdvertiserReceipt = mongoose.models.AdvertiserReceipt
  || mongoose.model<AdvertiserReceiptDocument>('AdvertiserReceipt', AdvertiserReceiptSchema);
