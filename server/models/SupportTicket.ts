import mongoose, { Schema, Document } from 'mongoose';
import { ISupportTicket } from '../types/index.ts';

export interface SupportTicketDocument extends ISupportTicket, Document {}

const SupportTicketSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Contact name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SupportTicket = mongoose.models.SupportTicket || mongoose.model<SupportTicketDocument>('SupportTicket', SupportTicketSchema);
