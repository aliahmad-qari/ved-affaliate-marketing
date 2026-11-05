export const LEADERBOARD_TIME_ZONE = 'Asia/Kolkata';
export const MONTHLY_REWARD_PAYMENT_STATUSES = ['PENDING', 'PROCESSING', 'PAID'] as const;
export type MonthlyRewardPaymentStatus = typeof MONTHLY_REWARD_PAYMENT_STATUSES[number];

export function monthKeyInTimeZone(date = new Date(), timeZone = LEADERBOARD_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  if (!year || !month) throw new Error('Unable to determine the reporting month.');
  return `${year}-${month}`;
}

function offsetAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const localAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return localAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function localMidnightUtc(year: number, monthIndex: number, timeZone: string): Date {
  const localMidnightAsUtc = Date.UTC(year, monthIndex, 1);
  let candidate = localMidnightAsUtc;
  for (let attempt = 0; attempt < 3; attempt++) candidate = localMidnightAsUtc - offsetAt(new Date(candidate), timeZone);
  return new Date(candidate);
}

export function monthWindow(monthKey: string, timeZone = LEADERBOARD_TIME_ZONE): { monthKey: string; start: Date; end: Date } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
  if (!match) throw Object.assign(new Error('Month must use YYYY-MM format.'), { status: 400 });
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = localMidnightUtc(year, monthIndex, timeZone);
  const end = localMidnightUtc(year, monthIndex + 1, timeZone);
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
