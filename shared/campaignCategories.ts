export const DEFAULT_CAMPAIGN_CATEGORIES = ['Demat & Trading', 'Mutual Funds', 'Insurance', 'Loans', 'Banking', 'UPI & Credit'] as const;
export const LEGACY_CAMPAIGN_CATEGORIES = ['Banking & Credit', 'Fintech & Wallets'] as const;
export const DEFAULT_TICKER_MESSAGE = 'Explore financial campaigns. Submit eligible leads and grow with VED Affiliate.';

export function campaignCategories(extra: unknown): string[] {
  const custom = Array.isArray(extra) ? extra.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map(value => value.trim()) : [];
  const seen = new Set<string>();
  return [...DEFAULT_CAMPAIGN_CATEGORIES, ...custom].filter(value => { const key = value.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}
