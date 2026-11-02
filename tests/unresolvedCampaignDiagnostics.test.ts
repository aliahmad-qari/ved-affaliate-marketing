import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnoseUnresolvedCampaigns, diagnosticLabel } from '../scripts/lib/unresolvedCampaignDiagnostics.ts';
const key = 'ab'.repeat(32);
const campaigns = [{ _id: 'canonical-one', slug: 'current' }, { _id: 'canonical-two', slug: 'other' }];

test('private labels are stable, keyed, domain-separated and contain no raw identifiers', () => {
  const label = diagnosticLabel(key, 'reference', 'private-old-slug');
  assert.equal(label, diagnosticLabel(key, 'reference', 'private-old-slug'));
  assert.notEqual(label, diagnosticLabel('cd'.repeat(32), 'reference', 'private-old-slug'));
  assert.notEqual(label, diagnosticLabel(key, 'campaign', 'private-old-slug'));
  assert.notEqual(diagnosticLabel(key, 'reference', null), diagnosticLabel(key, 'reference', 'null'));
  assert.throws(() => diagnosticLabel('short', 'reference', 'x'));
  assert.match(label, /^R-[a-f0-9]{64}$/);
});

test('groups original references without formatting guesses; counts and exact historical evidence only', () => {
  const leads = Array.from({ length: 10 }, (_, i) => ({ campaignId: i < 6 ? 'old-private' : ' CURRENT ', status: i < 8 ? 'APPROVED' : i === 8 ? 'PAID' : 'PENDING', clientName: 'never-output', clientMobile: '9876543210' }));
  const audits = [{ entityType: 'Campaign', entityId: 'canonical-one', action: 'CAMPAIGN_UPDATED', before: { slug: 'old-private' }, after: { slug: 'current' } }];
  const before = JSON.stringify({ campaigns, leads, audits });
  const report = diagnoseUnresolvedCampaigns(campaigns, leads, audits, key, true);
  assert.equal(report.distinctUnresolvedReferenceGroups, 2); assert.equal(report.unresolvedRecords, 10);
  const verified = report.groups.find(g => g.verifiedHistoricalMappingEvidence)!;
  assert.equal(verified.affectedRecords, 6); assert.equal(verified.approvedOrPaidRecords, 6);
  assert.equal(verified.canonicalCampaignLabel, diagnosticLabel(key, 'campaign', 'canonical-one'));
  const unknown = report.groups.find(g => !g.verifiedHistoricalMappingEvidence)!;
  assert.equal(unknown.approvedOrPaidRecords, 3);
  assert.equal(unknown.evidenceStatus, 'NO_EXACT_MAPPING_EVIDENCE');
  assert.ok(report.groups.every(g => g.requiresManualConfirmation));
  assert.equal(report.registryActivationAllowed, false);
  const output = JSON.stringify(report);
  for (const privateValue of ['old-private', 'canonical-one', '9876543210', 'never-output', ' CURRENT ']) assert.ok(!output.includes(privateValue));
  assert.equal(JSON.stringify({ campaigns, leads, audits }), before);
});

test('conflicting, missing and mismatched historical identities never establish mappings', () => {
  const leads = [{ campaignId: 'old', status: 'PAID' }];
  const event = (id: string) => ({ entityType: 'Campaign', action: 'CAMPAIGN_UPDATED', entityId: id, before: { slug: 'old' } });
  assert.equal(diagnoseUnresolvedCampaigns(campaigns, leads, [event('canonical-one'), event('canonical-two')], key, true).groups[0].evidenceStatus, 'CONFLICTING_HISTORY');
  assert.equal(diagnoseUnresolvedCampaigns(campaigns, leads, [event('removed')], key, true).groups[0].evidenceStatus, 'HISTORICAL_TARGET_NOT_CURRENT');
  const mismatch = { ...event('canonical-one'), before: { slug: 'old', _id: 'canonical-two' } };
  assert.equal(diagnoseUnresolvedCampaigns(campaigns, leads, [mismatch], key, true).groups[0].verifiedHistoricalMappingEvidence, false);
  assert.equal(diagnoseUnresolvedCampaigns(campaigns, leads, [], key, false).groups[0].evidenceStatus, 'HISTORY_UNAVAILABLE');
  assert.equal(diagnoseUnresolvedCampaigns(campaigns, [{ campaignId: 'current' }], [], key, true).groups.length, 0);
});
