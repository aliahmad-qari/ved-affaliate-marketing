import mongoose from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CLAIM_COLLECTION, CLAIM_INDEX, STATE_COLLECTION, STATE_ID, compareClaimIndex } from './lib/campaignMobileRegistryPlan.ts';
import { buildForwardOnlyReadinessMarker, isForwardOnlyRegistryReady } from '../server/services/forwardOnlyCampaignMobileRegistry.ts';

const TARGET_DATABASE = 'VedAffiliatemarket';
const LIVE_APP_DIRECTORY = '/var/www/ved-affaliate-marketing';
const API_PROCESS_NAME = 'ved-affiliate-api';
const API_PORT = 4004;
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), '..');

class SafeStop extends Error {}
class AbortTransactionProbe extends Error {}

function safeError(error: unknown): { name: string; code?: number | string } {
  const value = error as { name?: string; code?: number | string };
  return { name: value?.name || 'Error', ...(value?.code !== undefined ? { code: value.code } : {}) };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const digestArg = args.find(arg => arg.startsWith('--approval-digest='));
  const allowed = new Set(['--dry-run', '--apply', '--confirm-target=VedAffiliatemarket', '--maintenance-approved', '--writers-fenced', '--approve-forward-only']);
  for (const arg of args) if (!allowed.has(arg) && arg !== digestArg) throw new SafeStop('Unsupported command-line option.');
  const apply = args.includes('--apply');
  if (apply === args.includes('--dry-run')) throw new SafeStop('Choose exactly one of --dry-run or --apply.');
  const approvalDigest = digestArg?.slice('--approval-digest='.length);
  if (approvalDigest && !/^[a-f0-9]{64}$/i.test(approvalDigest)) throw new SafeStop('Approval digest format is invalid.');
  if (apply && (!approvalDigest || !args.includes('--confirm-target=VedAffiliatemarket')
    || !args.includes('--maintenance-approved') || !args.includes('--writers-fenced') || !args.includes('--approve-forward-only'))) {
    throw new SafeStop('Apply requires the dry-run digest, target confirmation, maintenance and writer-fence acknowledgements, and forward-only approval.');
  }
  return { apply, approvalDigest };
}

function uriDatabase(uri: string): string {
  try { return decodeURIComponent(new URL(uri).pathname.replace(/^\//, '')); }
  catch { throw new SafeStop('Configured MongoDB URI is invalid.'); }
}

function equalDigest(left: string, right: string): boolean {
  return left.length === right.length && createHash('sha256').update(left).digest('hex') === createHash('sha256').update(right).digest('hex');
}

function gitRevision(): string {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { throw new SafeStop('Could not identify the reviewed release revision.'); }
}

function assertWritersFenced(): void {
  if (process.platform !== 'linux') throw new SafeStop('Apply is permitted only on the approved Contabo Linux host.');
  let processes: any[];
  try { processes = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); }
  catch { throw new SafeStop('Could not verify the VED PM2 maintenance state.'); }
  const expected = processes.filter(process => process.name === API_PROCESS_NAME);
  if (expected.length !== 1 || expected[0]?.pm2_env?.status !== 'stopped' || expected[0]?.pm2_env?.pm_cwd !== LIVE_APP_DIRECTORY) {
    throw new SafeStop('The expected VED API process is not uniquely present, stopped, and rooted in the approved live directory.');
  }
  if (processes.some(process => process.pm2_env?.status === 'online' && process.pm2_env?.pm_cwd === LIVE_APP_DIRECTORY)) {
    throw new SafeStop('An online PM2 process still uses the VED live directory.');
  }
  let listeners = '';
  try { listeners = execFileSync('ss', ['-ltnH', 'sport', '=', `:${API_PORT}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { throw new SafeStop('Could not verify that the VED API listener is stopped.'); }
  if (listeners.trim()) throw new SafeStop('A process is still listening on the VED API port.');
  if (process.env.R7_WRITERS_FENCED !== 'YES') throw new SafeStop('Set R7_WRITERS_FENCED=YES only after confirming VED webhook and manual lead writers are paused.');
}

async function verifyRoles(db: any, apply: boolean): Promise<string> {
  try {
    const result = await db.admin().command({ connectionStatus: 1, showPrivileges: false });
    const roles = (result.authInfo?.authenticatedUserRoles || []) as Array<{ role: string; db: string }>;
    if (!roles.length || roles.some(role => role.db !== TARGET_DATABASE)) throw new SafeStop('Authenticated database roles are unavailable or not target-scoped.');
    if (apply && (!roles.some(role => role.role === 'readWrite') || !roles.some(role => ['dbAdmin', 'dbOwner'].includes(role.role)))) {
      throw new SafeStop('Apply requires target-database readWrite and database-administration roles.');
    }
    return 'verified-target-only';
  } catch (error) {
    if (error instanceof SafeStop) throw error;
    if (apply) throw new SafeStop('Could not verify apply credential database-scoped roles.');
    return 'unavailable-read-only-role-metadata';
  }
}

async function transactionRollbackProbe(db: any): Promise<void> {
  const session = await mongoose.startSession();
  const probeId = `__r7-forward-probe-${randomUUID()}`;
  try {
    try {
      await session.withTransaction(async () => {
        await db.collection(CLAIM_COLLECTION).insertOne({
          canonicalCampaignId: probeId, normalizedMobile: '9999999999', state: 'CLAIMED', historicalCount: 1,
        }, { session });
        throw new AbortTransactionProbe('expected rollback');
      });
    } catch (error) {
      if (!(error instanceof AbortTransactionProbe)) throw error;
    }
    const persisted = await db.collection(CLAIM_COLLECTION).findOne({ canonicalCampaignId: probeId });
    if (persisted) throw new SafeStop('The transaction rollback probe left a registry record.');
  } finally { await session.endSession(); }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const uri = args.apply ? process.env.R7_REGISTRY_PREPARE_URI : process.env.PROD_AUDIT_MONGODB_URI;
  if (!uri || uriDatabase(uri) !== TARGET_DATABASE) throw new SafeStop(`Configured MongoDB URI must target exactly ${TARGET_DATABASE}.`);
  if (args.apply) assertWritersFenced();

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
    if (!db || db.databaseName !== TARGET_DATABASE) throw new SafeStop('Resolved database does not match the approved target.');
    const roleStatus = await verifyRoles(db, args.apply);
    const hello = await db.admin().command({ hello: 1 });
    const build = await db.admin().command({ buildInfo: 1 });
    const transactionTopology = Boolean(hello.setName && hello.logicalSessionTimeoutMinutes != null && /^([4-9]|[1-9]\d)\./.test(String(build.version || '')));
    const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((row: any) => row.name));
    if (!names.has('campaigns') || !names.has('leads')) throw new SafeStop('Required application collections are not present.');

    const claimCollectionExists = names.has(CLAIM_COLLECTION);
    const stateCollectionExists = names.has(STATE_COLLECTION);
    const claimCollection = db.collection(CLAIM_COLLECTION);
    const claimCount = claimCollectionExists ? await claimCollection.countDocuments({}) : 0;
    const indexes = claimCollectionExists ? await claimCollection.listIndexes().toArray() : [];
    let indexStatus: 'present' | 'missing' = 'missing';
    if (claimCollectionExists) {
      try { indexStatus = compareClaimIndex(indexes); }
      catch { throw new SafeStop('Existing registry index conflicts with the approved unique index.'); }
    }
    const stateCollection: any = db.collection(STATE_COLLECTION);
    const state = stateCollectionExists ? await stateCollection.findOne({ _id: STATE_ID }) : null;
    const alreadyForwardReady = isForwardOnlyRegistryReady(state) && indexStatus === 'present';
    const historicalReady = state?.ready === true && state.version === 1 && state.coverageVerified === true && state.unidentifiedHistoryCount === 0;
    const blockers = [
      ...(!transactionTopology ? ['replica-set-transaction-topology-not-verified'] : []),
      ...(claimCount && !alreadyForwardReady ? ['existing-registry-claims-require-separate-review'] : []),
      ...(state && !alreadyForwardReady && !historicalReady ? ['existing-readiness-marker-requires-separate-review'] : []),
      ...(historicalReady ? ['historical-coverage-mode-already-prepared-use-existing-readiness'] : []),
    ];
    const revision = gitRevision();
    const scriptSha256 = createHash('sha256').update(await readFile(SCRIPT_PATH)).digest('hex');
    const digestInputs = {
      database: TARGET_DATABASE, revision, scriptSha256, binaryVersion: String(build.version || 'unknown'),
      transactionTopology, claimCollectionExists, claimCount, stateCollectionExists,
      stateMode: state?.mode || (historicalReady ? 'historical-covered' : 'none'),
      readiness: Boolean(state?.ready), indexStatus, claimIndex: { key: CLAIM_INDEX.key, options: CLAIM_INDEX.options },
    };
    const approvalDigest = createHash('sha256').update(JSON.stringify(digestInputs)).digest('hex');
    const report = {
      target: TARGET_DATABASE, mode: args.apply ? 'apply' : 'dry-run', databaseRoleCheck: roleStatus,
      mongoBinaryVersion: String(build.version || 'unknown'), transactionTopology: transactionTopology ? 'replica-set-sessions-supported' : 'unverified',
      historicalLeadsImported: false, historicalCoverage: 'not-imported; this registry only arbitrates claims created after activation',
      claims: { collectionPresent: claimCollectionExists, documentCount: claimCount },
      readinessCollectionPresent: stateCollectionExists, readinessMode: state?.mode || null,
      index: { status: indexStatus, name: CLAIM_INDEX.options.name, key: CLAIM_INDEX.key, options: CLAIM_INDEX.options },
      createCollections: alreadyForwardReady ? [] : [!claimCollectionExists ? CLAIM_COLLECTION : null, !stateCollectionExists ? STATE_COLLECTION : null].filter(Boolean),
      blockers, approvalDigest,
    };
    console.log(JSON.stringify(report, null, 2));
    if (!args.apply) return;
    if (blockers.length) throw new SafeStop('Forward-only registry preparation is blocked; no readiness marker was written.');
    if (!args.approvalDigest || !equalDigest(args.approvalDigest, approvalDigest)) throw new SafeStop('Approval digest does not match this database and reviewed artifact.');
    if (alreadyForwardReady) {
      console.log(JSON.stringify({ result: 'already-prepared-forward-only', target: TARGET_DATABASE }));
      return;
    }

    if (!claimCollectionExists) await db.createCollection(CLAIM_COLLECTION);
    if (!stateCollectionExists) await db.createCollection(STATE_COLLECTION);
    if (indexStatus === 'missing') await db.collection(CLAIM_COLLECTION).createIndex(CLAIM_INDEX.key, CLAIM_INDEX.options);
    const verifiedIndexes = await db.collection(CLAIM_COLLECTION).listIndexes().toArray();
    if (compareClaimIndex(verifiedIndexes) !== 'present') throw new SafeStop('The full unique registry index did not verify.');
    await transactionRollbackProbe(db);
    const marker = buildForwardOnlyReadinessMarker(new Date());
    await stateCollection.insertOne(marker);
    const stored = await stateCollection.findOne({ _id: STATE_ID });
    if (!isForwardOnlyRegistryReady(stored)) throw new SafeStop('Forward-only readiness marker verification failed. Keep enforcement disabled.');
    console.log(JSON.stringify({ result: 'forward-only-registry-prepared', target: TARGET_DATABASE, historicalCoverage: 'not-imported', uniqueIndex: CLAIM_INDEX.options.name }));
  } finally { await mongoose.disconnect(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof SafeStop ? error.message : JSON.stringify({ stage: 'forward-only-registry-preparation', error: safeError(error) }));
  process.exitCode = 1;
});
