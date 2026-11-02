import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inventoryCampaignMobiles } from '../scripts/lib/campaignMobileInventory.ts';
import { validateHistoricalManifest, loadHistoricalManifest } from '../scripts/lib/historicalReferenceManifest.ts';
import { verifyCampaignMobileRegistry, isFullCampaignMobileIndex } from '../scripts/lib/verifyCampaignMobileRegistry.ts';

const fixture = () => ({ version: 1, approvedBy: 'Synthetic reviewer', approvalReference: 'TEST-ONLY', expectedTotalLeads: 12, expectedCampaigns: 1,
  entries: [
    { originalReference: 'old-A', historicalIdentity: 'historical:00000000-0000-4000-8000-000000000001', expectedRecords: 1, expectedApproved: 0, expectedPaid: 0 },
    { originalReference: 'old-B', historicalIdentity: 'historical:00000000-0000-4000-8000-000000000002', expectedRecords: 9, expectedApproved: 9, expectedPaid: 0 },
  ] });
const campaigns = [{ _id: 'current-id', slug: 'current-slug' }];
const rows = () => [
  { _id: 'a', campaignId: 'old-A', clientMobile: '9876543210', status: 'PENDING', partnerId: 'P1' },
  ...Array.from({ length: 9 }, (_, i) => ({ _id: `b-${i}`, campaignId: 'old-B', clientMobile: '9876543210', status: 'APPROVED', partnerId: i % 2 ? 'P1' : 'P2' })),
  { _id: 'c', campaignId: 'current-id', clientMobile: '9876543210', status: 'PENDING', partnerId: 'P1' },
  { _id: 'd', campaignId: 'current-slug', clientMobile: '+91 9876543210', status: 'PAID', partnerId: 'P2' },
];
const stream = async function* (data: any[]) { yield* data; };

test('approved isolated identities reserve mobile pairs without modifying history or choosing conflict ownership', async () => {
  const data = rows(); const before = JSON.stringify(data);
  const result = await inventoryCampaignMobiles(campaigns, stream(data), validateHistoricalManifest(fixture()));
  assert.equal(result.summary.unresolvedCampaign, 0);
  assert.equal(result.summary.isolatedHistoricalRecords, 10);
  assert.equal(result.summary.validRecords, 12);
  assert.equal(result.claims.length, 3, 'same mobile belongs to three distinct identities');
  const historical = result.claims.find(c => c.canonicalCampaignId === fixture().entries[1].historicalIdentity)!;
  assert.equal(historical.state, 'HISTORICAL_CONFLICT'); assert.equal(historical.historicalCount, 9);
  assert.equal(historical.partnerId, undefined); assert.equal(historical.leadId, undefined);
  const current = result.claims.find(c => c.canonicalCampaignId === 'current-id')!;
  assert.equal(current.state, 'HISTORICAL_CONFLICT'); assert.equal(current.historicalCount, 2);
  assert.equal(JSON.stringify(data), before);
  const output = JSON.stringify(result.summary);
  for (const raw of ['old-A', 'old-B', '9876543210', 'historical:']) assert.ok(!output.includes(raw));
  assert.equal((await inventoryCampaignMobiles(campaigns, stream(data))).summary.unresolvedCampaign, 10);
});

test('invalid, colliding and incomplete approvals fail closed; unknown references are never implicitly mapped', async () => {
  for (const modify of [
    (v: any) => v.entries.pop(),
    (v: any) => { v.entries[1].originalReference = v.entries[0].originalReference; },
    (v: any) => { v.entries[1].historicalIdentity = v.entries[0].historicalIdentity; },
    (v: any) => { v.entries[0].historicalIdentity = 'current-id'; },
    (v: any) => { v.approvalReference = ''; },
  ]) { const value = fixture(); modify(value); assert.throws(() => validateHistoricalManifest(value)); }
  for (const modify of [
    (v: any) => { v.entries[0].originalReference = 'current-slug'; },
    (v: any) => { v.expectedTotalLeads++; },
    (v: any) => { v.expectedCampaigns++; },
    (v: any) => { v.entries[1].expectedApproved--; },
  ]) { const value = fixture(); modify(value); await assert.rejects(inventoryCampaignMobiles(campaigns, stream(rows()), validateHistoricalManifest(value))); }
  const data = rows(); data.push({ ...data[0], _id: 'unknown', campaignId: 'unapproved-reference' });
  const approval = fixture(); approval.expectedTotalLeads++;
  assert.equal((await inventoryCampaignMobiles(campaigns, stream(data), validateHistoricalManifest(approval))).summary.unresolvedCampaign, 1);
});

test('private manifest requires an external file and exact approval digest', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ved-manifest-test-'));
  const file = path.join(directory, 'manifest.json');
  t.after(() => { unlinkSync(file); rmdirSync(directory); });
  const body = JSON.stringify(fixture()); writeFileSync(file, body, { mode: 0o600 });
  const digest = createHash('sha256').update(body).digest('hex');
  assert.equal(loadHistoricalManifest(file, digest)?.digest, digest);
  assert.throws(() => loadHistoricalManifest(file, '0'.repeat(64)));
  assert.throws(() => loadHistoricalManifest(file, undefined));
  assert.throws(() => loadHistoricalManifest('relative.json', digest));
  assert.throws(() => loadHistoricalManifest(path.resolve('package.json'), digest));
  assert.equal(loadHistoricalManifest(undefined, undefined), undefined);
});

test('activation verification requires every source record covered, exact persisted claims and a full unique index', async () => {
  const { claims } = await inventoryCampaignMobiles(campaigns, stream(rows()), validateHistoricalManifest(fixture()));
  const full = { unique: true, key: { canonicalCampaignId: 1, normalizedMobile: 1 } };
  let stored = structuredClone(claims); let index: any = full;
  const registry = { indexes: async () => [index], countDocuments: async () => stored.length,
    findOne: async (q: any) => stored.find(c => c.canonicalCampaignId === q.canonicalCampaignId && c.normalizedMobile === q.normalizedMobile) };
  await verifyCampaignMobileRegistry(registry, claims, 12);
  await verifyCampaignMobileRegistry(registry, claims, 12); // matching partial preparation is verifiable repeatedly
  await assert.rejects(verifyCampaignMobileRegistry(registry, claims, 13));
  for (const bad of [{ ...full, sparse: true }, { ...full, partialFilterExpression: {} }, { ...full, unique: false }, { ...full, expireAfterSeconds: 5 }, { ...full, key: { ...full.key, partnerId: 1 } }]) {
    assert.equal(isFullCampaignMobileIndex(bad), false);
    index = bad; await assert.rejects(verifyCampaignMobileRegistry(registry, claims, 12));
  }
  index = full; stored.pop(); await assert.rejects(verifyCampaignMobileRegistry(registry, claims, 12));
  stored = structuredClone(claims); stored[1].partnerId = 'NEW-OWNER'; await assert.rejects(verifyCampaignMobileRegistry(registry, claims, 12));
  stored = [...structuredClone(claims), { ...claims[0], canonicalCampaignId: 'extra' }]; await assert.rejects(verifyCampaignMobileRegistry(registry, claims, 12));
});
