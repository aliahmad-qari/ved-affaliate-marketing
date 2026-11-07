export type IndexKey = Record<string, 1 | -1>;

export interface RequiredIndex {
  collection: string;
  name: string;
  key: IndexKey;
  options: {
    unique?: boolean;
    sparse?: boolean;
    expireAfterSeconds?: number;
  };
}

export const PRODUCTION_DATABASE = 'VedAffiliatemarket';

export const REQUIRED_COLLECTIONS = [
  'advertiserreceipts',
  'monthlyleaderboardrewards',
  'monthlyrewardpolicies',
  'partnerSignupChallenges',
  'partnersubteamlinks',
] as const;

export const REQUIRED_INDEXES: readonly RequiredIndex[] = [
  { collection: 'leads', name: 'lead_subteam_status_created', key: { subTeamLinkId: 1, status: 1, createdAt: -1 }, options: {} },
  { collection: 'leads', name: 'unique_percentage_payout_event_keys', key: { 'payoutCommission.eventKeys': 1 }, options: { unique: true, sparse: true } },
  { collection: 'partnerSignupChallenges', name: 'partner_signup_challenge_purge', key: { purgeAt: 1 }, options: { expireAfterSeconds: 0 } },
  { collection: 'partnersubteamlinks', name: 'partner_subteam_tracking_id_unique', key: { trackingId: 1 }, options: { unique: true } },
  { collection: 'partnersubteamlinks', name: 'partner_subteam_owner_created', key: { partnerId: 1, createdAt: -1 }, options: {} },
  { collection: 'partnersubteamlinks', name: 'partner_subteam_campaign_status', key: { campaignId: 1, status: 1 }, options: {} },
  { collection: 'advertiserreceipts', name: 'advertiser_receipt_unique_lead', key: { leadId: 1 }, options: { unique: true } },
  { collection: 'advertiserreceipts', name: 'advertiser_receipt_unique_reference', key: { referenceKey: 1 }, options: { unique: true } },
];

export interface ExistingIndex {
  name: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: unknown;
  collation?: unknown;
  hidden?: boolean;
}

function sameKey(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return leftEntries.length === rightEntries.length && leftEntries.every(([field, value], i) => {
    const other = rightEntries[i];
    return other?.[0] === field && other[1] === value;
  });
}

export function compareIndex(expected: RequiredIndex, existing: readonly ExistingIndex[]): 'present' | 'missing' {
  const byName = existing.find((index) => index.name === expected.name);
  if (byName) {
    const optionsMatch = (byName.unique === true) === (expected.options.unique === true)
      && (byName.sparse === true) === (expected.options.sparse === true)
      && byName.expireAfterSeconds === expected.options.expireAfterSeconds
      && byName.partialFilterExpression === undefined
      && byName.collation === undefined
      && byName.hidden !== true;
    if (!sameKey(byName.key, expected.key) || !optionsMatch) {
      throw new Error(`Index name conflict: ${expected.collection}.${expected.name}`);
    }
    return 'present';
  }

  const sameKeyIndex = existing.find((index) => sameKey(index.key, expected.key));
  if (sameKeyIndex) {
    throw new Error(`Index key exists under an unexpected name: ${expected.collection}.${sameKeyIndex.name}`);
  }
  return 'missing';
}

export function missingCollections(existing: ReadonlySet<string>): string[] {
  return REQUIRED_COLLECTIONS.filter((name) => !existing.has(name));
}
