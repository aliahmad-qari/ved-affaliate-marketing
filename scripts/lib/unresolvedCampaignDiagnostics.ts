import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';

export function diagnosticLabel(key: string, kind: 'reference' | 'campaign', value: unknown) {
  if (!/^[a-f\d]{64}$/i.test(key)) throw new Error('A private 32-byte hexadecimal diagnostic key is required.');
  const encoded = mongoose.mongo.BSON.EJSON.stringify({ value }, { relaxed: false });
  return `${kind === 'reference' ? 'R' : 'C'}-${createHmac('sha256', Buffer.from(key, 'hex')).update(`${kind}\0${encoded}`).digest('hex')}`;
}

/** Only exact historical slug snapshots tied to an existing campaign are evidence.
 * Names, formatting, lead metadata and vendor URLs are never mapping evidence.
 */
export function diagnoseUnresolvedCampaigns(campaigns: any[], leads: any[], audits: any[], key: string, auditAvailable: boolean) {
  diagnosticLabel(key, 'reference', 'validate-key');
  const aliases = new Map<string, Set<string>>();
  const currentIds = new Set(campaigns.map(c => String(c._id)));
  for (const c of campaigns) for (const alias of [String(c._id), c.slug].filter(v => typeof v === 'string' && v)) {
    const ids = aliases.get(alias) ?? new Set<string>(); ids.add(String(c._id)); aliases.set(alias, ids);
  }
  const history = new Map<string, Set<string>>();
  for (const audit of audits) {
    if (audit.entityType !== 'Campaign' || !['CAMPAIGN_CREATED', 'CAMPAIGN_UPDATED', 'CAMPAIGN_ARCHIVED'].includes(audit.action)) continue;
    const id = String(audit.entityId);
    for (const snapshot of [audit.before, audit.after]) {
      if (typeof snapshot?.slug !== 'string' || !snapshot.slug) continue;
      // A conflicting snapshot identity cannot establish a verified mapping.
      if (snapshot._id != null && String(snapshot._id) !== id) continue;
      const ids = history.get(snapshot.slug) ?? new Set<string>(); ids.add(id); history.set(snapshot.slug, ids);
    }
  }
  const groups = new Map<string, { affectedRecords: number; approvedRecords: number; paidRecords: number; reference: unknown }>();
  for (const lead of leads) {
    if (aliases.get(String(lead.campaignId))?.size === 1) continue;
    const label = diagnosticLabel(key, 'reference', lead.campaignId);
    const group = groups.get(label) ?? { affectedRecords: 0, approvedRecords: 0, paidRecords: 0, reference: lead.campaignId };
    group.affectedRecords++;
    if (lead.status === 'APPROVED') group.approvedRecords++;
    if (lead.status === 'PAID') group.paidRecords++;
    groups.set(label, group);
  }
  const result = [...groups].map(([label, { reference, ...counts }]) => {
    const candidates = typeof reference === 'string' ? history.get(reference) ?? new Set<string>() : new Set<string>();
    const target = candidates.size === 1 ? [...candidates][0] : undefined;
    const verified = !!target && currentIds.has(target) && !aliases.has(String(reference));
    return { label, ...counts, approvedOrPaidRecords: counts.approvedRecords + counts.paidRecords,
      verifiedHistoricalMappingEvidence: verified,
      canonicalCampaignLabel: verified ? diagnosticLabel(key, 'campaign', target) : null,
      evidenceStatus: verified ? 'EXACT_AUDIT_SLUG_SNAPSHOT' : candidates.size > 1 ? 'CONFLICTING_HISTORY' : target ? 'HISTORICAL_TARGET_NOT_CURRENT' : auditAvailable ? 'NO_EXACT_MAPPING_EVIDENCE' : 'HISTORY_UNAVAILABLE',
      requiresManualConfirmation: true };
  }).sort((a, b) => a.label.localeCompare(b.label));
  return { totalLeadsInspected: leads.length, unresolvedRecords: result.reduce((n, r) => n + r.affectedRecords, 0),
    distinctUnresolvedReferenceGroups: result.length, historyCollectionAvailable: auditAvailable,
    groups: result, registryActivationAllowed: false };
}
