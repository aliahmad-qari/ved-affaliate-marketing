import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeCustomerMobile } from '../../shared/customerMobile.ts';

export const CLAIM_COLLECTION = 'campaignmobileclaims';
export const STATE_COLLECTION = 'leadDeduplicationState';
export const STATE_ID = 'campaign-mobile-v1';
export const CLAIM_INDEX = {
  key: { canonicalCampaignId: 1, normalizedMobile: 1 } as const,
  options: { unique: true, name: 'unique_campaign_mobile' } as const,
};
export const HISTORICAL_MAPPING_ACK = 'I_APPROVE_EXACT_EVIDENCE_BASED_CAMPAIGN_MAPPINGS';

export function compareClaimIndex(indexes: readonly any[]): 'present' | 'missing' {
  const exactKey = (index: any) => index.key && Object.keys(index.key).length === 2
    && Object.keys(index.key)[0] === 'canonicalCampaignId' && index.key.canonicalCampaignId === 1
    && Object.keys(index.key)[1] === 'normalizedMobile' && index.key.normalizedMobile === 1;
  const byName = indexes.find(index => index.name === CLAIM_INDEX.options.name);
  if (byName && (!exactKey(byName) || byName.unique !== true || byName.sparse === true || byName.partialFilterExpression
    || byName.expireAfterSeconds != null || byName.collation || byName.hidden === true)) {
    throw new Error('Existing duplicate-claim index conflicts with the required full unique index.');
  }
  if (indexes.some(index => exactKey(index) && index.name !== CLAIM_INDEX.options.name)) {
    throw new Error('The required compound key already exists under an unexpected index name.');
  }
  return byName ? 'present' : 'missing';
}

export interface HistoricalAliasManifest {
  version: 1;
  approvedBy: string;
  approvedAt: string;
  limitationsAcknowledged: typeof HISTORICAL_MAPPING_ACK;
  entries: Array<{ referenceHmac: string; canonicalCampaignId: string; evidenceReference: string }>;
}

export interface RegistryClaim {
  canonicalCampaignId: string;
  normalizedMobile: string;
  state: 'CLAIMED' | 'HISTORICAL_CONFLICT';
  historicalCount: number;
  leadId?: string;
  partnerId?: string;
}

export interface HistoricalCounts {
  totalLeads: number;
  missingCampaignReferences: number;
  invalidOrMissingMobiles: number;
  unresolvedReferenceGroups: number;
  duplicateGroups: number;
  additionalDuplicateRecords: number;
  crossPartnerConflictGroups: number;
  approvedPaidConflictGroups: number;
  approvedOrPaidRecordsInConflictGroups: number;
}

export function privateReferenceLabel(reference: string, key: string): string {
  return createHmac('sha256', key).update(`ved-r7-campaign-reference:v1\0${reference}`).digest('hex');
}

function sameHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function validateHistoricalAliasManifest(
  manifest: HistoricalAliasManifest | undefined,
  unresolvedReferences: readonly string[],
  campaigns: readonly { id: string; slug?: string }[],
  hmacKey: string,
): Map<string, string> {
  if (!unresolvedReferences.length) {
    if (manifest?.entries?.length) throw new Error('Historical alias manifest contains unused entries.');
    return new Map();
  }
  if (!manifest || manifest.version !== 1 || !manifest.limitationsAcknowledged
    || !manifest.approvedBy?.trim() || !Number.isFinite(Date.parse(manifest.approvedAt))
    || !Array.isArray(manifest.entries) || manifest.entries.length !== unresolvedReferences.length) {
    throw new Error('Every unresolved campaign reference requires an explicitly approved exact-evidence mapping.');
  }
  const campaignIds = new Set(campaigns.map(campaign => campaign.id));
  const byHmac = new Map<string, HistoricalAliasManifest['entries'][number]>();
  for (const entry of manifest.entries) {
    if (!/^[a-f0-9]{64}$/i.test(entry.referenceHmac) || !entry.evidenceReference?.trim()
      || !campaignIds.has(entry.canonicalCampaignId) || byHmac.has(entry.referenceHmac.toLowerCase())) {
      throw new Error('Historical alias manifest has an invalid, duplicate, or unverified mapping.');
    }
    byHmac.set(entry.referenceHmac.toLowerCase(), entry);
  }
  const result = new Map<string, string>();
  for (const reference of unresolvedReferences) {
    const hash = privateReferenceLabel(reference, hmacKey).toLowerCase();
    const entry = byHmac.get(hash);
    if (!entry) throw new Error('Historical alias manifest does not cover every unresolved reference.');
    result.set(reference, entry.canonicalCampaignId);
  }
  if (result.size !== byHmac.size) throw new Error('Historical alias manifest contains an unmatched reference.');
  return result;
}

export function buildRegistryPlan(
  leads: readonly any[],
  campaigns: readonly { id: string; slug?: string }[],
  mappings: ReadonlyMap<string, string>,
  hmacKey: string,
): { claims: RegistryClaim[]; counts: HistoricalCounts; unresolvedLabels: Array<{ label: string; records: number }> ; inventoryDigest: string } {
  const byId = new Map(campaigns.map(campaign => [campaign.id.toLowerCase(), campaign.id]));
  const bySlug = new Map(campaigns.filter(campaign => campaign.slug).map(campaign => [campaign.slug!.toLowerCase(), campaign.id]));
  const unresolvedCounts = new Map<string, number>();
  const buckets = new Map<string, { campaignId: string; mobile: string; leadRows: any[] }>();
  const digestRows: string[] = [];
  let invalidOrMissingMobiles = 0;
  let missingCampaignReferences = 0;

  for (const lead of leads) {
    const rawReference = lead.campaignId == null ? '' : String(lead.campaignId).trim();
    const refById = byId.get(rawReference.toLowerCase());
    const refBySlug = bySlug.get(rawReference.toLowerCase());
    const campaignId = rawReference ? (refById || refBySlug || mappings.get(rawReference)) : undefined;
    if (!rawReference) missingCampaignReferences++;
    if (!campaignId) unresolvedCounts.set(rawReference || '<missing>', (unresolvedCounts.get(rawReference || '<missing>') || 0) + 1);
    const mobile = normalizeCustomerMobile(lead.clientMobile);
    if (!mobile) invalidOrMissingMobiles++;
    if (campaignId && mobile) {
      const key = `${campaignId}\0${mobile}`;
      const bucket = buckets.get(key) || { campaignId, mobile, leadRows: [] };
      bucket.leadRows.push(lead);
      buckets.set(key, bucket);
    }
    // HMAC the mobile before including it in the approval digest; never return source values.
    const safeMobile = mobile ? privateReferenceLabel(`mobile:${mobile}`, hmacKey) : 'INVALID';
    const safeUnresolved = campaignId || `UNRESOLVED:${privateReferenceLabel(rawReference, hmacKey)}`;
    digestRows.push([String(lead._id || ''), String(lead.leadId || ''), String(lead.partnerId || '').toUpperCase(), safeUnresolved, safeMobile, String(lead.status || '').toUpperCase()].join('\0'));
  }

  const claims: RegistryClaim[] = [];
  let duplicateGroups = 0;
  let additionalDuplicateRecords = 0;
  let crossPartnerConflictGroups = 0;
  let approvedPaidConflictGroups = 0;
  let approvedRecordsInConflictGroups = 0;
  for (const bucket of buckets.values()) {
    const rows = bucket.leadRows;
    const isConflict = rows.length > 1;
    if (isConflict) {
      duplicateGroups++;
      additionalDuplicateRecords += rows.length - 1;
      if (new Set(rows.map(row => String(row.partnerId || '').trim().toUpperCase()).filter(Boolean)).size > 1) crossPartnerConflictGroups++;
      const approvedCount = rows.filter(row => ['APPROVED', 'PAID'].includes(String(row.status || '').toUpperCase())).length;
      if (approvedCount) { approvedPaidConflictGroups++; approvedRecordsInConflictGroups += approvedCount; }
      // Conflicts reserve the pair but intentionally have no winning lead or partner owner.
      claims.push({ canonicalCampaignId: bucket.campaignId, normalizedMobile: bucket.mobile, state: 'HISTORICAL_CONFLICT', historicalCount: rows.length });
    } else {
      const row = rows[0];
      if (!row.leadId || !row.partnerId) throw new Error('A historical lead is missing required registry ownership identifiers.');
      claims.push({ canonicalCampaignId: bucket.campaignId, normalizedMobile: bucket.mobile, state: 'CLAIMED', historicalCount: 1, leadId: String(row.leadId), partnerId: String(row.partnerId).trim().toUpperCase() });
    }
  }
  digestRows.sort();
  const unresolvedLabels = [...unresolvedCounts].map(([reference, records]) => ({ label: privateReferenceLabel(reference, hmacKey), records }));
  return {
    claims,
    counts: {
      totalLeads: leads.length,
      missingCampaignReferences,
      invalidOrMissingMobiles,
      unresolvedReferenceGroups: unresolvedCounts.size,
      duplicateGroups,
      additionalDuplicateRecords,
      crossPartnerConflictGroups,
      approvedPaidConflictGroups,
      approvedOrPaidRecordsInConflictGroups: approvedRecordsInConflictGroups,
    },
    unresolvedLabels,
    inventoryDigest: createHmac('sha256', hmacKey).update(digestRows.join('\n')).digest('hex'),
  };
}

export function sameClaim(actual: any, expected: RegistryClaim): boolean {
  return actual.canonicalCampaignId === expected.canonicalCampaignId
    && actual.normalizedMobile === expected.normalizedMobile
    && actual.state === expected.state
    && Number(actual.historicalCount || 1) === expected.historicalCount
    && (actual.leadId || undefined) === expected.leadId
    && (actual.partnerId || undefined) === expected.partnerId;
}
