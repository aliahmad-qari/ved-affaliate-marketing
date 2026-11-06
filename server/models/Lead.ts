import mongoose, { Schema, Document } from 'mongoose';
import { ILead } from '../types/index.ts';

export interface LeadDocument extends ILead, Document {}

const LeadSchema: Schema = new Schema(
  {
    leadId: {
      type: String,
      required: [true, 'Lead ID is required'],
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
    campaignId: {
      type: String,
      required: [true, 'Campaign ID is required'],
      trim: true,
      index: true,
    },
    campaignName: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
    },
    campaignType: {
      type: String,
      trim: true,
    },
    clientName: {
      type: String,
      default: '',
      trim: true,
    },
    clientMobile: {
      type: String,
      default: '',
      trim: true,
    },
    accountId: {
      type: String,
      required: [true, 'Account/Reference ID is required'],
      trim: true,
    },
    vendorClickId: { type: String, default: '', index: true },
    subTeamLinkId: { type: String, trim: true },
    vendorConversionKey: { type: String, unique: true, sparse: true },
    action: {
      type: String,
      required: [true, 'Campaign action is required'],
      trim: true,
    },
    submittedData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED', 'PAID'],
      default: 'PENDING',
      index: true,
    },
    payoutSnapshot: {
      type: Number,
      required: [true, 'Payout snapshot is required'],
      min: 0,
    },
    payoutTypeSnapshot: { type: String, enum: ['FIXED', 'PERCENTAGE'], default: 'FIXED' },
    payoutBasisSnapshot: { type: String, enum: ['LOAN_DISBURSED_AMOUNT', 'INSURANCE_ELIGIBLE_PREMIUM'] },
    payoutRateSnapshot: { type: Number, min: 0, max: 100 },
    payoutTermsSnapshot: { type: String, trim: true, maxlength: 2000 },
    payoutEligibilitySnapshot: { type: Schema.Types.Mixed, default: {} },
    payoutCommission: {
      type: new Schema({
        state: { type: String, enum: ['AWAITING_REVIEW', 'REPORT_REJECTED', 'PENDING', 'AVAILABLE', 'REVERSED'], required: true },
        source: { type: String, enum: ['APPROVED_MIS'] },
        reportedBaseAmount: { type: Number, min: 0 },
        verifiedBaseAmount: { type: Number, min: 0 },
        calculatedAmount: { type: Number, min: 0 },
        advertiserReference: { type: String, trim: true, maxlength: 160 },
        advertiserName: { type: String, trim: true, maxlength: 160 },
        reportReference: { type: String, trim: true, maxlength: 160 },
        reportDate: { type: Date },
        reportKey: { type: String, select: false },
        earningIdempotencyKey: { type: String, select: false },
        eventKeys: { type: [String], select: false },
        evidenceReference: { type: String, trim: true, maxlength: 500 },
        verificationDetails: { type: String, trim: true, maxlength: 2000 },
        enteredBy: String,
        enteredAt: Date,
        verifiedBy: String,
        verifiedAt: Date,
        receiptReference: { type: String, trim: true, maxlength: 160 },
        receiptEvidenceReference: { type: String, trim: true, maxlength: 500 },
        receiptDetails: { type: String, trim: true, maxlength: 2000 },
        receiptConfirmedBy: String,
        receiptConfirmedAt: Date,
        receiptKey: { type: String, select: false },
        history: [{
          action: { type: String, required: true },
          adminId: { type: String, required: true },
          at: { type: Date, required: true },
          reason: { type: String, trim: true, maxlength: 1000 },
          snapshot: { type: Schema.Types.Mixed },
          reportKey: { type: String },
        }],
      }, { _id: false }),
      default: undefined,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    rejectionReasonCode: { type: String, enum: ['NO_LEAD_FOUND', 'DUPLICATE_LEAD', 'OTHER'] },
    approvalReversal: {
      type: new Schema({ transactionId: String, amount: Number, reason: String, adminId: String, at: Date }, { _id: false }),
      default: undefined,
    },
    verifiedAt: {
      type: Date,
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    reviewedBy: {
      type: String,
      default: '',
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
  },
  {
    timestamps: true,
    // Financial idempotency indexes are prepared through an explicit release step.
    // Never let a routine API startup create them implicitly.
    autoIndex: false,
    autoCreate: false,
    toJSON: {
      transform: function (_doc, ret: Record<string, any>) {
        delete ret.__v;
        if (ret.payoutCommission) {
          const commission = ret.payoutCommission;
          ret.commissionSummary = {
            state: commission.state,
            verifiedBaseAmount: commission.verifiedBaseAmount,
            calculatedAmount: commission.calculatedAmount,
            receiptConfirmed: Boolean(commission.receiptConfirmedAt),
          };
          delete ret.payoutCommission;
        }
        return ret;
      },
    },
  }
);

// Prevent duplicate submission of the same account/reference ID for the same campaign by the same partner
LeadSchema.index({ partnerId: 1, campaignId: 1, accountId: 1 }, { unique: true });
LeadSchema.index({ status: 1, rejectedAt: 1, createdAt: -1 });
LeadSchema.index({ subTeamLinkId: 1, status: 1, createdAt: -1 }, { name: 'lead_subteam_status_created' });
LeadSchema.index({ 'payoutCommission.eventKeys': 1 }, { unique: true, sparse: true, name: 'unique_percentage_payout_event_keys' });

export const Lead = mongoose.models.Lead || mongoose.model<LeadDocument>('Lead', LeadSchema);
