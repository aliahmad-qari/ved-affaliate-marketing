import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import mongoose from 'mongoose';
import { leadDateQuery, emptyLeadDateFilters } from '../shared/leadDateFilters.ts';
import { LeadDateFilterControls } from '../src/components/ui/LeadDateFilterControls.tsx';
import { createApp } from '../server/app.ts';
import { Lead } from '../server/models/Lead.ts';
import { Partner } from '../server/models/Partner.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { Campaign } from '../server/models/Campaign.ts';
import { PartnerStore } from '../server/services/partnerStore.ts';
import { signToken } from '../server/utils/jwt.ts';

test('IST dates, complete inclusive days, month/year intersections, leap years and invalid dates', () => {
  const same = leadDateQuery({ startDate: '2026-10-01', endDate: '2026-10-01' })!;
  assert.equal(same.$gte?.toISOString(), '2026-09-30T18:30:00.000Z');
  assert.equal(same.$lt?.toISOString(), '2026-10-01T18:30:00.000Z');
  assert.equal(leadDateQuery({ year: '2026', month: '12' })?.$lt?.toISOString(), '2026-12-31T18:30:00.000Z');
  const leap = leadDateQuery({ startDate: '2024-02-29', endDate: '2024-02-29' })!;
  assert.equal(leap.$lt?.getTime()! - leap.$gte?.getTime()!, 86400000);
  assert.equal(leadDateQuery({ year: '2026' })?.$gte?.toISOString(), '2025-12-31T18:30:00.000Z');
  const intersect = leadDateQuery({ year: '2026', month: '10', startDate: '2026-10-15', endDate: '2026-11-10' })!;
  assert.equal(intersect.$gte?.toISOString(), '2026-10-14T18:30:00.000Z'); assert.equal(intersect.$lt?.toISOString(), '2026-10-31T18:30:00.000Z');
  assert.equal(leadDateQuery({ endDate: '2026-10-01T12:00:00.000Z' })?.$lte?.toISOString(), '2026-10-01T12:00:00.000Z');
  for (const input of [{ startDate: '2026-02-29' }, { endDate: '2026-04-31' }, { startDate: 'no' }, { month: '0', year: '2026' }, { month: '13', year: '2026' }, { month: '1' }, { year: '2026bad' }, { year: ['2026'] }, { startDate: '2026-10-02', endDate: '2026-10-01' }]) assert.throws(() => leadDateQuery(input), { status: 400 });
  assert.equal(leadDateQuery({}), undefined);
  const html = renderToStaticMarkup(<LeadDateFilterControls value={emptyLeadDateFilters} onChange={() => {}} onReset={() => {}} />);
  for (const label of ['From Date', 'To Date', 'Month', 'Year', 'Reset Filters', 'Asia/Kolkata']) assert.ok(html.includes(label));
});

function matches(row: any, query: any): boolean {
  return Object.entries(query).every(([key, value]: any) => {
    if (key === '$or') return value.some((part: any) => matches(row, part));
    if (key === '$nor') return !value.some((part: any) => matches(row, part));
    const found = key.split('.').reduce((obj: any, field: string) => obj?.[field], row);
    if (value instanceof RegExp) return value.test(found || '');
    if (value && typeof value === 'object' && !(value instanceof Date)) return Object.entries(value).every(([op, operand]: any) => {
      if (op === '$in') return operand.includes(found);
      if (op === '$regex' || op === '$options') return op === '$options' || new RegExp(operand, value.$options).test(found || '');
      if (op === '$gte') return found != null && new Date(found) >= operand;
      if (op === '$lt') return found != null && new Date(found) < operand;
      if (op === '$lte') return found != null && new Date(found) <= operand;
      return false;
    });
    return String(found) === String(value);
  });
}
function chain(rows: any): any {
  let skip = 0, limit = Infinity;
  const query: any = { select: () => query, lean: () => query, sort: () => query, skip: (n: number) => { skip = n; return query; }, limit: (n: number) => { limit = n; return query; }, exec: async () => Array.isArray(rows) ? rows.slice(skip, skip + limit) : rows };
  query.then = (resolve: any, reject: any) => query.exec().then(resolve, reject);
  query.cursor = () => ({ async *[Symbol.asyncIterator]() { for (const row of rows) yield row; }, close: async () => {} });
  return query;
}

test('partner/admin lists and CSV filter before pagination with correct counts and ownership', async t => {
  const env = { ...process.env }, ready = mongoose.connection.readyState;
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'lead-date-filter-test-secret-at-least-32' }); mongoose.connection.readyState = 1;
  t.after(() => { process.env = env; mongoose.connection.readyState = ready; });
  const partner: any = { _id: '507f1f77bcf86cd799439011', partnerId: 'VED-PTR-DATE', email: 'date@example.test', accountStatus: 'ACTIVE' };
  const admin: any = { _id: '507f1f77bcf86cd799439012', email: 'admin@example.test', status: 'ACTIVE', toJSON: () => ({ email: 'admin@example.test' }) };
  const rows = [
    { leadId: 'before', createdAt: '2026-09-30T18:29:59.999Z' },
    { leadId: 'first', createdAt: '2026-09-30T18:30:00.000Z' },
    { leadId: 'middle', createdAt: '2026-10-15T00:00:00.000Z' },
    { leadId: 'last', createdAt: '2026-10-31T18:29:59.999Z' },
    { leadId: 'after', createdAt: '2026-10-31T18:30:00.000Z' },
    { leadId: 'other', partnerId: 'VED-PTR-OTHER', createdAt: '2026-10-15T00:00:00.000Z' },
    { leadId: 'rejected', status: 'REJECTED', rejectedAt: new Date('2026-01-01'), createdAt: '2026-10-15T00:00:00.000Z' },
  ].map(row => ({ partnerId: partner.partnerId, campaignId: 'broker', campaignName: 'Broker', status: 'PENDING', clientName: 'Customer', clientMobile: '9876543210', ...row, toJSON() { return { ...this }; } }));
  t.mock.method(PartnerStore, 'findById', async () => partner);
  t.mock.method(PartnerStore, 'getSessionsInvalidatedAt', async () => 0);
  t.mock.method(AdminUser, 'findById', () => chain(admin));
  t.mock.method(Partner, 'find', () => chain([]));
  t.mock.method(Campaign, 'findOne', () => chain({ _id: '507f1f77bcf86cd799439013', slug: 'broker' }));
  t.mock.method(Lead, 'find', (query: any) => chain(rows.filter(row => matches(row, query))));
  t.mock.method(Lead, 'countDocuments', async (query: any) => rows.filter(row => matches(row, query)).length);
  const server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const partnerToken = signToken({ id: partner._id, partnerId: partner.partnerId, email: partner.email, role: 'PARTNER' });
  const adminToken = signToken({ id: admin._id, email: admin.email, role: 'ADMIN' });
  const get = (path: string, token = partnerToken) => fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  const filter = 'month=10&year=2026&status=PENDING&search=Customer&campaignId=broker';
  const first = await (await get(`/api/partner/leads?${filter}&limit=2&partnerId=VED-PTR-OTHER`)).json();
  assert.equal(first.total, 3); assert.equal(first.totalPages, 2); assert.equal(first.data.length, 2);
  const second = await (await get(`/api/partner/leads?${filter}&limit=2&page=2`)).json(); assert.equal(second.total, 3); assert.equal(second.data[0].leadId, 'last');
  const day = await (await get('/api/partner/leads?startDate=2026-10-01&endDate=2026-10-01')).json(); assert.deepEqual(day.data.map((row: any) => row.leadId), ['first']);
  const empty = await (await get('/api/partner/leads?year=2020&month=1')).json(); assert.equal(empty.total, 0); assert.deepEqual(empty.data, []);
  const adminList = await (await get(`/api/admin/leads?${filter}&limit=2`, adminToken)).json(); assert.equal(adminList.total, 4); assert.equal(adminList.totalPages, 2);
  const csv = await (await get(`/api/partner/reports/leads.csv?${filter}`)).text(); assert.ok(csv.includes('first') && csv.includes('last')); assert.ok(!csv.includes('before') && !csv.includes('after') && !csv.includes('other')); assert.ok(!csv.includes('9876543210'));
  assert.equal((await get('/api/admin/leads?year=2026')).status, 403);
  assert.equal((await fetch(base + '/api/partner/leads?year=2026')).status, 401);
  assert.equal((await get('/api/partner/leads?month=13&year=2026')).status, 400);
  const reset = await (await get('/api/partner/leads')).json(); assert.equal(reset.total, 6);
  assert.equal(rows.length, 7, 'No lead records changed');
});
