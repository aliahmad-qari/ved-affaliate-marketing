import { randomUUID } from 'node:crypto';
import { historicalRecordsDigest, inventoryCampaignMobiles } from './campaignMobileInventory.ts';
import { validateHistoricalManifest } from './historicalReferenceManifest.ts';

/** Exact production-approved counts only. No guesses, output, file or DB writes. */
export async function buildHistoricalManifest(campaigns: any[], leads: any[], approvedBy: string, approvalReference: string) {
  const stop = () => { throw new Error('Historical inventory does not match the approved manifest setup.'); };
  if (campaigns.length !== 27 || leads.length < 10 || leads.length > 100000) stop();
  const aliases = new Map<string, Set<string>>();
  for (const campaign of campaigns) for (const alias of [String(campaign._id), campaign.slug].filter(v => typeof v === 'string' && v)) {
    const ids = aliases.get(alias) ?? new Set<string>(); ids.add(String(campaign._id)); aliases.set(alias, ids);
  }
  const groups = new Map<string, { records: number; approved: number; paid: number }>();
  for (const lead of leads) {
    const matches = aliases.get(String(lead.campaignId));
    if (matches?.size === 1) continue;
    if (matches || typeof lead.campaignId !== 'string' || !lead.campaignId.trim() || lead.campaignId.length > 1000) stop();
    const count = groups.get(lead.campaignId) ?? { records: 0, approved: 0, paid: 0 };
    count.records++;
    if (lead.status === 'APPROVED') count.approved++;
    if (lead.status === 'PAID') count.paid++;
    groups.set(lead.campaignId, count);
  }
  if (groups.size !== 2) stop();
  const ordered = [...groups].sort((a, b) => a[1].records - b[1].records);
  if (ordered[0][1].records !== 1 || ordered[0][1].approved !== 0 || ordered[0][1].paid !== 0 ||
      ordered[1][1].records !== 9 || ordered[1][1].approved !== 9 || ordered[1][1].paid !== 0) stop();
  const manifest = validateHistoricalManifest({ version: 1, approvedBy, approvalReference,
    expectedTotalLeads: leads.length, inventoryPolicy: 'FROZEN_AT_CUTOVER', expectedCampaigns: 27,
    historicalRecordsDigest: historicalRecordsDigest(leads.filter(lead => groups.has(lead.campaignId))),
    entries: ordered.map(([originalReference, counts]) => ({ originalReference,
      historicalIdentity: `historical:${randomUUID()}`, expectedRecords: counts.records,
      expectedApproved: counts.approved, expectedPaid: counts.paid })),
  });
  const checked = await inventoryCampaignMobiles(campaigns, (async function* () { yield* leads; })(), manifest);
  if (checked.summary.unresolvedCampaign || checked.summary.invalidOrMissingMobile || checked.summary.validRecords !== leads.length || checked.summary.isolatedHistoricalRecords !== 10) stop();
  return manifest;
}
