import assert from 'node:assert/strict';
import test from 'node:test';
import { CampaignMobileClaim } from '../server/models/CampaignMobileClaim.ts';
import { LeadDuplicateProtection, duplicateMobileError } from '../server/services/leadDuplicateProtection.ts';
import { normalizeCustomerMobile } from '../shared/customerMobile.ts';

const chain = (run: () => any) => {
  const query: any = { exec: async () => run() };
  query.select = () => query; query.session = () => query; query.lean = () => query;
  return query;
};

test('Indian mobile normalization accepts supported format variants only', () => {
  for (const value of ['9876543210', '+91 98765 43210', '91(98765)-43210']) assert.equal(normalizeCustomerMobile(value), '9876543210');
  for (const value of ['+1 9876543210', '09876543210', '1234567890', '9876543210 ext 1', 9876543210]) assert.equal(normalizeCustomerMobile(value), null);
});

test('claim uniqueness is campaign/mobile scoped, partner independent and concurrency safe', async t => {
  const rows: any[] = [];
  t.mock.method(CampaignMobileClaim, 'findOne', (filter: any) => chain(() => rows.find(row => row.canonicalCampaignId === filter.canonicalCampaignId && row.normalizedMobile === filter.normalizedMobile) || null));
  t.mock.method(CampaignMobileClaim, 'create', async ([row]: any[]) => {
    if (rows.some(existing => existing.canonicalCampaignId === row.canonicalCampaignId && existing.normalizedMobile === row.normalizedMobile)) {
      throw { code: 11000, keyPattern: { canonicalCampaignId: 1, normalizedMobile: 1 } };
    }
    rows.push({ ...row });
    return [row];
  });
  const parallel = await Promise.allSettled([
    LeadDuplicateProtection.claim('campaign-a', '9876543210', 'lead-a', 'PARTNER-A', {} as any),
    LeadDuplicateProtection.claim('campaign-a', '+91 98765 43210', 'lead-b', 'PARTNER-B', {} as any),
  ]);
  assert.equal(parallel.filter(result => result.status === 'fulfilled').length, 1);
  const duplicate = parallel.find(result => result.status === 'rejected') as PromiseRejectedResult;
  assert.equal(duplicate.reason.code, 'DUPLICATE_CAMPAIGN_MOBILE');
  assert.ok(!JSON.stringify(duplicate.reason).includes('9876543210'));
  await LeadDuplicateProtection.claim('campaign-b', '9876543210', 'lead-c', 'PARTNER-C', {} as any);
  await LeadDuplicateProtection.claim('campaign-a', '9876543211', 'lead-d', 'PARTNER-B', {} as any);
  rows.push({ canonicalCampaignId: 'campaign-a', normalizedMobile: '9876543212', state: 'HISTORICAL_CONFLICT' });
  await assert.rejects(LeadDuplicateProtection.claim('campaign-a', '9876543212', 'lead-e', 'PARTNER-A', {} as any), duplicateMobileError());
  assert.deepEqual(CampaignMobileClaim.schema.indexes().filter(([key]: any) => key.canonicalCampaignId === 1), [
    [{ canonicalCampaignId: 1, normalizedMobile: 1 }, { unique: true, name: 'unique_campaign_mobile' }],
  ]);
});
