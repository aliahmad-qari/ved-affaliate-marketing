import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/app.ts';
import { Campaign } from '../server/models/Campaign.ts';
import { Partner } from '../server/models/Partner.ts';
import { Lead } from '../server/models/Lead.ts';
import { TrackingClick } from '../server/models/TrackingClick.ts';
import { Notification } from '../server/models/Notification.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { VendorWebhookEvent } from '../server/models/VendorWebhookEvent.ts';
import { WalletTransaction } from '../server/models/WalletTransaction.ts';
import { AppSetting } from '../server/models/AppSetting.ts';
import { signToken } from '../server/utils/jwt.ts';

// Exercise real HTTP routes with isolated database doubles; no live database or vendor calls.
test('customer capture, redirect, admin progress and existing tracking compatibility', async (t) => {
  process.env.JWT_SECRET = 'test-secret-for-capture-only-32-characters';
  process.env.VENDOR_WEBHOOK_SECRET = 'test-vendor-secret';
  process.env.NODE_ENV = 'test';
  mongoose.connection.readyState = 1;
  const campaign: any = { _id: 'campaign-1', slug: 'sample', name: 'Sample <Campaign>', companyName: 'Broker & Co', status: 'LIVE', requiredAction: 'Open an account', campaignType: 'Demat & Trading', payout: 250, currency: 'INR', baseTrackingUrl: 'https://vendor.example/apply?offer=original' };
  const partner = { partnerId: 'VED-PTR-123', referralCode: 'REF-123', accountStatus: 'ACTIVE' };
  const leads: any[] = [], clicks: any[] = [], notices: any[] = [], audits: any[] = [], ledger: any[] = [];
  let failSave = false, financialWrites = 0;
  const chain = (value: any): any => {
    const query: any = { exec: async () => typeof value === 'function' ? value() : value };
    query.then = (resolve: any, reject: any) => query.exec().then(resolve, reject);
    for (const method of ['select', 'lean', 'session', 'sort', 'skip', 'limit']) query[method] = () => query;
    return query;
  };
  const matches = (doc: any, filter: any) => Object.entries(filter).every(([key, value]: any) => {
    if (key === '$or') return value.some((condition: any) => matches(doc, condition));
    const found = key.split('.').reduce((obj: any, field: string) => obj?.[field], doc);
    if (value instanceof RegExp) return value.test(found || '');
    if (value && typeof value === 'object' && '$exists' in value) return (found !== undefined) === value.$exists;
    return value && typeof value === 'object' && '$in' in value ? value.$in.includes(found) : found === value;
  });
  t.mock.method(mongoose, 'startSession', async () => ({
    withTransaction: async (operation: () => Promise<void>) => {
      const sizes = [leads.length, clicks.length, notices.length];
      try { await operation(); } catch (error) {
        [leads.length, clicks.length, notices.length] = sizes;
        throw error;
      }
    }, endSession: async () => {},
  }) as any);
  t.mock.method(Campaign, 'findOne', (query: any) => chain(query.slug === campaign.slug && campaign.status === 'LIVE' ? campaign : null));
  t.mock.method(Campaign, 'findById', () => chain(campaign));
  t.mock.method(Campaign, 'find', () => chain([{ ...campaign, toJSON: () => ({ ...campaign }) }]));
  t.mock.method(Partner, 'findOne', (query: any) => chain(matches(partner, query) ? partner : null));
  t.mock.method(Partner, 'findById', (id: string) => chain(id === 'partner-1' ? { ...partner, _id: id } : null));
  t.mock.method(Lead, 'findOne', (query: any) => chain(() => leads.find((lead) => matches(lead, query)) || null));
  t.mock.method(Lead, 'findById', (id: string) => chain(() => leads.find((lead) => lead._id === id) || null));
  t.mock.method(Lead, 'find', (query: any) => chain(() => leads.filter((lead) => matches(lead, query))));
  t.mock.method(Lead, 'countDocuments', (query: any) => chain(() => leads.filter((lead) => matches(lead, query)).length));
  t.mock.method(Lead, 'create', async (rows: any[]) => {
    if (failSave) throw Object.assign(new Error('Simulated storage failure'), { status: 503 });
    const row = { ...rows[0], _id: `lead-${leads.length + 1}`, createdAt: new Date().toISOString(), save: async () => {}, toJSON() { return { ...this }; } };
    await new Lead(rows[0]).validate();
    leads.push(row);
    return [row];
  });
  t.mock.method(Lead.prototype, 'save', async function () {
    await this.validate();
    const data = this.toObject();
    leads.push({ ...data, _id: String(data._id), save: async () => {}, toJSON() { return { ...this }; } });
    return this;
  });
  t.mock.method(TrackingClick, 'create', async (rows: any[]) => { clicks.push(...rows); return rows; });
  t.mock.method(TrackingClick, 'findOne', (query: any) => chain(clicks.find((click) => click.clickId === query.clickId)));
  t.mock.method(Notification, 'create', async (rows: any[]) => { notices.push(...rows); return rows; });
  t.mock.method(Notification, 'find', (query: any) => chain(() => notices.filter((notice) => matches(notice, query))));
  t.mock.method(Notification, 'countDocuments', (query: any) => chain(() => notices.filter((notice) => matches(notice, query)).length));
  t.mock.method(AppSetting, 'findOne', () => chain(null));
  t.mock.method(AuditLog, 'create', async (rows: any[]) => { audits.push(...rows); return rows; });
  t.mock.method(VendorWebhookEvent, 'create', async () => []);
  t.mock.method(WalletTransaction, 'updateOne', async (query: any, update: any) => {
    financialWrites++;
    if (!ledger.some((entry) => matches(entry, query))) {
      const entry = update.$setOnInsert;
      await new WalletTransaction(entry).validate();
      ledger.push({ ...entry, _id: `transaction-${ledger.length + 1}`, save: async () => {} });
    }
    return {};
  });
  t.mock.method(WalletTransaction, 'findOne', (query: any) => chain(() => ledger.find((entry) => matches(entry, query))));
  t.mock.method(WalletTransaction, 'find', (query: any) => chain(() => ledger.filter((entry) => matches(entry, query))));
  t.mock.method(AdminUser, 'findById', () => chain({ _id: 'admin-1', email: 'admin@example.test', status: 'ACTIVE', toJSON() { return { email: this.email }; } }));
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const link = '/api/public/campaigns/sample/go?ref=REF-123&pid=VED-PTR-123';
  const getForm = async () => {
    const response = await fetch(`${base}${link}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('Sample &lt;Campaign&gt;'));
    assert.ok(html.includes('Broker &amp; Co'));
    assert.ok(html.includes('name="clientName"') && html.includes('name="clientMobile"'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return html.match(/name="captureToken" value="([^"]+)"/)![1];
  };
  const post = (token: string, fields: Record<string, string> = {}, origin = base) => fetch(`${base}/api/public/campaigns/sample/go`, {
    method: 'POST', redirect: 'manual', headers: { Origin: origin },
    body: new URLSearchParams({ captureToken: token, clientName: 'Test Customer', clientMobile: '+91 98765 43210', consent: 'yes', ...fields }),
  });
  const admin = signToken({ id: 'admin-1', email: 'admin@example.test', role: 'ADMIN' });
  const patch = (path: string, body: any, authenticated = true) => fetch(`${base}/api/admin${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${admin}` } : {}) }, body: JSON.stringify(body),
  });
  try {
    const token = await getForm();
    assert.equal(clicks.length, 0, 'Viewing the form must not create a started lead');
    assert.equal((await post(token, { clientMobile: 'invalid' })).status, 400);
    assert.equal((await post(token, { clientName: '<script>alert(1)</script>' })).status, 400);
    assert.equal((await post(token, { consent: '' })).status, 400);
    assert.equal((await post('tampered')).status, 400);
    assert.equal((await post(token, {}, 'https://untrusted.example')).status, 403);
    assert.equal(leads.length, 0);
    const expired = jwt.sign({ slug: 'sample', ref: 'REF-123', pid: 'VED-PTR-123', clickId: 'expired' }, process.env.JWT_SECRET, { expiresIn: -1, audience: 'ved-lead-capture', issuer: 'ved-api' });
    const expiredResponse = await post(expired);
    assert.equal(expiredResponse.status, 400);
    assert.ok((await expiredResponse.text()).includes('Reopen the form'), 'Expired forms offer a safe way to resume');

    const saved = await post(token);
    assert.equal(saved.status, 303);
    const target = new URL(saved.headers.get('location')!);
    assert.equal(target.origin, 'https://vendor.example');
    assert.equal(target.searchParams.get('offer'), 'original');
    assert.equal(target.searchParams.get('ref'), 'REF-123');
    assert.equal(target.searchParams.get('pid'), 'VED-PTR-123');
    assert.equal(target.searchParams.get('clickid'), clicks[0].clickId);
    assert.ok(!target.toString().includes('9876543210') && !target.toString().includes('Customer'));
    assert.equal(leads[0].clientMobile, '9876543210');
    assert.equal(leads[0].status, 'PENDING');
    assert.equal(leads[0].submittedData.processStatus, 'IN_PROCESS');
    assert.ok(leads[0].submittedData.consentAt);
    assert.equal(notices.length, 1);
    assert.equal(financialWrites, 0);
    assert.equal((await post(token)).status, 303);
    assert.equal(leads.length, 1, 'Repeated form submit should resume the same enquiry');
    assert.equal(clicks.length, 1);
    assert.equal(notices.length, 1);

    assert.equal((await patch('/leads/lead-1/process', { processStatus: 'NOT_SUBMITTED' }, false)).status, 401);
    assert.equal((await patch('/leads/lead-1/process', { processStatus: 'APPROVED' })).status, 400);
    assert.equal((await patch('/leads/lead-1/process', { processStatus: 'NOT_SUBMITTED' })).status, 200);
    assert.equal(leads[0].submittedData.processStatus, 'NOT_SUBMITTED');
    const listed = await fetch(`${base}/api/admin/leads?status=NOT_SUBMITTED`, { headers: { Authorization: `Bearer ${admin}` } });
    assert.equal((await listed.json()).data.length, 1);
    assert.equal((await patch('/leads/lead-1/review', { status: 'APPROVED' })).status, 409);
    assert.equal((await patch('/leads/lead-1/process', { processStatus: 'IN_PROCESS' })).status, 200);
    assert.equal(audits.length, 2);

    const callback = await fetch(`${base}/api/webhooks/vendor`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-vendor-secret' },
      body: JSON.stringify({ eventId: 'event-1', clickId: clicks[0].clickId, conversionId: 'conversion-1', status: 'approved' }),
    });
    assert.equal(callback.status, 200);
    assert.equal((await callback.json()).data.ignoredManualEnquiry, true);
    assert.equal(leads.length, 1);
    assert.equal(financialWrites, 0);
    assert.equal((await patch('/leads/lead-1/review', { status: 'REJECTED', rejectionReason: 'Application not eligible' })).status, 200);
    assert.equal(leads[0].status, 'REJECTED');
    assert.equal((await patch('/leads/lead-1/process', { processStatus: 'IN_PROCESS' })).status, 409);

    const failingToken = await getForm();
    failSave = true;
    const failed = await post(failingToken);
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('location'), null, 'Never redirect when storage fails');
    const failureHtml = await failed.text();
    assert.ok(failureHtml.includes('We could not save your enquiry') && failureHtml.includes('value="Test Customer"') && failureHtml.includes('value="+91 98765 43210"'), 'Failed saves retain entered details on the form');
    assert.ok(failureHtml.includes('name="consent" value="yes" checked'));
    assert.equal(leads.length, 1);
    failSave = false;
    campaign.baseTrackingUrl = 'https://wa.me/911234567890?text=Hello&utm_source=old';
    const whatsapp = await post(failingToken);
    const whatsappTarget = new URL(whatsapp.headers.get('location')!);
    assert.ok(whatsappTarget.searchParams.get('text')!.includes('VED reference:'));
    assert.equal(whatsappTarget.searchParams.has('utm_source'), false);
    assert.equal(whatsappTarget.searchParams.has('pid'), false);

    const unattributed = await fetch(`${base}/api/public/campaigns/sample/go`, { redirect: 'manual' });
    assert.equal(unattributed.status, 302, 'Existing unattributed redirect still works');
    assert.equal(leads.length, 2);

    // Approving and paying a captured enquiry still uses the existing earning ledger.
    assert.equal((await patch('/leads/lead-2/review', { status: 'VERIFIED' })).status, 200);
    assert.equal((await patch('/leads/lead-2/review', { status: 'APPROVED' })).status, 200);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].amount, 250);
    assert.equal((await patch('/leads/lead-2/review', { status: 'APPROVED' })).status, 409);
    assert.equal(ledger.length, 1);
    assert.equal((await patch('/leads/lead-2/paid', { paymentReference: 'TEST-PAYMENT' })).status, 200);
    assert.equal(leads[1].status, 'PAID');
    assert.equal(ledger[0].status, 'PROCESSED');
    assert.equal((await patch('/leads/lead-2/paid', { paymentReference: 'TEST-PAYMENT' })).status, 409);

    // Existing manual partner submission remains available and does not create customer-form progress fields.
    const partnerToken = signToken({ id: 'partner-1', partnerId: partner.partnerId, email: 'partner@example.test', role: 'PARTNER' });
    const manualBody = { campaignId: 'sample', clientName: 'Manual Customer', clientMobile: '9876543210', accountId: 'APPLICATION-123', submittedNotes: 'Existing manual flow', status: 'APPROVED' };
    const manualSubmit = () => fetch(`${base}/api/partner/leads`, { method: 'POST', headers: { Authorization: `Bearer ${partnerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(manualBody) });
    const manualResponse = await manualSubmit();
    assert.equal(manualResponse.status, 201);
    const manualLead = (await manualResponse.json()).data;
    assert.equal(manualLead.status, 'PENDING');
    assert.equal(manualLead.submittedData.source, undefined);
    assert.equal((await manualSubmit()).status, 409);
    assert.equal((await patch(`/leads/${manualLead._id}/process`, { processStatus: 'NOT_SUBMITTED' })).status, 404);
    assert.equal((await patch(`/leads/${manualLead._id}/review`, { status: 'APPROVED' })).status, 200);

    // Legacy vendor conversions without a customer-form enquiry still get processed automatically.
    clicks.push({ ...clicks[0], clickId: 'legacy-click' });
    const legacyCallback = await fetch(`${base}/api/webhooks/vendor`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-vendor-secret' },
      body: JSON.stringify({ eventId: 'legacy-event', clickId: 'legacy-click', conversionId: 'legacy-conversion', status: 'approved', customerName: 'Vendor Customer', customerMobile: '9876543210' }),
    });
    assert.equal(legacyCallback.status, 200);
    assert.equal((await legacyCallback.json()).data.status, 'APPROVED');
    assert.equal(leads.find((lead) => lead.vendorClickId === 'legacy-click')?.clientName, 'Vendor Customer');
    assert.equal(ledger.length, 3, 'Captured, manual, and legacy vendor leads each earn only one ledger entry');

    const partnerGet = (path: string) => fetch(`${base}/api/partner${path}`, { headers: { Authorization: `Bearer ${partnerToken}` } });
    const dashboardResponse = await partnerGet('/dashboard');
    assert.equal(dashboardResponse.status, 200);
    const summary = (await dashboardResponse.json()).data.summary;
    assert.equal(summary.totalLeads, 4);
    assert.equal(summary.successfulLeads, 3);
    assert.equal(summary.rejectedLeads, 1);
    assert.equal(summary.totalEarnings, 750);
    assert.equal(summary.availableWalletBalance, 500, 'Paid earnings must not remain available to withdraw');
    const walletResponse = await partnerGet('/wallet');
    assert.equal(walletResponse.status, 200);
    const wallet = (await walletResponse.json()).data;
    assert.equal(wallet.availableBalance, 500);
    assert.equal(wallet.totalEarned, 750);
    assert.equal(wallet.transactions.length, 3);
    const notificationsResponse = await partnerGet('/notifications');
    assert.equal(notificationsResponse.status, 200);
    const notifications = await notificationsResponse.json();
    assert.equal(notifications.data.filter((notice: any) => notice.title === 'Customer started an application').length, 2);
    assert.ok(notifications.unreadCount >= 2);
    campaign.status = 'PAUSED';
    assert.equal((await fetch(`${base}${link}`)).status, 404);
    campaign.status = 'LIVE';
    assert.equal((await fetch(`${base}/api/public/campaigns/sample/go?ref=bad&pid=wrong`)).status, 400);
    mongoose.connection.readyState = 0;
    assert.equal((await fetch(`${base}${link}`)).status, 503);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    mongoose.connection.readyState = 0;
  }
});
