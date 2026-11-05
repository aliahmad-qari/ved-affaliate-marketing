export interface PartnerPayoutConfig {
  defaultPayout?: number;
  campaignOverrides?: Array<{ campaignId: string; payout: number }>;
}

export function resolvePartnerPayoutAmount(campaignId: string, campaignPayout: number | null | undefined, settings?: PartnerPayoutConfig | null): number {
  const campaignOverride = settings?.campaignOverrides?.find(item => item.campaignId === campaignId);
  if (campaignOverride && Number.isFinite(campaignOverride.payout) && campaignOverride.payout >= 0) return campaignOverride.payout;
  if (settings?.defaultPayout !== undefined && Number.isFinite(settings.defaultPayout) && settings.defaultPayout >= 0) return settings.defaultPayout;
  const base = Number(campaignPayout);
  return Number.isFinite(base) && base >= 0 ? base : 0;
}
