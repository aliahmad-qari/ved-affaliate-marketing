import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { createApp } from '../server/app.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { Lead } from '../server/models/Lead.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { WalletTransaction } from '../server/models/WalletTransaction.ts';
import { AdvertiserReceipt } from '../server/models/AdvertiserReceipt.ts';
import { Notification } from '../server/models/Notification.ts';
import { PartnerStore } from '../server/services/partnerStore.ts';
import { signToken } from '../server/utils/jwt.ts';
import { availableBalanceCents } from '../server/services/adminServices.ts';
import { calculatePercentagePayout, isEligiblePercentageCampaign, isValidPercentageRate, resolvePayoutRate } from '../shared/percentagePayout.ts';
import { percentageAdvertiserEventKey } from '../server/controllers/percentagePayoutController.ts';
import { hasRequiredPercentagePayoutIndexes } from '../server/middleware/percentagePayoutReadiness.ts';
import { resolvePayoutSnapshot } from '../server/services/partnerPayout.ts';

const payoutIndexes = {
  leads: [
    { name: '_id_', key: { _id: 1 } },
    { name: 'unique_percentage_payout_event_keys', key: { 'payoutCommission.eventKeys': 1 }, unique: true, sparse: true },
  ],
  walletTransactions: [{ name: 'idempotencyKey_1', key: { idempotencyKey: 1 }, unique: true, sparse: true }],
  advertiserReceipts: [
    { name: 'advertiser_receipt_unique_lead', key: { leadId: 1 }, unique: true },
    { name: 'advertiser_receipt_unique_reference', key: { referenceKey: 1 }, unique: true },
  ],
};

test('percentage payout precedence uses campaign partner rate, partner default, then campaign rate', () => {
  const campaign = { _id: 'loan-1', campaignType: 'Loans', payoutType: 'PERCENTAGE' as const, payoutBasis: 'LOAN_DISBURSED_AMOUNT' as const, payoutPercentage: 1.5 };
  assert.equal(resolvePayoutRate(campaign), 1.5);
  assert.equal(resolvePayoutRate(campaign, { defaultPayoutPercentage: 2 }), 2);
  assert.equal(resolvePayoutRate(campaign, { defaultPayoutPercentage: 2, campaignPercentageOverrides: [{ campaignId: 'loan-1', percentage: 2.75 }] }), 2.75);
  assert.equal(resolvePayoutRate({ ...campaign, campaignType: 'Banking' }), null);
});

test('only Loan-disbursed and Insurance-eligible-premium bases match their categories', () => {
  assert.equal(isEligiblePercentageCampaign({ campaignType: 'Loans', payoutBasis: 'LOAN_DISBURSED_AMOUNT' }), true);
  assert.equal(isEligiblePercentageCampaign({ campaignType: 'Insurance', payoutBasis: 'INSURANCE_ELIGIBLE_PREMIUM' }), true);
  assert.equal(isEligiblePercentageCampaign({ campaignType: 'Loans', payoutBasis: 'INSURANCE_ELIGIBLE_PREMIUM' }), false);
  assert.equal(isEligiblePercentageCampaign({ campaignType: 'Banking', payoutBasis: 'LOAN_DISBURSED_AMOUNT' }), false);
});

test('rate validation is bounded and calculation rounds half-up to paisa', () => {
  for (const value of [0, 100.0001, -1, Number.NaN, 2.00001]) assert.equal(isValidPercentageRate(value), false);
  assert.equal(isValidPercentageRate(100), true);
  assert.equal(isValidPercentageRate(2.125), true);
  assert.equal(calculatePercentagePayout(100_000, 2.5), 2_500);
  assert.equal(calculatePercentagePayout(0.01, 50), 0.01);
  assert.throws(() => calculatePercentagePayout(100, 0));
});

test('new percentage snapshots freeze campaign terms while fixed payout snapshots retain existing behavior', () => {
  const pct = resolvePayoutSnapshot({ _id: 'insurance-1', payoutType: 'PERCENTAGE', payoutBasis: 'INSURANCE_ELIGIBLE_PREMIUM', payoutPercentage: 3, campaignType: 'Insurance', payoutTerms: 'Eligible premium per approved company schedule', terms: { eligibility: 'New policies only' } });
  assert.equal(pct.payoutRateSnapshot, 3);
  assert.equal(pct.payoutTermsSnapshot, 'Eligible premium per approved company schedule');
  assert.equal(pct.payoutEligibilitySnapshot?.eligibility, 'New policies only');
  const fixed = resolvePayoutSnapshot({ _id: 'fixed-1', payoutType: 'FIXED', payout: 450 });
  assert.deepEqual(fixed, { payoutSnapshot: 450, payoutTypeSnapshot: 'FIXED' });
});

test('MIS event identity is stable across a batch report reference and index readiness fails closed', () => {
  assert.equal(percentageAdvertiserEventKey('campaign-1', 'APPROVED_MIS', 'ADV-1'), percentageAdvertiserEventKey('campaign-1', 'APPROVED_MIS', 'adv-1'));
  assert.equal(percentageAdvertiserEventKey('campaign-1', 'APPROVED_MIS', 'ADV-1'), percentageAdvertiserEventKey('campaign-1', 'APPROVED_MIS', 'ADV-1'));
  assert.equal(percentageAdvertiserEventKey('campaign-1', 'APPROVED_MIS', 'ADV-1') === percentageAdvertiserEventKey('campaign-2', 'APPROVED_MIS', 'ADV-1'), false);
  assert.equal(hasRequiredPercentagePayoutIndexes(payoutIndexes), true);
  assert.equal(hasRequiredPercentagePayoutIndexes({ ...payoutIndexes, advertiserReceipts: [] }), false);
  assert.equal(Lead.schema.options.autoIndex, false, 'lead finance indexes require explicit preparation');
  assert.equal(Lead.schema.options.autoCreate, false, 'lead collection is not created by application startup');
  assert.equal(WalletTransaction.schema.options.autoIndex, false, 'wallet idempotency indexes require explicit preparation');
  assert.equal(WalletTransaction.schema.options.autoCreate, false, 'wallet collection creation is not an API startup side effect');
  assert.equal(AdvertiserReceipt.schema.options.autoIndex, false, 'receipt indexes require explicit preparation');
  assert.equal(AdvertiserReceipt.schema.options.autoCreate, false, 'receipt collection is not created by application startup');
});

test('percentage commissions in PENDING or unreconciled states never enter available balance', () => {
  const tx = [{ type: 'REFERRAL_REWARD', status: 'AVAILABLE', amount: 0 }];
  assert.equal(availableBalanceCents([
    { status: 'APPROVED', payoutTypeSnapshot: 'FIXED', payoutSnapshot: 100 },
    { status: 'APPROVED', payoutTypeSnapshot: 'PERCENTAGE', payoutSnapshot: 200, payoutCommission: { state: 'PENDING' } },
    { status: 'APPROVED', payoutTypeSnapshot: 'PERCENTAGE', payoutSnapshot: 300 },
  ], tx), 10_000);
  assert.equal(availableBalanceCents([
    { status: 'APPROVED', payoutTypeSnapshot: 'FIXED', payoutSnapshot: 100 },
    { status: 'APPROVED', payoutTypeSnapshot: 'PERCENTAGE', payoutSnapshot: 200, payoutCommission: { state: 'AVAILABLE' } },
  ], tx), 30_000);
});

test('MIS verification and single-lead receipt are separate, idempotent admin-gated stages', async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'percentage-payout-test-secret-at-least-32-characters';
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  const lead: any = {
    _id: 'lead-doc', leadId: 'LEAD-1', partnerId: 'VED-PTR-1', campaignId: 'campaign-1', campaignType: 'Loans',
    status: 'APPROVED', payoutTypeSnapshot: 'PERCENTAGE', payoutBasisSnapshot: 'LOAN_DISBURSED_AMOUNT', payoutRateSnapshot: 2.5, payoutSnapshot: 0,
    payoutTermsSnapshot: 'Loan commission is based on actual disbursed amount.', payoutEligibilitySnapshot: { eligibility: 'Approved qualifying loan event' },
    save: async () => {},
  };
  const duplicateEventLead: any = { ...lead, _id: 'other-lead-doc', leadId: 'LEAD-2', partnerId: 'VED-PTR-2', payoutCommission: undefined, save: async () => { throw Object.assign(new Error('duplicate event key'), { code: 11000 }); } };
  const incompleteInsuranceLead: any = { ...lead, _id: 'insurance-lead-doc', campaignId: 'insurance-1', campaignType: 'Insurance', payoutBasisSnapshot: 'INSURANCE_ELIGIBLE_PREMIUM', payoutTermsSnapshot: '', payoutEligibilitySnapshot: {}, payoutCommission: undefined, save: async () => {} };
  const eligibleInsuranceLead: any = { ...lead, _id: 'insurance-valid-lead-doc', leadId: 'LEAD-INSURANCE', campaignId: 'insurance-valid-1', partnerId: 'VED-PTR-INSURANCE', campaignType: 'Insurance', payoutBasisSnapshot: 'INSURANCE_ELIGIBLE_PREMIUM', payoutRateSnapshot: 3, payoutTermsSnapshot: 'Campaign-agreed eligible premium rules', payoutEligibilitySnapshot: { eligibility: 'Eligible premium confirmed by insurer MIS' }, payoutCommission: undefined, save: async () => {} };
  const query = (value: any): any => {
    const q: any = { exec: async () => value, session: () => q, select: () => q };
    q.then = (resolve: any, reject: any) => q.exec().then(resolve, reject);
    return q;
  };
  const walletUpdates: any[] = [];
  const receiptRows: any[] = [];
  const auditRows: any[] = [];
  t.mock.method(AdminUser, 'findById', (id: string) => query({ _id: id, email: `${id}@example.test`, status: 'ACTIVE', toJSON: () => ({ email: `${id}@example.test` }) }));
  t.mock.method(PartnerStore, 'getSessionsInvalidatedAt', async () => null);
  t.mock.method(Lead, 'findById', (id: string) => query(id === 'other-lead-doc' ? duplicateEventLead : id === 'insurance-lead-doc' ? incompleteInsuranceLead : id === 'insurance-valid-lead-doc' ? eligibleInsuranceLead : lead));
  t.mock.method(WalletTransaction, 'findOne', () => query(null));
  t.mock.method(WalletTransaction, 'updateOne', (_filter: any, update: any) => { walletUpdates.push(update); return query({ acknowledged: true }); });
  const walletFilters: any[] = [];
  t.mock.method(WalletTransaction, 'findOneAndUpdate', (filter: any, update: any) => { walletFilters.push(filter); walletUpdates.push(update); return query({ status: update.$set.status }); });
  t.mock.method(AdvertiserReceipt, 'create', async (rows: any[]) => {
    if (rows.some(row => receiptRows.some(existing => existing.leadId === row.leadId || existing.referenceKey === row.referenceKey))) throw Object.assign(new Error('duplicate receipt'), { code: 11000 });
    receiptRows.push(...rows); return rows;
  });
  t.mock.method(AuditLog, 'create', async (rows: any[]) => { auditRows.push(...rows); return rows; });
  t.mock.method(Notification, 'create', async (rows: any[]) => rows);
  t.mock.method(Lead.collection, 'indexes', async () => payoutIndexes.leads);
  t.mock.method(WalletTransaction.collection, 'indexes', async () => payoutIndexes.walletTransactions);
  t.mock.method(AdvertiserReceipt.collection, 'indexes', async () => payoutIndexes.advertiserReceipts);
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async (fn: () => Promise<void>) => fn(), endSession: async () => {} }) as any);

  const app = createApp().listen(0, '127.0.0.1');
  await once(app, 'listening');
  t.after(async () => { app.closeAllConnections(); await new Promise<void>(resolve => app.close(() => resolve())); });
  const endpoint = `http://127.0.0.1:${(app.address() as any).port}/api/admin/leads/lead-doc/percentage-payout`;
  const request = (url: string, adminId: string, body: any) => fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${signToken({ id: adminId, email: `${adminId}@example.test`, role: 'ADMIN' })}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const report = { source: 'APPROVED_MIS', reportedBaseAmount: 100_000, advertiserName: 'Approved Company', advertiserReference: 'ADV-1', reportReference: 'MIS-1', reportDate: '2026-11-05', evidenceReference: 'vault/MIS-1', verificationDetails: 'Company-reported actual disbursement' };
  const invalid = await request(`${endpoint}/evidence`, 'admin-a', { ...report, advertiserName: '', reportDate: '2026-02-30' });
  assert.equal(invalid.status, 400, 'company identity and a real calendar report date are required');
  assert.equal(lead.payoutCommission, undefined, 'invalid evidence does not mutate the lead');
  const invalidAmount = await request(`${endpoint}/evidence`, 'admin-a', { ...report, reportedBaseAmount: 0 });
  assert.equal(invalidAmount.status, 400, 'zero or missing verified base amounts cannot enter the commission workflow');
  assert.equal(lead.payoutCommission, undefined, 'invalid financial values do not mutate the lead');
  const entered = await request(`${endpoint}/evidence`, 'admin-a', report);
  assert.equal(entered.status, 202);
  assert.equal(lead.payoutCommission.state, 'AWAITING_REVIEW');
  assert.equal(lead.payoutCommission.verifiedBaseAmount, undefined, 'company-entered amount is not treated as verified');
  assert.equal(lead.payoutCommission.reportedBaseAmount, 100_000);
  assert.equal(walletUpdates.length, 0, 'entering an MIS value creates no wallet earning');
  const duplicateEvent = await request(`http://127.0.0.1:${(app.address() as any).port}/api/admin/leads/other-lead-doc/percentage-payout/evidence`, 'admin-a', report);
  assert.equal(duplicateEvent.status, 409, 'the unique event-key constraint rejects the same company event for another partner/lead');
  assert.equal(walletUpdates.length, 0, 'duplicate event rejection creates no ledger credit');
  const missingInsuranceTerms = await request(`http://127.0.0.1:${(app.address() as any).port}/api/admin/leads/insurance-lead-doc/percentage-payout/evidence`, 'admin-a', report);
  assert.equal(missingInsuranceTerms.status, 409, 'insurance remains non-payable without frozen campaign-agreed eligible premium rules');
  assert.equal(incompleteInsuranceLead.payoutCommission, undefined);

  const unchecked = await request(`${endpoint}/verify`, 'admin-b', { approvedMisReviewed: false });
  assert.equal(unchecked.status, 400, 'verification requires explicit evidence review');
  const verified = await request(`${endpoint}/verify`, 'admin-a', { approvedMisReviewed: true });
  assert.equal(verified.status, 200, 'the authorized MIS submitter can complete manual review without a second administrator');
  assert.equal(lead.payoutCommission.state, 'PENDING');
  assert.equal(lead.payoutCommission.verifiedBaseAmount, 100_000);
  assert.ok(lead.payoutCommission.history.some((entry: any) => entry.action === 'MIS_REPORT_MANUALLY_VERIFIED' && entry.adminId === 'admin-a'), 'manual verification is retained in the lead audit history with the authorized actor');
  assert.equal(lead.payoutSnapshot, 2500, 'the frozen 2.5 percent rate applies only to the verified loan disbursement amount');
  assert.equal(walletUpdates[0].$setOnInsert.status, 'PENDING', 'manual verification remains non-withdrawable pending advertiser receipt');
  const firstEarningKey = lead.payoutCommission.earningIdempotencyKey;
  const duplicateFirstVerify = await request(`${endpoint}/verify`, 'admin-a', { approvedMisReviewed: true });
  assert.equal(duplicateFirstVerify.status, 409, 'repeated manual verification cannot calculate or record the commission twice');
  assert.equal(walletUpdates.length, 1, 'repeated verification creates no second earning ledger row');
  const rejected = await request(`${endpoint}/reject`, 'admin-b', { reason: 'Incorrect MIS row; corrected approved row will be entered.' });
  assert.equal(rejected.status, 200);
  const correctedReport = await request(`${endpoint}/evidence`, 'admin-a', { ...report, reportedBaseAmount: 90_000, reportReference: 'MIS-CORRECTED', evidenceReference: 'vault/MIS-CORRECTED' });
  assert.equal(correctedReport.status, 202);
  assert.notEqual(lead.payoutCommission.earningIdempotencyKey, firstEarningKey, 'correction gets a new idempotency identity while retaining the original row');
  assert.equal(lead.payoutCommission.state, 'AWAITING_REVIEW');
  assert.equal(walletUpdates[1].$set.status, 'CANCELLED', 'the original pending ledger row is retained as cancelled');
  assert.equal(walletFilters[0].idempotencyKey, firstEarningKey, 'correction cancels only the original report’s pending ledger row');
  const finalVerified = await request(`${endpoint}/verify`, 'admin-a', { approvedMisReviewed: true });
  assert.equal(finalVerified.status, 200);
  assert.equal(lead.payoutCommission.verifiedBaseAmount, 90_000);
  assert.equal(lead.payoutSnapshot, 2250);
  assert.equal(walletUpdates[2].$setOnInsert.status, 'PENDING');
  const duplicateVerify = await request(`${endpoint}/verify`, 'admin-b', { approvedMisReviewed: true });
  assert.equal(duplicateVerify.status, 409, 'verified commission cannot be calculated or recorded twice');
  assert.equal(walletUpdates.length, 3, 'repeated verification does not issue another earning ledger write');

  const noAttestation = await request(`${endpoint}/confirm-receipt`, 'admin-c', { paymentReference: 'PAY-1', evidenceReference: 'vault/PAY-1', details: 'Receipt confirmed' });
  assert.equal(noAttestation.status, 400);
  const submitterReceipt = await request(`${endpoint}/confirm-receipt`, 'admin-a', { paymentReference: 'PAY-1', evidenceReference: 'vault/PAY-1', details: 'Receipt verified', fullSingleLeadReceipt: true });
  assert.equal(submitterReceipt.status, 409, 'the administrator who entered and verified the MIS cannot confirm advertiser receipt');
  const receiptRequests = await Promise.all([
    request(`${endpoint}/confirm-receipt`, 'admin-b', { paymentReference: 'PAY-1', evidenceReference: 'vault/PAY-1', details: 'Full single-lead receipt verified', fullSingleLeadReceipt: true }),
    request(`${endpoint}/confirm-receipt`, 'admin-c', { paymentReference: 'PAY-1', evidenceReference: 'vault/PAY-1', details: 'Full single-lead receipt verified', fullSingleLeadReceipt: true }),
  ]);
  assert.deepEqual(receiptRequests.map(response => response.status).sort(), [200, 409], 'concurrent receipt replays permit one release only');
  assert.equal(lead.payoutCommission.state, 'AVAILABLE');
  assert.equal(walletUpdates[3].$set.status, 'AVAILABLE');
  assert.equal(walletFilters.at(-1).partnerId, lead.partnerId, 'receipt release is matched to the lead’s original partner');
  assert.equal(walletFilters.at(-1).idempotencyKey, lead.payoutCommission.earningIdempotencyKey, 'receipt releases only the corrected report’s current earning identity');
  assert.equal(receiptRows.length, 1);
  assert.ok(auditRows.some(row => row.action === 'PERCENTAGE_PAYOUT_MIS_VERIFIED'));
  assert.ok(auditRows.some(row => row.action === 'ADVERTISER_RECEIPT_CONFIRMED'));
  const replay = await request(`${endpoint}/confirm-receipt`, 'admin-e', { paymentReference: 'PAY-2', evidenceReference: 'vault/PAY-2', details: 'Replay', fullSingleLeadReceipt: true });
  assert.equal(replay.status, 409, 'available commission cannot be confirmed twice');

  const insuranceReport = { ...report, reportedBaseAmount: 40_000, advertiserName: 'Approved Insurer', advertiserReference: 'INS-EVENT-1', reportReference: 'INS-MIS-1', evidenceReference: 'vault/INS-MIS-1', verificationDetails: 'Insurer-confirmed eligible premium' };
  const insuranceEntered = await request(`${endpoint}/evidence`.replace('/lead-doc/', '/insurance-valid-lead-doc/'), 'admin-insurance', insuranceReport);
  assert.equal(insuranceEntered.status, 202);
  const insuranceVerified = await request(`${endpoint}/verify`.replace('/lead-doc/', '/insurance-valid-lead-doc/'), 'admin-insurance', { approvedMisReviewed: true });
  assert.equal(insuranceVerified.status, 200, 'the same authorized administrator can manually verify eligible Insurance evidence');
  assert.equal(eligibleInsuranceLead.payoutCommission.verifiedBaseAmount, 40_000);
  assert.equal(eligibleInsuranceLead.payoutSnapshot, 1_200, '3 percent applies to the verified eligible premium');
  assert.equal(eligibleInsuranceLead.payoutCommission.state, 'PENDING');
  assert.equal(walletUpdates[4].$setOnInsert.status, 'PENDING', 'insurance commission remains non-withdrawable until advertiser receipt confirmation');
});
