import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminOverview } from '../src/components/admin/AdminOverview.tsx';
import { getAdminDashboard } from '../server/controllers/adminLeadController.ts';
import { Partner } from '../server/models/Partner.ts';
import { Lead } from '../server/models/Lead.ts';
import { WalletTransaction } from '../server/models/WalletTransaction.ts';
import { emptyLeadDateFilters } from '../shared/leadDateFilters.ts';

test('Admin Overview applies the same UTC date range to partner, lead, payout and withdrawal metrics', async (t) => {
  const partnerFilters: any[] = [];
  const leadFilters: any[] = [];
  const walletFilters: any[] = [];
  const aggregates: any[][] = [];
  t.mock.method(Partner, 'countDocuments', async (filter: any) => { partnerFilters.push(filter); return 3; });
  t.mock.method(Lead, 'countDocuments', async (filter: any) => { leadFilters.push(filter); return 4; });
  t.mock.method(Lead, 'aggregate', (pipeline: any[]) => { aggregates.push(pipeline); return Promise.resolve([{ _id: 'APPROVED', amount: 500 }]) as any; });
  t.mock.method(WalletTransaction, 'countDocuments', async (filter: any) => { walletFilters.push(filter); return 2; });
  t.mock.method(WalletTransaction, 'aggregate', (pipeline: any[]) => { aggregates.push(pipeline); return Promise.resolve([{ amount: 100 }]) as any; });

  let body: any;
  let forwarded: any;
  await getAdminDashboard({ query: { startDate: '2026-11-10', endDate: '2026-11-20', month: '11', year: '2026' } } as any, { json(value: any) { body = value; } } as any, error => { forwarded = error; });

  assert.equal(forwarded, undefined);
  const expectedRange = { $gte: new Date('2026-11-10T00:00:00.000Z'), $lt: new Date('2026-11-21T00:00:00.000Z') };
  assert.equal(partnerFilters.length, 2);
  assert.deepEqual(partnerFilters[0].createdAt, expectedRange);
  assert.deepEqual(partnerFilters[1], { createdAt: expectedRange, accountStatus: 'ACTIVE' });
  assert.equal(leadFilters.length, 3);
  for (const filter of leadFilters) assert.deepEqual(filter.createdAt, expectedRange);
  assert.deepEqual(aggregates[0][0].$match.createdAt, expectedRange, 'payout sums are filtered by lead creation date');
  assert.deepEqual(walletFilters[0].createdAt, expectedRange);
  assert.deepEqual(aggregates[1][0].$match.createdAt, expectedRange);
  assert.deepEqual(aggregates[2][0].$match.createdAt, expectedRange);
  assert.equal(body.data.totalPartners, 3);
  assert.equal(body.data.totalEarnings, 500);

  partnerFilters.length = 0;
  leadFilters.length = 0;
  walletFilters.length = 0;
  aggregates.length = 0;
  await getAdminDashboard({ query: {} } as any, { json(value: any) { body = value; } } as any, error => { forwarded = error; });
  assert.equal(forwarded, undefined);
  assert.deepEqual(partnerFilters, [{}, { accountStatus: 'ACTIVE' }], 'the default partner totals remain all-time');
  assert.deepEqual(leadFilters, [
    {},
    { status: { $in: ['APPROVED', 'PAID'] } },
    { status: { $in: ['PENDING', 'VERIFIED'] } },
  ], 'the default lead totals remain all-time with existing status scopes');
  assert.ok(aggregates.every(pipeline => !('createdAt' in pipeline[0].$match)), 'default payout and withdrawal totals remain all-time');
});

test('Admin Overview invalid date filters fail safely before database queries', async () => {
  let error: any;
  await getAdminDashboard({ query: { month: '13', year: '2026' } } as any, { json() { assert.fail('invalid filter must not return dashboard metrics'); } } as any, value => { error = value; });
  assert.equal(error?.status, 400);
});

test('Admin Overview shares UTC date control styling and keeps the all-time default without filters', () => {
  const html = renderToStaticMarkup(React.createElement(AdminOverview, { metrics: null, onSelect: () => {}, dateFilters: emptyLeadDateFilters, onDateFilters: () => {}, onApplyFilters: () => {}, onResetFilters: () => {} }));
  assert.ok(html.includes('From Date') && html.includes('To Date') && html.includes('Month') && html.includes('Year'));
  assert.ok(html.includes('Database totals · All time'));
  assert.ok(!html.includes('Filtered reporting period'));
});
