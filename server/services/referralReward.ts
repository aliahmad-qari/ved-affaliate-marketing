import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.ts';
import { Lead } from '../models/Lead.ts';
import { Partner } from '../models/Partner.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import {
  evaluateReferralReward,
  REFERRAL_REWARD_AMOUNT_INR,
  REFERRAL_REWARD_REQUIRED_LEADS,
  referralRewardIdempotencyKey,
} from '../../shared/referralReward.ts';

export function adminApprovedReferralLeadCriteria() {
  return {
    status: { $in: ['APPROVED', 'PAID'] },
    reviewedBy: { $type: 'string', $nin: ['', 'VENDOR_WEBHOOK', 'SYSTEM'] },
    rejectionReasonCode: { $nin: ['NO_LEAD_FOUND', 'DUPLICATE_LEAD', 'OTHER'] },
    approvalReversal: { $exists: false },
  };
}

export function adminApprovedReferralLeadFilter(partnerId: string) {
  return { ...adminApprovedReferralLeadCriteria(), partnerId: partnerId.trim().toUpperCase() };
}

export function isAdminApprovedReferralLead(lead: any): boolean {
  return ['APPROVED', 'PAID'].includes(String(lead?.status || '').toUpperCase())
    && typeof lead?.reviewedBy === 'string'
    && Boolean(lead.reviewedBy.trim())
    && !['VENDOR_WEBHOOK', 'SYSTEM'].includes(lead.reviewedBy.trim().toUpperCase())
    && !['NO_LEAD_FOUND', 'DUPLICATE_LEAD', 'OTHER'].includes(String(lead?.rejectionReasonCode || '').toUpperCase())
    && !lead?.approvalReversal;
}

function thresholdAuditId(referredPartnerId: string): mongoose.Types.ObjectId {
  const hash = createHash('sha256').update(`referral-reward-threshold:${referredPartnerId.toUpperCase()}`).digest('hex');
  return new mongoose.Types.ObjectId(hash.slice(0, 24));
}

/** Invoked only by the Admin lead-approval transaction. Never changes an existing referral transaction. */
export async function issueReferralRewardAtThreshold(input: {
  referredPartnerId: string;
  referrerPartnerId: string;
  approvedLeadCount: number;
  adminId: string;
  adminEmail: string;
  ipAddress?: string;
  session: mongoose.ClientSession;
}): Promise<'NOT_ELIGIBLE' | 'ISSUED' | 'PRIOR_REWARD_EXISTS' | 'REQUIRES_REVIEW'> {
  const referredPartnerId = input.referredPartnerId.trim().toUpperCase();
  const referrerPartnerId = input.referrerPartnerId.trim().toUpperCase();
  if (!referredPartnerId || !referrerPartnerId || !input.session) return 'NOT_ELIGIBLE';

  // Any historical referral transaction is treated as already rewarded. This prevents a second
  // ₹100 credit after the legacy ₹50 reward; ambiguous legacy states require manual review.
  const existingReward = await WalletTransaction.findOne({
    type: 'REFERRAL_REWARD', referenceId: referredPartnerId,
  }).session(input.session).lean().exec();
  const decision = evaluateReferralReward(input.approvedLeadCount, Boolean(existingReward));
  if (decision === 'NOT_ELIGIBLE' || decision === 'REQUIRES_REVIEW') return decision;

  let rewardIssued = false;
  let reason: string;
  if (decision === 'PRIOR_REWARD_EXISTS') {
    reason = 'PRIOR_REFERRAL_REWARD_PRESERVED';
  } else {
    const key = referralRewardIdempotencyKey(referredPartnerId);
    const result = await WalletTransaction.updateOne(
      { idempotencyKey: key },
      { $setOnInsert: {
        transactionId: `REF${createHash('sha256').update(key).digest('hex').slice(0, 18).toUpperCase()}`,
        partnerId: referrerPartnerId,
        type: 'REFERRAL_REWARD',
        amount: REFERRAL_REWARD_AMOUNT_INR,
        status: 'AVAILABLE',
        referenceType: 'REFERRAL',
        referenceId: referredPartnerId,
        description: `Referral reward after ${REFERRAL_REWARD_REQUIRED_LEADS} admin-approved leads by ${referredPartnerId}`,
        idempotencyKey: key,
        processedBy: input.adminId,
      } },
      { upsert: true, session: input.session, runValidators: true },
    );
    rewardIssued = result.upsertedCount === 1;
    reason = rewardIssued ? 'ONE_TIME_REWARD_ISSUED' : 'IDEMPOTENT_REWARD_ALREADY_EXISTS';
  }

  // Stable _id makes the eligibility audit idempotent without adding a custom database index.
  await AuditLog.updateOne(
    { _id: thresholdAuditId(referredPartnerId) },
    { $setOnInsert: {
      adminId: input.adminId,
      adminEmail: input.adminEmail,
      action: 'REFERRAL_REWARD_FIVE_LEADS_DECIDED',
      entityType: 'ReferralReward',
      entityId: referredPartnerId,
      before: { priorRewardExists: Boolean(existingReward) },
      after: {
        referrerPartnerId,
        approvedAdminLeadCount: input.approvedLeadCount,
        requiredLeadCount: REFERRAL_REWARD_REQUIRED_LEADS,
        rewardAmount: rewardIssued ? REFERRAL_REWARD_AMOUNT_INR : 0,
        rewardIssued,
        decision: reason,
      },
      ipAddress: input.ipAddress,
    } },
    { upsert: true, session: input.session },
  );
  return rewardIssued ? 'ISSUED' : 'PRIOR_REWARD_EXISTS';
}

/** Preserve an issued reward and append an Admin-review flag when its qualifying lead is reversed. */
export async function flagReferralRewardReviewAfterLeadReversal(input: {
  referredPartnerId: string;
  leadId: string;
  reason: string;
  adminId: string;
  adminEmail: string;
  ipAddress?: string;
  session: mongoose.ClientSession;
}): Promise<boolean> {
  const referredPartnerId = input.referredPartnerId.trim().toUpperCase();
  const reward: any = await WalletTransaction.findOne({
    type: 'REFERRAL_REWARD', referenceId: referredPartnerId,
  }).session(input.session).lean().exec();
  if (!reward) return false;

  await AuditLog.create([{
    adminId: input.adminId,
    adminEmail: input.adminEmail,
    action: 'REFERRAL_REWARD_REVIEW_REQUIRED_AFTER_LEAD_REVERSAL',
    entityType: 'ReferralReward',
    entityId: referredPartnerId,
    before: { transactionId: reward.transactionId, amount: reward.amount, status: reward.status },
    after: {
      referredPartnerId,
      leadId: input.leadId,
      reversalReason: input.reason,
      rewardPreserved: true,
      automaticClawback: false,
      reviewRequired: true,
    },
    ipAddress: input.ipAddress,
  }], { session: input.session });
  return true;
}

export async function countAdminApprovedReferralLeads(partnerId: string, session?: mongoose.ClientSession): Promise<number> {
  return Lead.countDocuments(adminApprovedReferralLeadFilter(partnerId)).session(session || null).exec();
}

export async function findReferrer(referredPartnerId: string, session?: mongoose.ClientSession): Promise<string> {
  const partner = await Partner.findOne({ partnerId: referredPartnerId.trim().toUpperCase() })
    .select('referredBy').session(session || null).lean().exec();
  const referrerPartnerId = String(partner?.referredBy || '').trim().toUpperCase();
  if (!referrerPartnerId) return '';
  const referrerExists = await Partner.exists({ partnerId: referrerPartnerId }).session(session || null).exec();
  return referrerExists ? referrerPartnerId : '';
}
