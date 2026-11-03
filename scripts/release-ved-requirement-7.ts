import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import mongoose from 'mongoose';
import { parse as parseEnv } from 'dotenv';
import { loadHistoricalManifest } from './lib/historicalReferenceManifest.ts';
import { readInventory } from './lib/campaignMobileInventory.ts';
import { verifyCampaignMobileRegistry } from './lib/verifyCampaignMobileRegistry.ts';
import { databaseToolsVersion, restoreVersionPolicy, stableFcv, verifyRestoreServer } from './lib/restoreVersionCompatibility.ts';

// No app/model imports, shell execution, git push, deploy.sh or automatic rollback.
const PROCESS = 'ved-affiliate-api';
const ROOT = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const CONTROLLED = new Set(['campaignmobileclaims', 'leadDeduplicationState']);
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const requireSafe = (condition: unknown) => { if (!condition) throw new Error('Release prerequisite failed.'); };
const quiet = (program: string, args: string[], cwd = ROOT, env = process.env) => execFileSync(program, args, {
  cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30 * 60 * 1000, maxBuffer: 32 * 1024 * 1024,
}).trim();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function privateFile(file: string) {
  requireSafe(path.isAbsolute(file));
  const target = realpathSync(file), relative = path.relative(ROOT, target);
  requireSafe(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative));
  const stat = statSync(target);
  requireSafe(stat.isFile() && stat.size <= 65536 && (stat.mode & 0o077) === 0 && stat.uid === process.getuid?.());
  return target;
}
function treeDigest(directory: string) {
  const digest = createHash('sha256');
  function walk(dir: string) {
    for (const name of readdirSync(dir).sort()) {
      const file = path.join(dir, name), stat = lstatSync(file);
      requireSafe(!stat.isSymbolicLink());
      if (stat.isDirectory()) walk(file);
      else { requireSafe(stat.isFile()); digest.update(path.relative(directory, file)); digest.update('\0'); digest.update(readFileSync(file)); }
    }
  }
  walk(directory); return digest.digest('hex');
}
function pm2(): any[] {
  // Do not let a dry-run implicitly launch a new PM2 daemon.
  requireSafe(existsSync(path.join(process.env.PM2_HOME || path.join(os.homedir(), '.pm2'), 'rpc.sock')));
  return JSON.parse(quiet('pm2', ['jlist']));
}
function vedProcesses(all: any[]) { return all.filter(p => p.name === PROCESS); }
function processIdentity(p: any) {
  return { id: p.pm_id, name: p.name, cwd: p.pm2_env.pm_cwd, entry: p.pm2_env.pm_exec_path, args: p.pm2_env.args ?? [], mode: p.pm2_env.exec_mode };
}
async function main() {
  requireSafe(process.platform === 'linux');
  const args = process.argv.slice(2), apply = args.includes('--apply');
  requireSafe(args.length === (apply ? 5 : 2) && args[0] === '--config' && (!apply || args[2] === '--apply' && args[3] === '--approve'));
  const configFile = privateFile(args[1]);
  const configBytes = readFileSync(configFile);
  const config = JSON.parse(configBytes.toString());
  requireSafe(config.allVedWritersAreThisProcess === true && config.vendorRetryHandlingApproved === true && config.acceptHistoricalIsolation === true && config.deploymentAutomationFrozen === true);
  const live = realpathSync(config.liveDirectory), release = realpathSync(config.releaseDirectory), backups = realpathSync(config.backupDirectory);
  requireSafe(live === '/var/www/ved-affaliate-marketing' && live !== release && live !== ROOT && release !== live);
  requireSafe(!release.startsWith(live + '/') && !live.startsWith(release + '/') && !backups.startsWith(live + '/') && !backups.startsWith(release + '/'));
  requireSafe(![live, release, ROOT].some(dir => backups === dir || backups.startsWith(dir + '/')));
  requireSafe(!configFile.startsWith(live + '/') && !configFile.startsWith(release + '/'));
  requireSafe((statSync(backups).mode & 0o077) === 0 && statSync(backups).uid === process.getuid?.());
  requireSafe(/^[a-f0-9]{40}$/.test(config.reviewedCommit) && /^[A-Za-z][A-Za-z0-9_-]{0,62}$/.test(config.databaseName));
  requireSafe(/^mongo@sha256:[a-f0-9]{64}$/.test(config.restoreImage));
  requireSafe(hash(readFileSync(path.join(live, 'package-lock.json'))) === hash(readFileSync(path.join(release, 'package-lock.json'))));
  for (const dir of [ROOT, live, release]) requireSafe(quiet('git', ['status', '--porcelain'], dir) === '');
  requireSafe(JSON.parse(readFileSync(path.join(release, 'package.json'), 'utf8')).scripts.start === 'tsx server.ts');
  requireSafe(quiet('git', ['rev-parse', 'HEAD'], release) === config.reviewedCommit);
  // This runner and the release must be reviewed at the same immutable revision.
  requireSafe(quiet('git', ['rev-parse', 'HEAD'], ROOT) === config.reviewedCommit);
  const oldCommit = quiet('git', ['rev-parse', 'HEAD'], live);
  requireSafe(quiet('git', ['cat-file', '-t', config.reviewedCommit], live) === 'commit');
  const tracked = quiet('git', ['ls-tree', '-r', '--name-only', config.reviewedCommit], live).split('\n');
  requireSafe(!tracked.some(f => /(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519)$/.test(f) && f !== '.env.example'));
  requireSafe(existsSync(path.join(release, 'dist/index.html')) && existsSync(path.join(live, 'node_modules/tsx/dist/cli.mjs')));
  requireSafe(statSync(live).dev === statSync(backups).dev);
  const disk = statfsSync(backups);
  requireSafe(disk.bavail * disk.bsize >= 1024 * 1024 * 1024);
  const artifactDigest = treeDigest(path.join(release, 'dist'));
  const approval = loadHistoricalManifest(config.manifestPath, config.manifestSha256);
  requireSafe(approval && !realpathSync(config.manifestPath).startsWith(live + '/') && !realpathSync(config.manifestPath).startsWith(release + '/'));
  const all = pm2(), processes = vedProcesses(all);
  requireSafe(processes.length > 0 && processes.every(p => p.pm2_env.status === 'online' && p.pm2_env.pm_cwd === live));
  const fileEnv = existsSync(path.join(live, '.env')) ? parseEnv(readFileSync(path.join(live, '.env'))) : {};
  for (const p of processes) {
    const e = p.pm2_env, launchArgs = Array.isArray(e.args) ? e.args : [e.args].filter(Boolean);
    const entry = e.pm_exec_path;
    const directEntry = [path.join(live, 'server.ts'), path.join(live, 'server/server.ts')].includes(entry) && launchArgs.length === 0;
    const tsxEntry = entry === path.join(live, 'node_modules/tsx/dist/cli.mjs') && (same(launchArgs, ['server.ts']) || same(launchArgs, [path.join(live, 'server.ts')]));
    const npmEntry = /(?:^|\/)(npm|npm-cli\.js)$/.test(entry) && (same(launchArgs, ['start']) || same(launchArgs, ['run', 'start']));
    requireSafe(directEntry || tsxEntry || npmEntry);
    requireSafe(!e.watch || Array.isArray(e.watch) && e.watch.length === 0);
    requireSafe(!e.cron_restart);
    requireSafe((e.MONGODB_URI ?? fileEnv.MONGODB_URI) === config.mongoUri);
    requireSafe((e.NODE_ENV ?? fileEnv.NODE_ENV) === 'production');
  }
  for (const tool of ['mongodump', 'mongorestore', 'mongosh', 'docker']) quiet(tool, ['--version']);
  const dumpToolVersion = databaseToolsVersion(quiet('mongodump', ['--version']), 'mongodump');
  const image = JSON.parse(quiet('docker', ['image', 'inspect', config.restoreImage]))[0];
  const imageVersion = image.Config.Env.find((s: string) => s.startsWith('MONGO_VERSION='))?.split('=')[1];
  requireSafe(imageVersion && os.freemem() > 1536 * 1024 * 1024);
  const client = new mongoose.mongo.MongoClient(config.mongoUri, { maxPoolSize: 2, serverSelectionTimeoutMS: 5000 });
  let fenced = false, switched = false, container: string | undefined, runDir: string | undefined;
  try {
    await client.connect(); const db = client.db(); requireSafe(db.databaseName === config.databaseName);
    const metadata = await db.listCollections().toArray();
    requireSafe(metadata.length > 0 && metadata.every(c => c.type === 'collection' && !c.name.startsWith('system.')));
    // Bound restore size to the existing isolated tmpfs limits BEFORE pausing VED.
    const sizes = await db.command({ dbStats: 1, scale: 1 });
    const estimatedBytes = Number(sizes.dataSize) + Number(sizes.indexSize);
    requireSafe(Number.isFinite(estimatedBytes) && estimatedBytes >= 0 && estimatedBytes <= 128 * 1024 * 1024);
    const hello = await db.admin().command({ hello: 1 }); requireSafe(hello.setName || hello.msg === 'isdbgrid');
    const productionMetadata = async () => {
      const build = await db.admin().command({ buildInfo: 1 });
      const parameter = await db.admin().command({ getParameter: 1, featureCompatibilityVersion: 1 });
      return { version: build.version as string, fcv: stableFcv(parameter.featureCompatibilityVersion) };
    };
    const production = await productionMetadata();
    const compatibility = restoreVersionPolicy(production.version, imageVersion, production.fcv, config.restoreImage, config.restoreCompatibilityApproval);
    // Require transaction execution, not only a topology indication. Read-only probe.
    const probe = client.startSession();
    try { await probe.withTransaction(async () => { await db.collection('leads').findOne({}, { session: probe, projection: { _id: 1 } }); }, { readConcern: { level: 'snapshot' } }); }
    finally { await probe.endSession(); }
    const inventory = await readInventory(db, approval!.manifest);
    requireSafe(!inventory.summary.unresolvedCampaign && !inventory.summary.invalidOrMissingMobile && inventory.summary.validRecords === inventory.summary.totalLeads);
    requireSafe(!(await db.collection('leadDeduplicationState').findOne({ _id: 'campaign-mobile-v1' as any }))?.ready);
    // Verify cluster-monitor permission before a maintenance window.
    const activity = async () => client.db('admin').aggregate([
      { $currentOp: { allUsers: true, idleConnections: false } },
      { $match: { active: true, $or: [{ ns: { $regex: `^${config.databaseName.replace(/[-]/g, '\\-')}\\.` } }, { 'command.$db': config.databaseName }] } },
      { $count: 'count' },
    ]).toArray();
    await activity();
    const plan = { configDigest: hash(configBytes), reviewedCommit: config.reviewedCommit, previousCommit: oldCommit,
      manifestDigest: approval!.digest, artifactDigest, processes: processes.map(processIdentity), inventory: inventory.summary, restoreImageId: image.Id,
      compatibility, requiredDatabaseToolsVersion: dumpToolVersion };
    const planDigest = hash(JSON.stringify(plan));
    console.log(JSON.stringify({ mode: apply ? 'APPROVED_RELEASE' : 'READ_ONLY_DRY_RUN', process: PROCESS, reviewedCommit: config.reviewedCommit,
      totalLeads: inventory.summary.totalLeads, isolatedHistoricalRecords: inventory.summary.isolatedHistoricalRecords,
      backupRestore: 'Dedicated network-disabled MongoDB container; full data/index/options comparison',
      compatibility, requiredDatabaseToolsVersion: dumpToolVersion,
      pauseScope: 'Entire VED process only; no route-only gate exists', approvalDigest: planDigest }, null, 2));
    if (!apply) return;
    requireSafe(args[4] === planDigest);
    process.umask(0o077);
    const lock = path.resolve(live, quiet('git', ['rev-parse', '--git-path', 'ved-r7-release.lock'], live));
    mkdirSync(lock, { mode: 0o700 }); // Exclusive; retained on success/failure for explicit operator acknowledgement.
    runDir = path.join(backups, `ved-r7-${Date.now()}-${randomUUID()}`); mkdirSync(runDir, { mode: 0o700 });
    const journal = (phase: string) => {
      writeFileSync(path.join(runDir!, 'release-state.json'), JSON.stringify({ phase, reviewedCommit: config.reviewedCommit, previousCommit: oldCommit, planDigest, switched, fenced }, null, 2), { mode: 0o600 });
      console.log(`VED release phase: ${phase}`);
    };
    journal('APPROVAL_ACCEPTED');
    fenced = true; quiet('pm2', ['stop', PROCESS]);
    requireSafe(vedProcesses(pm2()).every(p => p.pm2_env.status === 'stopped'));
    requireSafe((await activity()).length === 0); journal('VED_WRITERS_STOPPED');
    const frozen = await readInventory(db, approval!.manifest); requireSafe(same(frozen.summary, inventory.summary));
    const fingerprintEnv = { ...process.env, VED_FINGERPRINT_URI: config.mongoUri, VED_FINGERPRINT_DB: config.databaseName };
    const fpScript = path.join(ROOT, 'scripts/ved-release-fingerprint.cjs');
    const fingerprint = () => JSON.parse(quiet('mongosh', ['--nodb', '--quiet', '--file', fpScript], ROOT, fingerprintEnv));
    const baseline = fingerprint();
    writeFileSync(path.join(runDir, 'baseline.json'), JSON.stringify(baseline), { mode: 0o600 });
    const mongoConfig = path.join(runDir, 'mongo-tools.yaml');
    // JSON is a YAML subset. URI is never passed on the command line or printed.
    writeFileSync(mongoConfig, JSON.stringify({ uri: config.mongoUri }), { mode: 0o600 });
    const archive = path.join(runDir, 'ved.archive.gz');
    quiet('mongodump', ['--config', mongoConfig, '--db', config.databaseName, `--archive=${archive}`, '--gzip']);
    requireSafe(statSync(archive).size > 0 && statSync(archive).size <= 128 * 1024 * 1024);
    requireSafe(same(baseline, fingerprint()));
    const archiveDigest = hash(readFileSync(archive));
    writeFileSync(path.join(runDir, 'archive.sha256'), archiveDigest + '\n', { mode: 0o600 });
    container = `ved-r7-restore-${randomUUID()}`;
    quiet('docker', ['run', '-d', '--name', container, '--network', 'none', '--memory', '1g', '--cpus', '1', '--pids-limit', '128',
      '--read-only', '--tmpfs', '/data/db:rw,size=512m', '--tmpfs', '/data/configdb:rw,size=32m', '--tmpfs', '/tmp:rw,size=256m',
      config.restoreImage, '--bind_ip', '127.0.0.1']);
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { quiet('docker', ['exec', container, 'mongosh', '--quiet', '--eval', 'quit(db.adminCommand({ping:1}).ok ? 0 : 1)']); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
    }
    requireSafe(ready);
    const verifierMetadata = () => JSON.parse(quiet('docker', ['exec', container!, 'mongosh', '--quiet', '--eval',
      'const b=db.adminCommand({buildInfo:1}); const f=db.adminCommand({getParameter:1,featureCompatibilityVersion:1}); if(b.ok!==1||f.ok!==1)quit(2); print(JSON.stringify({version:b.version,fcv:f.featureCompatibilityVersion}));']));
    const actualVerifier = verifierMetadata();
    verifyRestoreServer(compatibility, actualVerifier.version, actualVerifier.fcv);
    const restoreToolVersion = databaseToolsVersion(quiet('docker', ['exec', container, 'mongorestore', '--version']), 'mongorestore');
    requireSafe(restoreToolVersion === dumpToolVersion);
    quiet('docker', ['cp', archive, `${container}:/tmp/ved.archive.gz`]);
    quiet('docker', ['cp', fpScript, `${container}:/tmp/fingerprint.cjs`]);
    quiet('docker', ['exec', container, 'mongorestore', '--archive=/tmp/ved.archive.gz', '--gzip', `--nsInclude=${config.databaseName}.*`]);
    const restored = JSON.parse(quiet('docker', ['exec', '-e', `VED_FINGERPRINT_DB=${config.databaseName}`, container, 'mongosh', '--nodb', '--quiet', '--file', '/tmp/fingerprint.cjs']));
    requireSafe(hash(readFileSync(archive)) === archiveDigest && same(baseline, restored));
    const restoredMetadata = verifierMetadata();
    verifyRestoreServer(compatibility, restoredMetadata.version, restoredMetadata.fcv);
    requireSafe(same(production, await productionMetadata()));
    writeFileSync(path.join(runDir, 'restore-verified.json'), JSON.stringify({ archiveDigest, verified: true, collections: restored.length,
      compatibility, actualVerifierVersion: restoredMetadata.version, actualVerifierFcv: stableFcv(restoredMetadata.fcv), dumpToolVersion, restoreToolVersion }), { mode: 0o600 });
    quiet('docker', ['stop', container]); // Only the newly created isolated verifier; retain it for private recovery inspection.
    requireSafe((await activity()).length === 0 && same(baseline, fingerprint())); journal('BACKUP_RESTORE_VERIFIED');
    quiet(process.execPath, ['--import', 'tsx', 'scripts/prepare-campaign-mobile-registry.ts', '--apply', '--writers-paused'], ROOT, {
      ...process.env, MIGRATION_MONGODB_URI: config.mongoUri, CONFIRM_DEDUPLICATION_MIGRATION: 'YES',
      HISTORICAL_REFERENCE_MANIFEST: config.manifestPath, APPROVED_HISTORICAL_MANIFEST_SHA256: config.manifestSha256,
    });
    const after = await readInventory(db, approval!.manifest);
    await verifyCampaignMobileRegistry(db.collection('campaignmobileclaims'), after.claims, after.summary.totalLeads);
    const state = await db.collection('leadDeduplicationState').findOne({ _id: 'campaign-mobile-v1' as any });
    requireSafe(state?.ready && state.coverageVerified && state.historicalManifestDigest === approval!.digest && state.coveredLeadCount === after.summary.totalLeads);
    const sourceOnly = (rows: any[]) => rows.filter(row => !CONTROLLED.has(row.name));
    requireSafe(same(sourceOnly(baseline), sourceOnly(fingerprint()))); journal('REGISTRY_VERIFIED');
    requireSafe(quiet('git', ['status', '--porcelain'], live) === '' && treeDigest(path.join(release, 'dist')) === artifactDigest);
    // Deploy only the approved Git object; never pull main or execute an existing deploy script.
    quiet('git', ['-c', 'core.hooksPath=/dev/null', 'checkout', '--detach', config.reviewedCommit], live); switched = true;
    if (existsSync(path.join(live, 'dist'))) renameSync(path.join(live, 'dist'), path.join(runDir, 'previous-dist'));
    cpSync(path.join(release, 'dist'), path.join(live, 'dist'), { recursive: true, errorOnExist: true, force: false });
    requireSafe(treeDigest(path.join(live, 'dist')) === artifactDigest);
    journal('APPROVED_RELEASE_INSTALLED');
    // Environment, node_modules, .env, uploads and all source database records are retained.
    quiet('pm2', ['restart', PROCESS]);
    const port = Number(processes[0].pm2_env.PORT ?? fileEnv.PORT ?? 3001);
    requireSafe(Number.isInteger(port) && port > 0 && port <= 65535);
    let healthy = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000), redirect: 'error' });
        const health = await response.json() as any;
        if (response.ok && health.success === true && health.service === 'VED AFFILIATE PVT. LIMITED API' && health.database?.isConnected === true) { healthy = true; break; }
      } catch { /* Do not log health payloads or endpoints with secrets. */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    requireSafe(healthy);
    requireSafe(vedProcesses(pm2()).length === processes.length && vedProcesses(pm2()).every(p => p.pm2_env.status === 'online'));
    const unrelatedBefore = all.filter(p => p.name !== PROCESS).map(p => ({ id: p.pm_id, status: p.pm2_env.status }));
    requireSafe(same(unrelatedBefore, pm2().filter(p => p.name !== PROCESS).map(p => ({ id: p.pm_id, status: p.pm2_env.status }))));
    journal('RELEASE_STARTED');
    console.log('Release started after verified backup restoration and registry readiness. Only VED was restarted. Perform client acceptance; retain backup and release journal.');
  } catch {
    if (fenced) {
      try { quiet('pm2', ['stop', PROCESS]); } catch { /* Never reopen; operator must confirm stop if PM2 is unavailable. */ }
      if (container) try { quiet('docker', ['stop', container]); } catch { /* Retain isolated verifier for investigation. */ }
      if (runDir) writeFileSync(path.join(runDir, 'FAILED'), 'STOP: VED writers must remain fenced. Review private release-state.json and restore proof. No automatic rollback/reopen.\n', { mode: 0o600 });
    }
    throw new Error('Release stopped. No automatic rollback or reopening; inspect private release state.');
  } finally { await client.close(); }
}
main().catch(() => { console.error('VED release stopped safely. No raw subprocess/database errors or secrets are printed. If approval was applied, verify VED remains stopped; inspect the private backup journal.'); process.exitCode = 1; });
