import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead.ts';
import { Partner } from '../models/Partner.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { Notification } from '../models/Notification.ts';
import { generateTransactionId } from '../utils/idGenerator.ts';
import { availableBalanceCents } from '../services/adminServices.ts';
import { LeadStore } from '../services/leadStore.ts';

export const reverseLeadApproval = async (req: Request, res: Response, next: NextFunction) => {
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 3 || reason.length > 1000) { res.status(400).json({ success: false, message: 'Enter a reversal reason containing 3–1000 characters.' }); return; }
  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession(); let result: any;
    await session.withTransaction(async () => {
      const lead: any = await Lead.findById(req.params.id).session(session!).exec();
      if (!lead) throw Object.assign(new Error('Lead not found.'), { status: 404 });
      if (lead.status !== 'APPROVED' || lead.approvalReversal) throw Object.assign(new Error('Only an approved, unpaid lead can be reversed once.'), { status: 409 });
      const key = `LEAD_APPROVAL_REVERSAL:${lead._id}`;
      const existing = await WalletTransaction.findOne({ idempotencyKey: key }).session(session!).exec();
      if (existing) throw Object.assign(new Error('This approval has already been reversed.'), { status: 409 });
      const earning: any = await WalletTransaction.findOne({ idempotencyKey: `LEAD_EARNING:${lead._id}`, partnerId: lead.partnerId, type: 'LEAD_EARNING', referenceId: String(lead._id) }).session(session!).exec();
      const amount = Number(earning?.amount);
      if (!earning || earning.status !== 'AVAILABLE' || !Number.isFinite(amount) || amount < 0 || Math.round(amount * 100) !== Math.round(Number(lead.payoutSnapshot) * 100)) throw Object.assign(new Error('The original available earning must match this lead before it can be reversed.'), { status: 409 });
      // Shared write lock with withdrawal requests and direct lead payments.
      const lock = await Partner.updateOne({ partnerId: lead.partnerId }, { $inc: { walletRevision: 1 } }, { session });
      if (!lock.matchedCount) throw Object.assign(new Error('Partner not found.'), { status: 404 });
      const [leads, transactions] = await Promise.all([Lead.find({ partnerId: lead.partnerId }).session(session!).exec(), WalletTransaction.find({ partnerId: lead.partnerId }).session(session!).exec()]);
      const beforeCents = availableBalanceCents(leads, transactions), amountCents = Math.round(amount * 100);
      if (!Number.isSafeInteger(beforeCents) || !Number.isSafeInteger(amountCents)) throw Object.assign(new Error('The balance cannot be safely verified. Reconcile this account before reversing the approval.'), { status: 409 });
      if (beforeCents < amountCents) throw Object.assign(new Error('Insufficient unreserved balance. Resolve pending withdrawals or reconcile paid amounts before reversing this lead.'), { status: 409 });
      const transactionId = generateTransactionId(), now = new Date();
      const [adjustment] = await WalletTransaction.create([{
        transactionId, partnerId: lead.partnerId, type: 'ADJUSTMENT', direction: 'DEBIT', amount,
        status: 'PROCESSED', referenceType: 'LEAD', referenceId: String(lead._id), relatedLeadId: lead.leadId, idempotencyKey: key,
        description: `Approval reversed for ${lead.leadId}: ${reason}`, internalNote: reason,
        processedBy: String(req.user._id), adjustmentAdminEmail: req.user.email,
        balanceBefore: beforeCents / 100, balanceAfter: (beforeCents - amountCents) / 100,
      }], { session });
      const before = { status: lead.status, payoutSnapshot: lead.payoutSnapshot, availableBalance: beforeCents / 100 };
      // Existing balances are derived from lead status. Removing this approved credit
      // debits it exactly once; the append-only ADJUSTMENT records that same correction.
      // Keep the original earning transaction, payout snapshot and approval timestamp intact.
      lead.status = 'REJECTED'; lead.rejectedAt = now; lead.rejectionReason = `Approval reversed: ${reason}`;
      lead.rejectionReasonCode = 'OTHER'; lead.reviewedBy = String(req.user._id);
      lead.approvalReversal = { transactionId, amount, reason, adminId: String(req.user._id), at: now };
      await lead.save({ session });
      await AuditLog.create([{
        adminId: String(req.user._id), adminEmail: req.user.email, action: 'LEAD_APPROVAL_REVERSED', entityType: 'Lead', entityId: String(lead._id),
        before, after: { status: 'REJECTED', payoutSnapshot: lead.payoutSnapshot, adjustmentAmount: -amount, reason, transactionId, availableBalance: (beforeCents - amountCents) / 100 }, ipAddress: req.ip,
      }], { session });
      await Notification.create([{ partnerId: lead.partnerId, type: 'PAYMENT_UPDATE', title: 'Lead approval reversed', message: `Approval for ${lead.leadId} was reversed: ${reason}`, referenceType: 'LEAD', referenceId: String(lead._id), dedupeKey: key }], { session });
      result = { lead: lead.toJSON(), adjustment: adjustment.toJSON(), previousBalance: beforeCents / 100, availableBalance: (beforeCents - amountCents) / 100 };
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error?.code === 11000) res.status(409).json({ success: false, message: 'This approval has already been reversed.' });
    else next(error);
  } finally { await session?.endSession(); }
};

export const getPartnerBalanceAdjustments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partner: any = await Partner.findById(req.params.id).select('partnerId fullName').lean().exec();
    if (!partner) { res.status(404).json({ success: false, message: 'Partner not found.' }); return; }
    const [summary, adjustments] = await Promise.all([
      LeadStore.getDashboardSummary(partner.partnerId),
      WalletTransaction.find({ partnerId: partner.partnerId, type: 'ADJUSTMENT', idempotencyKey: /^LEAD_APPROVAL_REVERSAL:/ }).select('transactionId referenceId relatedLeadId amount direction internalNote processedBy +adjustmentAdminEmail balanceBefore balanceAfter createdAt').sort({ createdAt: -1 }).limit(100).lean().exec(),
    ]);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, availableBalance: summary.availableWalletBalance, totalEarnings: summary.totalEarnings, data: adjustments });
  } catch (error) { next(error); }
};
