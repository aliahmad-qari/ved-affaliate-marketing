import mongoose, { Document, Schema } from 'mongoose';

export interface AnnouncementDocument extends Document {
  title: string;
  message: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  startsAt?: Date;
  endsAt?: Date;
  createdBy: string;
}

const AnnouncementSchema = new Schema<AnnouncementDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT', index: true },
    startsAt: { type: Date },
    endsAt: { type: Date },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

export const Announcement = mongoose.models.Announcement || mongoose.model<AnnouncementDocument>('Announcement', AnnouncementSchema);