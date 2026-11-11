import { LEADERBOARD_TIME_ZONE, LeaderboardCandidate, rankLeaderboard, validateReportMonth } from '../../shared/monthlyLeaderboard.ts';
import { Lead } from '../models/Lead.ts';
import { Partner } from '../models/Partner.ts';
import { maskPublicPartnerName } from '../utils/publicPartnerMasking.ts';

export { LEADERBOARD_TIME_ZONE, rankLeaderboard, validateReportMonth };

export function adminApprovedLeadFilter(monthKey: string, now = new Date()) {
  const { start, end } = validateReportMonth(monthKey, now);
  return {
    status: { $in: ['APPROVED', 'PAID'] },
    approvedAt: { $gte: start, $lt: end },
    reviewedBy: { $nin: ['', 'VENDOR_WEBHOOK', 'SYSTEM'] },
    rejectionReasonCode: { $ne: 'DUPLICATE_LEAD' },
    approvalReversal: { $exists: false },
  };
}

export async function getMonthlyLeaderboard(monthKey: string, now = new Date()) {
  const filter = adminApprovedLeadFilter(monthKey, now);
  const groups = await Lead.aggregate([
    { $match: filter },
    { $group: {
      _id: '$partnerId',
      approvedConversions: { $sum: 1 },
      approvedEarnings: { $sum: { $cond: [
        { $eq: ['$payoutTypeSnapshot', 'PERCENTAGE'] },
        { $cond: [{ $eq: ['$payoutCommission.state', 'AVAILABLE'] }, { $ifNull: ['$payoutSnapshot', 0] }, 0] },
        { $ifNull: ['$payoutSnapshot', 0] },
      ] } },
    } },
  ]).exec();
  const partnerIds = groups.map((group: any) => String(group._id)).filter(Boolean);
  const partners: any[] = partnerIds.length
    ? await Partner.find({ partnerId: { $in: partnerIds } }).select('partnerId fullName').lean().exec()
    : [];
  const names = new Map(partners.map(partner => [String(partner.partnerId).toUpperCase(), String(partner.fullName || '').trim()]));
  const candidates: LeaderboardCandidate[] = groups.map((group: any) => ({
    partnerId: String(group._id),
    fullName: names.get(String(group._id).toUpperCase()) || 'VED Partner',
    approvedConversions: Number(group.approvedConversions) || 0,
    approvedEarnings: Math.round((Number(group.approvedEarnings) || 0) * 100) / 100,
  }));
  const window = validateReportMonth(monthKey, now);
  return {
    monthKey,
    timeZone: LEADERBOARD_TIME_ZONE,
    rangeStart: window.start.toISOString(),
    rangeEndExclusive: window.end.toISOString(),
    rankings: rankLeaderboard(candidates),
  };
}

/** Privacy-safe monthly rankings shared by the public homepage and partner dashboard. */
export async function getPublicMonthlyLeaderboard(monthKey: string, now = new Date()) {
  const board = await getMonthlyLeaderboard(monthKey, now);
  return {
    monthKey: board.monthKey,
    timeZone: board.timeZone,
    rankings: board.rankings.slice(0, 5).map(row => ({
      rank: row.rank,
      partnerName: maskPublicPartnerName(row.fullName),
      approvedConversions: row.approvedConversions,
      approvedEarnings: row.approvedEarnings,
    })),
  };
}
