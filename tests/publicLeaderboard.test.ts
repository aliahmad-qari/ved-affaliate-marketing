import assert from 'node:assert/strict';
import test from 'node:test';
import { Lead } from '../server/models/Lead.ts';
import { Partner } from '../server/models/Partner.ts';
import { getPublicSuccessfulLeads } from '../server/controllers/publicLeaderboardController.ts';
import { monthKeyInTimeZone } from '../shared/monthlyLeaderboard.ts';

test('public endpoint shares a monthly top-five source and returns only masked names and approved counts', async t => {
  const counts = [1, 10, 3, 8, 2, 5, 4];
  const groups = counts.map((approvedConversions, index) => ({ _id: `VED12345${index}`, approvedConversions, approvedEarnings: index * 125.5 }));
  let leadMatch: any;
  t.mock.method(Lead, 'aggregate', (pipeline: any[]) => {
    leadMatch = pipeline[0].$match;
    return { exec: async () => groups } as any;
  });
  const query: any = { exec: async () => groups.map(group => ({ partnerId: group._id, fullName: 'Priyam Kumar', email: 'secret@example.test', mobile: '9876543210' })) };
  query.select = () => query; query.lean = () => query;
  t.mock.method(Partner, 'find', () => query as any);
  const response: any = { headers: {} as Record<string, string>, set(headers: Record<string, string>) { Object.assign(this.headers, headers); return this; }, json(body: any) { this.body = body; } };
  await getPublicSuccessfulLeads({ query: { month: '1999-01' } } as any, response, error => { throw error; });
  assert.equal(response.body.data.monthKey, monthKeyInTimeZone(), 'the public homepage always shows the current UTC month');
  assert.equal(response.body.data.timeZone, 'UTC');
  assert.equal(response.body.data.rankings.length, 5);
  assert.deepEqual(response.body.data.rankings.map((row: any) => row.approvedConversions), [10, 8, 5, 4, 3]);
  assert.deepEqual(response.body.data.rankings[0], { rank: 1, partnerName: 'P**m Kum**', approvedConversions: 10, approvedEarnings: 125.5 });
  assert.deepEqual(Object.keys(response.body.data.rankings[0]), ['rank', 'partnerName', 'approvedConversions', 'approvedEarnings']);
  assert.equal(response.body.data.rankings.length, 5, 'earnings are added without changing the top-five ranking');
  assert.deepEqual(leadMatch.status, { $in: ['APPROVED', 'PAID'] });
  assert.deepEqual(leadMatch.reviewedBy, { $nin: ['', 'VENDOR_WEBHOOK', 'SYSTEM'] });
  assert.deepEqual(leadMatch.rejectionReasonCode, { $ne: 'DUPLICATE_LEAD' });
  assert.deepEqual(leadMatch.approvalReversal, { $exists: false });
  assert.equal(JSON.stringify(response.body).includes('secret@example.test'), false);
  assert.equal(JSON.stringify(response.body).includes('9876543210'), false);
  assert.equal(JSON.stringify(response.body).includes('VED12345'), false);
  assert.equal(response.headers['Referrer-Policy'], 'no-referrer');
});
