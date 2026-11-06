import { Partner } from '../models/Partner.ts';
import { PartnerSubTeamLink } from '../models/PartnerSubTeamLink.ts';
import { TrackingClick } from '../models/TrackingClick.ts';

export function buildSubTeamTrackingUrl(baseUrl: string, slug: string, referralCode: string, partnerId: string, trackingId: string): string {
  const query = new URLSearchParams({ ref: referralCode, pid: partnerId, subteam: trackingId });
  return `${baseUrl.replace(/\/$/, '')}/campaigns/${encodeURIComponent(slug)}?${query.toString()}`;
}
export function summarizeSubTeamLinks(links: any[], leads: any[]) {
  const byId = new Map<string, { leads: number; approvedConversions: number; attributedEarnings: number }>();
  for (const link of links) byId.set(String(link._id), { leads: 0, approvedConversions: 0, attributedEarnings: 0 });
  for (const lead of leads) {
    const row = byId.get(String(lead.subTeamLinkId));
    if (!row) continue;
    row.leads++;
    if (lead.status === 'APPROVED' || lead.status === 'PAID') {
      row.approvedConversions++;
      row.attributedEarnings += Number(lead.payoutSnapshot) || 0;
    }
  }
  return links.map(link => ({
    ...link,
    ...(byId.get(String(link._id)) || { leads: 0, approvedConversions: 0, attributedEarnings: 0 }),
  }));
}

export async function resolveSubTeamPartner(slug: string, campaign: any, referralCode: string, parentPartnerId: string, trackingId: string, allowArchived = false) {
  const link = await PartnerSubTeamLink.findOne({
    trackingId,
    campaignId: String(campaign._id),
    campaignSlug: slug,
    status: allowArchived ? { $in: ['ACTIVE', 'ARCHIVED'] } : 'ACTIVE',
  }).lean().exec();
  if (!link || link.partnerId !== parentPartnerId.toUpperCase()) {
    throw Object.assign(new Error('Sub-team attribution is invalid, inactive, or does not belong to this partner and campaign.'), { status: 400 });
  }
  const partner = await Partner.findOne({
    partnerId: parentPartnerId.toUpperCase(),
    referralCode: referralCode.toUpperCase(),
    accountStatus: 'ACTIVE',
  }).select('partnerId referralCode payoutSettings').lean().exec();
  if (!partner) throw Object.assign(new Error('Partner attribution is invalid or inactive.'), { status: 400 });
  return { partner, link };
}

export async function resolvePartnerOwnedSubTeamLink(partnerId: string, linkId: string, campaignId: string) {
  const link = await PartnerSubTeamLink.findOne({ _id: linkId, partnerId: partnerId.toUpperCase(), campaignId, status: 'ACTIVE' }).lean().exec();
  if (!link) throw Object.assign(new Error('The selected sub-team link is unavailable for this partner or campaign.'), { status: 400 });
  return link;
}

type SubTeamPayoutSnapshot = {
  payoutSnapshot: number;
  payoutTypeSnapshot?: 'FIXED' | 'PERCENTAGE';
  payoutBasisSnapshot?: 'LOAN_DISBURSED_AMOUNT' | 'INSURANCE_ELIGIBLE_PREMIUM';
  payoutRateSnapshot?: number | null;
  payoutTermsSnapshot?: string;
  payoutEligibilitySnapshot?: Record<string, string>;
};

export async function createSubTeamClick(link: any, campaign: any, partner: any, clickId: string, payout: number | SubTeamPayoutSnapshot, currency: string) {
  const payoutSnapshot = typeof payout === 'number'
    ? { payoutSnapshot: payout, payoutTypeSnapshot: 'FIXED' as const }
    : payout;
  const session = await TrackingClick.db.startSession();
  try {
    await session.withTransaction(async () => {
      await TrackingClick.create([{
        clickId, partnerId: partner.partnerId, campaignId: String(campaign._id), campaignSlug: campaign.slug,
        ...payoutSnapshot, currency, subTeamLinkId: String(link._id), expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      }], { session });
      const updated = await PartnerSubTeamLink.updateOne(
        { _id: link._id, partnerId: partner.partnerId, status: 'ACTIVE' },
        { $inc: { clickCount: 1 } }, { session },
      );
      if (!updated.matchedCount) throw Object.assign(new Error('Sub-team link is no longer active.'), { status: 409 });
    });
  } finally { await session.endSession(); }
}
