export const LEADERBOARD_TIME_ZONE = 'UTC';
export const MONTHLY_REWARD_PAYMENT_STATUSES = ['PENDING', 'PROCESSING', 'PAID'] as const;
export type MonthlyRewardPaymentStatus = typeof MONTHLY_REWARD_PAYMENT_STATUSES[number];

export function monthKeyInTimeZone(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Unable to determine the reporting month.');
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthWindow(monthKey: string): { monthKey: string; start: Date; end: Date } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
  if (!match) throw Object.assign(new Error('Month must use YYYY-MM format.'), { status: 400 });
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { monthKey, start, end };
}

export function shiftMonth(monthKey: string, delta: number): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
  if (!match || !Number.isInteger(delta)) throw new Error('Month navigation requires a valid month and whole-month offset.');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function validateReportMonth(monthKey: string, now = new Date()): { monthKey: string; start: Date; end: Date } {
  const window = monthWindow(monthKey);
  if (window.start.getTime() > now.getTime()) throw Object.assign(new Error('Future leaderboard months are unavailable.'), { status: 400 });
  return window;
}

export interface LeaderboardCandidate {
  partnerId: string;
  fullName: string;
  approvedConversions: number;
  approvedEarnings: number;
}

export function rankLeaderboard(candidates: LeaderboardCandidate[]) {
  const sorted = [...candidates].sort((a, b) =>
    b.approvedConversions - a.approvedConversions
    || a.fullName.localeCompare(b.fullName, 'en', { sensitivity: 'base' })
    || a.partnerId.localeCompare(b.partnerId, 'en', { sensitivity: 'base' }),
  );
  let previousCount: number | undefined;
  let currentRank = 0;
  return sorted.map((candidate, index) => {
    if (candidate.approvedConversions !== previousCount) currentRank = index + 1;
    previousCount = candidate.approvedConversions;
    return { rank: currentRank, ...candidate };
  });
}

export function monthlyRewardId(monthKey: string, partnerId: string, rewardType: string): string {
  return `${monthKey}:${partnerId.toUpperCase()}:${rewardType.toUpperCase()}`;
}

export function isApprovedLeadMatch(status: unknown, reviewedBy: unknown, approvedAt: unknown): boolean {
  return (status === 'APPROVED' || status === 'PAID')
    && typeof reviewedBy === 'string' && reviewedBy.length > 0
    && !['VENDOR_WEBHOOK', 'SYSTEM'].includes(reviewedBy)
    && approvedAt instanceof Date && Number.isFinite(approvedAt.getTime());
}
