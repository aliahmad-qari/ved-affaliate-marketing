import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import mongoose from 'mongoose';
import { createApp } from '../server/app.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { Partner } from '../server/models/Partner.ts';
import { WalletTransaction } from '../server/models/WalletTransaction.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { Notification } from '../server/models/Notification.ts';
import { signToken } from '../server/utils/jwt.ts';
import { AdminOverview } from '../src/components/admin/AdminOverview.tsx';
import { AdminWithdrawals, defaultWithdrawalFilters } from '../src/components/admin/AdminWithdrawals.tsx';

test('overview uses real totals and loading placeholders without invented trends', () => {
  const html = renderToStaticMarkup(<AdminOverview metrics={{ totalPartners: 15, activePartners: 12, totalLeads: 19, approvedLeads: 9, pendingLeads: 7, totalEarnings: 2310, pendingPayout: 1310, paidPayout: 1000, withdrawalRequests: 0 }} onSelect={() => {}} />);
  assert.ok(html.includes('₹2,310.00') && html.includes('Withdrawal Requests'));
  assert.equal((html.match(/<button/g) || []).length, 9);
  assert.ok(!html.includes('last 7 days') && !html.includes('OTP') && !html.includes('+12%'));
  assert.ok(renderToStaticMarkup(<AdminOverview metrics={null} onSelect={() => {}} />).includes('—'));
});

test('withdrawals render responsive layouts, filters and status-appropriate actions', () => {
  const row = { _id: 'tx-1', partnerId: 'PARTNER-1', partner: { fullName: 'Sample Partner', email: 'sample@example.test' }, amount: 550, paymentMethod: 'UPI', payoutDestination: 'sample@bank', status: 'PENDING', createdAt: '2026-10-06T10:00:00Z', transactionId: 'TX-1' };
  const render = (status = 'PENDING') => renderToStaticMarkup(<AdminWithdrawals response={{ data: [{ ...row, status }], total: 1, page: 1, totalPages: 1 }} filters={defaultWithdrawalFilters} busy={false} onFilters={() => {}} onAction={() => {}} />);
  const pending = render();
  assert.ok(pending.includes('<table') && pending.includes('md:hidden'));
  assert.ok(pending.includes('Search withdrawals') && pending.includes('Payment method') && pending.includes('Requested from') && pending.includes('Requested until'));
  assert.ok(pending.includes('₹550.00') && pending.includes('sample@bank'));
  assert.ok(pending.includes('Approve</button>') && pending.includes('Reject</button>') && pending.includes('View</button>'));
  assert.ok(!pending.includes('Mark paid</button>'));
  assert.ok(render('APPROVED').includes('Mark paid</button>'));
  assert.ok(!render('PAID').includes('Approve</button>') && !render('PAID').includes('Mark paid</button>'));
});

test('withdrawal filters, pagination and existing payout transitions work through the API', async (t) => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'admin-design-test-secret-at-least-32-characters';
  const partners = [{ partnerId: 'PARTNER-1', fullName: 'Alpha Partner', email: 'alpha@example.test' }, { partnerId: 'PARTNER-2', fullName: 'Beta Partner', email: 'beta@example.test' }];
  const rows: any[] = Array.from({ length: 25 }, (_, index) => ({ _id: `tx-${index}`, type: 'WITHDRAWAL', partnerId: index === 24 ? 'PARTNER-2' : 'PARTNER-1', transactionId: `TX-${index}`, amount: 500, paymentMethod: index === 24 ? 'BANK_TRANSFER' : 'UPI', payoutDestination: index === 24 ? 'BANK-ACCOUNT' : 'alpha@bank', status: 'PENDING', createdAt: new Date(`2026-10-${index === 24 ? '07' : '06'}T10:00:00Z`), save: async () => {}, toJSON() { return { ...this }; } }));
  const matches = (row: any, filter: any): boolean => Object.entries(filter).every(([key, value]: any) => {
    if (key === '$or') return value.some((condition: any) => matches(row, condition));
    const field = row[key];
    if (value instanceof RegExp) return value.test(String(field || ''));
    if (value && typeof value === 'object') {
      if ('$in' in value) return value.$in.includes(field);
      return (!value.$gte || field >= value.$gte) && (!value.$lte || field <= value.$lte);
    }
    return field === value;
  });
  const chain = (fn: () => any): any => {
    let skip = 0, limit = Infinity;
    const query: any = { exec: async () => { const result = fn(); return Array.isArray(result) ? result.slice(skip, skip + limit) : result; } };
    for (const key of ['select', 'lean', 'sort', 'session']) query[key] = () => query;
    query.skip = (value: number) => { skip = value; return query; };
    query.limit = (value: number) => { limit = value; return query; };
    query.then = (resolve: any, reject: any) => query.exec().then(resolve, reject);
    return query;
  };
  t.mock.method(AdminUser, 'findById', () => chain(() => ({ _id: 'admin-1', status: 'ACTIVE', toJSON: () => ({ email: 'admin@example.test' }) })));
  t.mock.method(Partner, 'find', (filter: any) => chain(() => partners.filter((partner) => matches(partner, filter))));
  t.mock.method(Partner, 'updateOne', async () => ({}));
  t.mock.method(WalletTransaction, 'find', (filter: any) => chain(() => rows.filter((row) => matches(row, filter))));
  t.mock.method(WalletTransaction, 'countDocuments', (filter: any) => chain(() => rows.filter((row) => matches(row, filter)).length));
  t.mock.method(WalletTransaction, 'findOne', (filter: any) => chain(() => rows.find((row) => matches(row, filter))));
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async (fn: any) => fn(), endSession: async () => {} }) as any);
  t.mock.method(Notification, 'create', async () => []);
  t.mock.method(AuditLog, 'create', async () => []);
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const authorization = `Bearer ${signToken({ id: 'admin-1', email: 'admin@example.test', role: 'ADMIN' })}`;
  const get = (query: string) => fetch(`${base}/api/admin/withdrawals?${query}`, { headers: { Authorization: authorization } });
  const patch = (status: string, paymentReference = '') => fetch(`${base}/api/admin/withdrawals/tx-0`, { method: 'PATCH', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ status, paymentReference }) });
  try {
    const byName = await get('search=beta');
    assert.equal((await byName.json()).data[0].partner.fullName, 'Beta Partner');
    assert.equal((await (await get('paymentMethod=BANK_TRANSFER')).json()).total, 1);
    assert.equal((await (await get('search=alpha%40bank')).json()).total, 24);
    const page = await (await get('limit=20&page=2')).json();
    assert.equal(page.total, 25);
    assert.equal(page.data.length, 5);
    assert.equal(page.totalPages, 2);
    const filtered = await (await get('startDate=2026-10-07T00:00:00Z&endDate=2026-10-07T23:59:59Z')).json();
    assert.equal(filtered.total, 1);
    assert.equal((await get('startDate=invalid')).status, 400);
    assert.equal((await get('startDate=2026-10-08&endDate=2026-10-06')).status, 400);
    assert.equal((await get('paymentMethod=OTHER')).status, 400);
    assert.equal((await patch('APPROVED')).status, 200);
    assert.equal((await patch('PAID')).status, 400, 'A payment reference is still required');
    assert.equal((await patch('PAID', 'PAYMENT-123')).status, 200);
    assert.equal(rows[0].status, 'PAID');
    assert.equal(rows[0].paymentReference, 'PAYMENT-123');
    assert.equal((await patch('APPROVED')).status, 409, 'Paid withdrawals cannot be approved twice');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
