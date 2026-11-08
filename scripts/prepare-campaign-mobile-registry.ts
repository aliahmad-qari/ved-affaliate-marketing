import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import {
  CLAIM_COLLECTION, CLAIM_INDEX, STATE_COLLECTION, STATE_ID,
  buildRegistryPlan, compareClaimIndex, sameClaim, validateHistoricalAliasManifest,
  type HistoricalAliasManifest,
} from './lib/campaignMobileRegistryPlan.ts';

const TARGET_DATABASE = 'VedAffiliatemarket';
const LIVE_APP_DIRECTORY = '/var/www/ved-affaliate-marketing';
const API_PROCESS_NAME = 'ved-affiliate-api';
const API_PORT = 4004;

class SafeStop extends Error {}

function safeError(error: unknown): { name: string; code?: number | string } {
  const value = error as { name?: string; code?: number | string };
  return { name: value?.name || 'Error', ...(value?.code !== undefined ? { code: value.code } : {}) };
}

function parseArgs(): { apply: boolean; approvalDigest?: string; maintenanceApproved: boolean; writersFenced: boolean; historicalApproved: boolean } {
  const args = process.argv.slice(2);
  const allowed = new Set(['--dry-run', '--apply', '--confirm-target=VedAffiliatemarket', '--maintenance-approved', '--writers-fenced', '--approve-historical-mappings']);
  const digestArg = args.find(arg => arg.startsWith('--approval-digest='));
  for (const arg of args) if (!allowed.has(arg) && arg !== digestArg) throw new SafeStop('Unsupported command-line option.');
  if (args.includes('--dry-run') === args.includes('--apply')) throw new SafeStop('Choose exactly one of --dry-run or --apply.');
  const apply = args.includes('--apply');
  const approvalDigest = digestArg?.slice('--approval-digest='.length);
  if (approvalDigest && !/^[a-f0-9]{64}$/i.test(approvalDigest)) throw new SafeStop('Approval digest format is invalid.');
  if (apply && (!approvalDigest || !args.includes('--confirm-target=VedAffiliatemarket') || !args.includes('--maintenance-approved') || !args.includes('--writers-fenced'))) {
    throw new SafeStop('Apply requires the exact dry-run digest, target confirmation, and maintenance/writer-fence acknowledgements.');
  }
  return { apply, approvalDigest, maintenanceApproved: args.includes('--maintenance-approved'), writersFenced: args.includes('--writers-fenced'), historicalApproved: args.includes('--approve-historical-mappings') };
}

function uriDatabase(uri: string): string {
  try { return decodeURIComponent(new URL(uri).pathname.replace(/^\//, '')); }
  catch { throw new SafeStop('Configured MongoDB URI is invalid.'); }
}

function digestEqual(left: string, right: string): boolean {
  return left.length === right.length && createHash('sha256').update(left).digest('hex') === createHash('sha256').update(right).digest('hex');
}

function assertApplyFence(): void {
  if (process.platform !== 'linux') throw new SafeStop('Apply is permitted only on the approved Contabo Linux host.');
  let processes: any[];
  try { processes = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); }
  catch { throw new SafeStop('Could not verify the VED PM2 maintenance state.'); }
  const expected = processes.filter(process => process.name === API_PROCESS_NAME);
  if (expected.length !== 1 || expected[0]?.pm2_env?.status !== 'stopped' || expected[0]?.pm2_env?.pm_cwd !== LIVE_APP_DIRECTORY) {
    throw new SafeStop('Expected VED PM2 process is not uniquely present, stopped, and rooted in the approved live directory.');
  }
  if (processes.some(process => process.pm2_env?.status === 'online' && process.pm2_env?.pm_cwd === LIVE_APP_DIRECTORY)) {
    throw new SafeStop('An online PM2 process still uses the VED live directory.');
  }
  let listeners = '';
  try { listeners = execFileSync('ss', ['-ltnH', 'sport', '=', `:${API_PORT}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { throw new SafeStop('Could not verify that the VED API port is closed.'); }
  if (listeners.trim()) throw new SafeStop('A process is still listening on the VED API port.');
  if (process.env.R7_WRITERS_FENCED !== 'YES') throw new SafeStop('Set R7_WRITERS_FENCED=YES only after confirming all VED webhook and manual lead writers are paused.');
}

async function loadManifest(path: string | undefined): Promise<{ manifest?: HistoricalAliasManifest; fileDigest: string }> {
  if (!path) return { fileDigest: 'none' };
  const info = await stat(path);
  if (process.platform === 'linux' && (info.mode & 0o077) !== 0) throw new SafeStop('Historical mapping manifest permissions must be 0600 or stricter.');
  const bytes = await readFile(path);
  let manifest: HistoricalAliasManifest;
  try { manifest = JSON.parse(bytes.toString('utf8')); }
  catch { throw new SafeStop('Historical mapping manifest is not valid JSON.'); }
  return { manifest, fileDigest: createHash('sha256').update(bytes).digest('hex') };
}

async function verifyRole(db: any, apply: boolean): Promise<{ status: string; roles: string[] }> {
  try {
    const result = await db.admin().command({ connectionStatus: 1, showPrivileges: false });
    const roles = (result.authInfo?.authenticatedUserRoles || []).map((role: any) => `${role.role}@${role.db}`);
    if (!roles.length) return { status: 'unavailable', roles: [] };
    const roleDatabases = roles.map((role: string) => role.slice(role.lastIndexOf('@') + 1));
    const roleNames = roles.map((role: string) => role.slice(0, role.lastIndexOf('@')));
    if (roleDatabases.some((database: string) => database !== TARGET_DATABASE)) throw new SafeStop('Authenticated user has a role outside the approved database.');
    if (apply && (!roleNames.includes('readWrite') || !roleNames.some((name: string) => ['dbAdmin', 'dbOwner'].includes(name)))) {
      throw new SafeStop('Apply credentials must have target-database readWrite and database-administration permissions.');
    }
    return { status: 'verified-target-only', roles };
  } catch (error) {
    if (error instanceof SafeStop) throw error;
    if (apply) throw new SafeStop('Could not verify apply credential database-scoped roles.');
    return { status: 'unavailable', roles: [] };
  }
}

async function readInventory(db: any, hmacKey: string, manifest?: HistoricalAliasManifest) {
  const collectionNames = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((row: any) => row.name));
  if (!collectionNames.has('campaigns') || !collectionNames.has('leads')) throw new SafeStop('Required production campaigns/leads collections are missing; target identity is not safe to prepare.');
  const [campaignRows, leadRows, claimIndexes] = await Promise.all([
    db.collection('campaigns').find({}, { projection: { _id: 1, slug: 1 }, maxTimeMS: 60_000 }).toArray(),
    db.collection('leads').find({}, { projection: { _id: 1, leadId: 1, partnerId: 1, campaignId: 1, clientMobile: 1, status: 1 }, maxTimeMS: 60_000 }).toArray(),
    db.listCollections({ name: CLAIM_COLLECTION }, { nameOnly: true }).hasNext()
      .then(async (exists: boolean) => exists ? db.collection(CLAIM_COLLECTION).listIndexes().toArray() : []),
  ]);
  const campaigns = campaignRows.map((row: any) => ({ id: String(row._id), slug: row.slug ? String(row.slug) : undefined }));
  const byId = new Map(campaigns.map((campaign: any) => [campaign.id.toLowerCase(), campaign.id]));
  const bySlug = new Map(campaigns.filter((campaign: any) => campaign.slug).map((campaign: any) => [campaign.slug.toLowerCase(), campaign.id]));
  const unresolved = new Set<string>();
  for (const lead of leadRows) {
    const reference = lead.campaignId == null ? '' : String(lead.campaignId).trim();
    if (reference && !byId.has(reference.toLowerCase()) && !bySlug.has(reference.toLowerCase())) unresolved.add(reference);
  }
  const manifestMappings = manifest
    ? validateHistoricalAliasManifest(manifest, [...unresolved], campaigns, hmacKey)
    : new Map<string, string>();
  const plan = buildRegistryPlan(leadRows, campaigns, manifestMappings, hmacKey);
  const claimsCollectionExists = (await db.listCollections({ name: CLAIM_COLLECTION }, { nameOnly: true }).hasNext());
  const stateCollectionExists = (await db.listCollections({ name: STATE_COLLECTION }, { nameOnly: true }).hasNext());
  const existingClaims = claimsCollectionExists
    ? await db.collection(CLAIM_COLLECTION).find({}, { projection: { canonicalCampaignId: 1, normalizedMobile: 1, state: 1, historicalCount: 1, leadId: 1, partnerId: 1 } }).toArray()
    : [];
  const existingByKey = new Map<string, any>();
  let duplicateRegistryKeys = 0;
  for (const claim of existingClaims) {
    const key = `${claim.canonicalCampaignId}\0${claim.normalizedMobile}`;
    if (existingByKey.has(key)) duplicateRegistryKeys++;
    existingByKey.set(key, claim);
  }
  let claimMismatches = 0;
  let missingClaims = 0;
  const expectedKeys = new Set<string>();
  for (const claim of plan.claims) {
    const key = `${claim.canonicalCampaignId}\0${claim.normalizedMobile}`;
    expectedKeys.add(key);
    const existing = existingByKey.get(key);
    if (!existing) missingClaims++;
    else if (!sameClaim(existing, claim)) claimMismatches++;
  }
  const extraClaims = existingClaims.filter((claim: any) => !expectedKeys.has(`${claim.canonicalCampaignId}\0${claim.normalizedMobile}`)).length;
  let indexStatus: 'present' | 'missing' = 'missing';
  try { indexStatus = claimsCollectionExists ? compareClaimIndex(claimIndexes) : 'missing'; }
  catch { throw new SafeStop('Existing duplicate-claim index definition conflicts with the reviewed schema.'); }
  const state = stateCollectionExists ? await db.collection(STATE_COLLECTION).findOne({ _id: STATE_ID }) : null;
  return {
    plan, campaigns: campaigns.length, claimsCollectionExists, stateCollectionExists, indexStatus,
    leadCollectionExists: collectionNames.has('leads'), campaignCollectionExists: collectionNames.has('campaigns'),
    missingClaims, claimMismatches, duplicateRegistryKeys, extraClaims,
    mappedHistoricalReferenceGroups: manifestMappings.size,
    readinessMarkerCurrentlyReady: state?.ready === true,
  };
}

function approvalDigest(inventory: any, manifestDigest: string, binaryVersion: string, topology: string): string {
  const stable = {
    database: TARGET_DATABASE,
    inventoryDigest: inventory.plan.inventoryDigest,
    counts: inventory.plan.counts,
    campaigns: inventory.campaigns,
    leadCollectionExists: inventory.leadCollectionExists,
    campaignCollectionExists: inventory.campaignCollectionExists,
    claims: inventory.plan.claims.length,
    missingClaims: inventory.missingClaims,
    mappedHistoricalReferenceGroups: inventory.mappedHistoricalReferenceGroups,
    claimMismatches: inventory.claimMismatches,
    duplicateRegistryKeys: inventory.duplicateRegistryKeys,
    extraClaims: inventory.extraClaims,
    claimCollection: inventory.claimsCollectionExists,
    stateCollection: inventory.stateCollectionExists,
    indexStatus: inventory.indexStatus,
    manifestDigest,
    binaryVersion,
    topology,
    claimIndex: { key: CLAIM_INDEX.key, options: CLAIM_INDEX.options },
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

async function main(): Promise<void> {
  const args = parseArgs();
  const uri = args.apply ? process.env.R7_REGISTRY_PREPARE_URI : process.env.PROD_AUDIT_MONGODB_URI;
  if (!uri || uriDatabase(uri) !== TARGET_DATABASE) throw new SafeStop(`Configured MongoDB URI must target exactly ${TARGET_DATABASE}.`);
  const hmacKey = process.env.R7_CAMPAIGN_REFERENCE_HMAC_KEY || '';
  if (Buffer.byteLength(hmacKey, 'utf8') < 32) throw new SafeStop('R7_CAMPAIGN_REFERENCE_HMAC_KEY must contain at least 32 bytes.');
  const { manifest, fileDigest } = await loadManifest(process.env.R7_HISTORICAL_ALIAS_MANIFEST);
  const manifestDigest = manifest ? fileDigest : 'none';
  if (args.apply && manifest && !args.historicalApproved) throw new SafeStop('Historical mappings require --approve-historical-mappings.');
  if (args.apply) assertApplyFence();

  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 8_000, autoIndex: false, autoCreate: false });
  } catch (error) {
    console.error(JSON.stringify({ stage: 'connect', error: safeError(error) }));
    throw new SafeStop('MongoDB connection failed.');
  }
  try {
    const db = mongoose.connection.db;
    if (!db || db.databaseName !== TARGET_DATABASE) throw new SafeStop('Resolved database does not match the approved production database.');
    const roleCheck = await verifyRole(db, args.apply);
    const hello = await db.admin().command({ hello: 1 });
    const buildInfo = await db.admin().command({ buildInfo: 1 });
    const binaryVersion = String(buildInfo.version || 'unknown');
    const topologySupported = Boolean(hello.setName && hello.logicalSessionTimeoutMinutes != null && /^([4-9]|[1-9]\d)\./.test(binaryVersion));
    const topology = topologySupported ? 'replica-set-sessions-supported' : 'transaction-topology-not-verified';
    const inventory = await readInventory(db, hmacKey, manifest);
    const digest = approvalDigest(inventory, manifestDigest, binaryVersion, topology);
    const blockers = [
      ...(inventory.plan.counts.invalidOrMissingMobiles ? ['invalid-or-missing-mobile'] : []),
      ...(!inventory.plan.counts.totalLeads ? ['empty-lead-inventory'] : []),
      ...(!inventory.campaigns ? ['empty-campaign-inventory'] : []),
      ...(inventory.plan.counts.missingCampaignReferences ? ['missing-campaign-reference-cannot-be-mapped'] : []),
      ...(!manifest && inventory.plan.counts.unresolvedReferenceGroups ? ['unmapped-campaign-references'] : []),
      ...(inventory.plan.counts.unresolvedReferenceGroups && !args.historicalApproved && args.apply ? ['historical-mapping-approval-required'] : []),
      ...(inventory.duplicateRegistryKeys ? ['duplicate-registry-claims'] : []),
      ...(inventory.claimMismatches ? ['existing-claim-mismatch'] : []),
      ...(inventory.extraClaims ? ['orphan-registry-claims'] : []),
      ...(inventory.plan.counts.unresolvedReferenceGroups || inventory.plan.claims.length !== inventory.plan.counts.totalLeads - inventory.plan.counts.invalidOrMissingMobiles - inventory.plan.counts.additionalDuplicateRecords ? ['claim-coverage-incomplete'] : []),
      ...(!topologySupported ? ['replica-set-session-capability-unverified'] : []),
    ];
    const report = {
      target: TARGET_DATABASE,
      mode: args.apply ? 'apply' : 'dry-run',
      databaseRoleCheck: roleCheck.status,
      authenticatedRoles: roleCheck.roles,
      mongoBinaryVersion: binaryVersion,
      featureCompatibilityVersion: 'unavailable-unverified (Atlas-managed; not queried or inferred)',
      transactionTopology: topology,
      sourceCollections: { campaigns: inventory.campaignCollectionExists, leads: inventory.leadCollectionExists },
      collectionPlan: {
        create: [!inventory.claimsCollectionExists ? CLAIM_COLLECTION : null, !inventory.stateCollectionExists ? STATE_COLLECTION : null].filter(Boolean),
      },
      claimIndexPlan: { status: inventory.indexStatus, name: CLAIM_INDEX.options.name, key: CLAIM_INDEX.key, options: CLAIM_INDEX.options },
      historical: inventory.plan.counts,
      unresolvedReferenceLabels: inventory.plan.unresolvedLabels,
      claimCoverage: { expected: inventory.plan.claims.length, missing: inventory.missingClaims, mismatches: inventory.claimMismatches, duplicateRegistryKeys: inventory.duplicateRegistryKeys, extraClaims: inventory.extraClaims },
      mappedHistoricalReferenceGroups: inventory.mappedHistoricalReferenceGroups,
      historicalMappingManifestSha256: manifestDigest,
      blockers,
      approvalDigest: digest,
    };
    console.log(JSON.stringify(report, null, 2));
    if (!args.apply) return;
    if (blockers.length) throw new SafeStop('Readiness blockers remain; no registry writes were started.');
    if (!args.approvalDigest || !digestEqual(args.approvalDigest, digest)) throw new SafeStop('Approval digest does not match the current frozen inventory and configuration.');

    // Fence first. Any later failure leaves lead creation disabled by readiness checks.
    if (!inventory.stateCollectionExists) await db.createCollection(STATE_COLLECTION);
    await (db.collection(STATE_COLLECTION) as any).updateOne({ _id: STATE_ID }, { $set: {
      ready: false, version: 1, coverageVerified: false, unidentifiedHistoryCount: inventory.plan.counts.unresolvedReferenceGroups,
      transactionTopologyVerified: false,
      preparationStartedAt: new Date(), inventoryDigest: inventory.plan.inventoryDigest,
    } }, { upsert: true });
    if (!inventory.claimsCollectionExists) await db.createCollection(CLAIM_COLLECTION);
    if (inventory.indexStatus === 'missing') await db.collection(CLAIM_COLLECTION).createIndex(CLAIM_INDEX.key, CLAIM_INDEX.options);

    const writes = inventory.plan.claims.filter(claim => !inventory.claimMismatches && !inventory.duplicateRegistryKeys)
      .map(claim => ({ updateOne: {
        filter: { canonicalCampaignId: claim.canonicalCampaignId, normalizedMobile: claim.normalizedMobile },
        update: { $setOnInsert: claim }, upsert: true,
      } }));
    if (writes.length) {
      const preparedAt = new Date();
      for (const write of writes) {
        const update = (write.updateOne as any).update;
        update.$setOnInsert.createdAt = preparedAt;
        update.$setOnInsert.updatedAt = preparedAt;
      }
      await db.collection(CLAIM_COLLECTION).bulkWrite(writes, { ordered: true });
    }

    const finalInventory = await readInventory(db, hmacKey, manifest);
    if (finalInventory.plan.inventoryDigest !== inventory.plan.inventoryDigest || finalInventory.missingClaims || finalInventory.claimMismatches
      || finalInventory.duplicateRegistryKeys || finalInventory.extraClaims || finalInventory.indexStatus !== 'present') {
      throw new SafeStop('Post-write coverage verification failed; readiness remains false and submissions must stay paused.');
    }
    await (db.collection(STATE_COLLECTION) as any).updateOne({ _id: STATE_ID }, { $set: {
      ready: true, version: 1, coverageVerified: true, unidentifiedHistoryCount: 0, transactionTopologyVerified: topologySupported,
      preparedAt: new Date(), inventoryDigest: inventory.plan.inventoryDigest,
      claimCount: finalInventory.plan.claims.length, duplicateConflictGroups: inventory.plan.counts.duplicateGroups,
      historicalMappingManifestSha256: manifestDigest, indexName: CLAIM_INDEX.options.name,
    } });
    console.log(JSON.stringify({ result: 'registry-prepared-and-verified', target: TARGET_DATABASE, claims: finalInventory.plan.claims.length, index: CLAIM_INDEX.options.name }));
  } finally { await mongoose.disconnect(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof SafeStop ? error.message : JSON.stringify({ stage: 'registry-preparation', error: safeError(error) }));
  process.exitCode = 1;
});
