import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createApp } from '../server/app.ts';
import { Partner } from '../server/models/Partner.ts';
import { PartnerSignupChallenge } from '../server/models/PartnerSignupChallenge.ts';
import { PartnerStore } from '../server/services/partnerStore.ts';
import { beginPartnerSignup, resendPartnerSignupOtp, SIGNUP_OTP_MAX_ATTEMPTS, SIGNUP_OTP_MAX_SENDS, verifyPartnerSignupOtp } from '../server/services/partnerSignupOtp.ts';

function query<T>(run: () => T | Promise<T>): any {
  const q: any = { exec: async () => run(), select: () => q, lean: () => q };
  q.then = (resolve: any, reject: any) => q.exec().then(resolve, reject);
  return q;
}

function matches(row: any, filter: any): boolean {
  return Object.entries(filter).every(([key, expected]: any) => {
    const actual = row?.[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$exists' in expected) return (actual !== undefined) === expected.$exists;
      if ('$lt' in expected) return actual < expected.$lt;
      if ('$gt' in expected) return actual > expected.$gt;
      return false;
    }
    if (expected instanceof Date) return new Date(actual).getTime() === expected.getTime();
    return actual === expected;
  });
}

function apply(row: any, update: any) {
  Object.assign(row, update.$set || {});
  for (const [key, amount] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + Number(amount);
  for (const key of Object.keys(update.$unset || {})) delete row[key];
}

test('partner signup verifies email before account creation, limits OTP use, and keeps public responses generic', async t => {
  const env = { ...process.env }, readyState = mongoose.connection.readyState;
  Object.assign(process.env, {
    NODE_ENV: 'test', JWT_SECRET: 'partner-signup-otp-test-secret-long-enough-32',
    BREVO_API_KEY: 'mock-brevo-key', EMAIL_FROM_ADDRESS: 'no-reply@vedaffiliatepvtltd.com',
    EMAIL_FROM_NAME: 'VED Affiliate', PUBLIC_APP_URL: 'https://vedaffiliatepvtltd.com',
  });
  mongoose.connection.readyState = 1;
  t.after(() => { process.env = env; mongoose.connection.readyState = readyState; });

  const challenges = new Map<string, any>();
  const partners = new Map<string, any>();
  const sentCodes = new Map<string, string[]>();
  let failDelivery = false;
  const realFetch = globalThis.fetch;
  t.mock.method(PartnerSignupChallenge.collection, 'indexes', async () => [
    { name: '_id_', key: { _id: 1 } },
    { name: 'partner_signup_challenge_purge', key: { purgeAt: 1 }, expireAfterSeconds: 0 },
  ]);
  t.mock.method(Partner.collection, 'indexes', async () => [
    { name: 'email_1', key: { email: 1 }, unique: true },
    { name: 'mobile_1', key: { mobile: 1 }, unique: true },
  ]);
  t.mock.method(PartnerSignupChallenge, 'findById', (id: string) => query(() => challenges.get(id) || null));
  t.mock.method(PartnerSignupChallenge, 'create', async (data: any) => {
    if (challenges.has(data._id)) throw Object.assign(new Error('duplicate'), { code: 11000 });
    const row = structuredClone(data); challenges.set(data._id, row); return row;
  });
  t.mock.method(PartnerSignupChallenge, 'findOneAndUpdate', (filter: any, update: any) => query(() => {
    const row = challenges.get(filter._id);
    if (!matches(row, filter)) return null;
    apply(row, update); return row;
  }));
  t.mock.method(PartnerSignupChallenge, 'updateOne', (filter: any, update: any) => query(() => {
    const row = challenges.get(filter._id);
    if (matches(row, filter)) apply(row, update);
    return { acknowledged: true };
  }));
  t.mock.method(PartnerSignupChallenge, 'deleteOne', (filter: any) => query(() => {
    const row = challenges.get(filter._id);
    if (matches(row, filter)) challenges.delete(filter._id);
    return { acknowledged: true };
  }));

  t.mock.method(Partner, 'findOne', (filter: any) => query(() => [...partners.values()].find(row => row.email === filter.email) || null));
  t.mock.method(PartnerStore, 'checkDuplicates', async (email: string, mobile: string) => ({
    duplicateEmail: [...partners.values()].some(row => row.email === email),
    duplicateMobile: [...partners.values()].some(row => row.mobile === mobile),
  }));
  t.mock.method(PartnerStore, 'findByReferralCode', async (code: string) => [...partners.values()].find(row => row.referralCode === code) || null);
  t.mock.method(PartnerStore, 'create', async (data: any) => {
    if ([...partners.values()].some(row => row.email === data.email || row.mobile === data.mobile)) throw Object.assign(new Error('duplicate'), { code: 11000 });
    const row = { ...data, _id: `partner-${partners.size + 1}`, toJSON() { const { passwordHash: _passwordHash, emailVerifiedAt: _verifiedAt, ...safe } = this; return safe; } };
    partners.set(row.email, row); return row;
  });
  t.mock.method(PartnerStore, 'findByEmailOrMobile', async (identifier: string) => [...partners.values()].find(row => row.email === identifier || row.mobile === identifier) || null);
  t.mock.method(globalThis, 'fetch', async (url: any, init?: any) => {
    if (String(url) !== 'https://api.brevo.com/v3/smtp/email') return realFetch(url, init);
    const message = JSON.parse(init.body);
    const code = String(message.textContent).match(/code to complete your partner signup: (\d{6})/)?.[1];
    assert.ok(code, 'Brevo message contains an OTP');
    const email = message.to[0].email;
    sentCodes.set(email, [...(sentCodes.get(email) || []), code!]);
    return new Response('{}', { status: failDelivery ? 500 : 201 });
  });

  const app = createApp().listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(async () => { app.closeAllConnections(); await new Promise<void>(resolve => app.close(() => resolve())); });
  const base = `http://127.0.0.1:${(app.address() as any).port}/api/auth`;
  const post = async (path: string, body: any) => {
    const response = await realFetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const input = (email: string, mobile: string) => ({ fullName: 'Test Partner', email, mobile, city: 'Delhi', state: 'Delhi', password: 'Partner123', confirmPassword: 'Partner123', referralCodeInput: '' });

  const firstEmail = 'first@example.test';
  const initial = await post('/register', input(firstEmail, '9876543210'));
  assert.equal(initial.status, 202);
  assert.equal(initial.body.data, undefined);
  assert.equal(partners.size, 0, 'no Partner record or active account exists before verification');
  const firstChallenge = [...challenges.values()][0];
  assert.notEqual(firstChallenge.otpHash, sentCodes.get(firstEmail)?.[0]);
  assert.match(firstChallenge.otpHash, /^[a-f0-9]{64}$/);
  assert.match(firstChallenge.passwordHash, /^\$2[aby]\$/);
  assert.equal(JSON.stringify(initial.body).includes(sentCodes.get(firstEmail)?.[0]), false);

  assert.equal((await post('/register/resend-otp', { email: firstEmail })).status, 202);
  assert.equal(sentCodes.get(firstEmail)?.length, 1, 'cooldown blocks immediate resend');
  firstChallenge.lastSentAt = new Date(Date.now() - 61_000);
  const resent = await post('/register/resend-otp', { email: firstEmail });
  assert.equal(resent.status, 202);
  assert.equal(sentCodes.get(firstEmail)?.length, 2);
  const staleCode = sentCodes.get(firstEmail)![0];
  const currentCode = sentCodes.get(firstEmail)![1];
  assert.equal((await post('/register/verify-otp', { email: firstEmail, otp: staleCode })).status, 400);
  const verified = await post('/register/verify-otp', { email: firstEmail, otp: currentCode });
  assert.equal(verified.status, 200);
  assert.equal(partners.size, 1);
  assert.equal(partners.get(firstEmail).emailVerifiedAt instanceof Date, true);
  assert.equal(verified.body.data.partner.emailVerifiedAt, undefined);
  assert.ok(verified.body.data.token);
  assert.equal((await post('/register/verify-otp', { email: firstEmail, otp: currentCode })).status, 400, 'a verified OTP cannot be reused');

  const wrongEmail = 'attempts@example.test';
  assert.equal((await post('/register', input(wrongEmail, '9876543211'))).status, 202);
  const wrongChallenge = [...challenges.values()].find(row => row.email === wrongEmail);
  for (let send = 1; send < SIGNUP_OTP_MAX_SENDS; send++) {
    wrongChallenge.lastSentAt = new Date(Date.now() - 61_000);
    assert.equal(await resendPartnerSignupOtp(wrongEmail), false);
  }
  wrongChallenge.lastSentAt = new Date(Date.now() - 61_000);
  assert.equal(await resendPartnerSignupOtp(wrongEmail), false, 'email send window prevents a sixth code');
  assert.equal(sentCodes.get(wrongEmail)?.length, SIGNUP_OTP_MAX_SENDS);
  const wrongCode = sentCodes.get(wrongEmail)![SIGNUP_OTP_MAX_SENDS - 1];
  for (let attempt = 0; attempt < SIGNUP_OTP_MAX_ATTEMPTS; attempt++) {
    assert.equal((await post('/register/verify-otp', { email: wrongEmail, otp: wrongCode === '000000' ? '999999' : '000000' })).status, 400);
  }
  assert.equal((await post('/register/verify-otp', { email: wrongEmail, otp: wrongCode })).status, 400, 'attempt limit blocks the correct code after five failures');
  assert.equal(partners.has(wrongEmail), false);
  assert.equal(wrongChallenge.attempts, SIGNUP_OTP_MAX_ATTEMPTS);

  const expiredEmail = 'expired@example.test';
  assert.equal((await post('/register', input(expiredEmail, '9876543212'))).status, 202);
  const expiredChallenge = [...challenges.values()].find(row => row.email === expiredEmail);
  expiredChallenge.expiresAt = new Date(Date.now() - 1);
  assert.equal((await post('/register/verify-otp', { email: expiredEmail, otp: sentCodes.get(expiredEmail)![0] })).status, 400);
  assert.equal(partners.has(expiredEmail), false);

  // An already registered email receives the same public response; verification never creates another account.
  const duplicate = await post('/register', input(firstEmail, '9876543210'));
  assert.equal(duplicate.status, 202);
  assert.equal(duplicate.body.message, initial.body.message);
  assert.equal(partners.size, 1);

  const knownPasswordHash = await bcrypt.hash('Existing123', 4);
  partners.set('existing@example.test', { _id: 'legacy-partner', email: 'existing@example.test', mobile: '9876543213', passwordHash: knownPasswordHash, partnerId: 'VED-PTR-OLD', role: 'PARTNER', accountStatus: 'ACTIVE', referralCode: 'VEDOLD' });
  assert.equal((await post('/login', { identifier: 'existing@example.test', password: 'Existing123' })).status, 200, 'legacy partner login remains unchanged');

  failDelivery = true;
  const failedEmail = 'delivery-failure@example.test';
  const failed = await post('/register', input(failedEmail, '9876543214'));
  assert.equal(failed.status, 503);
  assert.equal([...challenges.values()].some(row => row.email === failedEmail), false, 'failed email delivery revokes the OTP challenge');
  failDelivery = false;
  assert.equal((await post('/register', input('rate-limit@example.test', '9876543216'))).status, 429, 'signup requests are rate limited by client IP');

  const retryEmail = 'resend-failure@example.test';
  await beginPartnerSignup(input(retryEmail, '9876543217'));
  const retryChallenge = [...challenges.values()].find(row => row.email === retryEmail);
  const originalOtpHash = retryChallenge.otpHash;
  failDelivery = true;
  retryChallenge.lastSentAt = new Date(Date.now() - 61_000);
  assert.equal(await resendPartnerSignupOtp(retryEmail), true, 'provider failure is reported to the client');
  assert.ok(challenges.has(retryChallenge._id), 'resend failure retains pending data for retry');
  assert.notEqual(retryChallenge.otpHash, originalOtpHash, 'the undelivered code is revoked');
  assert.equal(new Date(retryChallenge.expiresAt).getTime(), 0);
  failDelivery = false;
  assert.equal(await resendPartnerSignupOtp(retryEmail), false, 'resend can be retried after delivery failure');
  assert.equal(sentCodes.get(retryEmail)?.length, 3);
  assert.ok(await verifyPartnerSignupOtp(retryEmail, sentCodes.get(retryEmail)![2]));

  const recoveryEmail = 'consumed-recovery@example.test';
  await beginPartnerSignup(input(recoveryEmail, '9876543218'));
  const recoveryChallenge = [...challenges.values()].find(row => row.email === recoveryEmail);
  const consumedCode = sentCodes.get(recoveryEmail)![0];
  recoveryChallenge.verifiedAt = new Date(Date.now() - 6 * 60_000);
  recoveryChallenge.lastSentAt = new Date(Date.now() - 6 * 60_000);
  assert.equal(await resendPartnerSignupOtp(recoveryEmail), false, 'a fresh code can recover an interrupted, already-consumed verification');
  const freshCode = sentCodes.get(recoveryEmail)![1];
  assert.equal(await verifyPartnerSignupOtp(recoveryEmail, consumedCode), null, 'recovery does not make the consumed OTP reusable');
  assert.ok(await verifyPartnerSignupOtp(recoveryEmail, freshCode));

  assert.equal(await verifyPartnerSignupOtp('not-an-email', sentCodes.get(firstEmail)![1]), null);
  const concurrentEmail = 'concurrent@example.test';
  await beginPartnerSignup(input(concurrentEmail, '9876543215'));
  const concurrentCode = sentCodes.get(concurrentEmail)![0];
  const concurrent = await Promise.all([
    verifyPartnerSignupOtp(concurrentEmail, concurrentCode),
    verifyPartnerSignupOtp(concurrentEmail, concurrentCode),
  ]);
  assert.equal(concurrent.filter(Boolean).length, 1, 'only one concurrent verification request can consume an OTP');
  assert.equal([...partners.values()].filter(row => row.email === concurrentEmail).length, 1, 'concurrent OTP verification creates one account');
  assert.equal(SIGNUP_OTP_MAX_SENDS, 5);
  assert.equal(PartnerSignupChallenge.schema.options.autoIndex, false, 'startup does not create the required TTL index automatically');
});
