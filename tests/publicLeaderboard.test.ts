import assert from 'node:assert/strict';
import test from 'node:test';
import { Lead } from '../server/models/Lead.ts';
import { Partner } from '../server/models/Partner.ts';
import { getPublicSuccessfulLeads } from '../server/controllers/publicLeaderboardController.ts';

test('public successful-leads payload contains only masked partner identity and approved count', async t => {
  t.mock.method(Lead, 'aggregate', () => ({ exec: async () => [{ _id: 'VED123456', approvedCount: 3 }] }) as any);
  const query: any = { exec: async () => [{ partnerId: 'VED123456', fullName: 'Priyam Kumar', email: 'secret@example.test', mobile: '9876543210' }] };
  query.select = () => query; query.lean = () => query;
  t.mock.method(Partner, 'find', () => query as any);
  const response: any = { headers: {} as Record<string, string>, set(headers: Record<string, string>) { Object.assign(this.headers, headers); return this; }, json(body: any) { this.body = body; } };
  await getPublicSuccessfulLeads({ query: {} } as any, response, error => { throw error; });
  assert.deepEqual(response.body.data.partners, [{ partnerName: 'P**m Kum**', partnerId: 'VED1234**', successfulLeads: 3 }]);
  assert.deepEqual(Object.keys(response.body.data.partners[0]), ['partnerName', 'partnerId', 'successfulLeads']);
  assert.equal(JSON.stringify(response.body).includes('secret@example.test'), false);
  assert.equal(JSON.stringify(response.body).includes('9876543210'), false);
  assert.equal(response.headers['Referrer-Policy'], 'no-referrer');
});
