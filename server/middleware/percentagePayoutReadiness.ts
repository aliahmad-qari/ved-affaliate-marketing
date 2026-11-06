import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import { AdvertiserReceipt } from '../models/AdvertiserReceipt.ts';

type IndexInfo = { name?: string; key?: Record<string, unknown>; unique?: boolean; sparse?: boolean };

export function hasRequiredPercentagePayoutIndexes(indexes: {
  leads: IndexInfo[];
  walletTransactions: IndexInfo[];
  advertiserReceipts: IndexInfo[];
}): boolean {
  const has = (list: IndexInfo[], name: string, key: Record<string, unknown>, sparse = false) => list.some(index =>
    index.name === name && index.unique === true && (!sparse || index.sparse === true)
      && JSON.stringify(Object.entries(index.key || {}).sort()) === JSON.stringify(Object.entries(key).sort()));

  return has(indexes.leads, 'unique_percentage_payout_event_keys', { 'payoutCommission.eventKeys': 1 }, true)
    && has(indexes.walletTransactions, 'idempotencyKey_1', { idempotencyKey: 1 }, true)
    && has(indexes.advertiserReceipts, 'advertiser_receipt_unique_lead', { leadId: 1 })
    && has(indexes.advertiserReceipts, 'advertiser_receipt_unique_reference', { referenceKey: 1 });
}

/** Read-only fail-closed gate. Indexes are prepared separately; request startup never creates them. */
export async function requirePercentagePayoutReadiness(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [leads, walletTransactions, advertiserReceipts] = await Promise.all([
      Lead.collection.indexes(),
      WalletTransaction.collection.indexes(),
      AdvertiserReceipt.collection.indexes(),
    ]);
    if (!hasRequiredPercentagePayoutIndexes({ leads, walletTransactions, advertiserReceipts })) {
      res.status(503).json({ success: false, message: 'Percentage payouts are temporarily unavailable until their reviewed database indexes are prepared.' });
      return;
    }
    next();
  } catch {
    // NamespaceNotFound and permission errors both remain safely unavailable.
    res.status(503).json({ success: false, message: 'Percentage payouts are temporarily unavailable until database readiness is verified.' });
  }
}
