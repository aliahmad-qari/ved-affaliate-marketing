import crypto from 'crypto';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Campaign } from '../models/Campaign.ts';
import { Lead } from '../models/Lead.ts';
import { Partner } from '../models/Partner.ts';
import { TrackingClick } from '../models/TrackingClick.ts';
import { VendorWebhookEvent } from '../models/VendorWebhookEvent.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import { Notification } from '../models/Notification.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { generateLeadId, generateTransactionId } from '../utils/idGenerator.ts';

const text = (value: unknown, maxLength = 160): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const mapStatus = (value: string): 'PENDING' | 'APPROVED' | 'REJECTED' | null => {
  switch (value.trim().toLowerCase()) {
    case 'pending':
    case 'registered':
    case 'in_progress': return 'PENDING';
    case 'approved':
    case 'converted':
    case 'completed':
    case 'success': return 'APPROVED';
    case 'rejected':
    case 'declined':
    case 'dropped':
    case 'cancelled': return 'REJECTED';
    default: return null;
  }
};

const matchesSecret = (provided: string, expected: string): boolean => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

export const receiveVendorWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const secret = process.env.VENDOR_WEBHOOK_SECRET || '';
  const authorization = req.get('authorization') || '';
  const providedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : req.get('x-vendor-webhook-secret') || '';

  if (!secret || !matchesSecret(providedSecret, secret)) {
    res.status(401).json({ success: false, message: 'Invalid webhook credentials.' });
    return;
  }

  const eventId = text(req.body?.eventId, 200);
  const clickId = text(req.body?.clickId, 80);
  const conversionId = text(req.body?.conversionId, 160);
  const targetStatus = mapStatus(text(req.body?.status, 40));
  if (!eventId || !clickId || !conversionId || !targetStatus) {
    res.status(400).json({
      success: false,
      message: 'eventId, clickId, conversionId, and a supported status are required.',
    });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let response: Record<string, unknown> = {};
    await session.withTransaction(async () => {
      const click = await TrackingClick.findOne({ clickId, expiresAt: { $gt: new Date() } }).session(session).exec();
      if (!click) throw Object.assign(new Error('Unknown or expired clickId.'), { status: 404 });
      const [partner, campaign] = await Promise.all([
        Partner.findOne({ partnerId: click.partnerId, accountStatus: 'ACTIVE' }).session(session).exec(),
        Campaign.findById(click.campaignId).session(session).exec(),
      ]);
      if (!partner || !campaign) throw Object.assign(new Error('Partner or campaign attribution is no longer valid.'), { status: 404 });

      await VendorWebhookEvent.create([{ eventId, clickId, conversionId, status: targetStatus }], { session });
      const conversionKey = `${campaign._id}:${conversionId}`;
      let lead: any = await Lead.findOne({ vendorConversionKey: conversionKey }).session(session).exec();
      // Form enquiries are reviewed by Admin; keep callbacks from creating a second earning for the same click.
      if (!lead) lead = await Lead.findOne({ vendorClickId: clickId, 'submittedData.source': 'CUSTOMER_FORM' }).session(session).exec();
      if (lead?.submittedData?.source === 'CUSTOMER_FORM') {
        response = { leadId: lead.leadId, status: lead.status, ignoredManualEnquiry: true };
        return;
      }
      const beforeStatus = lead?.status;

      if (lead && lead.partnerId !== partner.partnerId) {
        throw Object.assign(new Error('Conversion attribution does not match the original partner.'), { status: 409 });
      }
      if (lead && lead.status !== 'PENDING' && lead.status !== targetStatus) {
        response = { leadId: lead.leadId, status: lead.status, ignoredTerminalUpdate: true };
        return;
      }

      if (!lead) {
        const accountId = text(req.body?.accountId, 120) || `VENDOR:${conversionId}`.slice(0, 120);
        [lead] = await Lead.create([{
          leadId: generateLeadId(),
          partnerId: partner.partnerId,
          campaignId: String(campaign._id),
          campaignName: campaign.name,
          campaignType: campaign.campaignType,
          clientName: text(req.body?.customerName, 120),
          clientMobile: text(req.body?.customerMobile, 40),
          accountId,
          action: campaign.requiredAction,
          vendorClickId: clickId,
          vendorConversionKey: conversionKey,
          status: targetStatus,
          payoutSnapshot: click.payoutSnapshot,
          currency: click.currency,
          rejectionReason: targetStatus === 'REJECTED' ? text(req.body?.rejectionReason, 1000) : '',
          approvedAt: targetStatus === 'APPROVED' ? new Date() : undefined,
          rejectedAt: targetStatus === 'REJECTED' ? new Date() : undefined,
          reviewedBy: 'VENDOR_WEBHOOK',
        }], { session });
      } else {
        if (!lead.clientName && req.body?.customerName) lead.clientName = text(req.body.customerName, 120);
        if (!lead.clientMobile && req.body?.customerMobile) lead.clientMobile = text(req.body.customerMobile, 40);
        lead.status = targetStatus;
        lead.reviewedBy = 'VENDOR_WEBHOOK';
        if (targetStatus === 'APPROVED') lead.approvedAt = new Date();
        if (targetStatus === 'REJECTED') {
          lead.rejectedAt = new Date();
          lead.rejectionReason = text(req.body?.rejectionReason, 1000) || 'Vendor rejected the conversion.';
        }
        await lead.save({ session });
      }

      if (targetStatus === 'APPROVED') {
        await WalletTransaction.updateOne(
          { idempotencyKey: `LEAD_EARNING:${lead._id}` },
          { $setOnInsert: {
            transactionId: generateTransactionId(), partnerId: lead.partnerId, type: 'LEAD_EARNING',
            amount: lead.payoutSnapshot, status: 'AVAILABLE', referenceType: 'LEAD',
            referenceId: String(lead._id), description: `Vendor-approved earning for ${lead.leadId}`,
            idempotencyKey: `LEAD_EARNING:${lead._id}`, processedBy: 'VENDOR_WEBHOOK',
          } },
          { upsert: true, session, runValidators: true },
        );

        const referredPartner: any = await Partner.findOne({ partnerId: lead.partnerId }).select('referredBy').session(session).exec();
        const approvedCount = await Lead.countDocuments({ partnerId: lead.partnerId, status: { $in: ['APPROVED', 'PAID'] } }).session(session);
        if (referredPartner?.referredBy && approvedCount === 1) {
          const referralKey = `REFERRAL_REWARD:${lead.partnerId}`;
          await WalletTransaction.updateOne(
            { idempotencyKey: referralKey },
            { $setOnInsert: {
              transactionId: generateTransactionId(), partnerId: referredPartner.referredBy, type: 'REFERRAL_REWARD',
              amount: 50, status: 'AVAILABLE', referenceType: 'REFERRAL', referenceId: lead.partnerId,
              description: `First eligible approved task by referral ${lead.partnerId}`,
              idempotencyKey: referralKey, processedBy: 'VENDOR_WEBHOOK',
            } },
            { upsert: true, session, runValidators: true },
          );
        }
      }

      await Notification.create([{
        partnerId: lead.partnerId,
        type: targetStatus === 'APPROVED' ? 'PAYMENT_UPDATE' : 'LEAD_UPDATE',
        title: `Vendor conversion ${targetStatus.toLowerCase()}`,
        message: `Lead ${lead.leadId} was updated to ${targetStatus.toLowerCase()} by the campaign provider.`,
        referenceType: 'LEAD', referenceId: String(lead._id),
        dedupeKey: `VENDOR_LEAD_STATUS:${lead._id}:${targetStatus}`,
      }], { session });
      await AuditLog.create([{
        adminId: 'SYSTEM', adminEmail: 'vendor-webhook', action: `VENDOR_LEAD_${targetStatus}`,
        entityType: 'Lead', entityId: String(lead._id),
        before: { status: beforeStatus || null }, after: { status: targetStatus, eventId },
        ipAddress: req.ip,
      }], { session });
      response = { leadId: lead.leadId, status: lead.status };
    });
    res.status(200).json({ success: true, data: response });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(200).json({ success: true, duplicate: true });
      return;
    }
    next(error);
  } finally {
    await session.endSession();
  }
};
