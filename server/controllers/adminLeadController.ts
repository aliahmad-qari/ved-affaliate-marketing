import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead.ts';
import { Partner } from '../models/Partner.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { Notification } from '../models/Notification.ts';
import { generateTransactionId } from '../utils/idGenerator.ts';
import { escapeRegex, availableBalanceCents } from '../services/adminServices.ts';

const listOptions = (req: Request) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
  return { page, limit, skip: (page - 1) * limit };
};

export const getAdminDashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [totalPartners, activePartners, totalLeads, approvedLeads, pendingLeads, payoutRows, withdrawalRequests] = await Promise.all([
      Partner.countDocuments(),
      Partner.countDocuments({ accountStatus: 'ACTIVE' }),
      Lead.countDocuments(),
      Lead.countDocuments({ status: { $in: ['APPROVED', 'PAID'] } }),
      Lead.countDocuments({ status: { $in: ['PENDING', 'VERIFIED'] } }),
      Lead.aggregate([
        { $match: { status: { $in: ['APPROVED', 'PAID'] } } },
        { $group: { _id: '$status', amount: { $sum: '$payoutSnapshot' } } },
      ]),
      WalletTransaction.countDocuments({ type: 'WITHDRAWAL', status: { $in: ['PENDING', 'PROCESSING', 'APPROVED'] } }),
    ]);
    const payouts = Object.fromEntries(payoutRows.map((row: any) => [row._id, row.amount]));
    const pendingWithdrawalRows = await WalletTransaction.aggregate([
      { $match: { type: 'WITHDRAWAL', status: { $in: ['PENDING', 'PROCESSING', 'APPROVED'] } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const paidWithdrawalRows = await WalletTransaction.aggregate([
      { $match: { type: 'WITHDRAWAL', status: { $in: ['PAID', 'PROCESSED'] } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const paidWithdrawals = Number(paidWithdrawalRows[0]?.amount || 0);
    // Paid withdrawals release APPROVED earnings without changing the lead status, so offset them here.
    res.json({
      success: true,
      data: {
        totalPartners, activePartners, totalLeads, approvedLeads, pendingLeads,
        totalEarnings: Number(payouts.APPROVED || 0) + Number(payouts.PAID || 0),
        pendingPayout: Math.max(0, Number(payouts.APPROVED || 0) - paidWithdrawals),
        paidPayout: Number(payouts.PAID || 0) + paidWithdrawals,
        withdrawalRequests,
        pendingWithdrawals: Number(pendingWithdrawalRows[0]?.amount || 0),
        paidWithdrawals,
      },
    });
  } catch (error) { next(error); }
};

export const listAdminLeads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, skip } = listOptions(req);
    const query: Record<string, any> = {};
    if (typeof req.query.status === 'string' && req.query.status !== 'ALL') {
      const status = req.query.status.toUpperCase();
      if (['IN_PROCESS', 'NOT_SUBMITTED'].includes(status)) {
        query['submittedData.source'] = 'CUSTOMER_FORM';
        query['submittedData.processStatus'] = status;
        query.status = { $in: ['PENDING', 'VERIFIED'] };
      } else query.status = status;
    }
    if (typeof req.query.partnerId === 'string') query.partnerId = req.query.partnerId.toUpperCase();
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const pattern = new RegExp(escapeRegex(req.query.search.trim().slice(0, 80)), 'i');
      query.$or = [{ leadId: pattern }, { clientName: pattern }, { clientMobile: pattern }, { accountId: pattern }, { campaignName: pattern }];
    }
    const [data, total] = await Promise.all([
      Lead.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      Lead.countDocuments(query),
    ]);
    const partnerIds = [...new Set(data.map(lead => lead.partnerId))];
    const partners = partnerIds.length ? await Partner.find({ partnerId: { $in: partnerIds } })
      .select('partnerId fullName -_id').lean().exec() : [];
    const partnerNames = new Map(partners.map(partner => [partner.partnerId, partner.fullName]));
    res.json({ success: true, data: data.map(lead => ({ ...lead, referringPartnerName: partnerNames.get(lead.partnerId) || null })), total, page, totalPages: Math.ceil(total / limit) || 1 });
  } catch (error) { next(error); }
};

export const reviewAdminLead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const target = req.body.status;
  const rejectionReason = typeof req.body.rejectionReason === 'string' ? req.body.rejectionReason.trim().slice(0, 1000) : '';
  if (!['VERIFIED', 'APPROVED', 'REJECTED'].includes(target)) {
    res.status(400).json({ success: false, message: 'Status must be VERIFIED, APPROVED, or REJECTED.' });
    return;
  }
  if (target === 'REJECTED' && !rejectionReason) {
    res.status(400).json({ success: false, message: 'A rejection reason is required.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let updated: any;
    await session.withTransaction(async () => {
      const lead: any = await Lead.findById(req.params.id).session(session).exec();
      if (!lead) throw Object.assign(new Error('Lead not found.'), { status: 404 });
      if (lead.submittedData?.source === 'CUSTOMER_FORM' && lead.submittedData.processStatus === 'NOT_SUBMITTED' && target !== 'REJECTED') {
        throw Object.assign(new Error('Mark this enquiry In Process before verifying or approving it.'), { status: 409 });
      }
      const before = { status: lead.status, payoutSnapshot: lead.payoutSnapshot, rejectionReason: lead.rejectionReason };
      const allowed: Record<string, string[]> = {
        PENDING: ['VERIFIED', 'APPROVED', 'REJECTED'],
        VERIFIED: ['APPROVED', 'REJECTED'],
      };
      if (!allowed[lead.status]?.includes(target)) throw Object.assign(new Error(`Cannot change lead from ${lead.status} to ${target}.`), { status: 409 });
      lead.status = target;
      lead.reviewedBy = String(req.user._id);
      lead.reviewNote = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 2000) : '';
      if (target === 'VERIFIED') lead.verifiedAt = new Date();
      if (target === 'APPROVED') lead.approvedAt = new Date();
      if (target === 'REJECTED') {
        lead.rejectedAt = new Date();
        lead.rejectionReason = rejectionReason;
      }
      await lead.save({ session });

      if (target === 'APPROVED') {
        await WalletTransaction.updateOne(
          { idempotencyKey: `LEAD_EARNING:${lead._id}` },
          { $setOnInsert: {
            transactionId: generateTransactionId(), partnerId: lead.partnerId, type: 'LEAD_EARNING',
            amount: lead.payoutSnapshot, status: 'AVAILABLE', referenceType: 'LEAD',
            referenceId: String(lead._id), description: `Approved lead earning for ${lead.leadId}`,
            idempotencyKey: `LEAD_EARNING:${lead._id}`, processedBy: String(req.user._id),
          } },
          { upsert: true, session, runValidators: true },
        );

        const partner: any = await Partner.findOne({ partnerId: lead.partnerId }).select('referredBy').session(session).exec();
        const approvedCount = await Lead.countDocuments({ partnerId: lead.partnerId, status: { $in: ['APPROVED', 'PAID'] } }).session(session);
        if (partner?.referredBy && approvedCount === 1) {
          const referralKey = `REFERRAL_REWARD:${lead.partnerId}`;
          await WalletTransaction.updateOne(
            { idempotencyKey: referralKey },
            { $setOnInsert: {
              transactionId: generateTransactionId(), partnerId: partner.referredBy, type: 'REFERRAL_REWARD',
              amount: 50, status: 'AVAILABLE', referenceType: 'REFERRAL', referenceId: lead.partnerId,
              description: `First eligible approved task by referral ${lead.partnerId}`,
              idempotencyKey: referralKey, processedBy: 'SYSTEM',
            } },
            { upsert: true, session, runValidators: true },
          );
        }
      }

      await Notification.create([{
        partnerId: lead.partnerId,
        type: target === 'APPROVED' ? 'PAYMENT_UPDATE' : 'LEAD_UPDATE',
        title: target === 'APPROVED' ? 'Lead approved' : `Lead ${target.toLowerCase()}`,
        message: target === 'REJECTED' ? `Lead ${lead.leadId} was rejected: ${rejectionReason}` : `Lead ${lead.leadId} is now ${target.toLowerCase()}.`,
        referenceType: 'LEAD', referenceId: String(lead._id),
        dedupeKey: `LEAD_STATUS:${lead._id}:${target}`,
      }], { session });
      await AuditLog.create([{
        adminId: String(req.user._id), adminEmail: req.user.email, action: `LEAD_${target}`,
        entityType: 'Lead', entityId: String(lead._id), before,
        after: { status: target, payoutSnapshot: lead.payoutSnapshot, rejectionReason: lead.rejectionReason }, ipAddress: req.ip,
      }], { session });
      updated = lead.toJSON();
    });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
  finally { await session.endSession(); }
};

export const adjustAdminLeadPayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payout = Number(req.body.payoutSnapshot);
    if (!Number.isFinite(payout) || payout < 0 || Math.abs(payout * 100 - Math.round(payout * 100)) >= 1e-6) {
      res.status(400).json({ success: false, message: 'Payout must be a non-negative amount with at most two decimals.' });
      return;
    }
    const lead: any = await Lead.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['PENDING', 'VERIFIED'] } },
      { $set: { payoutSnapshot: payout, reviewedBy: String(req.user._id) } },
      { new: false },
    ).exec();
    if (!lead) {
      res.status(409).json({ success: false, message: 'Payout can only be adjusted on Pending or Verified leads.' });
      return;
    }
    await AuditLog.create({
      adminId: String(req.user._id), adminEmail: req.user.email, action: 'LEAD_PAYOUT_ADJUSTED',
      entityType: 'Lead', entityId: String(lead._id), before: { payoutSnapshot: lead.payoutSnapshot },
      after: { payoutSnapshot: payout }, ipAddress: req.ip,
    });
    res.json({ success: true, data: { ...lead.toJSON(), payoutSnapshot: payout } });
  } catch (error) { next(error); }
};

export const markAdminLeadPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const paymentReference = typeof req.body.paymentReference === 'string' ? req.body.paymentReference.trim().slice(0, 160) : '';
  if (!paymentReference) {
    res.status(400).json({ success: false, message: 'Payment reference is required to mark the earning Paid.' });
    return;
  }
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const lead: any = await Lead.findById(req.params.id).session(session).exec();
      if (!lead) throw Object.assign(new Error('Lead not found.'), { status: 404 });
      if (lead.status !== 'APPROVED') throw Object.assign(new Error('Only an approved lead earning can be marked Paid.'), { status: 409 });
      const earning: any = await WalletTransaction.findOne({ idempotencyKey: `LEAD_EARNING:${lead._id}` }).session(session).exec();
      if (!earning || earning.status !== 'AVAILABLE') throw Object.assign(new Error('Available earning ledger entry was not found.'), { status: 409 });
      const [partnerLeads, partnerTransactions] = await Promise.all([
        Lead.find({ partnerId: lead.partnerId }).session(session).exec(),
        WalletTransaction.find({ partnerId: lead.partnerId }).session(session).exec(),
      ]);
      if (availableBalanceCents(partnerLeads, partnerTransactions) - Math.round(lead.payoutSnapshot * 100) < 0) {
        throw Object.assign(new Error('This earning is reserved by a pending withdrawal. Resolve the withdrawal first.'), { status: 409 });
      }
      const before = { leadStatus: lead.status, transactionStatus: earning.status };
      lead.status = 'PAID';
      lead.paidAt = new Date();
      lead.reviewedBy = String(req.user._id);
      await lead.save({ session });
      earning.status = 'PROCESSED';
      earning.paymentReference = paymentReference;
      earning.processedBy = String(req.user._id);
      await earning.save({ session });
      await Notification.create([{
        partnerId: lead.partnerId, type: 'PAYMENT_UPDATE', title: 'Lead commission paid',
        message: `Commission for lead ${lead.leadId} was marked Paid. Reference: ${paymentReference}`,
        referenceType: 'LEAD', referenceId: String(lead._id), dedupeKey: `LEAD_PAID:${lead._id}`,
      }], { session });
      await AuditLog.create([{
        adminId: String(req.user._id), adminEmail: req.user.email, action: 'LEAD_EARNING_PAID',
        entityType: 'Lead', entityId: String(lead._id), before,
        after: { leadStatus: lead.status, transactionStatus: earning.status, paymentReference }, ipAddress: req.ip,
      }], { session });
      result = lead.toJSON();
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
  finally { await session.endSession(); }
};
