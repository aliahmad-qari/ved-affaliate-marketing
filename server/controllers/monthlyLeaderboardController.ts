import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead.ts';
import { Partner } from '../models/Partner.ts';
import { MonthlyRewardPolicy, MonthlyRewardRule } from '../models/MonthlyRewardPolicy.ts';
import { MonthlyLeaderboardReward } from '../models/MonthlyLeaderboardReward.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { adminApprovedLeadFilter, getMonthlyLeaderboard, getPublicMonthlyLeaderboard, validateReportMonth } from '../services/monthlyLeaderboard.ts';
import { insertMonthlyRewardOnce, normalizeMonthlyRewardRules, partnerMonthlyRewardsFilter } from '../services/monthlyRewards.ts';
import { monthlyRewardId } from '../../shared/monthlyLeaderboard.ts';

const partnerIdFor = (req: Request) => String(req.user?.partnerId || '').toUpperCase();
const adminIdFor = (req: Request) => String(req.user?._id || '');

export const getPartnerMonthlyLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const monthKey = String(req.query.month || '').trim();
    const board = await getPublicMonthlyLeaderboard(monthKey);
    const rewards = await MonthlyLeaderboardReward.find(partnerMonthlyRewardsFilter(partnerIdFor(req), monthKey))
      .select('monthKey partnerId rewardType label amount currency paymentStatus approvedAt paidAt paymentReference')
      .sort({ createdAt: -1 }).lean().exec();
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, data: { ...board, rewards } });
  } catch (error) { next(error); }
};

export const getAdminMonthlyLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const monthKey = String(req.query.month || '').trim();
    const [board, policy, rewards] = await Promise.all([
      getMonthlyLeaderboard(monthKey),
      MonthlyRewardPolicy.findById(monthKey).lean().exec(),
      MonthlyLeaderboardReward.find({ monthKey }).sort({ createdAt: -1 }).lean().exec(),
    ]);
    const ids = [...new Set(rewards.map(reward => String(reward.partnerId)))];
    const partners: any[] = ids.length ? await Partner.find({ partnerId: { $in: ids } }).select('partnerId fullName').lean().exec() : [];
    const names = new Map(partners.map(partner => [String(partner.partnerId).toUpperCase(), partner.fullName]));
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, data: {
      ...board,
      policy: policy || { _id: monthKey, rules: [], clientApprovalReference: '' },
      rewards: rewards.map(reward => ({ ...reward, partnerName: names.get(String(reward.partnerId).toUpperCase()) || 'VED Partner' })),
      rewardIssuanceEnabled: Boolean(policy?.clientApprovedAt && policy?.clientApprovalReference),
    } });
  } catch (error) { next(error); }
};

export const saveMonthlyRewardPolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const monthKey = typeof req.body?.monthKey === 'string' ? req.body.monthKey.trim() : '';
  const rules = normalizeMonthlyRewardRules(req.body?.rules);
  if (!rules) { res.status(400).json({ success: false, message: 'Enter at least one reward rule with a unique type, label, positive approved-conversion threshold, and amount to two decimal places.' }); return; }
  try {
    validateReportMonth(monthKey);
    const existing: any = await MonthlyRewardPolicy.findById(monthKey).lean().exec();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const before = existing ? { rules: existing.rules, clientApprovalReference: existing.clientApprovalReference || '' } : undefined;
        await MonthlyRewardPolicy.updateOne(
          { _id: monthKey },
          { $set: { rules, clientApprovalReference: '', clientApprovedAt: null, clientApprovedBy: '' } },
          { upsert: true, session, runValidators: true },
        );
        await AuditLog.create([{
          adminId: adminIdFor(req), adminEmail: String(req.user?.email || ''), action: 'MONTHLY_REWARD_POLICY_SAVED',
          entityType: 'MonthlyRewardPolicy', entityId: monthKey, before,
          after: { rules, clientApproved: false }, ipAddress: req.ip,
        }], { session });
      });
    } finally { await session.endSession(); }
    res.json({ success: true, message: 'Reward rules saved. Client approval must be recorded again before eligibility records can be generated.' });
  } catch (error) { next(error); }
};

export const approveMonthlyRewardPolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const monthKey = typeof req.body?.monthKey === 'string' ? req.body.monthKey.trim() : '';
  const reference = typeof req.body?.clientApprovalReference === 'string' ? req.body.clientApprovalReference.trim() : '';
  if (reference.length < 4 || reference.length > 120) { res.status(400).json({ success: false, message: 'Enter the client approval reference (4 to 120 characters).' }); return; }
  try {
    validateReportMonth(monthKey);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const policy: any = await MonthlyRewardPolicy.findById(monthKey).session(session).exec();
        if (!policy?.rules?.length) throw Object.assign(new Error('Save reward rules before recording client approval.'), { status: 409 });
        const before = { clientApprovalReference: policy.clientApprovalReference || '', clientApprovedAt: policy.clientApprovedAt || null };
        policy.clientApprovalReference = reference;
        policy.clientApprovedAt = new Date();
        policy.clientApprovedBy = adminIdFor(req);
        await policy.save({ session });
        await AuditLog.create([{
          adminId: adminIdFor(req), adminEmail: String(req.user?.email || ''), action: 'MONTHLY_REWARD_POLICY_CLIENT_APPROVED',
          entityType: 'MonthlyRewardPolicy', entityId: monthKey, before,
          after: { clientApprovalReference: reference, clientApprovedAt: policy.clientApprovedAt }, ipAddress: req.ip,
        }], { session });
      });
    } finally { await session.endSession(); }
    res.json({ success: true, message: 'Client approval reference recorded for this month\'s reward rules.' });
  } catch (error) { next(error); }
};

export const generateMonthlyRewards = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const monthKey = typeof req.body?.monthKey === 'string' ? req.body.monthKey.trim() : '';
  try {
    validateReportMonth(monthKey);
    const policy: any = await MonthlyRewardPolicy.findById(monthKey).lean().exec();
    if (!policy?.clientApprovedAt || !policy?.clientApprovalReference || !policy.rules?.length) {
      res.status(409).json({ success: false, message: 'Reward generation is disabled until rules and their client approval reference are recorded.' }); return;
    }
    const board = await getMonthlyLeaderboard(monthKey);
    const eligible = board.rankings.flatMap(row => policy.rules
      .filter((rule: MonthlyRewardRule) => row.approvedConversions >= rule.minimumApprovedConversions)
      .map((rule: MonthlyRewardRule) => ({ row, rule })));
    const session = await mongoose.startSession();
    let created = 0;
    try {
      await session.withTransaction(async () => {
        for (const { row, rule } of eligible) {
          const id = monthlyRewardId(monthKey, row.partnerId, rule.rewardType);
          const inserted = await insertMonthlyRewardOnce({
            monthKey, partnerId: row.partnerId, rewardType: rule.rewardType, label: rule.label, amount: rule.amount,
            minimumApprovedConversions: rule.minimumApprovedConversions, approvedConversionsAtGeneration: row.approvedConversions,
          }, session);
          if (inserted) {
            created++;
            await AuditLog.create([{
              adminId: adminIdFor(req), adminEmail: String(req.user?.email || ''), action: 'MONTHLY_REWARD_ELIGIBILITY_RECORDED',
              entityType: 'MonthlyLeaderboardReward', entityId: id, before: undefined,
              after: { monthKey, partnerId: row.partnerId, rewardType: rule.rewardType, amount: rule.amount, paymentStatus: 'PENDING' }, ipAddress: req.ip,
            }], { session });
          }
        }
        await AuditLog.create([{
          adminId: adminIdFor(req), adminEmail: String(req.user?.email || ''), action: 'MONTHLY_REWARDS_GENERATED',
          entityType: 'MonthlyRewardPolicy', entityId: monthKey, after: { eligibleCount: eligible.length, newRecords: created }, ipAddress: req.ip,
        }], { session });
      });
    } finally { await session.endSession(); }
    res.json({ success: true, data: { eligibleCount: eligible.length, newRecords: created } });
  } catch (error: any) {
    if (error?.code === 11000) { res.status(409).json({ success: false, message: 'Reward records changed concurrently. Refresh the monthly leaderboard and retry.' }); return; }
    next(error);
  }
};

export const approveMonthlyReward = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const id = String(req.params.id || '');
  try {
    const reward: any = await MonthlyLeaderboardReward.findById(id).lean().exec();
    if (!reward) { res.status(404).json({ success: false, message: 'Monthly reward not found.' }); return; }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const policy: any = await MonthlyRewardPolicy.findById(reward.monthKey).session(session).exec();
        const rule = policy?.rules?.find((item: MonthlyRewardRule) => item.rewardType === reward.rewardType);
        if (!policy?.clientApprovedAt || !policy?.clientApprovalReference || !rule
          || rule.amount !== reward.amount || rule.minimumApprovedConversions !== reward.minimumApprovedConversions) {
          throw Object.assign(new Error('This reward is not covered by the currently client-approved rules.'), { status: 409 });
        }
        const current = await Lead.countDocuments({ ...adminApprovedLeadFilter(reward.monthKey), partnerId: reward.partnerId }).session(session);
        if (current < reward.minimumApprovedConversions) throw Object.assign(new Error('The partner no longer meets this reward\'s approved-conversion criteria.'), { status: 409 });
        const result = await MonthlyLeaderboardReward.updateOne(
          { _id: id, paymentStatus: 'PENDING', approvedAt: { $exists: false } },
          { $set: { approvedAt: new Date(), approvedBy: adminIdFor(req) } }, { session },
        );
        if (!result.matchedCount) throw Object.assign(new Error('This reward was already approved or its status changed.'), { status: 409 });
        await AuditLog.create([{
          adminId: adminIdFor(req), adminEmail: String(req.user?.email || ''), action: 'MONTHLY_REWARD_ADMIN_APPROVED',
          entityType: 'MonthlyLeaderboardReward', entityId: id,
          before: { approvedAt: null, paymentStatus: reward.paymentStatus },
          after: { approvedAt: new Date(), approvedBy: adminIdFor(req), amount: reward.amount }, ipAddress: req.ip,
        }], { session });
      });
    } finally { await session.endSession(); }
    res.json({ success: true, message: 'Reward approved for manual payment processing. No wallet was credited.' });
  } catch (error) { next(error); }
};

export const updateMonthlyRewardPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const id = String(req.params.id || '');
  const target = req.body?.paymentStatus;
  const paymentReference = typeof req.body?.paymentReference === 'string' ? req.body.paymentReference.trim() : '';
  if (!['PROCESSING', 'PAID'].includes(target)) { res.status(400).json({ success: false, message: 'Payment status must be PROCESSING or PAID.' }); return; }
  if (target === 'PAID' && (paymentReference.length < 3 || paymentReference.length > 160)) {
    res.status(400).json({ success: false, message: 'A payment reference is required to mark a reward Paid.' }); return;
  }
  try {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const reward: any = await MonthlyLeaderboardReward.findById(id).session(session).exec();
        if (!reward) throw Object.assign(new Error('Monthly reward not found.'), { status: 404 });
        if (!reward.approvedAt || !reward.approvedBy) throw Object.assign(new Error('An Admin must approve this reward before payment processing.'), { status: 409 });
        const policy: any = await MonthlyRewardPolicy.findById(reward.monthKey).session(session).exec();
        const rule = policy?.rules?.find((item: MonthlyRewardRule) => item.rewardType === reward.rewardType);
        if (!policy?.clientApprovedAt || !policy?.clientApprovalReference || !rule
          || rule.amount !== reward.amount || rule.minimumApprovedConversions !== reward.minimumApprovedConversions) {
          throw Object.assign(new Error('This reward is no longer covered by the client-approved rules.'), { status: 409 });
        }
        const current = await Lead.countDocuments({ ...adminApprovedLeadFilter(reward.monthKey), partnerId: reward.partnerId }).session(session);
        if (current < reward.minimumApprovedConversions) throw Object.assign(new Error('The partner no longer meets this reward\'s approved-conversion criteria.'), { status: 409 });
        const allowed = target === 'PROCESSING'
          ? reward.paymentStatus === 'PENDING'
          : reward.paymentStatus === 'PROCESSING';
        if (!allowed) throw Object.assign(new Error('This monthly reward payment status cannot be changed to the requested state.'), { status: 409 });
        const before = { paymentStatus: reward.paymentStatus, paymentReference: reward.paymentReference || '' };
        reward.paymentStatus = target;
        if (target === 'PAID') { reward.paymentReference = paymentReference; reward.paidBy = adminIdFor(req); reward.paidAt = new Date(); }
        await reward.save({ session });
        await AuditLog.create([{
          adminId: adminIdFor(req), adminEmail: String(req.user?.email || ''), action: `MONTHLY_REWARD_${target}`,
          entityType: 'MonthlyLeaderboardReward', entityId: id, before,
          after: { paymentStatus: target, paymentReference: target === 'PAID' ? paymentReference : '', amount: reward.amount }, ipAddress: req.ip,
        }], { session });
      });
    } finally { await session.endSession(); }
    res.json({ success: true, message: target === 'PAID' ? 'Manual reward payment recorded.' : 'Reward marked as Processing.' });
  } catch (error) { next(error); }
};
