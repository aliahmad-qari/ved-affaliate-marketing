import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../server/app.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { Lead } from '../server/models/Lead.ts';
import { Partner } from '../server/models/Partner.ts';
import { WalletTransaction } from '../server/models/WalletTransaction.ts';
import { AdvertiserReceipt } from '../server/models/AdvertiserReceipt.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { Notification } from '../server/models/Notification.ts';
import { PartnerStore } from '../server/services/partnerStore.ts';
import { signToken } from '../server/utils/jwt.ts';
import { AdminLeadCard } from '../src/components/admin/AdminLeadCard.tsx';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('authorized Admin approval verifies Loan and Insurance amounts atomically, makes calculated commission Available, and leaves fixed payouts unchanged', async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'admin-percentage-approval-test-secret-32-characters';
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });

  const leads: any[] = [
    { _id: 'loan-doc', leadId: 'LOAN-1', partnerId: 'VED-PTR-1', campaignId: 'loan-campaign', campaignType: 'Loans', status: 'PENDING', payoutTypeSnapshot: 'PERCENTAGE', payoutBasisSnapshot: 'LOAN_DISBURSED_AMOUNT', payoutRateSnapshot: 2.5, payoutSnapshot: 0, payoutTermsSnapshot: 'Actual disbursed amount', payoutEligibilitySnapshot: { eligibility: 'Approved Loan campaign' }, save: async () => {}, toJSON() { return { ...this }; } },
    { _id: 'insurance-doc', leadId: 'INS-1', partnerId: 'VED-PTR-2', campaignId: 'insurance-campaign', campaignType: 'Insurance', status: 'PENDING', payoutTypeSnapshot: 'PERCENTAGE', payoutBasisSnapshot: 'INSURANCE_ELIGIBLE_PREMIUM', payoutRateSnapshot: 3, payoutSnapshot: 0, payoutTermsSnapshot: 'Eligible premium under campaign terms', payoutEligibilitySnapshot: { eligibility: 'Eligible policy premium' }, save: async () => {}, toJSON() { return { ...this }; } },
    { _id: 'legacy-approved-doc', leadId: 'LOAN-LEGACY', partnerId: 'VED-PTR-3', campaignId: 'loan-campaign', campaignType: 'Loans', status: 'APPROVED', payoutTypeSnapshot: 'PERCENTAGE', payoutBasisSnapshot: 'LOAN_DISBURSED_AMOUNT', payoutRateSnapshot: 2.5, payoutSnapshot: 0, payoutCommission: { state: 'AWAITING_REVIEW', source: 'APPROVED_MIS', reportedBaseAmount: 100000, reportReference: 'LEGACY-REPORT', reportKey: 'legacy-report-key', eventKeys: ['legacy-event-key'], history: [{ action: 'MIS_REPORT_ENTERED', adminId: 'admin-old', at: new Date(), snapshot: { reportReference: 'LEGACY-REPORT' } }], toObject() { return { ...this }; } }, save: async () => {}, toJSON() { return { ...this }; } },
    { _id: 'fixed-doc', leadId: 'FIXED-1', partnerId: 'VED-PTR-4', campaignId: 'fixed-campaign', campaignType: 'Banking', status: 'PENDING', payoutTypeSnapshot: 'FIXED', payoutSnapshot: 450, save: async () => {}, toJSON() { return { ...this }; } },
    { _id: 'invalid-insurance-doc', leadId: 'INS-BAD', partnerId: 'VED-PTR-5', campaignId: 'insurance-bad', campaignType: 'Insurance', status: 'PENDING', payoutTypeSnapshot: 'PERCENTAGE', payoutBasisSnapshot: 'INSURANCE_ELIGIBLE_PREMIUM', payoutRateSnapshot: 3, payoutSnapshot: 0, payoutTermsSnapshot: '', payoutEligibilitySnapshot: {}, save: async () => {}, toJSON() { return { ...this }; } },
    { _id: 'concurrent-doc', leadId: 'LOAN-CONCURRENT', partnerId: 'VED-PTR-7', campaignId: 'loan-campaign', campaignType: 'Loans', status: 'PENDING', payoutTypeSnapshot: 'PERCENTAGE', payoutBasisSnapshot: 'LOAN_DISBURSED_AMOUNT', payoutRateSnapshot: 2.5, payoutSnapshot: 0, payoutTermsSnapshot: 'Actual disbursed amount', payoutEligibilitySnapshot: { eligibility: 'Approved Loan campaign' }, save: async () => {}, toJSON() { return { ...this }; } },
  ];
  const query = (read: () => any): any => {
    const q: any = { exec: async () => read(), select: () => q, session: () => q, lean: () => q };
    q.then = (resolve: any, reject: any) => q.exec().then(resolve, reject);
    return q;
  };
  const ledger: any[] = [];
  const audits: any[] = [];
  t.mock.method(AdminUser, 'findById', (id: string) => query(() => ({ _id: id, email: `${id}@example.test`, status: 'ACTIVE', toJSON: () => ({ email: `${id}@example.test` }), toString: () => id })));
  t.mock.method(PartnerStore, 'getSessionsInvalidatedAt', async () => null);
  t.mock.method(Lead, 'findById', (id: string) => query(() => leads.find(lead => lead._id === id) || null));
  t.mock.method(Partner, 'findOne', () => query(() => null));
  t.mock.method(WalletTransaction, 'findOne', (filter: any) => query(() => ledger.find(row => row.idempotencyKey === filter.idempotencyKey) || null));
  t.mock.method(WalletTransaction, 'updateOne', (filter: any, update: any) => query(() => {
    const existing = ledger.find(row => row.idempotencyKey === filter.idempotencyKey);
    if (!existing) ledger.push({ ...update.$setOnInsert });
    return { acknowledged: true, upsertedCount: existing ? 0 : 1 };
  }));
  t.mock.method(WalletTransaction, 'findOneAndUpdate', (filter: any, update: any) => query(() => {
    const row = ledger.find(entry => Object.entries(filter).every(([key, value]) => entry[key] === value));
    if (!row) return null;
    Object.assign(row, update.$set);
    return row;
  }));
  t.mock.method(Lead.collection, 'indexes', async () => [{ name: 'unique_percentage_payout_event_keys', key: { 'payoutCommission.eventKeys': 1 }, unique: true, sparse: true }]);
  t.mock.method(WalletTransaction.collection, 'indexes', async () => [{ name: 'idempotencyKey_1', key: { idempotencyKey: 1 }, unique: true, sparse: true }]);
  t.mock.method(AdvertiserReceipt.collection, 'indexes', async () => [
    { name: 'advertiser_receipt_unique_lead', key: { leadId: 1 }, unique: true },
    { name: 'advertiser_receipt_unique_reference', key: { referenceKey: 1 }, unique: true },
  ]);
  const receipts: any[] = [];
  t.mock.method(AdvertiserReceipt, 'create', async (rows: any[]) => { receipts.push(...rows); return rows; });
  let transactionQueue = Promise.resolve();
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async (callback: () => Promise<void>) => {
    let release!: () => void;
    const previous = transactionQueue;
    transactionQueue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { await callback(); } finally { release(); }
  }, endSession: async () => {} }) as any);
  t.mock.method(Notification, 'create', async () => []);
  t.mock.method(AuditLog, 'create', async (rows: any[]) => { audits.push(...rows); return rows; });

  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/admin/leads`;
  const token = signToken({ id: 'admin-authorized', email: 'admin@example.test', role: 'ADMIN' });
  const approve = (id: string, body: any, authenticated = true) => fetch(`${base}/${id}/review`, { method: 'PATCH', headers: { ...(authenticated ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

  assert.equal((await approve('loan-doc', { status: 'APPROVED', verifiedBaseAmount: 100000 }, false)).status, 401, 'unauthenticated users cannot approve');
  for (const value of [undefined, 0, -1, 1.001, '100000']) {
    const response = await approve('loan-doc', { status: 'APPROVED', verifiedBaseAmount: value });
    assert.equal(response.status, 400, `invalid confirmed amount ${String(value)} is rejected`);
    assert.equal(leads[0].status, 'PENDING');
    assert.equal(ledger.length, 0);
  }

  const approvedLoan = await approve('loan-doc', { status: 'APPROVED', verifiedBaseAmount: 100000 });
  assert.equal(approvedLoan.status, 200);
  assert.equal(leads[0].status, 'APPROVED');
  assert.equal(leads[0].payoutCommission.verifiedBaseAmount, 100000);
  assert.equal(leads[0].payoutCommission.calculatedAmount, 2500, 'the frozen campaign rate of 2.5% calculates ₹2,500');
  assert.equal(leads[0].payoutSnapshot, 2500);

  const simultaneousApprovals = await Promise.all([
    approve('concurrent-doc', { status: 'APPROVED', verifiedBaseAmount: 100000 }),
    approve('concurrent-doc', { status: 'APPROVED', verifiedBaseAmount: 100000 }),
  ]);
  assert.deepEqual(simultaneousApprovals.map(response => response.status).sort(), [200, 409]);
  assert.equal(leads[5].status, 'APPROVED');
  assert.equal(leads[5].payoutCommission.state, 'AVAILABLE');
  assert.equal(ledger.filter(row => row.referenceId === 'concurrent-doc').length, 1, 'concurrent first approval creates one available wallet credit');
  assert.equal(leads[0].payoutCommission.state, 'AVAILABLE');
  assert.equal(Object.hasOwn(leads[0].payoutCommission, 'eventKeys'), false, 'new admin approvals do not create an empty value in the sparse unique advertiser-event index');
  assert.equal(ledger[0].amount, 2500);
  assert.equal(ledger[0].status, 'AVAILABLE', 'approval credits the available wallet ledger in the same transaction');
  assert.equal(ledger[0].amount, 2500);
  assert.equal(ledger[0].processedBy, 'admin-authorized');
  assert.equal(leads[0].payoutCommission.verifiedBy, 'admin-authorized');
  assert.ok(leads[0].payoutCommission.verifiedAt instanceof Date);
  assert.ok(audits.some(entry => entry.action === 'LEAD_APPROVED' && entry.adminId === 'admin-authorized' && entry.after.verifiedBaseAmount === 100000 && entry.after.payoutRateSnapshot === 2.5 && entry.after.calculatedAmount === 2500 && entry.after.commissionState === 'AVAILABLE'));
  const receiptEndpoint = `${base}/loan-doc/percentage-payout/confirm-receipt`;
  const confirmReceipt = (admin: string) => fetch(receiptEndpoint, { method: 'PATCH', headers: { Authorization: `Bearer ${signToken({ id: admin, email: `${admin}@example.test`, role: 'ADMIN' })}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentReference: 'ADVERTISER-PAYMENT-1', evidenceReference: 'approved-payment-record-1', details: 'Full advertiser receipt verified for this lead', fullSingleLeadReceipt: true }) });
  assert.equal((await confirmReceipt('admin-authorized')).status, 409, 'receipt confirmation is not required after approval has made commission available');
  assert.equal(ledger[0].status, 'AVAILABLE');
  assert.equal((await confirmReceipt('admin-receipts')).status, 409, 'the unrelated receipt endpoint cannot credit an already available commission again');
  assert.equal(ledger[0].status, 'AVAILABLE');
  assert.equal(leads[0].payoutCommission.state, 'AVAILABLE');
  assert.equal((await confirmReceipt('admin-receipts')).status, 409, 'receipt replay cannot release a second credit');
  assert.equal(receipts.length, 0, 'single-admin approval creates no advertiser-receipt requirement or receipt record');

  const duplicateApprovals = await Promise.all([
    approve('loan-doc', { status: 'APPROVED', verifiedBaseAmount: 100000 }),
    approve('loan-doc', { status: 'APPROVED', verifiedBaseAmount: 100000 }),
  ]);
  assert.deepEqual(duplicateApprovals.map(response => response.status), [409, 409]);
  assert.equal(ledger.filter(row => row.referenceId === 'loan-doc').length, 1, 'repeat approval cannot create duplicate commission rows for the lead');
  assert.equal(leads[0].payoutSnapshot, 2500);

  const legacy = await approve('legacy-approved-doc', { status: 'APPROVED', verifiedBaseAmount: 80000 });
  assert.equal(legacy.status, 200, 'an already-approved legacy Loan can complete its amount approval directly');
  assert.equal(leads[2].payoutSnapshot, 2000);
  assert.deepEqual(leads[2].payoutCommission.eventKeys, ['legacy-event-key'], 'legacy event uniqueness data is preserved');
  assert.ok(leads[2].payoutCommission.history.some((entry: any) => entry.action === 'MIS_REPORT_ENTERED'));

  const approvedInsurance = await approve('insurance-doc', { status: 'APPROVED', verifiedBaseAmount: 40000 });
  assert.equal(approvedInsurance.status, 200);
  assert.equal(leads[1].payoutSnapshot, 1200, 'the campaign-configured 3% applies to the confirmed eligible premium');
  assert.equal(leads[1].payoutCommission.state, 'AVAILABLE');
  assert.equal(ledger.find(row => row.referenceId === 'insurance-doc')?.status, 'AVAILABLE');
  const missingTerms = await approve('invalid-insurance-doc', { status: 'APPROVED', verifiedBaseAmount: 40000 });
  assert.equal(missingTerms.status, 409);
  assert.equal(leads[4].status, 'PENDING');

  const previouslyPending: any = { _id: 'older-pending-doc', leadId: 'LOAN-OLD-PENDING', partnerId: 'VED-PTR-6', campaignId: 'loan-campaign', campaignType: 'Loans', status: 'APPROVED', payoutTypeSnapshot: 'PERCENTAGE', payoutBasisSnapshot: 'LOAN_DISBURSED_AMOUNT', payoutRateSnapshot: 2.5, payoutSnapshot: 0, payoutCommission: { state: 'PENDING', verifiedBaseAmount: 100000, calculatedAmount: 2500, history: [] }, save: async () => {}, toJSON() { return { ...this }; } };
  leads.push(previouslyPending);
  const doNotAutoReleaseHistoricalPending = await approve('older-pending-doc', { status: 'APPROVED', verifiedBaseAmount: 100000 });
  assert.equal(doNotAutoReleaseHistoricalPending.status, 409, 'approval does not automatically release a previously Pending commission');
  assert.equal(previouslyPending.payoutCommission.state, 'PENDING');
  assert.equal(ledger.some(row => row.referenceId === 'older-pending-doc'), false);

  const fixedApproval = await approve('fixed-doc', { status: 'APPROVED' });
  assert.equal(fixedApproval.status, 200);
  assert.equal(leads[3].payoutSnapshot, 450);
  assert.equal(leads[3].payoutCommission, undefined);
  assert.equal(ledger.find(row => row.referenceId === 'fixed-doc')?.status, 'AVAILABLE', 'fixed payouts retain their existing immediate ledger behavior');

  const legacyCard = renderToStaticMarkup(React.createElement(AdminLeadCard, { item: { _id: 'legacy-approved-doc', leadId: 'LOAN-LEGACY', status: 'APPROVED', payoutTypeSnapshot: 'PERCENTAGE', payoutBasisSnapshot: 'LOAN_DISBURSED_AMOUNT', payoutRateSnapshot: 2.5, payoutSnapshot: 0, campaignName: 'Loan Campaign', partnerId: 'VED-PTR-3', clientName: 'Test Customer', clientMobile: '9999999999', accountId: 'ACCOUNT-1', submittedData: undefined, payoutTermsSnapshot: 'Actual disbursed amount' } as any, busy: false, onAction: () => {} }));
  assert.ok(legacyCard.includes('Confirmed disbursed loan amount') && legacyCard.includes('Approve'));
  assert.ok(!legacyCard.includes('Record company report') && !legacyCard.includes('Verify report') && !legacyCard.includes('Evidence location'));
});
