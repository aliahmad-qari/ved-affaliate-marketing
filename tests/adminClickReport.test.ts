import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createApp } from '../server/app.ts';
import { adminClickReportColumns, buildAdminClickReportFilter, protectClickReportCell } from '../server/controllers/adminClickReportController.ts';

test('admin click report has the exact approved column order and protects spreadsheet formulas', () => {
  assert.deepEqual(adminClickReportColumns, [
    'Click ID', 'Partner ID', 'Partner Name', 'Tracking Link', 'Sub-Partner / Referral ID',
    'Campaign Name', 'Click Date', 'Click Time', 'Customer Name (if submitted)',
    'Customer Mobile Number (admin only)', 'Lead Submission ID', 'Lead Status', 'Conversion Status',
  ]);
  for (const value of ['=1+1', '+SUM(A1:A2)', '-cmd', '@HYPERLINK("x")', '\t=1']) assert.equal(protectClickReportCell(value)[0], "'");
  assert.equal(protectClickReportCell('VED123'), 'VED123');
});

test('click report filters are exact, UTC bounded and reject malformed date/status inputs', () => {
  const query = buildAdminClickReportFilter({
    partnerId: 'ved1', campaign: 'broker', clickId: 'click-1', startDate: '2026-11-01', endDate: '2026-11-02',
  });
  assert.equal(query.partnerId, 'VED1');
  assert.deepEqual(query.$or, [{ campaignId: 'broker' }, { campaignSlug: 'broker' }]);
  assert.equal(query.clickId, 'click-1');
  assert.equal(query.createdAt.$gte.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(query.createdAt.$lt.toISOString(), '2026-11-03T00:00:00.000Z');
  assert.throws(() => buildAdminClickReportFilter({ startDate: '2026-02-30' }), /valid YYYY-MM-DD/);
});

test('click CSV and Excel endpoints require the existing admin authorization middleware', async t => {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  assert.equal((await fetch(`${base}/api/admin/reports/clicks.csv`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/reports/clicks.xlsx`)).status, 401);
});
