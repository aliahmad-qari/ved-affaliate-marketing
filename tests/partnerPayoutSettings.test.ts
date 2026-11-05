import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../server/app.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { Campaign } from '../server/models/Campaign.ts';
import { Partner } from '../server/models/Partner.ts';
import { PartnerStore } from '../server/services/partnerStore.ts';
import { signToken } from '../server/utils/jwt.ts';
import { isValidPayoutAmount, resolvePartnerPayout } from '../server/services/partnerPayout.ts';

test('payout precedence is campaign-specific partner override, partner default, then campaign default', () => {
  const campaign = { _id: 'campaign-mongo-id', payout: 240 };
  assert.equal(resolvePartnerPayout(campaign), 240);
  assert.equal(resolvePartnerPayout(campaign, { defaultPayout: 310 }), 310);
  assert.equal(resolvePartnerPayout(campaign, { defaultPayout: 310, campaignOverrides: [{ campaignId: 'campaign-mongo-id', payout: 425 }] }), 425);
  assert.equal(resolvePartnerPayout({ _id: 'other-campaign', payout: 190 }, { defaultPayout: 310, campaignOverrides: [{ campaignId: 'campaign-mongo-id', payout: 425 }] }), 310);
  assert.equal(resolvePartnerPayout({ _id: 'missing-default', payout: null }, undefined), 0);
});

test('payout amount validation rejects negative, non-finite and fractional-paisa values', () => {
  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, 10.001, '10']) assert.equal(isValidPayoutAmount(value), false);
  assert.equal(isValidPayoutAmount(0), true);
  assert.equal(isValidPayoutAmount(125.5), true);
});

test('payout settings endpoint is admin-only, versioned, and writes an audit record without touching lead history', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'partner-payout-test-secret-at-least-32-characters';
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });

  const originalPartner = { _id: 'partner-doc', partnerId: 'VED-PTR-1', updatedAt: new Date('2026-10-01T00:00:00.000Z'), payoutSettings: undefined };
  let savedSettings: any;
  const auditRows: any[] = [];
  const chain = (value: any): any => {
    const query: any = { exec: async () => typeof value === 'function' ? value() : value, select: () => query, session: () => query };
    query.then = (resolve: any, reject: any) => query.exec().then(resolve, reject);
    return query;
  };
  t.mock.method(AdminUser, 'findById', () => chain({ _id: 'admin-1', email: 'admin@example.test', status: 'ACTIVE', toJSON: () => ({ email: 'admin@example.test' }) }));
  t.mock.method(PartnerStore, 'getSessionsInvalidatedAt', async () => null);
  t.mock.method(PartnerStore, 'findById', async () => ({ ...originalPartner, accountStatus: 'ACTIVE' }));
  t.mock.method(Partner, 'findById', () => chain({ ...originalPartner, payoutSettings: undefined }));
  t.mock.method(Partner, 'findOneAndUpdate', (_filter: any, update: any) => {
    savedSettings = update.$set.payoutSettings;
    return chain({ ...originalPartner, payoutSettings: savedSettings, updatedAt: new Date('2026-10-02T00:00:00.000Z') });
  });
  t.mock.method(Campaign, 'countDocuments', () => chain(1));
  t.mock.method(AuditLog, 'create', async (rows: any[]) => { auditRows.push(...rows); return rows; });
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async (operation: () => Promise<void>) => operation(), endSession: async () => {} }) as any);

  const app = createApp().listen(0, '127.0.0.1');
  await once(app, 'listening');
  t.after(async () => { app.closeAllConnections(); await new Promise<void>(resolve => app.close(() => resolve())); });
  const url = `http://127.0.0.1:${(app.address() as any).port}/api/admin/partners/partner-doc/payout-settings`;
  const body = { defaultPayout: 275, campaignOverrides: [{ campaignId: '507f1f77bcf86cd799439011', payout: 350 }], expectedUpdatedAt: originalPartner.updatedAt.toISOString() };
  assert.equal((await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 401);
  const partnerToken = signToken({ id: 'partner-doc', partnerId: 'VED-PTR-1', email: 'partner@example.test', role: 'PARTNER' });
  assert.equal((await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${partnerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 403);

  const adminToken = signToken({ id: 'admin-1', email: 'admin@example.test', role: 'ADMIN' });
  const invalid = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, defaultPayout: -1 }) });
  assert.equal(invalid.status, 400);
  const response = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 200);
  assert.deepEqual(savedSettings, { defaultPayout: 275, campaignOverrides: [{ campaignId: '507f1f77bcf86cd799439011', payout: 350 }] });
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].action, 'PARTNER_PAYOUT_SETTINGS_UPDATED');
});
