import mongoose, { Schema, Document } from 'mongoose';

export interface VendorWebhookEventDocument extends Document {
  eventId: string;
  clickId: string;
  conversionId: string;
  status: string;
}

const VendorWebhookEventSchema = new Schema<VendorWebhookEventDocument>(
  {
    eventId: { type: String, required: true, unique: true, trim: true },
    clickId: { type: String, required: true, index: true },
    conversionId: { type: String, required: true, trim: true },
    status: { type: String, required: true },
  },
  { timestamps: true },
);

export const VendorWebhookEvent = mongoose.models.VendorWebhookEvent || mongoose.model<VendorWebhookEventDocument>('VendorWebhookEvent', VendorWebhookEventSchema);