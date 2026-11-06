import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead.ts';
import { Campaign } from '../models/Campaign.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import { AdvertiserReceipt } from '../models/AdvertiserReceipt.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { Notification } from '../models/Notification.ts';
import { calculatePercentagePayout, isEligiblePercentageCampaign, isValidPercentageRate } from '../services/percentagePayout.ts';
import { generateTransactionId } from '../utils/idGenerator.ts';

const clean = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const centsAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
const reportDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
};
const hash = (value: string) => crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
// The advertiser event reference identifies the payable event. A MIS report may be a batch
// containing many leads, so the report/batch reference must not be the uniqueness key.
export const percentageAdvertiserEventKey = (campaignId: string, source: string, advertiserReference: string) =>
  hash(`${campaignId}|${source}|${advertiserReference}`);
const adminId = (req: Request) => String(req.user?._id || '');

function fail(status: number, message: string) { return Object.assign(new Error(message), { status }); }

/** Controlled entry from an approved advertiser MIS. Entry alone never makes it payable. */
export const submitPercentagePayoutEvidence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const source = req.body?.source;
  const advertiserReference = clean(req.body?.advertiserReference, 160);
  const advertiserName = clean(req.body?.advertiserName, 160);
  const reportReference = clean(req.body?.reportReference, 160);
  const reportedAt = reportDate(req.body?.reportDate);
  const evidenceReference = clean(req.body?.evidenceReference, 500);
  const verificationDetails = clean(req.body?.verificationDetails, 2000);
  const reportedBaseAmount = req.body?.reportedBaseAmount;
  if (source !== 'APPROVED_MIS' || !advertiserName || !advertiserReference || !reportReference || !reportedAt || !evidenceReference || !verificationDetails || !centsAmount(reportedBaseAmount)) {
    res.status(400).json({ success: false, message: 'Provide the company name, valid report date, positive company-reported amount, report and event references, evidence location and review notes.' }); return;
  }
  const session = await mongoose.startSession();
  try {
    let data: any;
    await session.withTransaction(async () => {
      const lead: any = await Lead.findById(req.params.id).select('+payoutCommission.reportKey +payoutCommission.eventKeys +payoutCommission.earningIdempotencyKey').session(session).exec();
      if (!lead) throw fail(404, 'Lead not found.');
      if (lead.payoutTypeSnapshot !== 'PERCENTAGE' || lead.status !== 'APPROVED') throw fail(409, 'Only an approved percentage-payout lead can receive advertiser MIS evidence.');
      if (!lead.payoutBasisSnapshot || !isEligiblePercentageCampaign({ campaignType: lead.campaignType, payoutBasis: lead.payoutBasisSnapshot })
        || !isValidPercentageRate(lead.payoutRateSnapshot)) throw fail(409, 'This lead is missing an eligible, complete percentage payout snapshot and remains non-payable.');
      if (lead.payoutBasisSnapshot === 'INSURANCE_ELIGIBLE_PREMIUM'
        && (!String(lead.payoutEligibilitySnapshot?.eligibility || '').trim() || !String(lead.payoutTermsSnapshot || '').trim())) {
        throw fail(409, 'The campaign-specific eligible premium rules were not captured for this lead; confirm the approved campaign terms before recording a payable commission.');
      }
      if (lead.payoutCommission && lead.payoutCommission.state !== 'REPORT_REJECTED') throw fail(409, 'A commission report is already recorded for this lead.');
      const reportKey = percentageAdvertiserEventKey(lead.campaignId, source, advertiserReference);
      const earningIdempotencyKey = `LEAD_EARNING:${lead._id}:${crypto.randomUUID()}`;
      const before = lead.payoutCommission ? { ...lead.payoutCommission.toObject?.() ?? lead.payoutCommission } : null;
      if (lead.payoutCommission?.eventKeys?.includes(reportKey) && lead.payoutCommission?.state !== 'REPORT_REJECTED') throw fail(409, 'This advertiser event was already recorded for this lead.');
      lead.payoutCommission = {
        state: 'AWAITING_REVIEW', source, reportedBaseAmount, advertiserName, advertiserReference, reportReference, reportDate: reportedAt,
        reportKey, earningIdempotencyKey, eventKeys: [...new Set([...(lead.payoutCommission?.eventKeys || []), reportKey])], evidenceReference, verificationDetails, enteredBy: adminId(req), enteredAt: new Date(),
        history: [...(lead.payoutCommission?.history || []), ...(before ? [{ action: 'PRIOR_PERCENTAGE_EVIDENCE_RETAINED', adminId: adminId(req), at: new Date(), snapshot: before, reportKey: before.reportKey }] : []), { action: 'MIS_REPORT_ENTERED', adminId: adminId(req), at: new Date(), snapshot: { source, reportedBaseAmount, advertiserName, advertiserReference, reportReference, reportDate: reportedAt, evidenceReference, verificationDetails }, reportKey }],
      };
      await lead.save({ session });
      await AuditLog.create([{
        adminId: adminId(req), adminEmail: req.user?.email, action: 'PERCENTAGE_PAYOUT_MIS_ENTERED',
        entityType: 'Lead', entityId: String(lead._id), before: before ? { commissionState: before.state, calculatedAmount: before.calculatedAmount } : undefined,
        after: { commissionState: 'AWAITING_REVIEW', source, reportedBaseAmount, advertiserName, advertiserReference, reportReference, reportDate: reportedAt, evidenceReference }, ipAddress: req.ip,
      }], { session });
      data = { leadId: lead.leadId, state: lead.payoutCommission.state };
    });
    res.status(202).json({ success: true, message: 'MIS evidence recorded for independent review; no payable balance has been created.', data });
  } catch (error: any) {
    if (error?.code === 11000) { res.status(409).json({ success: false, message: 'This advertiser report/reference has already been used.' }); return; }
    next(error);
  } finally { await session.endSession(); }
};

/** Second-admin verification calculates an immutable snapshot and creates a PENDING, non-withdrawable ledger entry. */
export const verifyPercentagePayoutEvidence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (req.body?.approvedMisReviewed !== true) { res.status(400).json({ success: false, message: 'Confirm that the approved advertiser MIS was independently reviewed.' }); return; }
  const session = await mongoose.startSession();
  try {
    let data: any;
    await session.withTransaction(async () => {
      const lead: any = await Lead.findById(req.params.id).select('+payoutCommission.reportKey +payoutCommission.eventKeys +payoutCommission.earningIdempotencyKey').session(session).exec();
      if (!lead) throw fail(404, 'Lead not found.');
      const evidence = lead.payoutCommission;
      if (lead.status !== 'APPROVED' || lead.payoutTypeSnapshot !== 'PERCENTAGE' || evidence?.state !== 'AWAITING_REVIEW') throw fail(409, 'A pending approved percentage lead with MIS evidence is required.');
      if (!evidence.enteredBy || evidence.enteredBy === adminId(req)) throw fail(409, 'A different administrator must independently verify the MIS evidence.');
      if (!lead.payoutBasisSnapshot || !isEligiblePercentageCampaign({ campaignType: lead.campaignType, payoutBasis: lead.payoutBasisSnapshot }) || !isValidPercentageRate(lead.payoutRateSnapshot)) throw fail(409, 'The frozen percentage payout configuration is invalid; this lead remains non-payable.');
      if (lead.payoutBasisSnapshot === 'INSURANCE_ELIGIBLE_PREMIUM'
        && (!String(lead.payoutEligibilitySnapshot?.eligibility || '').trim() || !String(lead.payoutTermsSnapshot || '').trim())) throw fail(409, 'The campaign-specific eligible premium rules are missing; this commission remains unverified.');
      if (!centsAmount(evidence.reportedBaseAmount) || !evidence.advertiserName || !evidence.reportDate || !evidence.advertiserReference || !evidence.reportReference || !evidence.evidenceReference || !evidence.verificationDetails) throw fail(409, 'The company report evidence is incomplete or invalid; this commission remains unverified.');
      const verifiedBaseAmount = Number(evidence.reportedBaseAmount);
      const calculatedAmount = calculatePercentagePayout(verifiedBaseAmount, Number(lead.payoutRateSnapshot));
      evidence.verifiedBaseAmount = verifiedBaseAmount;
      const before = { commissionState: evidence.state, payoutSnapshot: lead.payoutSnapshot };
      evidence.state = 'PENDING';
      evidence.calculatedAmount = calculatedAmount;
      evidence.verifiedBy = adminId(req);
      evidence.verifiedAt = new Date();
      evidence.history.push({ action: 'MIS_REPORT_INDEPENDENTLY_VERIFIED', adminId: adminId(req), at: new Date(), snapshot: { reportedBaseAmount: evidence.reportedBaseAmount, verifiedBaseAmount, advertiserName: evidence.advertiserName, reportDate: evidence.reportDate, advertiserReference: evidence.advertiserReference, reportReference: evidence.reportReference, evidenceReference: evidence.evidenceReference, ratePercent: lead.payoutRateSnapshot, calculatedAmount } });
      lead.payoutSnapshot = calculatedAmount;
      await lead.save({ session });
      const idempotencyKey = evidence.earningIdempotencyKey;
      if (!idempotencyKey) throw fail(409, 'This report has no verified earning identity; reconcile it before recording a commission.');
      const existingEarning: any = await WalletTransaction.findOne({ idempotencyKey }).session(session).exec();
      if (existingEarning && (existingEarning.type !== 'LEAD_EARNING' || existingEarning.partnerId !== lead.partnerId
        || existingEarning.referenceId !== String(lead._id) || existingEarning.status !== 'PENDING'
        || Math.round(Number(existingEarning.amount) * 100) !== Math.round(calculatedAmount * 100))) {
        throw fail(409, 'A conflicting earning ledger row exists; reconcile it before verifying this commission.');
      }
      await WalletTransaction.updateOne(
        { idempotencyKey },
        { $setOnInsert: { transactionId: generateTransactionId(), partnerId: lead.partnerId, type: 'LEAD_EARNING', amount: calculatedAmount, status: 'PENDING', referenceType: 'LEAD', referenceId: String(lead._id), description: `Verified percentage commission awaiting VED receipt for ${lead.leadId}`, idempotencyKey, processedBy: adminId(req) } },
        { upsert: true, session, runValidators: true },
      );
      await AuditLog.create([{
        adminId: adminId(req), adminEmail: req.user?.email, action: 'PERCENTAGE_PAYOUT_MIS_VERIFIED', entityType: 'Lead', entityId: String(lead._id), before,
        after: { commissionState: 'PENDING', verifiedBaseAmount, ratePercent: lead.payoutRateSnapshot, calculatedAmount, source: evidence.source, advertiserName: evidence.advertiserName, reportDate: evidence.reportDate, advertiserReference: evidence.advertiserReference, reportReference: evidence.reportReference }, ipAddress: req.ip,
      }], { session });
      await Notification.create([{
        partnerId: lead.partnerId, type: 'PAYMENT_UPDATE', title: 'Commission pending advertiser receipt',
        message: `A verified commission of ₹${calculatedAmount.toFixed(2)} for lead ${lead.leadId} is pending receipt confirmation by VED.`,
        referenceType: 'LEAD', referenceId: String(lead._id), dedupeKey: `PERCENTAGE_COMMISSION_PENDING:${lead._id}`,
      }], { session });
      data = { leadId: lead.leadId, state: evidence.state, verifiedBaseAmount: evidence.verifiedBaseAmount, ratePercent: lead.payoutRateSnapshot, calculatedAmount };
    });
    res.json({ success: true, data });
  } catch (error: any) { if (error?.code === 11000) { res.status(409).json({ success: false, message: 'A commission ledger record or MIS report already exists.' }); return; } next(error); }
  finally { await session.endSession(); }
};

export const rejectPercentagePayoutEvidence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const reason = clean(req.body?.reason, 1000);
  if (reason.length < 3) { res.status(400).json({ success: false, message: 'Provide a reason for rejecting this MIS entry.' }); return; }
  const session = await mongoose.startSession();
  try {
    let data: any;
    await session.withTransaction(async () => {
      const lead: any = await Lead.findById(req.params.id).select('+payoutCommission.reportKey +payoutCommission.eventKeys +payoutCommission.earningIdempotencyKey').session(session).exec();
      if (!lead) throw fail(404, 'Lead not found.');
      const evidence = lead.payoutCommission;
      if (lead.payoutTypeSnapshot !== 'PERCENTAGE' || !['AWAITING_REVIEW', 'PENDING'].includes(evidence?.state)) throw fail(409, 'Only an MIS entry awaiting review or a pending commission can be rejected for correction.');
      const wasPending = evidence.state === 'PENDING';
      if (wasPending) {
        if (!evidence.verifiedBy || evidence.verifiedBy === adminId(req) || evidence.enteredBy === adminId(req)) throw fail(409, 'A different administrator from the report submitter and verifier must approve this pending correction.');
        const cancelled = await WalletTransaction.findOneAndUpdate(
          { idempotencyKey: evidence.earningIdempotencyKey, type: 'LEAD_EARNING', partnerId: lead.partnerId, referenceId: String(lead._id), amount: evidence.calculatedAmount, status: 'PENDING' },
          { $set: { status: 'CANCELLED', internalNote: `Pending commission cancelled for correction: ${reason}`, processedBy: adminId(req) } },
          { new: true, session, runValidators: true },
        ).exec();
        if (!cancelled) throw fail(409, 'The matching pending ledger entry could not be cancelled; no correction was made.');
      }
      evidence.state = 'REPORT_REJECTED';
      evidence.history.push({ action: wasPending ? 'VERIFIED_PENDING_MIS_CANCELLED_FOR_CORRECTION' : 'MIS_REPORT_REJECTED', adminId: adminId(req), at: new Date(), reason, snapshot: { source: evidence.source, reportedBaseAmount: evidence.reportedBaseAmount, verifiedBaseAmount: evidence.verifiedBaseAmount, advertiserName: evidence.advertiserName, reportDate: evidence.reportDate, advertiserReference: evidence.advertiserReference, reportReference: evidence.reportReference, evidenceReference: evidence.evidenceReference, verificationDetails: evidence.verificationDetails, calculatedAmount: evidence.calculatedAmount, ratePercent: lead.payoutRateSnapshot, earningIdempotencyKey: evidence.earningIdempotencyKey }, reportKey: evidence.reportKey });
      await lead.save({ session });
      await AuditLog.create([{
        adminId: adminId(req), adminEmail: req.user?.email, action: wasPending ? 'PERCENTAGE_PAYOUT_PENDING_CANCELLED_FOR_CORRECTION' : 'PERCENTAGE_PAYOUT_MIS_REJECTED', entityType: 'Lead', entityId: String(lead._id),
        before: { commissionState: wasPending ? 'PENDING' : 'AWAITING_REVIEW', transactionStatus: wasPending ? 'PENDING' : undefined, calculatedAmount: wasPending ? evidence.calculatedAmount : undefined }, after: { commissionState: 'REPORT_REJECTED', transactionStatus: wasPending ? 'CANCELLED' : undefined, reason, reportReference: evidence.reportReference }, ipAddress: req.ip,
      }], { session });
      data = { leadId: lead.leadId, state: evidence.state };
    });
    res.json({ success: true, data });
  } catch (error) { next(error); }
  finally { await session.endSession(); }
};

/** Receipt confirmation supports only one lead and an explicit full-receipt attestation. */
export const confirmAdvertiserReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const paymentReference = clean(req.body?.paymentReference, 160);
  const evidenceReference = clean(req.body?.evidenceReference, 500);
  const details = clean(req.body?.details, 2000);
  if (!paymentReference || !evidenceReference || !details || req.body?.fullSingleLeadReceipt !== true) {
    res.status(400).json({ success: false, message: 'Provide receipt evidence and confirm that the payment is full and allocated to this one lead only. Partial or multi-lead allocation is unsupported.' }); return;
  }
  const session = await mongoose.startSession();
  try {
    let data: any;
    await session.withTransaction(async () => {
      const lead: any = await Lead.findById(req.params.id).select('+payoutCommission.reportKey +payoutCommission.earningIdempotencyKey').session(session).exec();
      if (!lead) throw fail(404, 'Lead not found.');
      if (lead.status !== 'APPROVED' || lead.payoutTypeSnapshot !== 'PERCENTAGE' || lead.payoutCommission?.state !== 'PENDING' || !lead.payoutCommission.verifiedAt) throw fail(409, 'Only a verified pending percentage commission can be released.');
      if (lead.payoutCommission.verifiedBy === adminId(req) || lead.payoutCommission.enteredBy === adminId(req)) throw fail(409, 'An administrator other than the MIS submitter and verifier must confirm advertiser receipt.');
      const key = hash(paymentReference);
      await AdvertiserReceipt.create([{
        leadId: String(lead._id), campaignId: lead.campaignId, referenceKey: key, paymentReference, evidenceReference,
        details, partnerCommissionAmount: lead.payoutSnapshot, confirmedBy: adminId(req), confirmedAt: new Date(),
      }], { session });
      const transaction = await WalletTransaction.findOneAndUpdate(
        { idempotencyKey: lead.payoutCommission.earningIdempotencyKey || `LEAD_EARNING:${lead._id}`, type: 'LEAD_EARNING', partnerId: lead.partnerId, referenceId: String(lead._id), amount: lead.payoutSnapshot, status: 'PENDING' },
        { $set: { status: 'AVAILABLE', paymentReference, internalNote: details, processedBy: adminId(req) } },
        { new: true, session, runValidators: true },
      ).exec();
      if (!transaction) throw fail(409, 'Pending commission ledger entry is missing or has changed; no balance was released.');
      const before = { commissionState: lead.payoutCommission.state, transactionStatus: 'PENDING' };
      lead.payoutCommission.state = 'AVAILABLE';
      lead.payoutCommission.receiptReference = paymentReference;
      lead.payoutCommission.receiptEvidenceReference = evidenceReference;
      lead.payoutCommission.receiptDetails = details;
      lead.payoutCommission.receiptConfirmedBy = adminId(req);
      lead.payoutCommission.receiptConfirmedAt = new Date();
      lead.payoutCommission.receiptKey = key;
      lead.payoutCommission.history.push({ action: 'ADVERTISER_RECEIPT_CONFIRMED', adminId: adminId(req), at: new Date(), snapshot: { paymentReference, evidenceReference, details, fullSingleLeadReceipt: true } });
      await lead.save({ session });
      await AuditLog.create([{
        adminId: adminId(req), adminEmail: req.user?.email, action: 'ADVERTISER_RECEIPT_CONFIRMED', entityType: 'Lead', entityId: String(lead._id), before,
        after: { commissionState: 'AVAILABLE', transactionStatus: 'AVAILABLE', amount: lead.payoutSnapshot, paymentReference, evidenceReference, fullSingleLeadReceipt: true }, ipAddress: req.ip,
      }], { session });
      await Notification.create([{
        partnerId: lead.partnerId, type: 'PAYMENT_UPDATE', title: 'Commission available',
        message: `VED verified advertiser receipt for the ₹${lead.payoutSnapshot.toFixed(2)} commission on lead ${lead.leadId}.`,
        referenceType: 'LEAD', referenceId: String(lead._id), dedupeKey: `PERCENTAGE_COMMISSION_AVAILABLE:${lead._id}`,
      }], { session });
      data = { leadId: lead.leadId, state: lead.payoutCommission.state, amount: lead.payoutSnapshot };
    });
    res.json({ success: true, data });
  } catch (error: any) {
    if (error?.code === 11000) { res.status(409).json({ success: false, message: 'This payment reference or lead receipt has already been recorded.' }); return; }
    next(error);
  } finally { await session.endSession(); }
};
