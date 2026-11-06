export type PayoutType = 'FIXED' | 'PERCENTAGE';
export type PercentagePayoutBasis = 'LOAN_DISBURSED_AMOUNT' | 'INSURANCE_ELIGIBLE_PREMIUM';

export interface PercentageRateSettings {
  defaultPayoutPercentage?: number;
  campaignPercentageOverrides?: Array<{ campaignId: string; percentage: number }>;
}

export interface PercentagePayoutCampaign {
  _id?: unknown;
  campaignId?: string;
  campaignType?: string;
  payoutType?: PayoutType;
  payoutBasis?: PercentagePayoutBasis;
  payoutPercentage?: number | null;
  payout?: number | null;
}

export function isEligiblePercentageCampaign(campaign: PercentagePayoutCampaign): boolean {
  const category = String(campaign.campaignType || '').trim().toLowerCase();
  if (campaign.payoutBasis === 'LOAN_DISBURSED_AMOUNT') return category.includes('loan');
  if (campaign.payoutBasis === 'INSURANCE_ELIGIBLE_PREMIUM') return category.includes('insurance');
  return false;
}

export function isValidPercentageRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100
    && Math.abs(value * 10_000 - Math.round(value * 10_000)) < 1e-6;
}

/** Partner campaign percentage > partner default percentage > campaign percentage. */
export function resolvePayoutRate(campaign: PercentagePayoutCampaign, settings?: PercentageRateSettings | null): number | null {
  if (campaign.payoutType === 'PERCENTAGE' && !isEligiblePercentageCampaign(campaign)) return null;
  const id = campaign._id == null ? campaign.campaignId : String(campaign._id);
  const override = settings?.campaignPercentageOverrides?.find((row) => row.campaignId === id);
  const rate = override?.percentage ?? settings?.defaultPayoutPercentage ?? campaign.payoutPercentage;
  return isValidPercentageRate(rate) ? rate : null;
}

/** Round half-up to the nearest paisa using integer rate units (1/10,000 percentage point). */
export function calculatePercentagePayout(baseAmount: number, percentage: number): number {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0 || !isValidPercentageRate(percentage)) {
    throw new Error('A verified positive amount and valid percentage rate are required.');
  }
  const basePaise = Math.round(baseAmount * 100);
  const rateUnits = Math.round(percentage * 10_000);
  if (!Number.isSafeInteger(basePaise) || !Number.isSafeInteger(rateUnits)) throw new Error('The payout calculation exceeds supported precision.');
  const payoutPaise = (BigInt(basePaise) * BigInt(rateUnits) + 500_000n) / 1_000_000n;
  if (payoutPaise > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('The payout calculation exceeds supported precision.');
  return Number(payoutPaise) / 100;
}

export function payoutBasisLabel(basis: PercentagePayoutBasis): string {
  return basis === 'LOAN_DISBURSED_AMOUNT' ? 'verified disbursed loan amount' : 'verified eligible insurance premium';
}
