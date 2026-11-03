import mongoose from 'mongoose';
import { assertFrozenInventory, readInventorySnapshot } from './lib/campaignMobileInventory.ts';
import { loadHistoricalManifest } from './lib/historicalReferenceManifest.ts';
import { verifyCampaignMobileRegistry } from './lib/verifyCampaignMobileRegistry.ts';

/** Explicitly executable migration; NEVER imported by app/server startup. */
async function main() {
  if (!process.argv.includes('--apply') || !process.argv.includes('--writers-paused') || process.env.CONFIRM_DEDUPLICATION_MIGRATION !== 'YES' || !process.env.MIGRATION_MONGODB_URI) {
    throw new Error('Explicit approval, a backup and paused writers are required.');
  }
  const approval = loadHistoricalManifest(process.env.HISTORICAL_REFERENCE_MANIFEST, process.env.APPROVED_HISTORICAL_MANIFEST_SHA256);
  const frozenDigest = process.env.VED_FROZEN_INVENTORY_SHA256;
  if (!frozenDigest || !/^[a-f\d]{64}$/.test(frozenDigest)) throw new Error('A writer-fenced source inventory is required.');
  const client = new mongoose.mongo.MongoClient(process.env.MIGRATION_MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect(); const db = client.db();
    const hello = await db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Transactions are required; no unsupported fallback will be used.');
    const state = db.collection<any>('leadDeduplicationState');
    const prior = await state.findOne({ _id: 'campaign-mobile-v1' });
    if (prior?.ready) throw new Error('Registry is already active; do not rerun migration online.');
    if (prior?.historicalManifestDigest && prior.historicalManifestDigest !== approval?.digest) throw new Error('Prior preparation approval mismatch.');
    if (prior?.frozenInventoryDigest && prior.frozenInventoryDigest !== frozenDigest) throw new Error('Prior frozen source mismatch; manual recovery required.');
    const inventory = await readInventorySnapshot(client, approval?.manifest);
    assertFrozenInventory(inventory, frozenDigest);
    const { summary, claims } = inventory;
    console.log(JSON.stringify(summary, null, 2));
    if (summary.unresolvedCampaign) throw new Error('Unresolved campaign aliases require review before activation.');
    if (summary.invalidOrMissingMobile || summary.validRecords !== summary.totalLeads) throw new Error('Complete customer identity coverage is required.');
    await state.updateOne({ _id: 'campaign-mobile-v1' }, { $set: { ready: false, version: 1, frozenInventoryDigest: frozenDigest } }, { upsert: true });
    // Bind partial preparation to the exact approval before any claim writes.
    if (approval) await state.updateOne({ _id: 'campaign-mobile-v1' }, { $set: { historicalManifestDigest: approval.digest } });
    const registry = db.collection('campaignmobileclaims');
    await registry.createIndex({ canonicalCampaignId: 1, normalizedMobile: 1 }, { unique: true, name: 'unique_campaign_mobile' });
    for (const claim of claims) {
      const key = { canonicalCampaignId: claim.canonicalCampaignId, normalizedMobile: claim.normalizedMobile };
      const existing = await registry.findOne(key);
      if (existing && (existing.state !== claim.state || existing.leadId !== claim.leadId || existing.partnerId !== claim.partnerId || existing.historicalCount !== claim.historicalCount)) throw new Error('Registry discrepancy requires manual review.');
      await registry.updateOne(key, { $setOnInsert: { ...claim, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
    }
    await verifyCampaignMobileRegistry(registry, claims, summary.totalLeads);
    // Reinventory while writers remain fenced; never activate a stale preparation.
    const check = await readInventorySnapshot(client, approval?.manifest);
    assertFrozenInventory(check, frozenDigest);
    await state.updateOne({ _id: 'campaign-mobile-v1' }, { $set: { ready: true, version: 1, preparedAt: new Date(), unidentifiedHistoryCount: 0, coverageVerified: true, coveredLeadCount: summary.totalLeads, isolatedHistoricalRecords: summary.isolatedHistoricalRecords } });
    console.log('Registry prepared. Existing leads, wallet entries and audit records were not changed.');
  } finally { await client.close(); }
}
main().catch(() => { console.error('Registry preparation stopped; readiness remains unconfirmed. Review privately without printing connection strings or customer details.'); process.exitCode = 1; });
