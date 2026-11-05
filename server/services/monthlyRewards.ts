import { MonthlyLeaderboardReward } from '../models/MonthlyLeaderboardReward.ts';
import { MonthlyRewardRule } from '../models/MonthlyRewardPolicy.ts';
import { monthlyRewardId } from '../../shared/monthlyLeaderboard.ts';

export function partnerMonthlyRewardsFilter(partnerId: string, monthKey: string) {
  return { partnerId: partnerId.toUpperCase(), monthKey };
}

export async function insertMonthlyRewardOnce(
  input: { monthKey: string; partnerId: string; rewardType: string; label: string; amount: number; minimumApprovedConversions: number; approvedConversionsAtGeneration: number },
  session?: any,
): Promise<boolean> {
  const id = monthlyRewardId(input.monthKey, input.partnerId, input.rewardType);
  try {
    const result = await MonthlyLeaderboardReward.updateOne({ _id: id }, { $setOnInsert: {
      _id: id,
      monthKey: input.monthKey,
      partnerId: input.partnerId,
      rewardType: input.rewardType,
      label: input.label,
      amount: input.amount,
      currency: 'INR',
      minimumApprovedConversions: input.minimumApprovedConversions,
      approvedConversionsAtGeneration: input.approvedConversionsAtGeneration,
      paymentStatus: 'PENDING',
    } }, { upsert: true, ...(session ? { session } : {}), runValidators: true });
    return result.upsertedCount === 1;
  } catch (error: any) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

export function normalizeMonthlyRewardRules(input: unknown): MonthlyRewardRule[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 20) return null;
  const result: MonthlyRewardRule[] = [];
  const types = new Set<string>();
  for (const row of input) {
    const rewardType = typeof row?.rewardType === 'string' ? row.rewardType.trim().toUpperCase() : '';
    const label = typeof row?.label === 'string' ? row.label.trim().replace(/\s+/g, ' ') : '';
    const minimumApprovedConversions = Number(row?.minimumApprovedConversions);
    const amount = Number(row?.amount);
    if (!/^[A-Z0-9_-]{2,40}$/.test(rewardType) || types.has(rewardType)
      || label.length < 2 || label.length > 80
      || !Number.isInteger(minimumApprovedConversions) || minimumApprovedConversions < 1 || minimumApprovedConversions > 100000
      || !Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return null;
    types.add(rewardType);
    result.push({ rewardType, label, minimumApprovedConversions, amount: Math.round(amount * 100) / 100 });
  }
  return result;
}
