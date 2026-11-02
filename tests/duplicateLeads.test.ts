import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { createApp } from '../server/app.ts';
import { Lead } from '../server/models/Lead.ts';
import { Campaign } from '../server/models/Campaign.ts';
import { Partner } from '../server/models/Partner.ts';
import { TrackingClick } from '../server/models/TrackingClick.ts';
import { Notification } from '../server/models/Notification.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { WalletTransaction } from '../server/models/WalletTransaction.ts';
import { VendorWebhookEvent } from '../server/models/VendorWebhookEvent.ts';
import { CampaignMobileClaim } from '../server/models/CampaignMobileClaim.ts';
import { LeadDuplicateProtection, DUPLICATE_MOBILE_MESSAGE, isClaimCollision } from '../server/services/leadDuplicateProtection.ts';
import { PartnerStore } from '../server/services/partnerStore.ts';
import { normalizeCustomerMobile } from '../shared/customerMobile.ts';
import { inventoryCampaignMobiles } from '../scripts/lib/campaignMobileInventory.ts';
import { signToken } from '../server/utils/jwt.ts';

test('normalization and historical inventory preserve conflicts without choosing a partner', async () => {
  for (const mobile of ['9876543210', '+91 98765 43210', '91(98765)-43210', ' 98765-43210 ']) assert.equal(normalizeCustomerMobile(mobile), '9876543210');
  for (const mobile of ['00919876543210', '09876543210', '9876543210ext1', '1234567890', '', null, 9876543210]) assert.equal(normalizeCustomerMobile(mobile), null);
  const rows = [
    { _id: 'old-1', campaignId: 'id-1', clientMobile: '+91 98765 43210', partnerId: 'P1', status: 'PAID', submittedData: { source: 'CUSTOMER_FORM' } },
    { _id: 'old-2', campaignId: 'broker', clientMobile: '9876543210', partnerId: 'P2', status: 'APPROVED' },
    { _id: 'old-3', campaignId: 'id-2', clientMobile: '9876543210', partnerId: 'P2' },
    { _id: 'unknown', campaignId: 'missing', clientMobile: '' },
  ];
  const before = JSON.stringify(rows);
  const result = await inventoryCampaignMobiles([{ _id: 'id-1', slug: 'broker' }, { _id: 'id-2', slug: 'other' }], (async function* () { yield* rows; })());
  assert.equal(result.summary.duplicateGroups, 1); assert.equal(result.summary.crossPartnerGroups, 1); assert.equal(result.summary.crossSourceGroups, 1); assert.equal(result.summary.approvedOrPaidConflictGroups, 1);
  assert.equal(result.summary.invalidOrMissingMobile, 1); assert.equal(result.summary.unresolvedCampaign, 1);
  assert.equal(result.claims[0].state, 'HISTORICAL_CONFLICT'); assert.equal(result.claims[0].leadId, undefined); assert.equal(result.claims[0].partnerId, undefined);
  assert.equal(JSON.stringify(rows), before); assert.ok(!JSON.stringify(result.summary).includes('9876543210'));
  assert.ok(CampaignMobileClaim.schema.indexes().some(([key, opts]: any) => key.canonicalCampaignId === 1 && key.normalizedMobile === 1 && !key.partnerId && opts.unique));
  assert.equal(isClaimCollision({ code: 11000, keyPattern: { canonicalCampaignId: 1, normalizedMobile: 1 } }), true);
  assert.equal(isClaimCollision({ code: 11000, keyPattern: { eventId: 1 } }), false);
});

test('readiness is read-only and fails closed without verified migration and a full unique index', async t => {
  const ready = mongoose.connection.readyState, db = mongoose.connection.db;
  let prepared = false; let unique = false; let partial = false;
  mongoose.connection.readyState = 1;
  mongoose.connection.db = { collection(name: string) {
    return name === 'leadDeduplicationState' ? { findOne: async () => ({ ready: prepared, version: 1 }) }
      : { indexes: async () => [{ key: { canonicalCampaignId: 1, normalizedMobile: 1 }, unique, ...(partial ? { partialFilterExpression: { state: 'CLAIMED' } } : {}) }] };
  } } as any;
  t.after(() => { mongoose.connection.readyState = ready; mongoose.connection.db = db; });
  await assert.rejects(LeadDuplicateProtection.assertReady(), { status: 503 });
  prepared = true; await assert.rejects(LeadDuplicateProtection.assertReady(), { status: 503 });
  unique = true; await LeadDuplicateProtection.assertReady();
  partial = true; await assert.rejects(LeadDuplicateProtection.assertReady(), { status: 503 });
});

test('atomic unique-index collision becomes a safe structured duplicate error', async t => {
  t.mock.method(CampaignMobileClaim, 'findOne', () => chain(() => null));
  let inserted = false;
  t.mock.method(CampaignMobileClaim, 'create', async () => {
    if (inserted) throw { code: 11000, keyPattern: { canonicalCampaignId: 1, normalizedMobile: 1 } };
    inserted = true; return [];
  });
  const result = await Promise.allSettled([
    LeadDuplicateProtection.claim('campaign', '9876543210', 'first', 'P1', {} as any),
    LeadDuplicateProtection.claim('campaign', '9876543210', 'second', 'P2', {} as any),
  ]);
  assert.equal(result.filter(row => row.status === 'fulfilled').length, 1);
  const failed = result.find(row => row.status === 'rejected') as PromiseRejectedResult;
  assert.equal(failed.reason.code, 'DUPLICATE_CAMPAIGN_MOBILE'); assert.equal(failed.reason.message, DUPLICATE_MOBILE_MESSAGE);
  assert.ok(!JSON.stringify(failed.reason).includes('9876543210'));
});

const match = (row: any, query: any): boolean => Object.entries(query).every(([key, value]: any) => {
  if (key === '$or') return value.some((part: any) => match(row, part));
  const found = key.split('.').reduce((obj: any, field: string) => obj?.[field], row);
  if (value && typeof value === 'object') {
    if ('$in' in value) return value.$in.includes(String(found));
    if ('$gt' in value) return new Date(found) > value.$gt;
  }
  return String(found) === String(value);
});
function chain(run: () => any): any { const query: any = { exec: async () => run() }; for (const method of ['session', 'lean', 'select', 'sort']) query[method] = () => query; query.then = (resolve: any, reject: any) => query.exec().then(resolve, reject); return query; }

test('all creation paths share campaign/mobile ownership, concurrent protection and unchanged financial rules', async t => {
  const env = { ...process.env }, ready = mongoose.connection.readyState;
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'duplicate-test-secret-32-characters-long', VENDOR_WEBHOOK_SECRET: 'duplicate-vendor-test' }); mongoose.connection.readyState = 1;
  t.after(() => { process.env = env; mongoose.connection.readyState = ready; });
  const campaigns = [{ _id: '507f1f77bcf86cd799439001', slug: 'broker', name: 'Broker', status: 'LIVE', payout: 250, currency: 'INR', requiredAction: 'Apply', baseTrackingUrl: 'https://vendor.example/apply?original=1' }, { _id: '507f1f77bcf86cd799439002', slug: 'other', name: 'Other', status: 'LIVE', payout: 100, requiredAction: 'Apply', baseTrackingUrl: 'https://vendor.example/other' }];
  const partners = [{ _id: '507f1f77bcf86cd799439011', partnerId: 'VED-PTR-ONE', referralCode: 'VEDONE', accountStatus: 'ACTIVE' }, { _id: '507f1f77bcf86cd799439012', partnerId: 'VED-PTR-TWO', referralCode: 'VEDTWO', accountStatus: 'ACTIVE' }];
  const leads: any[] = [], claims: any[] = [], clicks: any[] = [], notices: any[] = [], wallet: any[] = [], events: any[] = [], audits: any[] = [];
  const arrays = [leads, claims, clicks, notices, wallet, events, audits];
  let queue = Promise.resolve(); let failLead = false;
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction(operation: () => Promise<void>) {
    const run = queue.then(async () => { const snapshot = arrays.map(rows => [...rows]); try { await operation(); } catch (error) { arrays.forEach((rows, index) => rows.splice(0, rows.length, ...snapshot[index])); throw error; } });
    queue = run.catch(() => {}); return run;
  }, endSession: async () => {} }) as any);
  t.mock.method(LeadDuplicateProtection, 'assertReady', async () => {});
  t.mock.method(CampaignMobileClaim, 'findOne', (query: any) => chain(() => claims.find(row => match(row, query)) || null));
  t.mock.method(CampaignMobileClaim, 'create', async ([row]: any[]) => {
    if (claims.some(existing => existing.canonicalCampaignId === row.canonicalCampaignId && existing.normalizedMobile === row.normalizedMobile)) throw { code: 11000, keyPattern: { canonicalCampaignId: 1, normalizedMobile: 1 } };
    claims.push({ ...row }); return [row];
  });
  t.mock.method(Campaign, 'findOne', (query: any) => chain(() => campaigns.find(row => match(row, query)) || null));
  t.mock.method(Campaign, 'findById', (id: any) => chain(() => campaigns.find(row => row._id === String(id)) || null));
  t.mock.method(Campaign, 'find', (query: any) => chain(() => campaigns.filter(row => match(row, query)).map(row => ({ ...row, toJSON: () => ({ ...row }) }))));
  t.mock.method(Partner, 'findOne', (query: any) => chain(() => partners.find(row => match(row, query)) || null));
  t.mock.method(PartnerStore, 'findById', async (id: string) => partners.find(row => row._id === id));
  t.mock.method(PartnerStore, 'getSessionsInvalidatedAt', async () => 0);
  const doc = (row: any) => ({ ...row, save: async function () {}, toJSON() { return { ...this }; } });
  t.mock.method(Lead, 'findOne', (query: any) => chain(() => leads.find(row => match(row, query)) || null));
  t.mock.method(Lead, 'findById', (id: any) => chain(() => leads.find(row => String(row._id) === String(id)) || null));
  t.mock.method(Lead, 'create', async ([row]: any[]) => { if (failLead) throw new Error('Test failure'); const saved = doc({ ...row, _id: String(row._id) }); leads.push(saved); return [saved]; });
  t.mock.method(Lead.prototype, 'save', async function () { const row = doc({ ...this.toObject(), _id: String(this._id) }); leads.push(row); return this; });
  t.mock.method(Lead, 'countDocuments', (query: any) => chain(() => leads.filter(row => match(row, query)).length));
  t.mock.method(TrackingClick, 'create', async (rows: any) => { clicks.push(...(Array.isArray(rows) ? rows : [rows])); return rows; });
  t.mock.method(TrackingClick, 'findOne', (query: any) => chain(() => clicks.find(row => match(row, query)) || null));
  t.mock.method(VendorWebhookEvent, 'findOne', (query: any) => chain(() => events.find(row => match(row, query)) || null));
  t.mock.method(VendorWebhookEvent, 'create', async (rows: any[]) => { events.push(...rows); return rows; });
  t.mock.method(Notification, 'create', async (rows: any[]) => { notices.push(...rows); return rows; });
  t.mock.method(AuditLog, 'create', async (rows: any[]) => { audits.push(...rows); return rows; });
  t.mock.method(WalletTransaction, 'updateOne', async (query: any, update: any) => { if (!wallet.some(row => match(row, query))) wallet.push(update.$setOnInsert); return {}; });
  const server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const token = (index: number) => signToken({ id: partners[index]._id, partnerId: partners[index].partnerId, email: 'test@example.test', role: 'PARTNER' });
  const submit = (mobile: string, campaignId = 'broker', partner = 0, accountId = 'ACCOUNT-1') => fetch(base + '/api/partner/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(partner)}` }, body: JSON.stringify({ campaignId, clientMobile: mobile, clientName: 'Test Customer', accountId }) });
  const form = async (campaign = 'broker') => { const response = await fetch(`${base}/api/public/campaigns/${campaign}/go?ref=VEDONE&pid=VED-PTR-ONE`); return (await response.text()).match(/name="captureToken" value="([^"]+)"/)![1]; };
  const capture = (captureToken: string, mobile: string, campaign = 'broker') => fetch(`${base}/api/public/campaigns/${campaign}/go`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ captureToken, clientName: 'Test Customer', clientMobile: mobile, consent: 'yes' }) });
  const webhook = (body: any) => fetch(base + '/api/webhooks/vendor', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-vendor-webhook-secret': 'duplicate-vendor-test' }, body: JSON.stringify(body) });

  const firstToken = await form(); assert.equal((await capture(firstToken, '+91 98765 43210')).status, 303);
  const original = leads[0], originalSnapshot = JSON.stringify(original);
  assert.equal((await capture(firstToken, '9876543210')).status, 409);
  const duplicate = await capture(await form(), '91(98765)-43210'); assert.equal(duplicate.status, 409); const html = await duplicate.text(); assert.ok(html.includes(DUPLICATE_MOBILE_MESSAGE) && html.includes('If Not Completed, Click Here'));
  const manualDuplicate = await submit('9876543210', campaigns[0]._id, 1); assert.equal(manualDuplicate.status, 409); const body = await manualDuplicate.json(); assert.equal(body.code, 'DUPLICATE_CAMPAIGN_MOBILE'); assert.equal(body.continuation.supported, false); assert.ok(!JSON.stringify(body).includes(partners[0].partnerId));
  assert.equal(leads.length, 1); assert.equal(clicks.length, 1); assert.equal(notices.length, 1); assert.equal(wallet.length, 0); assert.equal(JSON.stringify(original), originalSnapshot);
  assert.equal((await submit('9876543210', 'other', 1)).status, 201);
  const parallel = await Promise.all([submit('9876543211', 'broker', 0, 'PARALLEL-A'), submit('+91 98765 43211', campaigns[0]._id, 1, 'PARALLEL-B')]); assert.deepEqual(parallel.map(row => row.status).sort(), [201, 409]);
  assert.equal((await capture(await form(), '9876543211')).status, 409, 'Public form sees manual claim');
  for (const status of ['APPROVED', 'PAID']) { original.status = status; assert.equal((await submit('9876543210', 'broker', 0, status)).status, 409); } original.status = 'PENDING';
  const callbackBody = { eventId: 'form-event', clickId: original.vendorClickId, conversionId: 'form-conversion', status: 'approved', customerMobile: '9876543210' };
  assert.equal((await webhook(callbackBody)).status, 200); assert.equal(wallet.length, 0); assert.equal(original.status, 'PENDING');
  const vendorClick = { clickId: 'vendor-click', partnerId: partners[0].partnerId, campaignId: campaigns[0]._id, payoutSnapshot: 250, currency: 'INR', expiresAt: new Date(Date.now() + 60000) }; clicks.push(vendorClick);
  const vendorBody = { eventId: 'vendor-event', clickId: vendorClick.clickId, conversionId: 'vendor-conversion', status: 'approved', customerMobile: '+91 98765 43212' };
  assert.equal((await webhook(vendorBody)).status, 200); assert.equal(wallet.length, 1); assert.equal(wallet[0].amount, 250);
  const count = leads.length, noticeCount = notices.length;
  assert.equal((await webhook(vendorBody)).status, 200); assert.equal((await webhook({ ...vendorBody, eventId: 'vendor-repeat' })).status, 200); assert.equal(leads.length, count); assert.equal(wallet.length, 1); assert.equal(notices.length, noticeCount);
  assert.equal((await submit('9876543212', 'broker', 1, 'VENDOR-DUPLICATE')).status, 409);
  clicks.push({ ...vendorClick, clickId: 'cross-partner', partnerId: partners[1].partnerId });
  assert.equal((await webhook({ ...vendorBody, eventId: 'cross-event', clickId: 'cross-partner', conversionId: 'different' })).status, 409); assert.equal(wallet.length, 1);
  clicks.push({ ...vendorClick, clickId: 'unknown-customer' });
  assert.equal((await webhook({ ...vendorBody, clickId: 'unknown-customer', eventId: 'missing-mobile', conversionId: 'missing-mobile', customerMobile: '' })).status, 422);
  failLead = true; const beforeClaims = claims.length, beforeClicks = clicks.length; assert.equal((await capture(await form(), '9876543213')).status, 503); assert.equal(claims.length, beforeClaims); assert.equal(clicks.length, beforeClicks); failLead = false;
  claims.push({ canonicalCampaignId: campaigns[0]._id, normalizedMobile: '9876543214', state: 'HISTORICAL_CONFLICT', historicalCount: 2 });
  assert.equal((await submit('9876543214', 'broker', 0, 'HISTORICAL')).status, 409);
  const preserved = arrays.map(rows => JSON.stringify(rows));
  clicks.push({ ...vendorClick, clickId: 'isolated-history', campaignId: 'historical:00000000-0000-4000-8000-000000000001' });
  assert.equal((await webhook({ ...vendorBody, eventId: 'history-event', clickId: 'isolated-history', conversionId: 'history-conversion' })).status, 409);
  clicks.pop();
  assert.deepEqual(arrays.map(rows => JSON.stringify(rows)), preserved, 'Historical callback must not write events, leads, claims or financial entries');
  clicks.push({ ...vendorClick, clickId: 'history-conflict' });
  assert.equal((await webhook({ ...vendorBody, eventId: 'history-conflict-event', clickId: 'history-conflict', conversionId: 'history-conflict-conversion', customerMobile: '9876543214' })).status, 409);
  clicks.pop();
  assert.deepEqual(arrays.map(rows => JSON.stringify(rows)), preserved);
  const unauthorized = await fetch(base + `/api/public/campaigns/broker/resume?leadId=${original._id}&mobile=9876543210`); assert.equal(unauthorized.status, 404); assert.ok(!(await unauthorized.text()).includes(partners[0].partnerId));
  assert.equal((await submit('invalid', 'broker')).status, 400);
});
