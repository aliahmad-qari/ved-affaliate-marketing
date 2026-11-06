export const REFERRAL_REWARD_REQUIRED_LEADS = 5;
export const REFERRAL_REWARD_AMOUNT_INR = 100;

export type ReferralRewardDecision = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'PRIOR_REWARD_EXISTS' | 'REQUIRES_REVIEW';

export function evaluateReferralReward(approvedLeadCount: number, priorRewardExists: boolean): ReferralRewardDecision {
  if (!Number.isInteger(approvedLeadCount) || approvedLeadCount < REFERRAL_REWARD_REQUIRED_LEADS) return 'NOT_ELIGIBLE';
  if (approvedLeadCount > REFERRAL_REWARD_REQUIRED_LEADS) return 'REQUIRES_REVIEW';
  return priorRewardExists ? 'PRIOR_REWARD_EXISTS' : 'ELIGIBLE';
}

export function referralRewardIdempotencyKey(referredPartnerId: string): string {
  return `REFERRAL_REWARD_5_APPROVED:${referredPartnerId.trim().toUpperCase()}`;
}
