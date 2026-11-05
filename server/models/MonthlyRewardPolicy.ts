import mongoose, { Document, Schema } from 'mongoose';

export interface MonthlyRewardRule {
  rewardType: string;
  label: string;
  minimumApprovedConversions: number;
  amount: number;
}

export interface MonthlyRewardPolicyDocument extends Document<string> {
  _id: string;
  rules: MonthlyRewardRule[];
  clientApprovalReference?: string;
  clientApprovedAt?: Date;
  clientApprovedBy?: string;
}

const MonthlyRewardPolicySchema = new Schema<MonthlyRewardPolicyDocument>({
  _id: { type: String, required: true },
  rules: { type: [Schema.Types.Mixed] as any, default: [] },
  clientApprovalReference: { type: String, trim: true, maxlength: 120, default: '' },
  clientApprovedAt: { type: Date },
  clientApprovedBy: { type: String, default: '' },
}, { timestamps: true, versionKey: false });

export const MonthlyRewardPolicy = mongoose.models.MonthlyRewardPolicy
  || mongoose.model<MonthlyRewardPolicyDocument>('MonthlyRewardPolicy', MonthlyRewardPolicySchema);
