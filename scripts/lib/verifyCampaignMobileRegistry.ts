export function isFullCampaignMobileIndex(index: any) {
  return index.unique === true && index.key?.canonicalCampaignId === 1 && index.key?.normalizedMobile === 1 &&
    Object.keys(index.key).length === 2 && !index.partialFilterExpression && !index.sparse && index.expireAfterSeconds == null;
}

/** Read-back every expected claim; no extra/stale registry rows may activate. */
export async function verifyCampaignMobileRegistry(registry: any, claims: any[], totalLeads: number) {
  if (claims.reduce((sum, claim) => sum + claim.historicalCount, 0) !== totalLeads) throw new Error('Historical coverage incomplete.');
  if (!(await registry.indexes()).some(isFullCampaignMobileIndex)) throw new Error('Full unique index missing.');
  if (await registry.countDocuments() !== claims.length) throw new Error('Unexpected registry coverage.');
  for (const claim of claims) {
    const actual = await registry.findOne({ canonicalCampaignId: claim.canonicalCampaignId, normalizedMobile: claim.normalizedMobile });
    if (!actual || actual.state !== claim.state || actual.leadId !== claim.leadId || actual.partnerId !== claim.partnerId || actual.historicalCount !== claim.historicalCount) throw new Error('Registry verification failed.');
  }
}
