import mongoose, { Schema, Document } from 'mongoose';
import { IWalletTransaction } from '../types/index.ts';

export interface WalletTransactionDocument extends IWalletTransaction, Document {}

const WalletTransactionSchema: Schema = new Schema(
  {
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
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
    type: {
      type: String,
      enum: ['LEAD_EARNING', 'REFERRAL_REWARD', 'WITHDRAWAL', 'ADJUSTMENT'],
      required: [true, 'Transaction type is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'AVAILABLE', 'PROCESSED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    referenceType: {
      type: String,
      enum: ['LEAD', 'REFERRAL', 'WITHDRAWAL_REQUEST', 'ADMIN'],
      required: [true, 'Reference type is required'],
    },
    referenceId: {
      type: String,
      required: [true, 'Reference ID is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'BANK_TRANSFER'],
    },
    payoutDestination: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret: Record<string, any>) {
        delete ret.__v;
        delete ret.payoutDestination;
        return ret;
      },
    },
  }
);

WalletTransactionSchema.index({ partnerId: 1, createdAt: -1 });

export const WalletTransaction =
  mongoose.models.WalletTransaction ||
  mongoose.model<WalletTransactionDocument>('WalletTransaction', WalletTransactionSchema);
