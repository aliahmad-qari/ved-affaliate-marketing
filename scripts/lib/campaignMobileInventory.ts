import { normalizeCustomerMobile } from '../../shared/customerMobile.ts';
import { validateHistoricalManifest, type HistoricalReferenceManifest } from './historicalReferenceManifest.ts';

/** Internal rows never go to stdout; callers may print summary counts only. */
export async function inventoryCampaignMobiles(campaigns: any[], leads: AsyncIterable<any>, historical?: HistoricalReferenceManifest) {
  const aliases = new Map<string, Set<string>>();
  for (const campaign of campaigns) for (const alias of [String(campaign._id), campaign.slug].filter(Boolean)) {
    const matches = aliases.get(alias) || new Set<string>(); matches.add(String(campaign._id)); aliases.set(alias, matches);
  }
  const historicalEntries = historical ? validateHistoricalManifest(historical).entries : [];
  if (historical && campaigns.length !== historical.expectedCampaigns) throw new Error('Historical approval campaign count mismatch.');
  for (const entry of historicalEntries) {
    if (aliases.has(entry.originalReference) || aliases.has(entry.historicalIdentity)) throw new Error('Historical identity collides with a current campaign.');
  }
  const historicalCounts = new Map(historicalEntries.map(e => [e.originalReference, { records: 0, approved: 0, paid: 0 }]));
  const groups = new Map<string, any>();
  const summary = { totalLeads: 0, invalidOrMissingMobile: 0, unresolvedCampaign: 0, validRecords: 0, uniqueCampaignMobilePairs: 0,
    duplicateGroups: 0, extraHistoricalRecords: 0, crossPartnerGroups: 0, crossSourceGroups: 0, approvedOrPaidConflictGroups: 0,
    unresolvedDiagnostics: { missingOrNonScalar: 0, ambiguousExactAlias: 0, formattingCandidateOnly: 0, unmatchedObjectId: 0, unmatchedOther: 0, approvedOrPaidRecords: 0 },
    financialConflictRecords: { approved: 0, paid: 0 }, isolatedHistoricalRecords: 0 };
  for await (const lead of leads) {
    summary.totalLeads++;
    const mobile = normalizeCustomerMobile(lead.clientMobile);
    let ids = aliases.get(String(lead.campaignId));
    const historicalEntry = typeof lead.campaignId === 'string' ? historicalEntries.find(e => e.originalReference === lead.campaignId) : undefined;
    if (historicalEntry) {
      ids = new Set([historicalEntry.historicalIdentity]);
      const counts = historicalCounts.get(historicalEntry.originalReference)!;
      counts.records++;
      if (lead.status === 'APPROVED') counts.approved++;
      if (lead.status === 'PAID') counts.paid++;
      summary.isolatedHistoricalRecords++;
    }
    if (!mobile) summary.invalidOrMissingMobile++;
    if (!ids || ids.size !== 1) {
      summary.unresolvedCampaign++;
      const diagnostic = summary.unresolvedDiagnostics;
      if (['APPROVED', 'PAID'].includes(lead.status)) diagnostic.approvedOrPaidRecords++;
      const raw = lead.campaignId;
      if (raw == null || (typeof raw !== 'string' && typeof raw?.toHexString !== 'function') || !String(raw).trim()) diagnostic.missingOrNonScalar++;
      else if (ids && ids.size > 1) diagnostic.ambiguousExactAlias++;
      else {
        // Suggestions are counts only. Never silently map legacy aliases or change claims.
        const normalized = String(raw).trim().toLowerCase();
        const candidates = new Set<string>();
        for (const [alias, matches] of aliases) if (alias.trim().toLowerCase() === normalized) {
          for (const id of matches) candidates.add(id);
        }
        if (candidates.size) diagnostic.formattingCandidateOnly++;
        else if (/^[a-f\d]{24}$/i.test(String(raw))) diagnostic.unmatchedObjectId++;
        else diagnostic.unmatchedOther++;
      }
    }
    if (!mobile || !ids || ids.size !== 1) continue;
    summary.validRecords++;
    const campaignId = [...ids][0];
    const key = `${campaignId}:${mobile}`;
    const source = lead.submittedData?.source === 'CUSTOMER_FORM' ? 'PUBLIC' : lead.vendorConversionKey ? 'VENDOR' : 'MANUAL';
    let group = groups.get(key);
    if (!group) {
      group = { canonicalCampaignId: campaignId, normalizedMobile: mobile, leadId: String(lead._id), partnerId: lead.partnerId,
        state: 'CLAIMED', historicalCount: 0, partners: new Set(), sources: new Set(), financial: false, approvedCount: 0, paidCount: 0 };
      groups.set(key, group);
    }
    group.historicalCount++; group.partners.add(lead.partnerId); group.sources.add(source);
    group.financial ||= ['APPROVED', 'PAID'].includes(lead.status);
    if (lead.status === 'APPROVED') group.approvedCount++;
    if (lead.status === 'PAID') group.paidCount++;
    if (group.historicalCount > 1) { group.state = 'HISTORICAL_CONFLICT'; delete group.leadId; delete group.partnerId; }
    if (groups.size > 1000000) throw new Error('Inventory exceeds the supported in-memory size; use a reviewed batch plan.');
  }
  summary.uniqueCampaignMobilePairs = groups.size;
  if (historical && summary.totalLeads !== historical.expectedTotalLeads) throw new Error('Historical approval lead count mismatch.');
  for (const entry of historicalEntries) {
    const count = historicalCounts.get(entry.originalReference)!;
    if (count.records !== entry.expectedRecords || count.approved !== entry.expectedApproved || count.paid !== entry.expectedPaid) throw new Error('Historical approval group counts mismatch.');
  }
  for (const group of groups.values()) if (group.historicalCount > 1) {
    summary.duplicateGroups++; summary.extraHistoricalRecords += group.historicalCount - 1;
    if (group.partners.size > 1) summary.crossPartnerGroups++;
    if (group.sources.size > 1) summary.crossSourceGroups++;
    if (group.financial) summary.approvedOrPaidConflictGroups++;
    summary.financialConflictRecords.approved += group.approvedCount;
    summary.financialConflictRecords.paid += group.paidCount;
  }
  return { summary, claims: [...groups.values()].map(({ partners, sources, financial, approvedCount, paidCount, ...claim }) => claim) };
}

export async function readInventory(db: any, historical?: HistoricalReferenceManifest) {
  const campaigns = await db.collection('campaigns').find({}, { projection: { _id: 1, slug: 1 } }).maxTimeMS(60000).toArray();
  const cursor = db.collection('leads').find({}, { projection: { _id: 1, campaignId: 1, clientMobile: 1, partnerId: 1, status: 1, 'submittedData.source': 1, vendorConversionKey: 1 } }).maxTimeMS(120000).batchSize(500);
  try { return await inventoryCampaignMobiles(campaigns, cursor, historical); }
  finally { await cursor.close(); }
}
