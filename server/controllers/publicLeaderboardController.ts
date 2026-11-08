import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead.ts';
import { Partner } from '../models/Partner.ts';
import { adminApprovedReferralLeadCriteria } from '../services/referralReward.ts';
import { maskPublicPartnerId, maskPublicPartnerName } from '../utils/publicPartnerMasking.ts';

export async function getPublicSuccessfulLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const groups = await Lead.aggregate([
      { $match: adminApprovedReferralLeadCriteria() },
      { $group: { _id: '$partnerId', approvedCount: { $sum: 1 } } },
    ]).exec();
    const partnerIds = groups.map(group => String(group._id)).filter(Boolean);
    const partners: any[] = partnerIds.length
      ? await Partner.find({ partnerId: { $in: partnerIds } }).select('partnerId fullName').lean().exec()
      : [];
    const names = new Map(partners.map(partner => [String(partner.partnerId).toUpperCase(), String(partner.fullName || '')]));
    res.set({ 'Cache-Control': 'public, max-age=60', 'Referrer-Policy': 'no-referrer' });
    res.json({
      success: true,
      data: {
        partners: groups.map(group => ({
          partnerName: maskPublicPartnerName(names.get(String(group._id).toUpperCase())),
          partnerId: maskPublicPartnerId(group._id),
          successfulLeads: Number(group.approvedCount) || 0,
        })),
      },
    });
  } catch (error) { next(error); }
}
