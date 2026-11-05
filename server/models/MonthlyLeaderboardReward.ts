import mongoose, { Document, Schema } from 'mongoose';
import { MonthlyRewardPaymentStatus } from '../../shared/monthlyLeaderboard.ts';

export interface MonthlyLeaderboardRewardDocument extends Document<string> {
  _id: string;
  monthKey: string;
  partnerId: string;
  rewardType: string;
  label: string;
  amount: number;
  currency: string;
  minimumApprovedConversions: number;
  approvedConversionsAtGeneration: number;
  paymentStatus: MonthlyRewardPaymentStatus;
  approvedBy?: string;
  approvedAt?: Date;
  paymentReference?: string;
  paidBy?: string;
  paidAt?: Date;
}

const MonthlyLeaderboardRewardSchema = new Schema<MonthlyLeaderboardRewardDocument>({
  _id: { type: String, required: true },
  monthKey: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  partnerId: { type: String, required: true, uppercase: true, trim: true },
  rewardType: { type: String, required: true, uppercase: true, trim: true, maxlength: 40 },
  label: { type: String, required: true, trim: true, maxlength: 80 },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, default: 'INR', immutable: true },
  minimumApprovedConversions: { type: Number, required: true, min: 1 },
  approvedConversionsAtGeneration: { type: Number, required: true, min: 0 },
  paymentStatus: { type: String, enum: ['PENDING', 'PROCESSING', 'PAID'], default: 'PENDING', required: true },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date },
  paymentReference: { type: String, trim: true, maxlength: 160, default: '' },
  paidBy: { type: String, default: '' },
  paidAt: { type: Date },
}, { timestamps: true, versionKey: false });

export const MonthlyLeaderboardReward = mongoose.models.MonthlyLeaderboardReward
  || mongoose.model<MonthlyLeaderboardRewardDocument>('MonthlyLeaderboardReward', MonthlyLeaderboardRewardSchema);
