import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType = 'NEW_CAMPAIGN' | 'CAMPAIGN_RATE_CHANGE' | 'LEAD_UPDATE' | 'PAYMENT_UPDATE' | 'WITHDRAWAL_UPDATE' | 'ANNOUNCEMENT' | 'ACCOUNT_UPDATE';

export interface NotificationDocument extends Document {
  partnerId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
  dedupeKey?: string;
  readAt?: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    partnerId: { type: String, required: true, index: true },
    type: { type: String, enum: ['NEW_CAMPAIGN', 'CAMPAIGN_RATE_CHANGE', 'LEAD_UPDATE', 'PAYMENT_UPDATE', 'WITHDRAWAL_UPDATE', 'ANNOUNCEMENT', 'ACCOUNT_UPDATE'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    referenceType: { type: String, default: '' },
    referenceId: { type: String, default: '' },
    dedupeKey: { type: String, sparse: true, unique: true },
    readAt: { type: Date },
  },
  { timestamps: true },
);

NotificationSchema.index({ partnerId: 1, createdAt: -1 });
export const Notification = mongoose.models.Notification || mongoose.model<NotificationDocument>('Notification', NotificationSchema);