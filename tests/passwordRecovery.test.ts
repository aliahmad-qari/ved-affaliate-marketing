import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createApp } from '../server/app.ts';
import { Partner } from '../server/models/Partner.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { PartnerStore } from '../server/services/partnerStore.ts';
import { hashResetToken, issuePasswordReset, resetPassword, validRecoveryPassword } from '../server/controllers/passwordRecoveryController.ts';
import { recoveryEmailConfig, passwordResetEmail, sendPasswordResetEmail } from '../server/services/brevoEmail.ts';
import { signToken } from '../server/utils/jwt.ts';

function chain(run: () => any): any { const query: any = { exec: async () => run() }; for (const key of ['select', 'lean']) query[key] = () => query; return query; }
function matches(row: any, filter: any): boolean {
  if (!row) return false;
  return Object.entries(filter).every(([key, value]: any) => {
    if (key === '$or') return value.some((part: any) => matches(row, part));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('$exists' in value) return (row[key] !== undefined) === value.$exists;
      if ('$gt' in value) return row[key] != null && new Date(row[key]) > value.$gt;
      if ('$lte' in value) return row[key] != null && new Date(row[key]) <= value.$lte;
    }
    return String(row[key]) === String(value);
  });
}
function apply(row: any, update: any) { Object.assign(row, update.$set); for (const key of Object.keys(update.$unset || {})) delete row[key]; }
const waitFor = async (predicate: () => boolean) => { for (let i = 0; i < 100 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10)); assert.ok(predicate(), 'Background email task completed'); };

test('Brevo config and templates validate trusted origins and redact provider failures', async t => {
  const env = { ...process.env };
  t.after(() => { process.env = env; });
  Object.assign(process.env, { BREVO_API_KEY: 'test-key', EMAIL_FROM_ADDRESS: 'no-reply@vedaffiliatepvtltd.com', EMAIL_FROM_NAME: 'VED Affiliate', PUBLIC_APP_URL: 'https://vedaffiliatepvtltd.com' });
  assert.equal(recoveryEmailConfig().origin, 'https://vedaffiliatepvtltd.com');
  for (const invalid of ['http://evil.test', 'https://user:password@domain.test', 'https://domain.test/other', 'https://domain.test/?next=evil']) {
    process.env.PUBLIC_APP_URL = invalid; assert.throws(recoveryEmailConfig);
  }
  process.env.PUBLIC_APP_URL = 'https://vedaffiliatepvtltd.com';
  delete process.env.BREVO_API_KEY; assert.throws(recoveryEmailConfig); process.env.BREVO_API_KEY = 'test-key';
  const template = passwordResetEmail('https://vedaffiliatepvtltd.com/reset-password#token=abc');
  assert.equal(template.subject, 'Reset Your Password — VED Affiliate');
  assert.ok(template.htmlContent.includes('Reset Password') && template.textContent.includes('15 minutes'));
  let networkFailure = false;
  t.mock.method(globalThis, 'fetch', async () => { if (networkFailure) throw new Error('private transport payload'); return new Response('secret-provider-response', { status: 403 }); });
  await assert.rejects(sendPasswordResetEmail('person@example.test', 'a'.repeat(64)), error => !String(error).includes('secret-provider-response') && !String(error).includes('test-key'));
  networkFailure = true;
  await assert.rejects(sendPasswordResetEmail('person@example.test', 'a'.repeat(64)), /could not be submitted/);
});

test('partner/admin recovery, atomic token use, sessions, login and rate limits through real HTTP routes', async t => {
  const env = { ...process.env }, readyState = mongoose.connection.readyState;
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'password-recovery-test-secret-32-characters', BREVO_API_KEY: 'test-key', EMAIL_FROM_ADDRESS: 'no-reply@vedaffiliatepvtltd.com', EMAIL_FROM_NAME: 'VED Affiliate', PUBLIC_APP_URL: 'https://vedaffiliatepvtltd.com' });
  mongoose.connection.readyState = 1;
  t.after(() => { process.env = env; mongoose.connection.readyState = readyState; });
  const oldHash = await bcrypt.hash('Original123', 12);
  const partner: any = { _id: '507f1f77bcf86cd799439011', email: 'partner@example.test', passwordHash: oldHash, partnerId: 'VED-PTR-RESET', role: 'PARTNER', accountStatus: 'ACTIVE' };
  const admin: any = { _id: '507f1f77bcf86cd799439012', email: 'admin@example.test', passwordHash: oldHash, status: 'ACTIVE', save: async () => {}, toJSON: () => ({ _id: admin._id, email: admin.email, status: admin.status }) };
  const rows = [partner, admin];
  for (const [model, row] of [[Partner, partner], [AdminUser, admin]] as const) {
    t.mock.method(model, 'findOneAndUpdate', (filter: any, update: any) => chain(() => { if (!matches(row, filter)) return null; apply(row, update); return { _id: row._id, email: row.email }; }));
    t.mock.method(model, 'updateOne', (filter: any, update: any) => chain(() => { if (matches(row, filter)) apply(row, update); return { acknowledged: true }; }));
  }
  t.mock.method(AdminUser, 'findOne', (filter: any) => chain(() => matches(admin, filter) ? admin : null));
  t.mock.method(AdminUser, 'findById', () => chain(() => admin));
  t.mock.method(PartnerStore, 'findByEmailOrMobile', async (email: string) => email === partner.email ? { ...partner } : null);
  t.mock.method(PartnerStore, 'findById', async () => ({ _id: partner._id, email: partner.email, partnerId: partner.partnerId, accountStatus: 'ACTIVE' }));
  t.mock.method(PartnerStore, 'getSessionsInvalidatedAt', async () => partner.sessionsInvalidatedAt?.getTime() || 0);
  const sent: any[] = []; let providerFailure = false;
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url: any, init: any) => {
    if (String(url) !== 'https://api.brevo.com/v3/smtp/email') return realFetch(url, init);
    assert.equal(init.headers['api-key'], 'test-key'); assert.equal(init.redirect, 'error'); assert.ok(init.signal);
    sent.push(JSON.parse(init.body)); return new Response('{}', { status: providerFailure ? 500 : 201 });
  });
  const logs: string[] = []; t.mock.method(console, 'error', (...args: any[]) => { logs.push(args.join(' ')); });
  const server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const post = async (path: string, body: any) => { const response = await realFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
  const reset = async (token: any, password: any = 'Replacement456', confirmPassword: any = password) => {
    let status = 0, body: any;
    await resetPassword({ body: { token, password, confirmPassword } } as any, { set() {}, status(value: number) { status = value; return this; }, json(value: any) { body = value; return this; } } as any);
    return { status, body };
  };
  assert.equal((await post('/api/auth/login', { identifier: partner.email, password: 'Original123' })).status, 200);
  assert.equal((await post('/api/admin/auth/login', { email: admin.email, password: 'Original123' })).status, 200);
  const stalePartner = signToken({ id: partner._id, email: partner.email, partnerId: partner.partnerId, role: 'PARTNER' });
  const staleAdmin = signToken({ id: admin._id, email: admin.email, role: 'ADMIN' });
  const unknown = await post('/api/auth/forgot-password', { email: 'missing@example.test' });
  const known = await post('/api/auth/forgot-password', { email: partner.email });
  assert.deepEqual(known, unknown); await waitFor(() => sent.length === 1);
  assert.deepEqual(sent[0].sender, { email: 'no-reply@vedaffiliatepvtltd.com', name: 'VED Affiliate' });
  assert.equal(sent[0].subject, 'Reset Your Password — VED Affiliate');
  assert.ok(sent[0].htmlContent && sent[0].textContent);
  const link = new URL(sent[0].textContent.match(/https:\/\/\S+/)[0]);
  const token = new URLSearchParams(link.hash.slice(1)).get('token')!;
  assert.equal(link.origin, 'https://vedaffiliatepvtltd.com'); assert.equal(link.pathname, '/reset-password'); assert.equal(link.search, '');
  assert.match(token, /^[a-f0-9]{64}$/); assert.equal(partner.resetPasswordToken, hashResetToken(token)); assert.notEqual(partner.resetPasswordToken, token);
  assert.equal(partner.resetPasswordExpires.getTime() - partner.resetPasswordRequestedAt.getTime(), 900000);
  await issuePasswordReset(partner.email, 'partner'); assert.equal(sent.length, 1, 'Account cooldown prevents repeat email');
  assert.equal((await reset('bad-token')).status, 400);
  for (const weak of ['short', 'abcdefgh', '12345678', 'x1'.repeat(37), { password: 'object' }]) assert.equal((await reset(token, weak)).status, 400);
  assert.equal(validRecoveryPassword('Valid123'), true);
  assert.equal((await reset(token, 'Replacement456', 'different')).status, 400);
  const expiry = partner.resetPasswordExpires;
  partner.resetPasswordExpires = new Date(Date.now() - 1); assert.equal((await reset(token)).status, 400); partner.resetPasswordExpires = expiry;
  const results = await Promise.all([reset(token), reset(token)]);
  assert.deepEqual(results.map(row => row.status).sort(), [200, 400]);
  assert.equal(partner.resetPasswordToken, undefined); assert.ok(partner.sessionsInvalidatedAt);
  assert.equal(await bcrypt.compare('Replacement456', partner.passwordHash), true);
  assert.equal((await reset(token)).status, 400);
  assert.equal((await post('/api/auth/login', { identifier: partner.email, password: 'Original123' })).status, 401);
  assert.equal((await post('/api/auth/login', { identifier: partner.email, password: 'Replacement456' })).status, 200);
  assert.equal((await realFetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${stalePartner}` } })).status, 401);
  const adminRequest = await post('/api/auth/forgot-password', { email: admin.email, accountType: 'admin' }); assert.equal(adminRequest.status, 200);
  await waitFor(() => sent.length === 2);
  const adminToken = new URLSearchParams(new URL(sent[1].textContent.match(/https:\/\/\S+/)[0]).hash.slice(1)).get('token')!;
  assert.equal((await reset(adminToken)).body.loginPath, 'admin/login');
  assert.equal((await post('/api/admin/auth/login', { email: admin.email, password: 'Original123' })).status, 401);
  assert.equal((await post('/api/admin/auth/login', { email: admin.email, password: 'Replacement456' })).status, 200);
  assert.equal((await realFetch(base + '/api/admin/auth/me', { headers: { Authorization: `Bearer ${staleAdmin}` } })).status, 401);
  providerFailure = true; partner.resetPasswordRequestedAt = new Date(Date.now() - 61000);
  await assert.rejects(issuePasswordReset(partner.email, 'partner')); assert.equal(partner.resetPasswordToken, undefined);
  partner.accountStatus = 'SUSPENDED'; await issuePasswordReset(partner.email, 'partner'); assert.equal(partner.resetPasswordToken, undefined);
  for (let i = 0; i < 3; i++) await post('/api/auth/forgot-password', { email: 'missing@example.test' });
  assert.equal((await post('/api/auth/forgot-password', { email: 'missing@example.test' })).status, 429);
  for (let i = 0; i < 5; i++) await post('/api/auth/reset-password', { token: 'invalid', password: 'Valid123', confirmPassword: 'Valid123' });
  assert.equal((await post('/api/auth/reset-password', { token: 'invalid' })).status, 429);
  assert.ok(!logs.some(log => log.includes(token) || log.includes(adminToken) || log.includes('test-key') || log.includes('Replacement456')));
  for (const row of rows) assert.ok(!JSON.stringify(new (row === partner ? Partner : AdminUser)({ ...row, passwordHash: 'hash', resetPasswordToken: 'secret' }).toJSON()).includes('secret'));
});
