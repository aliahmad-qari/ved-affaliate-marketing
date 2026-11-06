import assert from 'node:assert/strict';
import test from 'node:test';
import { campaignCaptureUrl } from '../src/lib/campaignTracking.ts';
import { Partner } from '../server/models/Partner.ts';
import { PartnerSubTeamLink } from '../server/models/PartnerSubTeamLink.ts';
import { TrackingClick } from '../server/models/TrackingClick.ts';
import {
  buildSubTeamTrackingUrl,
  createSubTeamClick,
  resolvePartnerOwnedSubTeamLink,
  resolveSubTeamPartner,
  summarizeSubTeamLinks,
} from '../server/services/subTeamAttribution.ts';

test('sub-team campaign links preserve the parent identifiers through SPA capture', () => {
  const link = buildSubTeamTrackingUrl('https://ved.example/', 'loan-offer', 'REF-123', 'VED-PTR-123', 'opaque-token');
  const parsed = new URL(link);
  assert.equal(parsed.pathname, '/campaigns/loan-offer');
  assert.equal(parsed.searchParams.get('ref'), 'REF-123');
  assert.equal(parsed.searchParams.get('pid'), 'VED-PTR-123');
  assert.equal(parsed.searchParams.get('subteam'), 'opaque-token');
  assert.equal(
    campaignCaptureUrl(parsed.pathname, parsed.search),
    '/api/public/campaigns/loan-offer/go?ref=REF-123&pid=VED-PTR-123&subteam=opaque-token',
  );
  assert.equal(campaignCaptureUrl(parsed.pathname, `${parsed.search}&untrusted=https://evil.test`)?.includes('untrusted'), false);
});

test('sub-team summaries count only directly attributed leads and approved or paid earnings', () => {
  const links = [{ _id: 'link-a' }, { _id: 'link-b' }];
  const stats = summarizeSubTeamLinks(links, [
    { subTeamLinkId: 'link-a', status: 'PENDING', payoutSnapshot: 500 },
    { subTeamLinkId: 'link-a', status: 'APPROVED', payoutSnapshot: 125.5 },
    { subTeamLinkId: 'link-a', status: 'PAID', payoutSnapshot: 74.5 },
    { subTeamLinkId: 'other-link', status: 'APPROVED', payoutSnapshot: 1000 },
  ]);
  assert.deepEqual(stats.map(({ leads, approvedConversions, attributedEarnings }) => ({ leads, approvedConversions, attributedEarnings })), [
    { leads: 3, approvedConversions: 2, attributedEarnings: 200 },
    { leads: 0, approvedConversions: 0, attributedEarnings: 0 },
  ]);
});

test('public resolution binds sub-team identity to the original active parent and campaign', async (t) => {
  const query = (value: any) => ({ select() { return this; }, lean() { return this; }, exec: async () => value });
  const link: any = { _id: 'link-1', partnerId: 'VED-PTR-123' };
  const partner: any = { partnerId: 'VED-PTR-123', referralCode: 'REF-123' };
  t.mock.method(PartnerSubTeamLink, 'findOne', (filter: any) => {
    assert.deepEqual(filter, { trackingId: 'opaque', campaignId: 'campaign-1', campaignSlug: 'campaign', status: 'ACTIVE' });
    return query(link) as any;
  });
  t.mock.method(Partner, 'findOne', (filter: any) => {
    assert.deepEqual(filter, { partnerId: 'VED-PTR-123', referralCode: 'REF-123', accountStatus: 'ACTIVE' });
    return { ...query(partner), select() { return query(partner); } } as any;
  });
  const resolved = await resolveSubTeamPartner('campaign', { _id: 'campaign-1' }, 'REF-123', 'VED-PTR-123', 'opaque');
  assert.equal(resolved.partner, partner);
  assert.equal(resolved.link, link);
});

test('manual attribution cannot select another partner’s sub-team link', async (t) => {
  const query = { lean() { return this; }, exec: async () => null };
  t.mock.method(PartnerSubTeamLink, 'findOne', (filter: any) => {
    assert.deepEqual(filter, { _id: 'link-1', partnerId: 'VED-PTR-OWN', campaignId: 'campaign-1', status: 'ACTIVE' });
    return query as any;
  });
  await assert.rejects(
    resolvePartnerOwnedSubTeamLink('VED-PTR-OWN', 'link-1', 'campaign-1'),
    (error: any) => error.status === 400,
  );
});

test('sub-team clicks retain fixed or percentage payout snapshots and commit counts together', async (t) => {
  const rows: any[] = [];
  let count = 0;
  let commits = 0;
  t.mock.method(TrackingClick.db, 'startSession', async () => ({
    withTransaction: async (operation: () => Promise<void>) => { await operation(); commits++; },
    endSession: async () => {},
  }) as any);
  t.mock.method(TrackingClick, 'create', async (docs: any[]) => { rows.push(...docs); return docs as any; });
  t.mock.method(PartnerSubTeamLink, 'updateOne', async (filter: any, update: any, options: any) => {
    assert.equal(filter._id, 'link-1');
    assert.equal(filter.partnerId, 'VED-PTR-123');
    assert.equal(filter.status, 'ACTIVE');
    assert.equal(update.$inc.clickCount, 1);
    assert.ok(options.session);
    count++;
    return { matchedCount: 1 } as any;
  });
  await createSubTeamClick(
    { _id: 'link-1' }, { _id: 'campaign-1', slug: 'campaign' }, { partnerId: 'VED-PTR-123' }, 'click-1', 250, 'INR',
  );
  await createSubTeamClick(
    { _id: 'link-1' }, { _id: 'campaign-1', slug: 'campaign' }, { partnerId: 'VED-PTR-123' }, 'click-2', {
      payoutSnapshot: 0,
      payoutTypeSnapshot: 'PERCENTAGE',
      payoutBasisSnapshot: 'LOAN_DISBURSED_AMOUNT',
      payoutRateSnapshot: 2.5,
      payoutTermsSnapshot: 'Actual disbursement only',
      payoutEligibilitySnapshot: { eligibility: 'Verified lender report' },
    }, 'INR',
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].subTeamLinkId, 'link-1');
  assert.equal(rows[0].payoutSnapshot, 250);
  assert.equal(rows[0].payoutTypeSnapshot, 'FIXED');
  assert.equal(rows[1].subTeamLinkId, 'link-1');
  assert.equal(rows[1].payoutSnapshot, 0);
  assert.equal(rows[1].payoutTypeSnapshot, 'PERCENTAGE');
  assert.equal(rows[1].payoutBasisSnapshot, 'LOAN_DISBURSED_AMOUNT');
  assert.equal(rows[1].payoutRateSnapshot, 2.5);
  assert.equal(count, 2);
  assert.equal(commits, 2);
});
