import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { createApp } from '../server/app.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { Campaign } from '../server/models/Campaign.ts';
import { Lead } from '../server/models/Lead.ts';
import { Partner } from '../server/models/Partner.ts';
import { TrackingClick } from '../server/models/TrackingClick.ts';
import { signToken } from '../server/utils/jwt.ts';
import { ADMIN_LEAD_EXPORT_COLUMNS, createAdminLeadWorkbook } from '../server/services/adminLeadWorkbook.ts';

const expectedHeaders = [
  'Lead ID', 'Click ID', 'Campaign ID', 'Campaign Name', 'Partner ID', 'Customer Name', 'Mobile Number',
  'Status', 'Payout Snapshot', 'Created At', 'Approved At', 'Rejection Reason', 'Tracking Link',
];

test('lead workbook has the exact single-sheet structure, exact ordered headers, blank missing values, and safe text cells', async () => {
  assert.deepEqual(ADMIN_LEAD_EXPORT_COLUMNS.map(column => column.header), expectedHeaders);
  const workbook = createAdminLeadWorkbook([
    { leadId: 'L-1', campaignName: 'Campaign', partnerId: 'PTR-1', status: 'PENDING', payoutSnapshot: undefined },
    { leadId: 'L-2', clickId: '+SUM(A1:A2)', campaignId: 'campaign-2', campaignName: 'Campaign', partnerId: '+SUM(A1:A2)', clientName: '=HYPERLINK("https://bad.example")', clientMobile: '\t@SUM(A1:A2)', status: 'APPROVED', payoutSnapshot: 125.5, createdAt: new Date('2026-10-01T12:34:56.000Z'), approvedAt: new Date('2026-10-02T01:02:03.000Z'), rejectionReason: '-2+3', trackingLink: '=HYPERLINK("https://bad.example")' },
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  const parsed = new ExcelJS.Workbook();
  await parsed.xlsx.load(Buffer.from(buffer));
  assert.deepEqual(parsed.worksheets.map(sheet => sheet.name), ['Leads']);
  const sheet = parsed.getWorksheet('Leads')!;
  assert.equal(sheet.columnCount, expectedHeaders.length);
  assert.equal(sheet.rowCount, 3);
  assert.deepEqual(sheet.getRow(1).values.slice(1), expectedHeaders);
  assert.equal(sheet.getRow(2).getCell(2).value, '');
  assert.equal(sheet.getRow(2).getCell(3).value, '');
  assert.equal(sheet.getRow(2).getCell(6).value, '');
  assert.equal(sheet.getRow(2).getCell(7).value, '');
  assert.equal(sheet.getRow(2).getCell(9).value, '');
  assert.equal(sheet.getRow(2).getCell(10).value, '');
  assert.equal(sheet.getRow(2).getCell(11).value, '');
  assert.equal(sheet.getRow(2).getCell(12).value, '');
  assert.equal(sheet.getRow(2).getCell(13).value, '');
  assert.equal(sheet.getRow(3).getCell(2).value, "'+SUM(A1:A2)");
  assert.equal(sheet.getRow(3).getCell(3).value, 'campaign-2');
  assert.equal(sheet.getRow(3).getCell(5).value, "'+SUM(A1:A2)");
  assert.equal(sheet.getRow(3).getCell(6).value, "'=HYPERLINK(\"https://bad.example\")");
  assert.equal(sheet.getRow(3).getCell(7).value, "'\t@SUM(A1:A2)");
  assert.equal(sheet.getRow(3).getCell(9).value, 125.5);
  assert.equal(sheet.getRow(3).getCell(10).value, '2026-10-01T12:34:56.000Z');
  assert.equal(sheet.getRow(3).getCell(11).value, '2026-10-02T01:02:03.000Z');
  assert.equal(sheet.getRow(3).getCell(12).value, "'-2+3");
  assert.equal(sheet.getRow(3).getCell(13).value, "'=HYPERLINK(\"https://bad.example\")");
  for (const row of [2, 3]) for (let column = 1; column <= expectedHeaders.length; column++) {
    assert.notEqual(sheet.getRow(row).getCell(column).type, ExcelJS.ValueType.Formula);
  }
});

test('admin lead export applies dashboard filters, ignores page size, emits empty headers, and blocks non-admin access', async t => {
  const prior = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET };
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'isolated-admin-export-test-secret-32-chars';
  mongoose.connection.readyState = 1;
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) value === undefined ? delete process.env[key] : process.env[key] = value;
    mongoose.connection.readyState = 0;
  });

  const campaignId = '507f1f77bcf86cd799439011';
  const campaign = { _id: campaignId, slug: 'angel-one' };
  const leads = Array.from({ length: 120 }, (_, index) => ({
    _id: `lead-${index}`,
    leadId: index === 1 ? 'needle-formula-row' : `LEAD-${index}`,
    ...(index === 1 ? { vendorClickId: 'click-export-1' } : {}),
    campaignId: 'angel-one',
    campaignName: 'Angel One',
    partnerId: `PTR-${index}`,
    clientName: index === 1 ? '=HYPERLINK("x")' : `needle customer ${index}`,
    clientMobile: index === 1 ? '+91 9876543210' : `987654${String(index).padStart(4, '0')}`,
    status: 'APPROVED',
    payoutSnapshot: 250,
    createdAt: new Date('2026-10-01T07:00:00.000Z'),
    approvedAt: index === 0 ? undefined : new Date('2026-10-01T08:00:00.000Z'),
    rejectionReason: '',
  }));
  leads.push(
    { ...leads[0], leadId: 'MISSING-CLICK-RECORD', vendorClickId: 'missing-click' },
    { ...leads[0], leadId: 'PENDING', status: 'PENDING' },
    { ...leads[0], leadId: 'OUTSIDE-DATE', createdAt: new Date('2026-10-03T07:00:00.000Z') },
    { ...leads[0], leadId: 'OTHER-CAMPAIGN', campaignId: 'different-campaign' },
    { ...leads[0], leadId: 'OTHER-SEARCH', clientName: 'unmatched' },
  );
  const queryState: { query?: Record<string, any>; selects: string[]; paginated: boolean; clickQuery?: any } = { selects: [], paginated: false };
  const queryChain = (execute: () => unknown) => {
    const chain: any = {
      select(value: string) { queryState.selects.push(value); return chain; },
      sort() { return chain; },
      skip() { queryState.paginated = true; return chain; },
      limit() { queryState.paginated = true; return chain; },
      lean() { return chain; },
      exec: async () => execute(),
    };
    return chain;
  };
  const matches = (lead: any, query: Record<string, any>): boolean => {
    if (query.status && lead.status !== query.status) return false;
    if (query.campaignId?.$in && !query.campaignId.$in.includes(lead.campaignId)) return false;
    const date = query.createdAt;
    if (date?.$gte && lead.createdAt < date.$gte) return false;
    if (date?.$lt && lead.createdAt >= date.$lt) return false;
    if (date?.$lte && lead.createdAt > date.$lte) return false;
    const matchesSearch = !query.$or || query.$or.some((term: any) => Object.entries(term).some(([key, pattern]: [string, any]) => pattern instanceof RegExp && pattern.test(String(lead[key] || ''))));
    if (!matchesSearch) return false;
    return true;
  };

  t.mock.method(AdminUser, 'findById', () => queryChain(() => ({ _id: 'admin-1', email: 'admin@example.test', status: 'ACTIVE', toJSON: () => ({ email: 'admin@example.test' }) })));
  t.mock.method(Partner, 'findById', () => queryChain(() => ({ _id: 'partner-1', partnerId: 'PTR-1', accountStatus: 'ACTIVE', toJSON: () => ({ partnerId: 'PTR-1' }) })));
  t.mock.method(Campaign, 'findOne', () => queryChain(() => campaign));
  t.mock.method(Lead, 'find', (query: Record<string, any>) => {
    queryState.query = query;
    return queryChain(() => leads.filter(lead => matches(lead, query)));
  });
  t.mock.method(TrackingClick, 'find', (query: any) => {
    queryState.clickQuery = query;
    return queryChain(() => [{ clickId: 'click-export-1', partnerId: 'PTR-1', campaignId, campaignSlug: 'angel-one', trackingLink: 'https://vedaffiliatepvtltd.com/campaigns/angel-one?ref=REF1&pid=PTR-1&subteam=team-token' }]);
  });

  const app = createApp().listen(0, '127.0.0.1');
  await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as any).port}/api`;
  const adminToken = signToken({ id: 'admin-1', email: 'admin@example.test', role: 'ADMIN' });
  const partnerToken = signToken({ id: 'partner-1', partnerId: 'PTR-1', role: 'PARTNER' });
  try {
    const url = '/admin/reports/campaign-report.xlsx?campaignId=angel-one&status=APPROVED&startDate=2026-10-01&endDate=2026-10-02&search=needle&page=3&limit=1';
    assert.equal((await fetch(base + '/admin/reports/campaign-report.xlsx')).status, 401);
    assert.equal((await fetch(base + '/admin/reports/campaign-report.xlsx', { headers: { Authorization: `Bearer ${partnerToken}` } })).status, 403);
    const response = await fetch(base + url, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.ok(queryState.selects.includes('leadId campaignName partnerId campaignId vendorClickId clientName clientMobile status payoutSnapshot createdAt approvedAt rejectionReason'));
    assert.ok(queryState.selects.includes('clickId partnerId campaignId campaignSlug trackingLink'));
    assert.deepEqual(queryState.clickQuery, { clickId: { $in: ['click-export-1', 'missing-click'] } });
    assert.equal(queryState.paginated, false);
    assert.equal(queryState.query?.status, 'APPROVED');
    assert.deepEqual(queryState.query?.campaignId, { $in: [campaignId, 'angel-one'] });
    assert.ok(queryState.query?.createdAt?.$gte instanceof Date);
    assert.ok(queryState.query?.createdAt?.$lt instanceof Date);
    assert.ok(queryState.query?.$or[0].leadId instanceof RegExp);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
    assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Leads']);
    const sheet = workbook.getWorksheet('Leads')!;
    assert.equal(sheet.rowCount, 122, 'all matching records are included even when page=3 and limit=1');
    assert.deepEqual(sheet.getRow(1).values.slice(1), expectedHeaders);
    assert.equal(sheet.getRow(2).getCell(2).value, '');
    assert.equal(sheet.getRow(2).getCell(9).value, 250);
    assert.equal(sheet.getRow(3).getCell(2).value, 'click-export-1', 'Click ID comes from the matching stored tracking click');
    assert.equal(sheet.getRow(3).getCell(3).value, 'angel-one');
    assert.equal(sheet.getRow(122).getCell(2).value, '', 'Click ID remains blank when no stored click can be matched');
    assert.equal(sheet.getRow(3).getCell(6).value, "'=HYPERLINK(\"x\")");
    assert.equal(sheet.getRow(3).getCell(7).value, "'+91 9876543210");
    assert.equal(sheet.getRow(3).getCell(13).value, 'https://vedaffiliatepvtltd.com/campaigns/angel-one?ref=REF1&pid=PTR-1&subteam=team-token');

    const empty = await fetch(base + '/admin/reports/campaign-report.xlsx?campaignId=angel-one&status=PAID', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(empty.status, 200);
    const emptyWorkbook = new ExcelJS.Workbook();
    await emptyWorkbook.xlsx.load(Buffer.from(await empty.arrayBuffer()));
    const emptySheet = emptyWorkbook.getWorksheet('Leads')!;
    assert.equal(emptySheet.rowCount, 1);
    assert.deepEqual(emptySheet.getRow(1).values.slice(1), expectedHeaders);
  } finally {
    app.closeAllConnections();
    await new Promise<void>(resolve => app.close(() => resolve()));
  }
});
