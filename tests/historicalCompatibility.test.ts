import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryCampaignMobiles } from '../scripts/lib/campaignMobileInventory.ts';

const stream = async function* (rows: any[]) { yield* rows; };

test('production-sized synthetic history retains every record and all 120 ownerless conflicts', async () => {
  const rows: any[] = [];
  for (let group = 0; group < 469; group++) {
    const count = group < 80 ? 3 : group < 120 ? 2 : 1;
    for (let copy = 0; copy < count; copy++) rows.push({
      _id: `${group}-${copy}`, campaignId: copy % 2 ? 'broker' : 'id-1',
      clientMobile: String(9000000000 + group), partnerId: group === 0 && copy === 1 ? 'P2' : 'P1',
      status: group < 45 && copy === 0 ? 'PAID' : 'PENDING',
      submittedData: { source: group < 2 && copy === 1 ? 'CUSTOMER_FORM' : 'MANUAL' },
    });
  }
  for (let i = 0; i < 10; i++) rows.push({ _id: `unknown-${i}`, campaignId: 'unresolved', clientMobile: String(9100000000 + i), status: 'PENDING' });
  const before = JSON.stringify(rows);
  const result = await inventoryCampaignMobiles([{ _id: 'id-1', slug: 'broker' }], stream(rows));
  const s = result.summary;
  assert.equal(s.totalLeads, 679); assert.equal(s.validRecords, 669);
  assert.equal(s.uniqueCampaignMobilePairs, 469); assert.equal(s.duplicateGroups, 120);
  assert.equal(s.extraHistoricalRecords, 200); assert.equal(s.crossPartnerGroups, 1);
  assert.equal(s.crossSourceGroups, 2); assert.equal(s.approvedOrPaidConflictGroups, 45);
  assert.equal(s.unresolvedCampaign, 10); assert.equal(s.invalidOrMissingMobile, 0);
  assert.equal(s.financialConflictRecords.paid, 45);
  for (const claim of result.claims.filter(c => c.state === 'HISTORICAL_CONFLICT')) {
    assert.equal(claim.leadId, undefined); assert.equal(claim.partnerId, undefined);
    assert.equal('paidCount' in claim, false);
  }
  assert.equal(JSON.stringify(rows), before);
  assert.ok(!JSON.stringify(s).includes('9000000000'));
});

test('unresolved diagnostics count uncertainty without guessing or exposing aliases', async () => {
  const refs = [null, {}, '   ', ' BROKER ', 'aaaaaaaaaaaaaaaaaaaaaaaa', 'legacy-private-alias', 'ambiguous'];
  const rows = refs.map((campaignId, i) => ({ _id: String(i), campaignId, clientMobile: '9876543210', status: 'APPROVED' }));
  const result = await inventoryCampaignMobiles([
    { _id: 'id-1', slug: 'broker' }, { _id: 'id-2', slug: 'ambiguous' }, { _id: 'id-3', slug: 'ambiguous' },
  ], stream(rows));
  assert.equal(result.summary.unresolvedCampaign, 7);
  assert.deepEqual(result.summary.unresolvedDiagnostics, {
    missingOrNonScalar: 3, ambiguousExactAlias: 1, formattingCandidateOnly: 1,
    unmatchedObjectId: 1, unmatchedOther: 1, approvedOrPaidRecords: 7,
  });
  assert.equal(result.claims.length, 0);
  assert.ok(!JSON.stringify(result.summary).includes('legacy-private-alias'));
});
