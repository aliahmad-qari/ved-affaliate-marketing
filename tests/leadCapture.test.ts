import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
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
import { redirectToCampaignTracking } from '../server/controllers/campaignController.ts';
import { LeadDuplicateProtection, duplicateMobileError } from '../server/services/leadDuplicateProtection.ts';

// Exercise real HTTP routes with isolated database doubles; no live database or vendor calls.
test('customer capture, redirect, admin progress and existing tracking compatibility', async (t) => {
  const previousRegistryFlag = process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT;
  delete process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT;
  t.after(() => {
    if (previousRegistryFlag === undefined) delete process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT;
    else process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT = previousRegistryFlag;
  });
  process.env.JWT_SECRET = 'test-secret-for-capture-only-32-characters';
  process.env.VENDOR_WEBHOOK_SECRET = 'test-vendor-secret';
  process.env.NODE_ENV = 'test';
  const renderOrigin = 'https://ved-affaliate-marketing.onrender.com';
  process.env.RENDER_EXTERNAL_URL = renderOrigin;
  mongoose.connection.readyState = 1;
  const campaign: any = { _id: 'campaign-1', slug: 'sample', name: 'Sample <Campaign>', companyName: 'Broker & Co', status: 'LIVE', requiredAction: 'Open an account', campaignType: 'Demat & Trading', payout: 250, currency: 'INR', baseTrackingUrl: 'https://vendor.example/apply?offer=original' };
  const campaigns: any[] = [campaign];
  const partner = { partnerId: 'VED-PTR-123', referralCode: 'REF-123', accountStatus: 'ACTIVE' };
  const leads: any[] = [], clicks: any[] = [], notices: any[] = [], audits: any[] = [], ledger: any[] = [], claims: any[] = [];
  let failSave = false, financialWrites = 0, transactionQueue = Promise.resolve();
  const chain = (value: any): any => {
    const query: any = { exec: async () => typeof value === 'function' ? value() : value };
    query.then = (resolve: any, reject: any) => query.exec().then(resolve, reject);
    for (const method of ['select', 'lean', 'session', 'sort', 'skip', 'limit']) query[method] = () => query;
    return query;
  };
  const matches = (doc: any, filter: any) => Object.entries(filter).every(([key, value]: any) => {
    if (key === '$or') return value.some((condition: any) => matches(doc, condition));
    if (key === '$nor') return !value.some((condition: any) => matches(doc, condition));
    const found = key.split('.').reduce((obj: any, field: string) => obj?.[field], doc);
    if (value instanceof RegExp) return value.test(found || '');
    if (value && typeof value === 'object' && '$exists' in value) return (found !== undefined) === value.$exists;
    if (value && typeof value === 'object' && '$lte' in value) return found != null && new Date(found) <= value.$lte;
    return value && typeof value === 'object' && '$in' in value ? value.$in.includes(found) : found === value;
  });
  t.mock.method(mongoose, 'startSession', async () => ({
    withTransaction: async (operation: () => Promise<void>) => {
      const preceding = transactionQueue;
      let release!: () => void;
      transactionQueue = new Promise<void>(resolve => { release = resolve; });
      await preceding;
      const sizes = [leads.length, clicks.length, notices.length, claims.length];
      try { await operation(); } catch (error) {
        [leads.length, clicks.length, notices.length, claims.length] = sizes;
        throw error;
      } finally { release(); }
    }, endSession: async () => {},
  }) as any);
  t.mock.method(Campaign, 'findOne', (query: any) => chain(campaigns.find(item => query.slug === item.slug && item.status === 'LIVE') || null));
  t.mock.method(LeadDuplicateProtection, 'assertReady', async () => {});
  t.mock.method(LeadDuplicateProtection, 'claim', async (campaignId: string, rawMobile: unknown, leadId: string, partnerId: string) => {
    const mobile = LeadDuplicateProtection.normalize(rawMobile)!;
    if (process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT !== 'true') return mobile;
    if (claims.some(claim => claim.canonicalCampaignId === campaignId && claim.normalizedMobile === mobile)) throw duplicateMobileError();
    claims.push({ canonicalCampaignId: campaignId, normalizedMobile: mobile, leadId, partnerId });
    return mobile;
  });
  t.mock.method(Campaign, 'findById', (id: string) => chain(campaigns.find(item => String(item._id) === String(id)) || null));
  t.mock.method(Campaign, 'find', (query: any = {}) => chain(matches(campaign, query) ? [{ ...campaign, toJSON: () => ({ ...campaign }) }] : []));
  t.mock.method(Partner, 'findOne', (query: any) => {
    const found = matches(partner, query) ? partner : null;
    const result = chain(found);
    result.select = (fields: string) => chain(found ? Object.fromEntries(fields.split(' ').filter(field => field in found).map(field => [field, (found as any)[field]])) : null);
    return result;
  });
  t.mock.method(Partner, 'findById', (id: string) => chain(id === 'partner-1' ? { ...partner, _id: id } : null));
  t.mock.method(Partner, 'find', () => chain([{ partnerId: partner.partnerId, fullName: 'Actual Submitting Partner' }]));
  t.mock.method(Partner, 'updateOne', () => chain({ matchedCount: 1 }));
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
  t.mock.method(TrackingClick, 'create', async (rows: any) => { clicks.push(...(Array.isArray(rows) ? rows : [rows])); return rows; });
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
  const mockVendor = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('synthetic vendor destination');
  });
  mockVendor.listen(0, '127.0.0.1');
  await once(mockVendor, 'listening');
  const mockVendorOrigin = `http://127.0.0.1:${(mockVendor.address() as any).port}`;
  const link = '/api/public/campaigns/sample/go?ref=REF-123&pid=VED-PTR-123';
  const getForm = async (cookie?: string) => {
    const response = await fetch(`${base}${link}`, { headers: cookie ? { Cookie: cookie } : {} });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('Unlock'));
    assert.ok(html.includes('CONTINUE SECURELY'));
    assert.ok(html.includes('action="/api/public/campaigns/sample/go"'));
    assert.ok(html.includes('name="clientName"') && html.includes('name="clientMobile"'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    return html.match(/name="captureToken" value="([^"]+)"/)![1];
  };
  const post = (token: string, fields: Record<string, string> = {}, origin = base, cookie?: string) => fetch(`${base}/api/public/campaigns/sample/go`, {
    method: 'POST', redirect: 'manual', headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: new URLSearchParams({ captureToken: token, clientName: 'Test Customer', clientMobile: '+91 98765 43210', consent: 'yes', ...fields }),
  });
  const admin = signToken({ id: 'admin-1', email: 'admin@example.test', role: 'ADMIN' });
  const patch = (path: string, body: any, authenticated = true) => fetch(`${base}/api/admin${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${admin}` } : {}) }, body: JSON.stringify(body),
  });
  try {
    const token = await getForm();
    assert.equal(clicks.length, 1, 'A legitimate tracking-link visit is recorded without creating a lead');
    assert.equal((await post(token, { clientMobile: 'invalid' })).status, 400);
    assert.equal((await post(token, { clientName: '<script>alert(1)</script>' })).status, 400);
    assert.equal((await post(token, { consent: '' })).status, 400);
    assert.equal((await post('tampered')).status, 400);
    assert.equal((await post(token, {}, 'https://untrusted.example')).status, 403);
    assert.equal((await post(token, {}, 'null')).status, 403, 'Do not allow arbitrary opaque origins to bypass the check');
    assert.equal((await post(token, {}, 'https://another-service.onrender.com')).status, 403);
    assert.equal((await post('tampered', {}, renderOrigin)).status, 400, 'The Render origin still requires a valid signed capture token');
    const unrelatedMutation = await fetch(`${base}/api/admin/auth/login`, {
      method: 'POST', headers: { Origin: renderOrigin, 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(unrelatedMutation.status, 403, 'The Render exception only applies to the public form route');
    assert.equal(leads.length, 0);
    const expired = jwt.sign({ slug: 'sample', ref: 'REF-123', pid: 'VED-PTR-123', clickId: 'expired' }, process.env.JWT_SECRET, { expiresIn: -1, audience: 'ved-lead-capture', issuer: 'ved-api' });
    const expiredResponse = await post(expired);
    assert.equal(expiredResponse.status, 400);
    assert.ok((await expiredResponse.text()).includes('Reopen the form'), 'Expired forms offer a safe way to resume');

    campaign.baseTrackingUrl = `${mockVendorOrigin}/apply?offer=original`;
    const saved = await post(token, {}, 'https://vedaffiliatepvtltd.com');
    assert.equal(saved.status, 303);
    const target = new URL(saved.headers.get('location')!);
    assert.equal(target.origin, mockVendorOrigin);
    assert.equal(target.searchParams.get('offer'), 'original');
    assert.equal(target.searchParams.get('ref'), 'REF-123');
    assert.equal(target.searchParams.get('pid'), 'VED-PTR-123');
    assert.equal(target.searchParams.get('partner_id'), partner.partnerId);
    assert.equal(target.searchParams.get('campaign_id'), campaign._id);
    assert.equal(target.searchParams.get('clickid'), clicks[0].clickId);
    assert.ok(!target.toString().includes('9876543210') && !target.toString().includes('Customer'));
    const followedHandoff = await fetch(saved.headers.get('location')!);
    assert.equal(followedHandoff.status, 200);
    assert.equal(await followedHandoff.text(), 'synthetic vendor destination');
    assert.equal(leads[0].clientMobile, '9876543210');
    assert.equal(leads[0].status, 'PENDING');
    assert.equal(leads[0].submittedData.processStatus, 'IN_PROCESS');
    assert.ok(leads[0].submittedData.consentAt);
    assert.equal(notices.length, 1);
    assert.equal(financialWrites, 0);
    const approvedDestination = campaign.baseTrackingUrl;
    campaign.baseTrackingUrl = 'javascript:alert(1)';
    const invalidDestination = await post(token, { clientName: 'Test Customer', clientMobile: '9876543210' });
    assert.equal(invalidDestination.status, 404);
    assert.equal(invalidDestination.headers.get('location'), null, 'An invalid vendor destination never causes a redirect');
    assert.ok((await invalidDestination.text()).includes('This campaign link is not active yet.'));
    assert.equal(leads.length, 1, 'A missing or invalid destination does not create another lead');
    campaign.baseTrackingUrl = approvedDestination;
    const replay = await post(token, { clientName: '', clientMobile: '', consent: '' });
    assert.equal(replay.status, 200);
    const replayHtml = await replay.text();
    assert.ok(replayHtml.includes('Already Registered'));
    assert.ok(replayHtml.includes('This mobile number is already registered for this campaign.'));
    assert.ok(replayHtml.includes('data-duplicate-countdown="true">3</strong>'));
    const replayTarget = replayHtml.match(/window\.location\.replace\((".*?")\)/)?.[1];
    assert.ok(replayTarget, 'Same-click duplicate response retains a delayed destination');
    const replayDestination = new URL(JSON.parse(replayTarget!));
    assert.equal(replayDestination.origin, mockVendorOrigin);
    assert.equal(replayDestination.searchParams.get('clickid'), clicks[0].clickId);
    assert.ok(replayHtml.includes('href="/"'));
    assert.ok(!replayHtml.includes('/api/public/campaigns/sample/continue'));
    assert.ok(!replayHtml.includes('Test Customer'));
    const forgedContinuation = await fetch(`${base}/api/public/campaigns/sample/continue`, { method: 'POST', redirect: 'manual', headers: { Origin: base }, body: new URLSearchParams({ captureToken: 'forged', destination: 'https://attacker.example' }) });
    assert.equal(forgedContinuation.status, 410);
    assert.notEqual(forgedContinuation.headers.get('location'), 'https://attacker.example');
    const expiredContinuationToken = jwt.sign({ slug: 'sample', ref: 'REF-123', pid: 'VED-PTR-123', clickId: 'old-click', subteam: 'SUB-TRACK' }, process.env.JWT_SECRET, {
      expiresIn: -1, audience: 'ved-campaign-continuation', issuer: 'ved-api',
    });
    const expiredContinuation = await fetch(`${base}/api/public/campaigns/sample/continue`, { method: 'POST', redirect: 'manual', headers: { Origin: base }, body: new URLSearchParams({ captureToken: expiredContinuationToken }) });
    assert.equal(expiredContinuation.status, 410);
    assert.equal(expiredContinuation.headers.get('location'), null);
    const expiredContinuationHtml = await expiredContinuation.text();
    assert.ok(expiredContinuationHtml.includes('Reopen the campaign form to continue.'));
    assert.ok(expiredContinuationHtml.includes('ref=REF-123&amp;pid=VED-PTR-123&amp;subteam=SUB-TRACK'), 'An expired but validly signed continuation preserves original attribution for a safe retry');
    const remembered = await fetch(base + '/api/public/campaigns/sample/go?ref=REF-123&pid=VED-PTR-123');
    const rememberedHtml = await remembered.text();
    assert.equal(remembered.status, 200);
    assert.ok(rememberedHtml.includes('name="clientName"') && rememberedHtml.includes('name="clientMobile"') && !rememberedHtml.includes('Already Registered'), 'Every tracking-link visit displays the form irrespective of previous submissions');
    const rememberedToken = rememberedHtml.match(/name="captureToken" value="([^"]+)"/)![1];
    const sameCustomerRetry = await post(rememberedToken, { clientMobile: '91 (98765)-43210' });
    assert.equal(sameCustomerRetry.status, 200);
    const sameCustomerRetryHtml = await sameCustomerRetry.text();
    assert.ok(sameCustomerRetryHtml.includes('This mobile number is already registered for this campaign.'));
    assert.ok(sameCustomerRetryHtml.includes('data-duplicate-countdown="true">3</strong>'), 'Duplicate response retains the three-second countdown');
    const delayedRedirect = sameCustomerRetryHtml.match(/window\.location\.replace\((".*?")\)/)?.[1];
    assert.ok(delayedRedirect, 'Duplicate response has a server-selected delayed destination');
    const duplicateDestination = new URL(JSON.parse(delayedRedirect!));
    assert.equal(duplicateDestination.origin, mockVendorOrigin);
    assert.equal(duplicateDestination.pathname, '/apply');
    assert.equal(duplicateDestination.searchParams.get('offer'), 'original');
    assert.equal(duplicateDestination.searchParams.get('ref'), 'REF-123');
    assert.equal(duplicateDestination.searchParams.get('pid'), partner.partnerId);
    assert.equal(duplicateDestination.searchParams.get('clickid'), clicks.at(-1).clickId, 'Duplicate continuation uses this signed visit click, not the earlier lead click');
    assert.equal(leads.length, 1, 'Returning on the same signed browser context does not insert another lead');
    const originalPartnerId = leads[0].partnerId;
    leads[0].partnerId = 'VED-PTR-OTHER';
    const crossPartnerDuplicate = await post(await getForm());
    assert.equal(crossPartnerDuplicate.status, 200, 'A duplicate mobile from a different partner is detected too');
    assert.ok((await crossPartnerDuplicate.text()).includes('This mobile number is already registered for this campaign.'));
    leads[0].partnerId = originalPartnerId;
    assert.equal(leads.length, 1);
    const otherCustomerToken = await getForm();
    const otherCustomer = await post(otherCustomerToken, { clientName: 'Another Customer', clientMobile: '9123456789' });
    assert.equal(otherCustomer.status, 303, 'A different mobile on the same device may submit as a new customer');
    assert.equal(leads.length, 2);
    assert.equal(leads[1].partnerId, partner.partnerId, 'The original parent partner attribution remains intact');
    const duplicateMobileToken = await getForm();
    const duplicateMobile = await post(duplicateMobileToken);
    assert.equal(duplicateMobile.status, 200);
    assert.ok((await duplicateMobile.text()).includes('This mobile number is already registered for this campaign.'));
    const duplicateRefresh = await fetch(base + '/api/public/campaigns/sample/go?ref=REF-123&pid=VED-PTR-123');
    const duplicateRefreshHtml = await duplicateRefresh.text();
    assert.ok(duplicateRefreshHtml.includes('name="clientMobile"') && !duplicateRefreshHtml.includes('Already Registered'));
    assert.equal(leads.length, 2, 'An independent visit does not create a lead until a valid form is submitted');
    const forged = await fetch(base + '/api/public/campaigns/sample/go?ref=REF-123&pid=VED-PTR-123', { headers: { Cookie: 'ved_customer_capture=forged' } });
    assert.ok((await forged.text()).includes('name="clientMobile"'), 'A forged or stale cookie never hides the registration form');
    assert.equal(leads.length, 2, 'Repeated form submit should resume the same enquiry');
    assert.equal(clicks.length, 7, 'Each independent partner-link visit receives its own click id');
    assert.equal(notices.length, 2, 'Only the two accepted customer submissions create notifications');

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
    assert.equal(leads.length, 2);
    assert.equal(financialWrites, 0);
    assert.equal((await patch('/leads/lead-1/review', { status: 'REJECTED', rejectionReason: 'Application not eligible' })).status, 200);
    assert.equal(leads[0].status, 'REJECTED');
    assert.equal((await patch('/leads/lead-1/process', { processStatus: 'IN_PROCESS' })).status, 409);

    const failingToken = await getForm();
    failSave = true;
    process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT = 'true';
    const priorClaims = claims.length;
    const failed = await post(failingToken, { clientMobile: '9876543216' });
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('location'), null, 'Never redirect when storage fails');
    const failureHtml = await failed.text();
    assert.ok(failureHtml.includes('We could not save your enquiry') && failureHtml.includes('value="Test Customer"') && failureHtml.includes('value="9876543216"'), 'Failed saves retain entered details on the form');
    assert.match(failureHtml, /<input(?=[^>]*name="consent")(?=[^>]*value="yes")(?=[^>]*checked)[^>]*>/, 'Retry must preserve consent despite HTML formatting');
    assert.equal(failed.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(leads.length, 2);
    assert.equal(claims.length, priorClaims, 'The transaction rolls back the new claim when lead creation fails');
    failSave = false;
    delete process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT;
    campaign.baseTrackingUrl = 'https://wa.me/911234567890?text=Hello&utm_source=old';
    const whatsapp = await post(failingToken, { clientMobile: '9876543211' });
    const whatsappTarget = new URL(whatsapp.headers.get('location')!);
    assert.ok(whatsappTarget.searchParams.get('text')!.includes('VED reference:'));
    assert.equal(whatsappTarget.searchParams.has('utm_source'), false);
    assert.equal(whatsappTarget.searchParams.has('pid'), false);

    const unattributed = await fetch(`${base}/api/public/campaigns/sample/go`, { redirect: 'manual' });
    assert.equal(unattributed.status, 302, 'Existing unattributed redirect still works');
    assert.equal(leads.length, 3, 'The second customer and the independent WhatsApp submission each create one lead');

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
    const manualBody = { campaignId: 'sample', clientName: 'Manual Customer', clientMobile: '9876543212', accountId: 'APPLICATION-123', submittedNotes: 'Existing manual flow', status: 'APPROVED' };
    partner.payoutSettings = { defaultPayout: 325, campaignOverrides: [{ campaignId: campaign._id, payout: 410 }] };
    const manualSubmit = () => fetch(`${base}/api/partner/leads`, { method: 'POST', headers: { Authorization: `Bearer ${partnerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(manualBody) });
    const manualResponse = await manualSubmit();
    assert.equal(manualResponse.status, 201);
    const manualLead = (await manualResponse.json()).data;
    assert.equal(manualLead.status, 'PENDING');
    assert.equal(manualLead.payoutSnapshot, 410, 'campaign-specific partner payout takes precedence for new manual leads');
    assert.equal(leads.find(lead => lead._id === 'lead-2')?.payoutSnapshot, 250, 'later partner settings do not alter an existing lead snapshot');
    assert.equal(ledger.find(entry => entry.referenceId === 'lead-2')?.amount, 250, 'later partner settings do not alter an existing wallet credit');
    assert.equal(manualLead.submittedData.source, undefined);
    assert.equal((await manualSubmit()).status, 409);
    // DRAFT and ENDED reports remain blocked even without any available rows.
    for (const status of ['DRAFT', 'ENDED']) {
      campaign.status = status;
      const blocked = await manualSubmit();
      assert.equal(blocked.status, 404);
      assert.ok((await blocked.json()).message.includes('only be submitted for LIVE or PAUSED'));
      assert.equal(leads.length, 4, 'Non-live submissions must not create records');
    }
    campaign.status = 'LIVE';
    assert.equal((await patch(`/leads/${manualLead._id}/process`, { processStatus: 'NOT_SUBMITTED' })).status, 404);
    const existingCreditCount = ledger.length;
    const concurrentApprovals = await Promise.all([
      patch(`/leads/${manualLead._id}/review`, { status: 'APPROVED' }),
      patch(`/leads/${manualLead._id}/review`, { status: 'APPROVED' }),
    ]);
    assert.deepEqual(concurrentApprovals.map(response => response.status).sort(), [200, 409]);
    assert.equal(ledger.length, existingCreditCount + 1, 'concurrent approval attempts create one wallet credit');

    // Legacy vendor conversions without a customer-form enquiry still get processed automatically.
    clicks.push({ ...clicks[0], clickId: 'legacy-click', subTeamLinkId: 'team-link-abc' });
    const legacyCallback = await fetch(`${base}/api/webhooks/vendor`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-vendor-secret' },
      body: JSON.stringify({ eventId: 'legacy-event', clickId: 'legacy-click', conversionId: 'legacy-conversion', status: 'approved', customerName: 'Vendor Customer', customerMobile: '9876543213' }),
    });
    assert.equal(legacyCallback.status, 200);
    assert.equal((await legacyCallback.json()).data.status, 'APPROVED');
    assert.equal(leads.find((lead) => lead.vendorClickId === 'legacy-click')?.clientName, 'Vendor Customer');
    assert.equal(leads.find((lead) => lead.vendorClickId === 'legacy-click')?.subTeamLinkId, 'team-link-abc', 'vendor callbacks retain the original sub-team attribution');
    assert.equal(ledger.length, 3, 'Captured, manual, and legacy vendor leads each earn only one ledger entry');

    const partnerGet = (path: string) => fetch(`${base}/api/partner${path}`, { headers: { Authorization: `Bearer ${partnerToken}` } });
    const dashboardResponse = await partnerGet('/dashboard');
    assert.equal(dashboardResponse.status, 200);
    const summary = (await dashboardResponse.json()).data.summary;
    assert.equal(summary.totalLeads, 5);
    assert.equal(summary.successfulLeads, 3);
    assert.equal(summary.rejectedLeads, 1);
    assert.equal(summary.totalEarnings, 910);
    assert.equal(summary.availableWalletBalance, 660, 'Paid earnings must not remain available to withdraw');
    const walletResponse = await partnerGet('/wallet');
    assert.equal(walletResponse.status, 200);
    const wallet = (await walletResponse.json()).data;
    assert.equal(wallet.availableBalance, 660);
    assert.equal(wallet.totalEarned, 910);
    assert.equal(wallet.transactions.length, 3);
    const notificationsResponse = await partnerGet('/notifications');
    assert.equal(notificationsResponse.status, 200);
    const notifications = await notificationsResponse.json();
    assert.equal(notifications.data.filter((notice: any) => notice.title === 'Customer started an application').length, 3);
    assert.ok(notifications.unreadCount >= 2);
    // Regression: preserve mStock's vendor referral identity in both flows,
    // while still recording the internal VED partner/click and enquiry.
    campaign.baseTrackingUrl = 'https://ekyc.mstock.com/Register-with-us?refsrc=19&Refcode=REF2087275&utm_campaign=RnE_CL_LS&deep_link_sub6=REF2087275&utm_medium=Referral%20Lead&source_caller=api_v2&route_to=AccountOpening&deep_link_sub3=Referral%20Lead&shortlink=al59dsog&c=RnE_CL_LS&Campaign=RnE_CL_LS&pid=REF2087275&deep_link_sub2=Client_Referral&utm_source=Client_Referral&af_xp=custom&deep_link_sub4=RnE_CL_LS&af_force_deeplink=false&ref=REF2087275';
    const beforeClicks = clicks.length;
    const beforeLeads = leads.length;
    const mstockToken = await getForm();
    const mstockSubmit = await post(mstockToken, { clientMobile: '9876543214' });
    assert.equal(mstockSubmit.status, 303);
    assert.equal(mstockSubmit.headers.get('location'), campaign.baseTrackingUrl);
    assert.equal(clicks.length, beforeClicks + 1);
    assert.equal(leads.length, beforeLeads + 1);
    assert.equal(clicks.at(-1).partnerId, partner.partnerId);
    assert.equal(clicks.at(-1).clickId, leads.at(-1).vendorClickId);
    assert.equal(leads.at(-1).partnerId, partner.partnerId);
    const mstockReplay = await post(mstockToken);
    assert.equal(mstockReplay.headers.get('location'), null);
    assert.ok((await mstockReplay.text()).includes('This mobile number is already registered for this campaign.'));
    assert.equal(leads.length, beforeLeads + 1, 'mStock retry must not duplicate the enquiry');
    let directLocation = '', directStatus = 0;
    await redirectToCampaignTracking(
      { params: { slug: 'sample' }, query: { ref: partner.referralCode, pid: partner.partnerId } } as any,
      { redirect: (status: number, location: string) => { directStatus = status; directLocation = location; } } as any,
      (error: any) => { throw error; },
    );
    assert.equal(directStatus, 302);
    assert.equal(directLocation, campaign.baseTrackingUrl);
    assert.equal(clicks.length, beforeClicks + 2);
    assert.equal(clicks.at(-1).partnerId, partner.partnerId);
    assert.notEqual(clicks.at(-1).clickId, clicks.at(-2).clickId, 'Different visits must have unique stored click IDs');
    // Non-mStock campaigns retain their existing tracking behavior. The mock
    // respects MongoDB projection so a missing referralCode selection fails.
    campaign.baseTrackingUrl = 'https://vendor.example/apply?offer=original';
    await redirectToCampaignTracking(
      { params: { slug: 'sample' }, query: { ref: partner.referralCode, pid: partner.partnerId } } as any,
      { redirect: (status: number, location: string) => { directStatus = status; directLocation = location; } } as any,
      (error: any) => { throw error; },
    );
    const directTarget = new URL(directLocation);
    assert.equal(directStatus, 302);
    assert.equal(directTarget.searchParams.get('ref'), partner.referralCode);
    assert.equal(directTarget.searchParams.get('pid'), partner.partnerId);
    assert.equal(directTarget.searchParams.get('clickid'), clicks.at(-1).clickId);
    assert.equal(clicks.at(-1).payoutSnapshot, 410, 'new vendor clicks capture the current campaign-specific partner payout');
    assert.equal(directTarget.searchParams.get('offer'), 'original');
    assert.ok(!directLocation.includes('undefined'));
    campaign.status = 'PAUSED';
    const priorReports = leads.length, priorEarnings = ledger.length, priorClicks = clicks.length;
    const pausedReport = await fetch(`${base}/api/partner/leads`, {
      method: 'POST', headers: { Authorization: `Bearer ${partnerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...manualBody, clientMobile: '9876543215', accountId: 'PAUSED-APPLICATION-456' }),
    });
    assert.equal(pausedReport.status, 201, 'Manual reports remain accepted after a LIVE campaign becomes PAUSED');
    const report = (await pausedReport.json()).data;
    assert.equal(report.status, 'PENDING');
    assert.equal(report.payoutSnapshot, 410, 'new manual leads capture the current campaign-specific partner payout');
    assert.equal(leads.length, priorReports + 1);
    assert.equal(ledger.length, priorEarnings, 'A pending report must not credit earnings');
    assert.equal(clicks.length, priorClicks, 'Manual reporting must not alter click attribution');
    const existingUpdate = await fetch(`${base}/api/partner/leads/${report._id}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${partnerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedNotes: 'Updated paused report' }),
    });
    assert.equal(existingUpdate.status, 200);
    const reportCampaigns = await partnerGet('/campaigns');
    assert.equal((await reportCampaigns.json()).data[0].canSubmitNew, true);
    assert.equal((await fetch(`${base}${link}`)).status, 404);
    campaign.status = 'LIVE';
    assert.equal((await fetch(`${base}/api/public/campaigns/sample/go?ref=bad&pid=wrong`)).status, 400);

    const secondCampaign: any = {
      ...campaign, _id: 'campaign-2', slug: 'investment', name: 'Investment Campaign',
      baseTrackingUrl: `${mockVendorOrigin}/second-campaign/apply?offer=second`,
    };
    campaigns.push(secondCampaign);
    const secondForm = await fetch(`${base}/api/public/campaigns/investment/go?ref=REF-123&pid=VED-PTR-123`);
    assert.equal(secondForm.status, 200);
    const secondHtml = await secondForm.text();
    const secondCaptureToken = secondHtml.match(/name="captureToken" value="([^"]+)"/)![1];
    assert.equal(jwt.verify(secondCaptureToken, process.env.JWT_SECRET!, { audience: 'ved-lead-capture', issuer: 'ved-api' }).slug, 'investment');
    const secondSubmission = await fetch(`${base}/api/public/campaigns/investment/go`, {
      method: 'POST', redirect: 'manual', headers: { Origin: base },
      body: new URLSearchParams({ captureToken: secondCaptureToken, clientName: 'Second Campaign Customer', clientMobile: '9876543210', consent: 'yes' }),
    });
    assert.equal(secondSubmission.status, 303);
    const secondDestination = new URL(secondSubmission.headers.get('location')!);
    assert.equal(secondDestination.pathname, '/second-campaign/apply');
    assert.equal(secondDestination.searchParams.get('offer'), 'second');
    assert.equal(secondDestination.searchParams.get('campaign_id'), 'campaign-2');
    assert.equal(secondDestination.searchParams.get('ref'), partner.referralCode);
    assert.equal(secondDestination.searchParams.get('pid'), partner.partnerId);
    assert.equal(leads.at(-1).campaignId, 'campaign-2');
    assert.equal(leads.at(-1).clientMobile, '9876543210', 'The same mobile remains eligible for a different campaign');
    mongoose.connection.readyState = 0;
    assert.equal((await fetch(`${base}${link}`)).status, 503);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    mockVendor.closeAllConnections();
    await new Promise<void>((resolve, reject) => mockVendor.close((error) => error ? reject(error) : resolve()));
    mongoose.connection.readyState = 0;
  }
});
