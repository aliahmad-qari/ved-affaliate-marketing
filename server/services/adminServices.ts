import { Request } from 'express';
import { AuditLog } from '../models/AuditLog.ts';
import { Notification, NotificationType } from '../models/Notification.ts';

export async function writeAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
): Promise<void> {
  await AuditLog.create({
    adminId: String(req.user?._id || ''),
    adminEmail: String(req.user?.email || ''),
    action,
    entityType,
    entityId,
    before,
    after,
    ipAddress: req.ip,
  });
}

export async function notifyPartner(
  partnerId: string,
  type: NotificationType,
  title: string,
  message: string,
  referenceType = '',
  referenceId = '',
  dedupeKey?: string,
): Promise<void> {
  await Notification.create({ partnerId, type, title, message, referenceType, referenceId, dedupeKey });
}

export async function notifyPartners(
  partnerIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  referenceType = '',
  referenceId = '',
): Promise<void> {
  const uniqueIds = [...new Set(partnerIds.filter(Boolean))];
  if (uniqueIds.length) {
    await Notification.insertMany(uniqueIds.map((partnerId) => ({
      partnerId,
      type,
      title,
      message,
      referenceType,
      referenceId,
    })));
  }
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function availableBalanceCents(leads: any[], transactions: any[]): number {
  const cents = (value: number) => Math.round(Number(value) * 100);
  const approved = leads.filter((lead) => lead.status === 'APPROVED').reduce((sum, lead) => sum + cents(lead.payoutSnapshot), 0);
  const referrals = transactions.filter((tx) => tx.type === 'REFERRAL_REWARD' && ['AVAILABLE', 'PROCESSED'].includes(tx.status)).reduce((sum, tx) => sum + cents(tx.amount), 0);
  const withdrawn = transactions.filter((tx) => tx.type === 'WITHDRAWAL' && ['PAID', 'PROCESSED'].includes(tx.status)).reduce((sum, tx) => sum + cents(tx.amount), 0);
  const reserved = transactions.filter((tx) => tx.type === 'WITHDRAWAL' && ['PENDING', 'PROCESSING', 'APPROVED'].includes(tx.status)).reduce((sum, tx) => sum + cents(tx.amount), 0);
  return approved + referrals - withdrawn - reserved;
}