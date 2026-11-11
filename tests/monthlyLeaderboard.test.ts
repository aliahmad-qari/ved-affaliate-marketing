import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isApprovedLeadMatch, LEADERBOARD_TIME_ZONE, monthKeyInTimeZone, monthWindow,
  monthlyRewardId, rankLeaderboard, shiftMonth, validateReportMonth,
} from '../shared/monthlyLeaderboard.ts';
import { adminApprovedLeadFilter } from '../server/services/monthlyLeaderboard.ts';
import { insertMonthlyRewardOnce, normalizeMonthlyRewardRules, partnerMonthlyRewardsFilter } from '../server/services/monthlyRewards.ts';
import { MonthlyLeaderboardReward } from '../server/models/MonthlyLeaderboardReward.ts';
import { requireRole } from '../server/middleware/authMiddleware.ts';

test('monthly reporting boundaries use UTC calendar months and an exclusive end', () => {
  const window = monthWindow('2026-11');
  assert.equal(LEADERBOARD_TIME_ZONE, 'UTC');
  assert.equal(window.start.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(window.end.toISOString(), '2026-12-01T00:00:00.000Z');
  assert.equal(monthKeyInTimeZone(new Date('2026-10-31T23:59:59.999Z')), '2026-10');
  assert.equal(monthKeyInTimeZone(new Date('2026-11-01T00:00:00.000Z')), '2026-11');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2025-12', 1), '2026-01');
  assert.throws(() => monthWindow('2026-13'));
  assert.throws(() => validateReportMonth('2026-12', new Date('2026-11-01T00:00:00.000Z')));
});

test('monthly eligibility uses approved admin-reviewed leads and excludes vendor-only, reversed, pending, rejected records', () => {
  const match = adminApprovedLeadFilter('2026-11', new Date('2026-11-10T00:00:00Z'));
  assert.deepEqual(match.status, { $in: ['APPROVED', 'PAID'] });
  assert.deepEqual(match.approvedAt, { $gte: new Date('2026-11-01T00:00:00.000Z'), $lt: new Date('2026-12-01T00:00:00.000Z') });
  assert.deepEqual(match.reviewedBy, { $nin: ['', 'VENDOR_WEBHOOK', 'SYSTEM'] });
  assert.deepEqual(match.rejectionReasonCode, { $ne: 'DUPLICATE_LEAD' });
  assert.deepEqual(match.approvalReversal, { $exists: false });
  const approvedAt = new Date('2026-11-10T00:00:00Z');
  assert.equal(isApprovedLeadMatch('APPROVED', 'admin-1', approvedAt), true);
  assert.equal(isApprovedLeadMatch('PAID', 'admin-1', approvedAt), true);
  assert.equal(isApprovedLeadMatch('PENDING', 'admin-1', approvedAt), false);
  assert.equal(isApprovedLeadMatch('REJECTED', 'admin-1', approvedAt), false);
  assert.equal(isApprovedLeadMatch('APPROVED', 'VENDOR_WEBHOOK', approvedAt), false);
});

test('rankings are deterministic and ties share competition rank', () => {
  assert.deepEqual(rankLeaderboard([
    { partnerId: 'VED-PTR-Z', fullName: 'Beta', approvedConversions: 5, approvedEarnings: 500 },
    { partnerId: 'VED-PTR-B', fullName: 'Alpha', approvedConversions: 5, approvedEarnings: 1000 },
    { partnerId: 'VED-PTR-A', fullName: 'Alpha', approvedConversions: 5, approvedEarnings: 0 },
    { partnerId: 'VED-PTR-C', fullName: 'Gamma', approvedConversions: 3, approvedEarnings: 3000 },
  ]).map(row => [row.rank, row.partnerId]), [
    [1, 'VED-PTR-A'], [1, 'VED-PTR-B'], [1, 'VED-PTR-Z'], [4, 'VED-PTR-C'],
  ]);
});

test('reward identity is unique by partner, month and reward type; partner history filters stay scoped', () => {
  assert.equal(monthlyRewardId('2026-11', 'ved-ptr-1', 'TOP_PERFORMER'), monthlyRewardId('2026-11', 'VED-PTR-1', 'top_performer'));
  assert.notEqual(monthlyRewardId('2026-11', 'VED-PTR-1', 'TOP_PERFORMER'), monthlyRewardId('2026-10', 'VED-PTR-1', 'TOP_PERFORMER'));
  assert.notEqual(monthlyRewardId('2026-11', 'VED-PTR-1', 'TOP_PERFORMER'), monthlyRewardId('2026-11', 'VED-PTR-2', 'TOP_PERFORMER'));
  assert.notEqual(monthlyRewardId('2026-11', 'VED-PTR-1', 'TOP_PERFORMER'), monthlyRewardId('2026-11', 'VED-PTR-1', 'CONSISTENCY'));
  assert.deepEqual(partnerMonthlyRewardsFilter('ved-ptr-1', '2026-11'), { partnerId: 'VED-PTR-1', monthKey: '2026-11' });
});

test('partner and admin role gates reject cross-role leaderboard access', () => {
  const invoke = (role: 'PARTNER' | 'ADMIN', required: 'PARTNER' | 'ADMIN') => {
    let status = 200;
    let passed = false;
    const response: any = { status(code: number) { status = code; return this; }, json() { return this; } };
    requireRole(required)({ user: { partnerId: 'VED-PTR-1' }, authRole: role } as any, response, () => { passed = true; });
    return { status, passed };
  };
  assert.deepEqual(invoke('PARTNER', 'ADMIN'), { status: 403, passed: false });
  assert.deepEqual(invoke('ADMIN', 'PARTNER'), { status: 403, passed: false });
});

test('reward rules have no built-in amount or threshold and reject missing or duplicate configuration', () => {
  assert.equal(normalizeMonthlyRewardRules([]), null);
  assert.equal(normalizeMonthlyRewardRules([{ rewardType: 'TOP', label: 'Top', minimumApprovedConversions: 5 }]), null);
  assert.equal(normalizeMonthlyRewardRules([
    { rewardType: 'TOP', label: 'Top performer', minimumApprovedConversions: 5, amount: 100 },
    { rewardType: 'top', label: 'Duplicate type', minimumApprovedConversions: 8, amount: 200 },
  ]), null);
  assert.deepEqual(normalizeMonthlyRewardRules([{ rewardType: 'top', label: 'Top performer', minimumApprovedConversions: '5', amount: '125.50' }]), [
    { rewardType: 'TOP', label: 'Top performer', minimumApprovedConversions: 5, amount: 125.5 },
  ]);
});

test('concurrent reward generation upserts one deterministic pending record and has no wallet side effect', async t => {
  const inserted = new Set<string>();
  t.mock.method(MonthlyLeaderboardReward, 'updateOne', async (filter: any, update: any, options: any) => {
    assert.equal(filter._id, update.$setOnInsert._id);
    assert.equal(update.$setOnInsert.paymentStatus, 'PENDING');
    assert.equal(update.$setOnInsert.partnerId, 'VED-PTR-1');
    assert.equal(options.upsert, true);
    if (inserted.has(filter._id)) return { upsertedCount: 0 } as any;
    inserted.add(filter._id);
    return { upsertedCount: 1 } as any;
  });
  const input = { monthKey: '2026-11', partnerId: 'VED-PTR-1', rewardType: 'TOP', label: 'Top', amount: 125, minimumApprovedConversions: 5, approvedConversionsAtGeneration: 7 };
  const results = await Promise.all(Array.from({ length: 12 }, () => insertMonthlyRewardOnce(input)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(inserted.size, 1);
});
