import mongoose, { Document, Schema } from 'mongoose';

export interface AuditLogDocument extends Document {
  adminId: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    adminId: { type: String, required: true, index: true },
    adminEmail: { type: String, required: true },
    action: { type: String, required: true, maxlength: 100 },
    entityType: { type: String, required: true, maxlength: 80 },
    entityId: { type: String, required: true, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ipAddress: { type: String, maxlength: 80 },
  },
  { timestamps: true },
);

AuditLogSchema.index({ createdAt: -1 });
export const AuditLog = mongoose.models.AuditLog || mongoose.model<AuditLogDocument>('AuditLog', AuditLogSchema);