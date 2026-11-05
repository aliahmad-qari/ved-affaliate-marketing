import { resolvePartnerPayoutAmount } from '../../shared/partnerPayout.ts';

export interface PartnerPayoutSettings {
  defaultPayout?: number;
  campaignOverrides?: Array<{ campaignId: string; payout: number }>;
}

export interface PayoutCampaign {
  _id?: unknown;
  campaignId?: string;
  payout?: number | null;
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
