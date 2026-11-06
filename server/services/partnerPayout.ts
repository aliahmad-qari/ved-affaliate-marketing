import { resolvePartnerPayoutAmount } from '../../shared/partnerPayout.ts';
import { isEligiblePercentageCampaign, resolvePayoutRate, type PercentagePayoutCampaign, type PercentageRateSettings } from './percentagePayout.ts';

export interface PartnerPayoutSettings {
  defaultPayout?: number;
  campaignOverrides?: Array<{ campaignId: string; payout: number }>;
  defaultPayoutPercentage?: number;
  campaignPercentageOverrides?: Array<{ campaignId: string; percentage: number }>;
}

export interface PayoutCampaign {
  _id?: unknown;
  campaignId?: string;
  payout?: number | null;
  payoutType?: 'FIXED' | 'PERCENTAGE';
  payoutBasis?: 'LOAN_DISBURSED_AMOUNT' | 'INSURANCE_ELIGIBLE_PREMIUM';
  payoutPercentage?: number | null;
  campaignType?: string;
  payoutTerms?: string;
  terms?: { eligibility?: string; validationRejection?: string; payoutTimeline?: string; duplicateFraudRules?: string };
}

export function isValidPayoutAmount(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

/**
 * Partner campaign override > partner-wide override > campaign default.
 * The result is a snapshot input for a new click/lead; historical snapshots
 * are deliberately never recalculated from these current settings.
 */
export function resolvePartnerPayout(campaign: PayoutCampaign, settings?: PartnerPayoutSettings | null): number {
  const campaignId = campaign._id == null ? campaign.campaignId : String(campaign._id);
  return resolvePartnerPayoutAmount(campaignId || '', campaign.payout, settings);
}

export function resolvePayoutSnapshot(campaign: PayoutCampaign, settings?: PartnerPayoutSettings | null) {
  if (campaign.payoutType !== 'PERCENTAGE') {
    return { payoutSnapshot: resolvePartnerPayout(campaign, settings), payoutTypeSnapshot: 'FIXED' as const };
  }
  const eligible = isEligiblePercentageCampaign(campaign as PercentagePayoutCampaign);
  const rate = eligible ? resolvePayoutRate(campaign as PercentagePayoutCampaign, settings as PercentageRateSettings) : null;
  const campaignTerms = campaign.terms || {};
  return {
    payoutSnapshot: 0,
    payoutTypeSnapshot: 'PERCENTAGE' as const,
    ...(campaign.payoutBasis ? { payoutBasisSnapshot: campaign.payoutBasis } : {}),
    payoutRateSnapshot: rate,
    payoutTermsSnapshot: typeof campaign.payoutTerms === 'string' ? campaign.payoutTerms.trim().slice(0, 2000) : '',
    payoutEligibilitySnapshot: {
      eligibility: String(campaignTerms.eligibility || '').trim().slice(0, 2000),
      validationRejection: String(campaignTerms.validationRejection || '').trim().slice(0, 2000),
      payoutTimeline: String(campaignTerms.payoutTimeline || '').trim().slice(0, 2000),
      duplicateFraudRules: String(campaignTerms.duplicateFraudRules || '').trim().slice(0, 2000),
    },
  };
}
