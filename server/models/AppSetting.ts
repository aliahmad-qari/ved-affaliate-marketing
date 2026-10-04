import mongoose, { Document, Schema } from 'mongoose';

export interface AppSettingDocument extends Document {
  key: string;
  minimumWithdrawalAmount: number;
  updatedBy?: string;
}

const AppSettingSchema = new Schema<AppSettingDocument>(
  {
    key: { type: String, required: true, unique: true, default: 'business' },
    minimumWithdrawalAmount: { type: Number, required: true, min: 200, default: 200 },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true },
);

export const AppSetting = mongoose.models.AppSetting || mongoose.model<AppSettingDocument>('AppSetting', AppSettingSchema);