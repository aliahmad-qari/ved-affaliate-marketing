import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLAIM_COLLECTION, CLAIM_INDEX, HISTORICAL_MAPPING_ACK, STATE_COLLECTION,
  buildRegistryPlan, compareClaimIndex, privateReferenceLabel, sameClaim, validateHistoricalAliasManifest,
} from '../scripts/lib/campaignMobileRegistryPlan.ts';

const key = 'test-only-hmac-key-that-is-at-least-32-bytes-long';
const campaigns = [{ id: 'campaign-a-id', slug: 'campaign-a' }, { id: 'campaign-b-id', slug: 'campaign-b' }];
const lead = (overrides: Record<string, unknown> = {}) => ({
  _id: 'mongo-id', leadId: 'LEAD-1', partnerId: 'VED100001', campaignId: 'campaign-a-id', clientMobile: '9876543210', status: 'PENDING', ...overrides,
});

test('registry has one full unique compound key and the separate readiness marker', () => {
  assert.equal(CLAIM_COLLECTION, 'campaignmobileclaims');
  assert.deepEqual(CLAIM_INDEX, { key: { canonicalCampaignId: 1, normalizedMobile: 1 }, options: { unique: true, name: 'unique_campaign_mobile' } });
  assert.equal(STATE_COLLECTION, 'leadDeduplicationState');
});

test('only the exact full unique index and ordered compound key satisfy readiness', () => {
  assert.equal(compareClaimIndex([{ name: 'unique_campaign_mobile', key: { canonicalCampaignId: 1, normalizedMobile: 1 }, unique: true }]), 'present');
  assert.equal(compareClaimIndex([]), 'missing');
  assert.throws(() => compareClaimIndex([{ name: 'unique_campaign_mobile', key: { normalizedMobile: 1, canonicalCampaignId: 1 }, unique: true }]), /conflicts/);
  assert.throws(() => compareClaimIndex([{ name: 'unique_campaign_mobile', key: { canonicalCampaignId: 1, normalizedMobile: 1 }, unique: true, sparse: true }]), /conflicts/);
});

test('campaign ids and exact slugs resolve to one canonical identity', () => {
  const plan = buildRegistryPlan([
    lead({ _id: '1', campaignId: 'campaign-a-id', clientMobile: '+91 98765-43210' }),
    lead({ _id: '2', leadId: 'LEAD-2', campaignId: 'CAMPAIGN-A', clientMobile: '919876543210' }),
  ], campaigns, new Map(), key);
  assert.equal(plan.counts.duplicateGroups, 1);
  assert.equal(plan.counts.additionalDuplicateRecords, 1);
  assert.deepEqual(plan.claims[0], { canonicalCampaignId: 'campaign-a-id', normalizedMobile: '9876543210', state: 'HISTORICAL_CONFLICT', historicalCount: 2 });
  assert.equal('leadId' in plan.claims[0], false);
  assert.equal('partnerId' in plan.claims[0], false);
});

test('same mobile in different campaigns remains two independent claims', () => {
  const plan = buildRegistryPlan([
    lead({ _id: '1', campaignId: 'campaign-a' }),
    lead({ _id: '2', leadId: 'LEAD-2', campaignId: 'campaign-b-id', partnerId: 'VED100002' }),
  ], campaigns, new Map(), key);
  assert.equal(plan.counts.duplicateGroups, 0);
  assert.equal(plan.claims.length, 2);
  assert.deepEqual(plan.claims.map(row => row.canonicalCampaignId).sort(), ['campaign-a-id', 'campaign-b-id']);
});

test('one partner can submit different customers on the same device without a false duplicate', () => {
  const plan = buildRegistryPlan([
    lead({ _id: '1', clientMobile: '9876543210' }),
    lead({ _id: '2', leadId: 'LEAD-2', clientMobile: '9123456789' }),
  ], campaigns, new Map(), key);
  assert.equal(plan.counts.duplicateGroups, 0);
  assert.equal(plan.claims.length, 2);
});

test('historical conflicts reserve a pair without choosing an owner and report financial/cross-partner counts', () => {
  const plan = buildRegistryPlan([
    lead({ _id: '1', status: 'APPROVED' }),
    lead({ _id: '2', leadId: 'LEAD-2', partnerId: 'VED200002', clientMobile: '+91 (987) 654-3210', status: 'PAID' }),
  ], campaigns, new Map(), key);
  assert.equal(plan.counts.crossPartnerConflictGroups, 1);
  assert.equal(plan.counts.approvedPaidConflictGroups, 1);
  assert.equal(plan.counts.approvedOrPaidRecordsInConflictGroups, 2);
  assert.equal(plan.claims[0].state, 'HISTORICAL_CONFLICT');
  assert.equal(plan.claims[0].historicalCount, 2);
});

test('unresolved references produce only stable keyed labels and block unapproved alias guessing', () => {
  const rawReference = 'private-old-campaign-reference';
  const plan = buildRegistryPlan([lead({ campaignId: rawReference })], campaigns, new Map(), key);
  assert.equal(plan.counts.unresolvedReferenceGroups, 1);
  assert.equal(plan.unresolvedLabels[0].label, privateReferenceLabel(rawReference, key));
  assert.equal(JSON.stringify(plan).includes(rawReference), false);
  assert.throws(() => validateHistoricalAliasManifest(undefined, [rawReference], campaigns, key), /explicitly approved/);
});

test('private alias manifest requires exact HMAC coverage, evidence, approval, and an existing campaign ID', () => {
  const reference = 'legacy-exact-reference';
  const manifest = {
    version: 1 as const,
    approvedBy: 'authorized reviewer',
    approvedAt: '2026-11-08T10:00:00.000Z',
    limitationsAcknowledged: HISTORICAL_MAPPING_ACK,
    entries: [{ referenceHmac: privateReferenceLabel(reference, key), canonicalCampaignId: 'campaign-a-id', evidenceReference: 'archived campaign configuration record' }],
  };
  assert.deepEqual([...validateHistoricalAliasManifest(manifest, [reference], campaigns, key)], [[reference, 'campaign-a-id']]);
  const mappings = validateHistoricalAliasManifest(manifest, [reference], campaigns, key);
  const mappedPlan = buildRegistryPlan([lead({ campaignId: reference })], campaigns, mappings, key);
  assert.equal(mappedPlan.counts.unresolvedReferenceGroups, 0);
  assert.equal(mappedPlan.claims[0].canonicalCampaignId, 'campaign-a-id');
  assert.throws(() => validateHistoricalAliasManifest({ ...manifest, entries: [] }, [reference], campaigns, key), /explicitly approved/);
  assert.throws(() => validateHistoricalAliasManifest({ ...manifest, entries: [{ ...manifest.entries[0], canonicalCampaignId: 'guessed-campaign' }] }, [reference], campaigns, key), /invalid/);
});

test('missing campaign identity or invalid mobile prevents full historical claim coverage', () => {
  const plan = buildRegistryPlan([
    lead({ _id: '1', campaignId: null }),
    lead({ _id: '2', leadId: 'LEAD-2', clientMobile: 'not-a-mobile' }),
  ], campaigns, new Map(), key);
  assert.equal(plan.counts.missingCampaignReferences, 1);
  assert.equal(plan.counts.invalidOrMissingMobiles, 1);
  assert.equal(plan.claims.length, 0);
});

test('registry coverage comparison requires a complete exact claim and detects stale state', () => {
  const plan = buildRegistryPlan([lead()], campaigns, new Map(), key);
  assert.equal(sameClaim({ ...plan.claims[0] }, plan.claims[0]), true);
  assert.equal(sameClaim({ ...plan.claims[0], partnerId: 'VED999999' }, plan.claims[0]), false);
});
