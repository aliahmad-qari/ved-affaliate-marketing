import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import { Partner } from '../models/Partner.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { Notification } from '../models/Notification.ts';
import { escapeRegex } from '../services/adminServices.ts';

export const listWithdrawals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
    const query: Record<string, any> = { type: 'WITHDRAWAL' };
    if (typeof req.query.status === 'string' && req.query.status !== 'ALL') query.status = req.query.status.toUpperCase();
    if (typeof req.query.paymentMethod === 'string' && req.query.paymentMethod !== 'ALL') {
      if (!['UPI', 'BANK_TRANSFER'].includes(req.query.paymentMethod)) {
        res.status(400).json({ success: false, message: 'Select a valid payment method.' });
        return;
      }
      query.paymentMethod = req.query.paymentMethod;
    }
    const startDate = typeof req.query.startDate === 'string' && req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = typeof req.query.endDate === 'string' && req.query.endDate ? new Date(req.query.endDate) : undefined;
    if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime())) || (startDate && endDate && startDate > endDate)) {
      res.status(400).json({ success: false, message: 'Enter a valid requested date range.' });
      return;
    }
    if (startDate || endDate) query.createdAt = { ...(startDate ? { $gte: startDate } : {}), ...(endDate ? { $lte: endDate } : {}) };
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const pattern = new RegExp(escapeRegex(req.query.search.trim().slice(0, 100)), 'i');
      const matchingPartners = await Partner.find({ $or: [{ fullName: pattern }, { email: pattern }, { partnerId: pattern }] }).select('partnerId').lean().exec();
      query.$or = [{ transactionId: pattern }, { partnerId: pattern }, { payoutDestination: pattern }, { paymentReference: pattern }, { partnerId: { $in: matchingPartners.map((partner: any) => partner.partnerId) } }];
    }
    const [transactions, total] = await Promise.all([
      WalletTransaction.find(query).select('+payoutDestination').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      WalletTransaction.countDocuments(query),
    ]);
    const ids = [...new Set(transactions.map((tx: any) => tx.partnerId))];
    const partners = await Partner.find({ partnerId: { $in: ids } }).select('partnerId fullName email mobile').lean().exec();
    const byId = new Map(partners.map((partner: any) => [partner.partnerId, partner]));
    res.json({ success: true, data: transactions.map((tx: any) => ({ ...tx, partner: byId.get(tx.partnerId) || null })), total, page, totalPages: Math.ceil(total / limit) || 1 });
  } catch (error) { next(error); }
};

export const updateWithdrawal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const target = String(req.body.status || '').toUpperCase();
  const paymentReference = typeof req.body.paymentReference === 'string' ? req.body.paymentReference.trim().slice(0, 160) : '';
  const internalNote = typeof req.body.internalNote === 'string' ? req.body.internalNote.trim().slice(0, 2000) : '';
  const transitions: Record<string, string[]> = {
    PENDING: ['PROCESSING', 'APPROVED', 'REJECTED'],
    PROCESSING: ['APPROVED', 'REJECTED', 'PAID'],
    APPROVED: ['PROCESSING', 'REJECTED', 'PAID'],
  };
  if (!['PROCESSING', 'APPROVED', 'PAID', 'REJECTED'].includes(target)) {
    res.status(400).json({ success: false, message: 'Status must be PROCESSING, APPROVED, PAID, or REJECTED.' });
    return;
  }
  if (target === 'PAID' && !paymentReference) {
    res.status(400).json({ success: false, message: 'Enter the manual payment reference before marking this request Paid.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const transaction: any = await WalletTransaction.findOne({ _id: req.params.id, type: 'WITHDRAWAL' }).session(session).exec();
      if (!transaction) throw Object.assign(new Error('Withdrawal request not found.'), { status: 404 });
      if (!transitions[transaction.status]?.includes(target)) throw Object.assign(new Error(`Cannot change withdrawal from ${transaction.status} to ${target}.`), { status: 409 });
      const before = { status: transaction.status, paymentReference: transaction.paymentReference };
      transaction.status = target;
      transaction.internalNote = internalNote || transaction.internalNote;
      transaction.processedBy = String(req.user._id);
      if (target === 'PAID') transaction.paymentReference = paymentReference;
      await transaction.save({ session });
      await Partner.updateOne({ partnerId: transaction.partnerId }, { $inc: { walletRevision: 1 } }, { session });
      await Notification.create([{
        partnerId: transaction.partnerId,
        type: 'WITHDRAWAL_UPDATE',
        title: `Withdrawal ${target.toLowerCase()}`,
        message: target === 'PAID'
          ? `Your ₹${transaction.amount} withdrawal was manually paid. Reference: ${paymentReference}`
          : `Your ₹${transaction.amount} withdrawal request is now ${target.toLowerCase()}.`,
        referenceType: 'WITHDRAWAL',
        referenceId: String(transaction._id),
        dedupeKey: `WITHDRAWAL:${transaction._id}:${target}`,
      }], { session });
      await AuditLog.create([{
        adminId: String(req.user._id), adminEmail: req.user.email, action: `WITHDRAWAL_${target}`,
        entityType: 'WalletTransaction', entityId: String(transaction._id), before,
        after: { status: target, paymentReference: transaction.paymentReference, internalNote: transaction.internalNote }, ipAddress: req.ip,
      }], { session });
      result = transaction.toJSON();
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
  finally { await session.endSession(); }
};
