import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../server/app.ts';
import { Partner } from '../server/models/Partner.ts';
import { Campaign } from '../server/models/Campaign.ts';
import { Lead } from '../server/models/Lead.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { AppSetting } from '../server/models/AppSetting.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { Notification } from '../server/models/Notification.ts';
import { LeadStore } from '../server/services/leadStore.ts';
import { signToken } from '../server/utils/jwt.ts';

const chain = (value: any): any => {
  const query: any = { exec: async () => typeof value === 'function' ? value() : value };
  for (const method of ['select','lean','sort','skip','limit','session']) query[method] = () => query;
  query.then = (resolve: any, reject: any) => query.exec().then(resolve, reject);
  return query;
};
const matches = (row: any, query: any): boolean => Object.entries(query).every(([key,value]: any) => {
  if (key === '$or') return value.some((part: any) => matches(row, part));
  const found = key.split('.').reduce((object: any, field: string) => object?.[field], row);
  if (value instanceof RegExp) return value.test(found || '');
  if (value instanceof Date) return new Date(found).getTime() === value.getTime();
  if (value && typeof value === 'object') {
    if ('$in' in value) return value.$in.includes(String(found));
    if ('$ne' in value) return found !== value.$ne;
    if ('$gte' in value && new Date(found) < value.$gte) return false;
    if ('$lte' in value && new Date(found) > value.$lte) return false;
    if ('$gte' in value || '$lte' in value) return true;
  }
  return String(found) === String(value);
});
const startServer = async () => { const server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening'); return { server, base: `http://127.0.0.1:${(server.address() as any).port}` }; };
const closeServer = async (server: any) => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(resolve)); };
const setupAdmin = (t: any) => {
  process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'final-report-test-secret-over-32-characters'; mongoose.connection.readyState = 1;
  t.mock.method(AdminUser, 'findById', () => chain({ _id: 'admin-test', status: 'ACTIVE', toJSON: () => ({ email: 'admin@test.example' }) }));
  return signToken({ id: 'admin-test', email: 'admin@test.example', role: 'ADMIN' });
};

test('signup without KYC → login → submit/reject/resubmit/approve; withdrawals and existing data protected', async t => {
  const adminToken = setupAdmin(t);
  const records = new Map<string, any>(); const audits: any[] = []; const withdrawals: any[] = [];
  let tick = Date.now();
  const doc = (record: any) => record ? new Partner(record) : null;
  t.mock.method(Partner.prototype, 'save', async function(this: any) {
    await this.validate();
    this.createdAt = new Date(++tick); this.updatedAt = new Date(++tick);
    records.set(String(this._id), this.toObject()); return this;
  });
  t.mock.method(Partner, 'findOne', (query: any) => chain(() => doc([...records.values()].find(row => matches(row, query)))));
  t.mock.method(Partner, 'findById', (id: string) => chain(() => doc(records.get(String(id)))));
  const update = (query: any, changes: any) => chain(() => {
    const original = [...records.values()].find(row => matches(row, query)); if (!original) return null;
    const updated = { ...original, ...changes.$set, updatedAt: new Date(++tick) };
    const result = doc(updated);
    records.set(String(result._id), updated); return result;
  });
  t.mock.method(Partner, 'findOneAndUpdate', update);
  t.mock.method(Partner, 'findByIdAndUpdate', (id: string, changes: any) => update({ _id: id }, changes));
  t.mock.method(AuditLog, 'create', async (row: any) => { audits.push(row); return row; });
  t.mock.method(Notification, 'insertMany', async () => []);
  t.mock.method(AppSetting, 'findOne', () => chain({ minimumWithdrawalAmount: 200 }));
  t.mock.method(LeadStore, 'requestWithdrawal', async (...args: any[]) => { withdrawals.push(args); return { transactionId: 'TEST-WITHDRAWAL', status: 'PENDING' }; });
  const { server, base } = await startServer();
  const request = (path: string, token?: string, body?: any, method = body === undefined ? 'GET' : 'POST') => fetch(`${base}/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const kyc = { pan: 'ABCDE1234F', upiId: 'test@upi', bankDetails: { accountHolderName: 'Test Partner', accountNumber: '123456789012', ifscCode: 'HDFC0001234', bankName: 'Test Bank' } };
  try {
    assert.equal((await request('/partner/kyc', undefined, kyc)).status, 401);
    assert.equal((await request('/partner/kyc', adminToken, kyc)).status, 403);
    const registration = { fullName: 'Test Partner', email: 'kyc-test@example.test', mobile: '9876543210', city: 'Delhi', state: 'Delhi', password: 'Test12345', confirmPassword: 'Test12345', role: 'ADMIN', kycStatus: 'VERIFIED' };
    const signup = await request('/auth/register', undefined, registration); assert.equal(signup.status, 201);
    const created = (await signup.json()).data;
    assert.equal(created.partner.role, 'PARTNER'); assert.equal(created.partner.kycStatus, 'PENDING');
    assert.equal(created.partner.pan, undefined); assert.equal(created.partner.bankDetails, undefined);
    assert.ok(created.partner.partnerId.startsWith('VED-PTR-') && created.partner.referralCode.startsWith('VED'));
    const id = created.partner._id; const partnerId = created.partner.partnerId;
    const login = await request('/auth/login', undefined, { identifier: registration.email, password: registration.password }); assert.equal(login.status, 200);
    const token = (await login.json()).data.token;
    const withdraw = () => request('/partner/wallet/withdraw', token, { amount: 250, paymentMethod: 'UPI' });
    assert.equal((await withdraw()).status, 403); assert.equal(withdrawals.length, 0);
    assert.equal((await request(`/admin/partners/${id}`, adminToken, { kycStatus: 'VERIFIED' }, 'PATCH')).status, 400);
    const invalid = await request('/partner/kyc', token, { pan: { $ne: '' }, bankDetails: null }); assert.equal(invalid.status, 400);
    assert.equal((await request('/partner/profile', token, { pan: kyc.pan, kycStatus: 'VERIFIED' }, 'PATCH')).status, 400);
    const submission = await request('/partner/kyc', token, { ...kyc, partnerId: 'OTHER', kycStatus: 'VERIFIED' }); assert.equal(submission.status, 200);
    const submitted = (await submission.json()).data;
    assert.equal(submitted.kycStatus, 'PENDING'); assert.equal(submitted.partnerId, partnerId);
    assert.equal(submitted.pan, undefined); assert.equal(submitted.maskedPan, 'ABCDE****F');
    assert.equal(submitted.bankDetails.accountNumber, undefined); assert.equal(submitted.bankDetails.maskedAccountNumber, '********9012');
    assert.equal(records.get(id).pan, kyc.pan); assert.equal(records.get(id).bankDetails.accountNumber, kyc.bankDetails.accountNumber);
    const privateKyc = await request(`/admin/partners/${id}/kyc`, adminToken); assert.equal(privateKyc.status, 200); assert.equal((await privateKyc.json()).data.upiId, kyc.upiId);
    assert.equal((await request(`/admin/partners/${id}/kyc`, token)).status, 403);
    assert.equal((await request(`/admin/partners/${id}`, adminToken, { kycStatus: 'REJECTED' }, 'PATCH')).status, 400);
    assert.equal((await request(`/admin/partners/${id}`, adminToken, { kycStatus: 'REJECTED', kycRejectionReason: 'Correct the bank name' }, 'PATCH')).status, 200);
    const rejected = (await (await request('/partner/profile', token)).json()).data;
    assert.equal(rejected.kycStatus, 'REJECTED'); assert.equal(rejected.kycRejectionReason, 'Correct the bank name');
    assert.equal((await withdraw()).status, 403);
    assert.equal((await request('/partner/kyc', token, kyc)).status, 200);
    assert.equal(records.get(id).kycRejectionReason, '');
    assert.equal((await request(`/admin/partners/${id}`, adminToken, { kycStatus: 'VERIFIED' }, 'PATCH')).status, 200);
    assert.equal((await request('/partner/kyc', token, { ...kyc, upiId: 'other@upi' })).status, 409);
    assert.equal((await request('/partner/profile', token, { upiId: 'other@upi' }, 'PATCH')).status, 409);
    assert.equal((await request('/partner/profile', token, { fullName: 'Updated Partner' }, 'PATCH')).status, 200);
    assert.equal(records.get(id).bankDetails.accountNumber, kyc.bankDetails.accountNumber);
    assert.equal(records.get(id).partnerId, partnerId); assert.equal(records.get(id).upiId, kyc.upiId);
    assert.equal((await withdraw()).status, 201); assert.equal(withdrawals[0][0], partnerId); assert.equal(withdrawals[0][3], 'test@upi');
    assert.equal((await request('/partner/wallet/withdraw', token, { amount: 250, paymentMethod: 'BANK_TRANSFER' })).status, 201);
    assert.ok(withdrawals[1][3].includes(kyc.bankDetails.accountNumber));
    const legacy = await request('/auth/register', undefined, { ...registration, ...kyc, email: 'legacy@example.test', mobile: '9876543211', referralCodeInput: created.partner.referralCode });
    assert.equal(legacy.status, 201); const preserved = (await legacy.json()).data.partner;
    assert.equal(preserved.referredBy, partnerId); assert.equal(preserved.maskedPan, submitted.maskedPan); assert.equal(preserved.kycStatus, 'PENDING');
    assert.ok(!JSON.stringify(audits).includes(kyc.pan) && !JSON.stringify(audits).includes(kyc.bankDetails.accountNumber));
  } finally { await closeServer(server); mongoose.connection.readyState = 0; }
});

test('campaign filters resolve IDs and slugs; partner ledger, counts, pagination and audit access remain isolated', async t => {
  const adminToken = setupAdmin(t);
  const owner = { _id: '507f1f77bcf86cd799439011', partnerId: 'VED-PTR-OWNER', fullName: 'Ledger Partner', accountStatus: 'ACTIVE', toJSON() { return this; } };
  const campaigns = ['LIVE','PAUSED','DRAFT','ENDED'].map((status,i) => ({ _id: `507f1f77bcf86cd79943901${i+2}`, slug: `campaign-${i}`, name: `Campaign ${i}`, status }));
  const statuses = ['PENDING','VERIFIED','APPROVED','REJECTED','PAID'];
  const rows: any[] = Array.from({ length: 25 }, (_,i) => ({ _id: `507f1f77bcf86cd7994390${String(i+20).padStart(2,'0')}`, leadId: `LEAD-${i}`, partnerId: owner.partnerId, campaignId: i % 2 ? campaigns[1].slug : campaigns[1]._id, campaignName: campaigns[1].name, clientName: `Customer ${i}`, clientMobile: '9876543210', accountId: `ACCOUNT.${i}`, status: statuses[i%5], payoutSnapshot: 250, createdAt: new Date('2026-10-08T10:00:00Z'), submittedData: { source: 'CUSTOMER_FORM', processStatus: 'IN_PROCESS' } }));
  const newAudits: any[] = [];
  rows[0].save = async () => rows[0]; rows[0].toJSON = () => ({ ...rows[0] });
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async (fn: () => Promise<void>) => fn(), endSession: async () => {} }) as any);
  t.mock.method(Notification, 'create', async () => []);
  t.mock.method(AuditLog, 'create', async (events: any[]) => { newAudits.push(...events.map((event,i) => ({ ...event, _id: `new-audit-${i}`, createdAt: new Date() }))); return events; });
  rows.push({ ...rows[0], _id: 'different', partnerId: 'VED-PTR-OTHER' });
  rows.push({ ...rows[0], _id: 'other-campaign', campaignId: campaigns[0]._id, campaignName: campaigns[0].name, createdAt: new Date('2026-10-07T10:00:00Z') });
  t.mock.method(Partner, 'findById', () => chain(owner));
  t.mock.method(Partner, 'findOne', () => chain(owner));
  t.mock.method(Partner, 'find', () => chain([owner]));
  t.mock.method(Campaign, 'findOne', (query: any) => chain(campaigns.find(row => matches(row, query)) || null));
  t.mock.method(Campaign, 'find', () => chain(campaigns));
  t.mock.method(Lead, 'find', (query: any) => {
    let skip = 0, limit = 100; const result = chain(() => rows.filter(row => matches(row, query)).slice(skip, skip + limit).map(({ save, toJSON, ...record }) => record));
    result.skip = (value: number) => { skip = value; return result; }; result.limit = (value: number) => { limit = value; return result; }; return result;
  });
  t.mock.method(Lead, 'findById', (id: string) => {
    const row = rows.find(record => record._id === id) || null;
    const query = chain(row);
    query.lean = () => { if (!row) return chain(null); const { save, toJSON, ...record } = row; return chain(record); };
    return query;
  });
  t.mock.method(Lead, 'countDocuments', (query: any) => chain(rows.filter(row => matches(row, query)).length));
  t.mock.method(Lead, 'aggregate', (pipeline: any) => {
    const partner = pipeline[0].$match.partnerId;
    return chain(statuses.map(status => ({ _id: status, count: rows.filter(row => row.partnerId === partner && row.status === status).length })));
  });
  t.mock.method(AuditLog, 'find', (query: any) => {
    assert.equal(query.entityType, 'Lead'); assert.equal(query.entityId, rows[0]._id);
    return chain([{ _id: 'audit-1', action: 'LEAD_REVIEWED', adminEmail: 'admin@test.example', createdAt: new Date(), before: { status: 'PENDING', pan: 'PRIVATE-PAN' }, after: { status: 'VERIFIED', payoutSnapshot: 250, bankDetails: 'PRIVATE-BANK' } }, ...newAudits]);
  });
  const { server, base } = await startServer();
  const get = (path: string, token = adminToken) => fetch(`${base}/api/admin${path}`, { headers: { Authorization: `Bearer ${token}` } });
  try {
    const partnerToken = signToken({ id: owner._id, partnerId: owner.partnerId, role: 'PARTNER' });
    for (const path of [`/partners/${owner._id}/leads`, '/lead-campaigns', `/leads/${rows[0]._id}`]) {
      assert.equal((await fetch(`${base}/api/admin${path}`)).status, 401);
      assert.equal((await get(path, partnerToken)).status, 403);
    }
    assert.equal((await (await get('/lead-campaigns')).json()).data.length, 4);
    const options = (await (await get('/lead-campaigns')).json()).data; assert.deepEqual(options.map((row: any) => row.status), ['LIVE','PAUSED','DRAFT','ENDED']);
    const ledgerPath = `/partners/${owner._id}/leads`;
    const all = await (await get(ledgerPath)).json(); assert.equal(all.total, 26); assert.equal(all.summary.ALL, 26); assert.equal(all.data.length, 20); assert.equal(all.totalPages, 2);
    assert.equal(statuses.reduce((sum,status) => sum + all.summary[status], 0), all.summary.ALL); assert.equal(all.summary.PENDING, 6); assert.equal(all.summary.PAID, 5);
    assert.equal(all.partner.partnerId, owner.partnerId); assert.ok(all.data.every((row: any) => row.partnerId === owner.partnerId && row.clientMobile === '******3210'));
    assert.equal((await (await get(`${ledgerPath}?page=2`)).json()).data.length, 6);
    for (const campaignId of [campaigns[1]._id, campaigns[1].slug]) {
      const filtered = await (await get(`${ledgerPath}?campaignId=${campaignId}&status=APPROVED`)).json(); assert.equal(filtered.total, 5);
      assert.equal(filtered.summary.ALL, 26); assert.ok(filtered.data.every((row: any) => row.status === 'APPROVED'));
    }
    const combined = `campaignId=${campaigns[1]._id}&status=PENDING&search=ACCOUNT.0&startDate=2026-10-08T00:00:00Z&endDate=2026-10-08T23:59:59.999Z`;
    assert.equal((await (await get(`${ledgerPath}?${combined}&partnerId=VED-PTR-OTHER`)).json()).total, 1);
    const main = await (await get(`/leads?${combined}&partnerId=${owner.partnerId}`)).json(); assert.equal(main.total, 1); assert.equal(main.data[0].leadId, rows[0].leadId);
    for (const status of statuses) assert.equal((await (await get(`${ledgerPath}?campaignId=${campaigns[1]._id}&status=${status}`)).json()).total, 5);
    assert.equal((await (await get(`${ledgerPath}?campaignId=${campaigns[0]._id}`)).json()).total, 1);
    assert.equal((await get(`${ledgerPath}?campaignId=unknown`)).status, 400);
    assert.equal((await get(`${ledgerPath}?startDate=bad`)).status, 400);
    assert.equal((await get(`${ledgerPath}?startDate=2026-10-09&endDate=2026-10-08`)).status, 400);
    const detail = await (await get(`/leads/${rows[0]._id}`)).json();
    assert.equal(detail.data.clientMobile, '9876543210'); assert.equal(detail.data.referringPartnerName, owner.fullName);
    assert.equal(detail.history[0].adminEmail, 'admin@test.example'); assert.equal(detail.history[0].after.status, 'VERIFIED');
    assert.ok(!JSON.stringify(detail.history).includes('PRIVATE-'));
    assert.equal(rows.length, 27); assert.equal(rows[0].status, 'PENDING'); assert.equal(rows[0].payoutSnapshot, 250);
    const reviewed = await fetch(`${base}/api/admin/leads/${rows[0]._id}/review`, { method: 'PATCH', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'VERIFIED' }) });
    assert.equal(reviewed.status, 200);
    const refreshed = await (await get(ledgerPath)).json(); assert.equal(refreshed.summary.ALL, 26); assert.equal(refreshed.summary.PENDING, 5); assert.equal(refreshed.summary.VERIFIED, 6);
    const refreshedDetail = await (await get(`/leads/${rows[0]._id}`)).json(); assert.equal(refreshedDetail.data.status, 'VERIFIED'); assert.equal(refreshedDetail.history.at(-1).action, 'LEAD_VERIFIED'); assert.equal(refreshedDetail.history.at(-1).before.status, 'PENDING');
    assert.equal(rows[0].payoutSnapshot, 250);
  } finally { await closeServer(server); mongoose.connection.readyState = 0; }
});
