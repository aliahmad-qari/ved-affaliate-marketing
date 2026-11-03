import { createHash } from 'node:crypto';

const MESSAGES = {
  ARGUMENTS: 'Use --config FILE, or --config FILE --apply --approve followed by the exact 64-character dry-run digest.',
  APPROVAL: 'Approval digest does not match this reviewed release plan. No release operation is authorized.',
  MAINTENANCE_APPROVAL: 'Already-stopped mode requires documented maintenance approval, confirmed Nginx maintenance and port 4004.',
  PM2_IDENTITY: 'VED process identity, working directory or initial state is unexpected. Inspect only redacted PM2 metadata.',
  UNEXPECTED_WRITER: 'An additional VED process or active database operation was detected. Keep maintenance active and investigate privately.',
  LISTENER: 'The VED API port is still listening or socket inspection could not complete. Do not proceed.',
  GIT_CLEANLINESS: 'Tracked changes, unexpected untracked files or unsafe operational paths were detected. Only regular non-symlink live deploy.sh and ecosystem.config.cjs may be untracked; runner/release checkouts must remain clean.',
} as const;
export class ReleasePreflightError extends Error {
  constructor(public code: keyof typeof MESSAGES) { super(MESSAGES[code]); }
}
export const failPreflight = (code: keyof typeof MESSAGES): never => { throw new ReleasePreflightError(code); };
const STAGES: Record<string, string> = {
  PLATFORM: 'This command requires Linux. Run it from the separate reviewed Contabo release checkout.',
  PRIVATE_CONFIG: 'Verify the owner-only private configuration and existing approval fields; never print their values.',
  RELEASE_PATHS: 'Verify the separate live, release and owner-only backup paths.',
  LOCKFILE_MATCH: 'Live and reviewed lockfile bytes must match. Do not install dependencies or bypass this gate.',
  REVIEWED_GIT_OBJECTS: 'Verify clean checkouts, reviewed HEAD and availability of that exact Git object in the live repository.',
  ARTIFACT_AND_CAPACITY: 'Verify the prebuilt reviewed dist, matching filesystem and required free space.',
  HISTORICAL_MANIFEST: 'Verify the private approved manifest, digest and external file permissions.',
  PM2_IDENTITY_AND_MAINTENANCE: 'Verify the expected PM2 daemon, VED launch environment, initial state and approved maintenance configuration.',
  TOOLS_AND_IMAGE: 'Verify required tools, approved local image and memory capacity.',
  PRODUCTION_DATABASE_AND_CAPACITY: 'Verify the database matches the live VED connection, collection types and restore-size limit.',
  MONGODB_VERSION_AND_FCV: 'Verify actual versions, stable FCV and any exact approved compatibility exception.',
  TRANSACTION_PROBE: 'The read-only transaction probe must succeed.',
  INVENTORY_AND_READINESS: 'Verify approved historical groups, complete inventory and that the registry is not already activated.',
  VED_DATABASE_ACTIVITY: 'Verify current-operation visibility and absence of VED activity during stopped maintenance.',
};
export function safeFailure(error: unknown, stage: string) {
  return error instanceof ReleasePreflightError ? `[${error.code}] ${MESSAGES[error.code]}` : `[${stage}] ${STAGES[stage] ?? 'Check this release phase in the private journal; raw error details are suppressed.'}`;
}
export function parseReleaseArguments(args: string[]) {
  if (args[0] !== '--config' || !args[1] || ![2, 5].includes(args.length)) return failPreflight('ARGUMENTS');
  if (args.length === 2) return { configFile: args[1], apply: false, approvedDigest: undefined };
  if (args[2] !== '--apply' || args[3] !== '--approve' || !/^[a-f\d]{64}$/.test(args[4])) return failPreflight('ARGUMENTS');
  return { configFile: args[1], apply: true, approvedDigest: args[4] };
}
export function releaseApprovalDigest(plan: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}
export function releaseIsApproved(args: ReturnType<typeof parseReleaseArguments>, actualDigest: string) {
  if (!args.apply) return false;
  if (args.approvedDigest !== actualDigest) return failPreflight('APPROVAL');
  return true;
}
export function processIdentity(p: any) {
  return { id: p.pm_id, name: p.name, cwd: p.pm2_env.pm_cwd, entry: p.pm2_env.pm_exec_path, args: p.pm2_env.args ?? [], mode: p.pm2_env.exec_mode };
}
export function inspectVedProcesses(all: any[], live: string, uri: string, state: 'online' | 'stopped') {
  const ved = all.filter(p => p.name === 'ved-affiliate-api');
  if (!ved.length || new Set(ved.map(p => p.pm_id)).size !== ved.length || ved.some(p =>
    !Number.isInteger(p.pm_id) || p.pm2_env?.pm_cwd !== live || p.pm2_env.status !== state ||
    (state === 'stopped' && p.pid !== 0))) return failPreflight('PM2_IDENTITY');
  if (all.some(p => p.name !== 'ved-affiliate-api' && (
    p.pm2_env?.pm_cwd === live || p.pm2_env?.pm_exec_path?.startsWith(live + '/') ||
    p.pm2_env?.MONGODB_URI === uri || /^ved-affiliate(?:-|$)/i.test(p.name ?? '')
  ))) return failPreflight('UNEXPECTED_WRITER');
  return ved;
}
export function initialVedMode(config: any, port: number): 'online' | 'stopped' {
  if (config.initialVedState === undefined || config.initialVedState === 'online') return 'online';
  const approval = config.maintenanceApproval;
  if (config.initialVedState !== 'stopped-maintenance' || approval?.approved !== true ||
    typeof approval.reference !== 'string' || !approval.reference.trim() || approval.nginxMaintenanceConfirmed !== true ||
    approval.apiPort !== 4004 || port !== 4004) return failPreflight('MAINTENANCE_APPROVAL');
  return 'stopped';
}
export async function assertVedQuiet(checkPort: () => Promise<void>, activeOperations: () => Promise<number>) {
  await checkPort();
  if (await activeOperations() !== 0) failPreflight('UNEXPECTED_WRITER');
}
export async function fenceVedWriters(options: {
  initialState: 'online' | 'stopped'; expectedIdentities: any[]; live: string; uri: string;
  readProcesses: () => any[]; stopVed: () => void; checkPort: () => Promise<void>; activeOperations: () => Promise<number>;
}) {
  // Revalidate identity/state immediately before any stop, not just in the earlier dry run.
  const before = inspectVedProcesses(options.readProcesses(), options.live, options.uri, options.initialState);
  if (JSON.stringify(before.map(processIdentity)) !== JSON.stringify(options.expectedIdentities)) failPreflight('PM2_IDENTITY');
  if (options.initialState === 'online') options.stopVed();
  const stopped = inspectVedProcesses(options.readProcesses(), options.live, options.uri, 'stopped');
  if (JSON.stringify(stopped.map(processIdentity)) !== JSON.stringify(options.expectedIdentities)) failPreflight('PM2_IDENTITY');
  await assertVedQuiet(options.checkPort, options.activeOperations);
}
