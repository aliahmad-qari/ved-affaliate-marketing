import mongoose from 'mongoose';
import { buildAdminLeadQuery } from '../services/adminLeadQuery.ts';
import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead.ts';
import { Partner } from '../models/Partner.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { Notification } from '../models/Notification.ts';
import { generateTransactionId } from '../utils/idGenerator.ts';
import { availableBalanceCents } from '../services/adminServices.ts';
import { countAdminApprovedReferralLeads, findReferrer, issueReferralRewardAtThreshold } from '../services/referralReward.ts';
import { leadDateQuery } from '../../shared/leadDateFilters.ts';
import { calculatePercentagePayout, isEligiblePercentageCampaign, isValidPercentageRate } from '../../shared/percentagePayout.ts';

const listOptions = (req: Request) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
  return { page, limit, skip: (page - 1) * limit };
};

export const getAdminDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dateRange = leadDateQuery(req.query as Record<string, unknown>);
    const createdAt = dateRange ? { createdAt: dateRange } : {};
    const [totalPartners, activePartners, totalLeads, approvedLeads, pendingLeads, payoutRows, withdrawalRequests] = await Promise.all([
      Partner.countDocuments(createdAt),
      Partner.countDocuments({ ...createdAt, accountStatus: 'ACTIVE' }),
      Lead.countDocuments(createdAt),
      Lead.countDocuments({ ...createdAt, status: { $in: ['APPROVED', 'PAID'] } }),
      Lead.countDocuments({ ...createdAt, status: { $in: ['PENDING', 'VERIFIED'] } }),
      Lead.aggregate([
        { $match: { ...createdAt, status: { $in: ['APPROVED', 'PAID'] }, $or: [{ payoutTypeSnapshot: { $ne: 'PERCENTAGE' } }, { payoutTypeSnapshot: 'PERCENTAGE', 'payoutCommission.state': 'AVAILABLE' }] } },
        { $group: { _id: '$status', amount: { $sum: '$payoutSnapshot' } } },
      ]),
      WalletTransaction.countDocuments({ ...createdAt, type: 'WITHDRAWAL', status: { $in: ['PENDING', 'PROCESSING', 'APPROVED'] } }),
    ]);
    const payouts = Object.fromEntries(payoutRows.map((row: any) => [row._id, row.amount]));
    const pendingWithdrawalRows = await WalletTransaction.aggregate([
      { $match: { ...createdAt, type: 'WITHDRAWAL', status: { $in: ['PENDING', 'PROCESSING', 'APPROVED'] } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const paidWithdrawalRows = await WalletTransaction.aggregate([
      { $match: { ...createdAt, type: 'WITHDRAWAL', status: { $in: ['PAID', 'PROCESSED'] } } },
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
    const query = await buildAdminLeadQuery(req.query, undefined, { hideOldRejected: true });
    const [data, total] = await Promise.all([
      Lead.find(query).select('+payoutCommission.reportKey +payoutCommission.receiptKey').sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
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
  let rejectionReason = typeof req.body.rejectionReason === 'string' ? req.body.rejectionReason.trim().slice(0, 1000) : '';
  const codes: Record<string, string> = { NO_LEAD_FOUND: 'No Lead Found', DUPLICATE_LEAD: 'Duplicate Lead' };
  const rejectionReasonCode = req.body.rejectionReasonCode || (rejectionReason === 'No Lead Found' ? 'NO_LEAD_FOUND' : rejectionReason === 'Duplicate Lead' ? 'DUPLICATE_LEAD' : 'OTHER');
  if (target === 'REJECTED' && !['NO_LEAD_FOUND','DUPLICATE_LEAD','OTHER'].includes(rejectionReasonCode)) {
    res.status(400).json({ success: false, message: 'Choose a valid rejection reason.' }); return;
  }
  if (target === 'REJECTED' && codes[rejectionReasonCode]) rejectionReason = codes[rejectionReasonCode];
  if (!['VERIFIED', 'APPROVED', 'REJECTED'].includes(target)) {
    res.status(400).json({ success: false, message: 'Status must be VERIFIED, APPROVED, or REJECTED.' });
    return;
  }
  if (target === 'REJECTED' && (!rejectionReason || (rejectionReasonCode === 'OTHER' && rejectionReason.length < 3))) {
    res.status(400).json({ success: false, message: 'A rejection reason is required.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let updated: any;
    await session.withTransaction(async () => {
      const lead: any = await Lead.findById(req.params.id).select('+payoutCommission.earningIdempotencyKey +payoutCommission.eventKeys +payoutCommission.reportKey').session(session).exec();
      if (!lead) throw Object.assign(new Error('Lead not found.'), { status: 404 });
      if (lead.submittedData?.source === 'CUSTOMER_FORM' && lead.submittedData.processStatus === 'NOT_SUBMITTED' && target !== 'REJECTED') {
        throw Object.assign(new Error('Mark this enquiry In Process before verifying or approving it.'), { status: 409 });
      }
      const before = { status: lead.status, payoutSnapshot: lead.payoutSnapshot, rejectionReason: lead.rejectionReason };
      const allowed: Record<string, string[]> = {
        PENDING: ['VERIFIED', 'APPROVED', 'REJECTED'],
        VERIFIED: ['APPROVED', 'REJECTED'],
      };
      const percentage = lead.payoutTypeSnapshot === 'PERCENTAGE';
      const existingCommissionState = lead.payoutCommission?.state;
      const completingApprovedPercentage = target === 'APPROVED' && percentage && lead.status === 'APPROVED'
        && (!existingCommissionState || ['AWAITING_REVIEW', 'REPORT_REJECTED'].includes(existingCommissionState));
      if (!allowed[lead.status]?.includes(target) && !completingApprovedPercentage) throw Object.assign(new Error(`Cannot change lead from ${lead.status} to ${target}.`), { status: 409 });

      const previousStatus = lead.status;
      let percentageApproval: { amount: number; calculatedAmount: number; earningIdempotencyKey: string } | undefined;
      if (target === 'APPROVED' && percentage) {
        const verifiedBaseAmount = req.body?.verifiedBaseAmount;
        if (typeof verifiedBaseAmount !== 'number' || !Number.isFinite(verifiedBaseAmount) || verifiedBaseAmount <= 0
          || Math.abs(verifiedBaseAmount * 100 - Math.round(verifiedBaseAmount * 100)) >= 1e-6) {
          throw Object.assign(new Error('Enter a confirmed Loan disbursement or Insurance premium amount greater than zero, with no more than two decimal places.'), { status: 400 });
        }
        if (!lead.payoutBasisSnapshot || !isEligiblePercentageCampaign({ campaignType: lead.campaignType, payoutBasis: lead.payoutBasisSnapshot })
          || !isValidPercentageRate(lead.payoutRateSnapshot)) {
          throw Object.assign(new Error('This lead has no valid frozen Loan/Insurance percentage configuration; approval cannot calculate a commission.'), { status: 409 });
        }
        if (lead.payoutBasisSnapshot === 'INSURANCE_ELIGIBLE_PREMIUM'
          && (!String(lead.payoutEligibilitySnapshot?.eligibility || '').trim() || !String(lead.payoutTermsSnapshot || '').trim())) {
          throw Object.assign(new Error('Campaign-approved eligible premium terms are missing; no Insurance commission can be calculated.'), { status: 409 });
        }
        const existingState = lead.payoutCommission?.state;
        if (['PENDING', 'AVAILABLE', 'REVERSED'].includes(existingState)) {
          throw Object.assign(new Error('A commission has already been calculated for this lead; repeated approval cannot change its financial total.'), { status: 409 });
        }
        const calculatedAmount = calculatePercentagePayout(verifiedBaseAmount, Number(lead.payoutRateSnapshot));
        const earningIdempotencyKey = `LEAD_EARNING:${lead._id}:PERCENTAGE_APPROVAL`;
        const priorCommission = lead.payoutCommission?.toObject?.() ?? lead.payoutCommission;
        const history = [...(priorCommission?.history || [])];
        if (priorCommission) history.push({
          action: 'PRIOR_PERCENTAGE_REPORT_RETAINED_DURING_ADMIN_APPROVAL', adminId: String(req.user._id), at: new Date(),
          snapshot: { state: priorCommission.state, source: priorCommission.source, reportedBaseAmount: priorCommission.reportedBaseAmount, advertiserName: priorCommission.advertiserName, advertiserReference: priorCommission.advertiserReference, reportReference: priorCommission.reportReference, reportDate: priorCommission.reportDate, evidenceReference: priorCommission.evidenceReference, verificationDetails: priorCommission.verificationDetails },
          reportKey: priorCommission.reportKey,
        });
        history.push({ action: 'ADMIN_APPROVED_PERCENTAGE_COMMISSION', adminId: String(req.user._id), at: new Date(), snapshot: { verifiedBaseAmount, payoutBasis: lead.payoutBasisSnapshot, ratePercent: lead.payoutRateSnapshot, calculatedAmount } });
        const eventKeys = [...new Set(priorCommission?.eventKeys || [])];
        lead.payoutCommission = {
          state: 'PENDING', verifiedBaseAmount, calculatedAmount, verifiedBy: String(req.user._id), verifiedAt: new Date(),
          earningIdempotencyKey, ...(eventKeys.length ? { eventKeys } : {}), history,
        };
        lead.payoutSnapshot = calculatedAmount;
        percentageApproval = { amount: verifiedBaseAmount, calculatedAmount, earningIdempotencyKey };
      }
      lead.status = target;
      lead.reviewedBy = String(req.user._id);
      lead.reviewNote = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 2000) : '';
      if (target === 'VERIFIED') lead.verifiedAt = new Date();
      if (target === 'APPROVED' && previousStatus !== 'APPROVED') lead.approvedAt = new Date();
      if (target === 'REJECTED') {
        lead.rejectedAt = new Date();
        lead.rejectionReason = rejectionReason;
        lead.rejectionReasonCode = rejectionReasonCode;
      }
      await lead.save({ session });

      if (target === 'APPROVED') {
        if (percentageApproval) {
          const existingEarning: any = await WalletTransaction.findOne({ idempotencyKey: percentageApproval.earningIdempotencyKey }).session(session).exec();
          if (existingEarning && (existingEarning.type !== 'LEAD_EARNING' || existingEarning.partnerId !== lead.partnerId
            || existingEarning.referenceId !== String(lead._id) || existingEarning.status !== 'PENDING'
            || Math.round(Number(existingEarning.amount) * 100) !== Math.round(percentageApproval.calculatedAmount * 100))) {
            throw Object.assign(new Error('A conflicting commission ledger entry exists; no approval or balance change was made.'), { status: 409 });
          }
          await WalletTransaction.updateOne(
            { idempotencyKey: percentageApproval.earningIdempotencyKey },
            { $setOnInsert: {
              transactionId: generateTransactionId(), partnerId: lead.partnerId, type: 'LEAD_EARNING',
              amount: percentageApproval.calculatedAmount, status: 'PENDING', referenceType: 'LEAD',
              referenceId: String(lead._id), description: `Admin-approved percentage commission awaiting advertiser receipt for ${lead.leadId}`,
              idempotencyKey: percentageApproval.earningIdempotencyKey, processedBy: String(req.user._id),
            } },
            { upsert: true, session, runValidators: true },
          );
        } else if (lead.payoutTypeSnapshot !== 'PERCENTAGE') {
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
        }

        if (previousStatus !== 'APPROVED') {
          const referrerPartnerId = await findReferrer(lead.partnerId, session);
          if (referrerPartnerId) {
            const approvedCount = await countAdminApprovedReferralLeads(lead.partnerId, session);
            await issueReferralRewardAtThreshold({
              referredPartnerId: lead.partnerId,
              referrerPartnerId,
              approvedLeadCount: approvedCount,
              adminId: String(req.user._id),
              adminEmail: String(req.user.email || ''),
              ipAddress: req.ip,
              session,
            });
          }
        }
      }

      if (previousStatus !== target) await Notification.create([{
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
        after: { status: target, payoutSnapshot: lead.payoutSnapshot, ...(percentageApproval ? { verifiedBaseAmount: percentageApproval.amount, payoutRateSnapshot: lead.payoutRateSnapshot, calculatedAmount: percentageApproval.calculatedAmount, commissionState: 'PENDING' } : {}), rejectionReason: lead.rejectionReason, rejectionReasonCode: lead.rejectionReasonCode }, ipAddress: req.ip,
      }], { session });
      updated = lead.toJSON();
    });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
  finally { await session.endSession(); }
};

export const adjustAdminLeadPayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing: any = await Lead.findById(req.params.id).select('payoutTypeSnapshot status').lean().exec();
    if (!existing) { res.status(404).json({ success: false, message: 'Lead not found.' }); return; }
    if (existing.payoutTypeSnapshot === 'PERCENTAGE') { res.status(409).json({ success: false, message: 'Percentage payouts must use the verified advertiser report workflow; manual payout adjustment is disabled.' }); return; }
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
      const lead: any = await Lead.findById(req.params.id).select('+payoutCommission.earningIdempotencyKey').session(session).exec();
      if (!lead) throw Object.assign(new Error('Lead not found.'), { status: 404 });
      if (lead.status !== 'APPROVED') throw Object.assign(new Error('Only an approved lead earning can be marked Paid.'), { status: 409 });
      await Partner.updateOne({ partnerId: lead.partnerId }, { $inc: { walletRevision: 1 } }, { session });
      const earningKey = lead.payoutTypeSnapshot === 'PERCENTAGE' ? (lead.payoutCommission?.earningIdempotencyKey || `LEAD_EARNING:${lead._id}`) : `LEAD_EARNING:${lead._id}`;
      const earning: any = earningKey ? await WalletTransaction.findOne({ idempotencyKey: earningKey }).session(session).exec() : null;
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
