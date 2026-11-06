import assert from 'node:assert/strict';
import test from 'node:test';
import { requireRole } from '../server/middleware/authMiddleware.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { WalletTransaction } from '../server/models/WalletTransaction.ts';
import { evaluateReferralReward, referralRewardIdempotencyKey } from '../shared/referralReward.ts';
import {
  adminApprovedReferralLeadFilter,
  flagReferralRewardReviewAfterLeadReversal,
  isAdminApprovedReferralLead,
  issueReferralRewardAtThreshold,
} from '../server/services/referralReward.ts';

const query = (value: unknown) => ({ session() { return this; }, lean() { return this; }, exec: async () => value });

test('referral reward threshold is exactly five and legacy rewards never qualify for a second award', () => {
  for (let count = 0; count <= 4; count++) assert.equal(evaluateReferralReward(count, false), 'NOT_ELIGIBLE');
  assert.equal(evaluateReferralReward(5, false), 'ELIGIBLE');
  assert.equal(evaluateReferralReward(6, false), 'REQUIRES_REVIEW');
  assert.equal(evaluateReferralReward(5, true), 'PRIOR_REWARD_EXISTS');
  assert.equal(referralRewardIdempotencyKey('ved-ptr-009'), 'REFERRAL_REWARD_5_APPROVED:VED-PTR-009');
});

test('only valid Admin-reviewed approved or paid leads count; rejected, pending, reversed, vendor, system and duplicates do not', () => {
  assert.deepEqual(adminApprovedReferralLeadFilter('ved-ptr-1'), {
    status: { $in: ['APPROVED', 'PAID'] },
    reviewedBy: { $type: 'string', $nin: ['', 'VENDOR_WEBHOOK', 'SYSTEM'] },
    rejectionReasonCode: { $nin: ['NO_LEAD_FOUND', 'DUPLICATE_LEAD', 'OTHER'] },
    approvalReversal: { $exists: false },
    partnerId: 'VED-PTR-1',
  });
  assert.equal(isAdminApprovedReferralLead({ status: 'APPROVED', reviewedBy: 'admin-1' }), true);
  assert.equal(isAdminApprovedReferralLead({ status: 'PAID', reviewedBy: 'admin-1' }), true);
  assert.equal(isAdminApprovedReferralLead({ status: 'PENDING', reviewedBy: 'admin-1' }), false);
  assert.equal(isAdminApprovedReferralLead({ status: 'REJECTED', reviewedBy: 'admin-1' }), false);
  assert.equal(isAdminApprovedReferralLead({ status: 'APPROVED', reviewedBy: 'VENDOR_WEBHOOK' }), false);
  assert.equal(isAdminApprovedReferralLead({ status: 'APPROVED', reviewedBy: 'SYSTEM' }), false);
  assert.equal(isAdminApprovedReferralLead({ status: 'APPROVED', reviewedBy: 'admin-1', rejectionReasonCode: 'DUPLICATE_LEAD' }), false);
  assert.equal(isAdminApprovedReferralLead({ status: 'APPROVED', reviewedBy: 'admin-1', rejectionReasonCode: 'OTHER' }), false);
  assert.equal(isAdminApprovedReferralLead({ status: 'APPROVED', reviewedBy: 'admin-1', approvalReversal: { at: new Date() } }), false);
  assert.equal(isAdminApprovedReferralLead({ status: 'APPROVED' }), false);
});

test('an existing historical ₹50 referral reward is preserved and blocks an additional ₹100 credit', async t => {
  let creditWrites = 0;
  t.mock.method(WalletTransaction, 'findOne', () => query({ amount: 50, status: 'AVAILABLE' }) as any);
  t.mock.method(WalletTransaction, 'updateOne', (async () => { creditWrites++; return { upsertedCount: 1 }; }) as any);
  t.mock.method(AuditLog, 'updateOne', async () => ({ upsertedCount: 1 }) as any);
  const result = await issueReferralRewardAtThreshold({
    referredPartnerId: 'VED-PTR-CHILD', referrerPartnerId: 'VED-PTR-PARENT', approvedLeadCount: 5,
    adminId: 'admin-1', adminEmail: 'admin@example.test', session: {} as any,
  });
  assert.equal(result, 'PRIOR_REWARD_EXISTS');
  assert.equal(creditWrites, 0);
});

test('concurrent qualifying approvals create one referral ledger reward and a separate audit entry', async t => {
  const credits = new Set<string>();
  const auditIds = new Set<string>();
  t.mock.method(WalletTransaction, 'findOne', () => query(null) as any);
  t.mock.method(WalletTransaction, 'updateOne', async (filter: any, update: any, options: any) => {
    assert.equal(filter.idempotencyKey, 'REFERRAL_REWARD_5_APPROVED:VED-PTR-CHILD');
    assert.equal(update.$setOnInsert.type, 'REFERRAL_REWARD');
    assert.equal(update.$setOnInsert.amount, 100);
    assert.equal(update.$setOnInsert.partnerId, 'VED-PTR-PARENT');
    assert.equal(update.$setOnInsert.referenceId, 'VED-PTR-CHILD');
    assert.equal(options.upsert, true);
    const key = filter.idempotencyKey;
    if (credits.has(key)) return { upsertedCount: 0 } as any;
    credits.add(key);
    return { upsertedCount: 1 } as any;
  });
  t.mock.method(AuditLog, 'updateOne', async (filter: any, update: any, options: any) => {
    assert.equal(update.$setOnInsert.action, 'REFERRAL_REWARD_FIVE_LEADS_DECIDED');
    assert.equal(options.upsert, true);
    const key = String(filter._id);
    if (auditIds.has(key)) return { upsertedCount: 0 } as any;
    auditIds.add(key);
    return { upsertedCount: 1 } as any;
  });
  const input = {
    referredPartnerId: 'VED-PTR-CHILD', referrerPartnerId: 'VED-PTR-PARENT', approvedLeadCount: 5,
    adminId: 'admin-1', adminEmail: 'admin@example.test', session: {} as any,
  };
  const results = await Promise.all(Array.from({ length: 16 }, () => issueReferralRewardAtThreshold(input)));
  assert.equal(credits.size, 1);
  assert.equal(results.filter(result => result === 'ISSUED').length, 1);
  assert.equal(auditIds.size, 1);
});

test('reversing a qualifying lead flags admin review without changing or clawing back an issued reward', async t => {
  const reward = { transactionId: 'REF123', amount: 100, status: 'AVAILABLE' };
  let audit: any;
  let walletMutations = 0;
  t.mock.method(WalletTransaction, 'findOne', () => query(reward) as any);
  t.mock.method(WalletTransaction, 'updateOne', async () => { walletMutations++; return {} as any; });
  t.mock.method(WalletTransaction, 'create', async () => { walletMutations++; return [] as any; });
  t.mock.method(AuditLog, 'create', async (docs: any[]) => { audit = docs[0]; return docs as any; });

  const result = await flagReferralRewardReviewAfterLeadReversal({
    referredPartnerId: 'ved-ptr-child', leadId: 'LEAD-123', reason: 'Eligibility reversal',
    adminId: 'admin-1', adminEmail: 'admin@example.test', session: {} as any,
  });

  assert.equal(result, true);
  assert.equal(audit.action, 'REFERRAL_REWARD_REVIEW_REQUIRED_AFTER_LEAD_REVERSAL');
  assert.equal(audit.after.reviewRequired, true);
  assert.equal(audit.after.rewardPreserved, true);
  assert.equal(audit.after.automaticClawback, false);
  assert.deepEqual(audit.before, { transactionId: 'REF123', amount: 100, status: 'AVAILABLE' });
  assert.equal(walletMutations, 0);
});

test('reversal without an existing referral reward does not create a reward-review record', async t => {
  let auditWrites = 0;
  t.mock.method(WalletTransaction, 'findOne', () => query(null) as any);
  t.mock.method(AuditLog, 'create', async () => { auditWrites++; return [] as any; });
  const result = await flagReferralRewardReviewAfterLeadReversal({
    referredPartnerId: 'VED-PTR-CHILD', leadId: 'LEAD-123', reason: 'Correction',
    adminId: 'admin-1', adminEmail: 'admin@example.test', session: {} as any,
  });
  assert.equal(result, false);
  assert.equal(auditWrites, 0);
});

test('partner and Admin authorization remain separated for referral data', () => {
  const invoke = (role: 'PARTNER' | 'ADMIN', required: 'PARTNER' | 'ADMIN') => {
    let status = 200; let passed = false;
    const response: any = { status(code: number) { status = code; return this; }, json() { return this; } };
    requireRole(required)({ user: { partnerId: 'VED-PTR-1' }, authRole: role } as any, response, () => { passed = true; });
    return { status, passed };
  };
  assert.deepEqual(invoke('PARTNER', 'ADMIN'), { status: 403, passed: false });
  assert.deepEqual(invoke('ADMIN', 'PARTNER'), { status: 403, passed: false });
});
