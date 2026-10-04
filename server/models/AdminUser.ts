import mongoose, { Document, Schema } from 'mongoose';

export interface AdminUserDocument extends Document {
  fullName: string;
  email: string;
  passwordHash: string;
  status: 'ACTIVE' | 'SUSPENDED';
  sessionsInvalidatedAt?: Date;
  lastLoginAt?: Date;
}

const AdminUserSchema = new Schema<AdminUserDocument>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE', index: true },
    sessionsInvalidatedAt: { type: Date, select: false },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.passwordHash;
        delete ret.sessionsInvalidatedAt;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const AdminUser = mongoose.models.AdminUser || mongoose.model<AdminUserDocument>('AdminUser', AdminUserSchema);