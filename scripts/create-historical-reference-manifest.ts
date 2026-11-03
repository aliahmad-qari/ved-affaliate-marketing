import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, fchmodSync, fsyncSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import os from 'node:os';
import mongoose from 'mongoose';
import { parse as parseEnv } from 'dotenv';
import { buildHistoricalManifest } from './lib/buildHistoricalManifest.ts';

const DIRECTORY = '/etc/ved';
const OUTPUT = '/etc/ved/historical-references.json';
const COUNTS = { totalLeads: 679, campaigns: 27, unresolvedGroups: 2, unresolvedRecords: 10,
  groupA: { records: 1, approved: 0, paid: 0 }, groupB: { records: 9, approved: 9, paid: 0 } };
const requireSafe = (condition: unknown) => { if (!condition) throw new Error('Private manifest prerequisite failed.'); };
function privateContents(file: string) {
  const stat = lstatSync(file);
  requireSafe(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid?.() && (stat.mode & 0o077) === 0 && stat.size <= 65536);
  return readFileSync(file, 'utf8');
}
function existingUri() {
  if (process.env.AUDIT_MONGODB_URI) return process.env.AUDIT_MONGODB_URI;
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const envFile = '/var/www/ved-affaliate-marketing/.env';
  if (existsSync(envFile)) {
    const uri = parseEnv(privateContents(envFile)).MONGODB_URI;
    if (uri) return uri;
  }
  const configFile = '/etc/ved/r7-release.json';
  if (existsSync(configFile)) return JSON.parse(privateContents(configFile)).mongoUri;
  return undefined;
}
async function main() {
  requireSafe(process.platform === 'linux' && process.stdin.isTTY && process.stderr.isTTY);
  const directory = lstatSync(DIRECTORY);
  requireSafe(directory.isDirectory() && !directory.isSymbolicLink() && realpathSync(DIRECTORY) === DIRECTORY && directory.uid === process.getuid?.() && (directory.mode & 0o077) === 0);
  requireSafe(!existsSync(OUTPUT));
  const uri = existingUri(); requireSafe(typeof uri === 'string' && uri.length > 0);
  const client = new mongoose.mongo.MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect(); const db = client.db();
    const snapshot = async () => {
      const session = client.startSession();
      let data: { campaigns: any[]; leads: any[] } | undefined;
      try {
        await session.withTransaction(async () => {
          const campaigns = await db.collection('campaigns').find({}, { session, projection: { _id: 1, slug: 1 }, maxTimeMS: 15000 }).sort({ _id: 1 }).limit(28).toArray();
          const leads = await db.collection('leads').find({}, { session, projection: { _id: 1, campaignId: 1, clientMobile: 1, partnerId: 1, status: 1 }, maxTimeMS: 15000 }).sort({ _id: 1 }).limit(680).toArray();
          data = { campaigns, leads };
        }, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
      } finally { await session.endSession(); }
      requireSafe(data); return data!;
    };
    const before = await snapshot();
    const reviewer = `${os.userInfo().username} (uid ${process.getuid!()})`;
    const approvalReference = `interactive-isolation-approval:${new Date().toISOString()}`;
    const manifest = await buildHistoricalManifest(before.campaigns, before.leads, reviewer, approvalReference);
    console.log(JSON.stringify(COUNTS));
    const terminal = createInterface({ input: process.stdin, output: process.stderr });
    try {
      const answer = await terminal.question('These identities do not prove participation in any active campaign. Existing approvals/financial records remain unchanged; affected callbacks may require manual reconciliation. If authorized, type exactly: I AM AUTHORIZED AND ACCEPT HISTORICAL ISOLATION\n> ');
      requireSafe(answer === 'I AM AUTHORIZED AND ACCEPT HISTORICAL ISOLATION');
    } finally { terminal.close(); }
    // Refuse drift while the operator was approving; do not refresh expectations silently.
    const after = await snapshot();
    const signature = (value: unknown) => createHash('sha256').update(mongoose.mongo.BSON.EJSON.stringify(value, { relaxed: false })).digest('hex');
    requireSafe(signature(before) === signature(after));
    const bytes = JSON.stringify(manifest, null, 2) + '\n';
    // Exclusive and no-follow: even a late-created file/symlink is never overwritten.
    const fd = openSync(OUTPUT, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { fchmodSync(fd, 0o600); writeFileSync(fd, bytes); fsyncSync(fd); requireSafe((fstatSync(fd).mode & 0o777) === 0o600); }
    finally { closeSync(fd); }
    const parent = openSync(DIRECTORY, constants.O_RDONLY);
    try { fsyncSync(parent); } finally { closeSync(parent); }
    console.log(JSON.stringify({ manifestSha256: createHash('sha256').update(bytes).digest('hex'), ...COUNTS }));
  } finally { await client.close(); }
}
main().catch(() => {
  console.error('Manifest setup stopped. No database writes or existing-manifest overwrite performed. Check private URI, counts, approval and permissions. If a partial file exists, stop for private review.');
  process.exitCode = 1;
});
