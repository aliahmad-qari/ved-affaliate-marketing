import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHistoricalManifest } from '../scripts/lib/buildHistoricalManifest.ts';

test('exact inventory yields two isolated UUIDs; ambiguous identities or financial drift reject', async () => {
  const campaigns = Array.from({ length: 27 }, (_, i) => ({ _id: `id-${i}`, slug: `slug-${i}` }));
  const leads: any[] = Array.from({ length: 669 }, (_, i) => ({ _id: `lead-${i}`, campaignId: 'id-0', clientMobile: String(9000000000 + i), partnerId: 'P1', status: 'PENDING' }));
  leads.push({ _id: 'a', campaignId: 'private-A', clientMobile: '9876543210', partnerId: 'P1', status: 'PENDING' });
  for (let i = 0; i < 9; i++) leads.push({ _id: `b-${i}`, campaignId: 'private-B', clientMobile: '9876543210', partnerId: 'P2', status: 'APPROVED' });
  const before = JSON.stringify({ campaigns, leads });
  const manifest = await buildHistoricalManifest(campaigns, leads, 'synthetic reviewer', 'synthetic approval');
  assert.deepEqual(manifest.entries.map(e => [e.expectedRecords, e.expectedApproved, e.expectedPaid]), [[1, 0, 0], [9, 9, 0]]);
  assert.notEqual(manifest.entries[0].historicalIdentity, manifest.entries[1].historicalIdentity);
  for (const e of manifest.entries) assert.match(e.historicalIdentity, /^historical:[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
  assert.equal(JSON.stringify({ campaigns, leads }), before);
  await assert.rejects(buildHistoricalManifest(campaigns, leads.slice(1), 'reviewer', 'approval'));
  await assert.rejects(buildHistoricalManifest(campaigns.slice(1), leads, 'reviewer', 'approval'));
  const changed = structuredClone(leads); changed[678].status = 'PAID';
  await assert.rejects(buildHistoricalManifest(campaigns, changed, 'reviewer', 'approval'));
  changed[678].status = 'APPROVED'; changed[678].campaignId = 'unapproved-third';
  await assert.rejects(buildHistoricalManifest(campaigns, changed, 'reviewer', 'approval'));
  changed[678].campaignId = null;
  await assert.rejects(buildHistoricalManifest(campaigns, changed, 'reviewer', 'approval'));
  const ambiguous = structuredClone(campaigns); ambiguous[1].slug = 'id-0';
  await assert.rejects(buildHistoricalManifest(ambiguous, leads, 'reviewer', 'approval'));
});
