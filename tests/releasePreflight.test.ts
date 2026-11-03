import assert from 'node:assert/strict';
import test from 'node:test';
import { assertVedQuiet, fenceVedWriters, initialVedMode, inspectVedProcesses, parseReleaseArguments, processIdentity, releaseApprovalDigest, releaseIsApproved, safeFailure } from '../scripts/lib/releasePreflight.ts';
const live = '/var/www/ved-affaliate-marketing';
const uri = 'private-test-uri-never-log';
const processRow = (status: string) => ({ name: 'ved-affiliate-api', pm_id: 3, pid: status === 'stopped' ? 0 : 123,
  pm2_env: { pm_cwd: live, pm_exec_path: live + '/server.ts', args: [], exec_mode: 'fork_mode', status, MONGODB_URI: uri } });
const unrelated = { name: 'another-project', pm_id: 9, pid: 456, pm2_env: { pm_cwd: '/var/www/another-project', pm_exec_path: '/var/www/another-project/server.js', status: 'online' } };
const maintenance = { initialVedState: 'stopped-maintenance', maintenanceApproval: { approved: true, reference: 'TEST-APPROVAL', nginxMaintenanceConfirmed: true, apiPort: 4004 } };

test('online mode retains controlled VED-only stop and preserves unrelated PM2 process', async () => {
  const ved = processRow('online'); const all = [ved, unrelated]; const before = JSON.stringify(unrelated);
  assert.equal(initialVedMode({}, 4004), 'online');
  const expectedIdentities = inspectVedProcesses(all, live, uri, 'online').map(processIdentity);
  let stops = 0, ports = 0;
  await fenceVedWriters({ initialState: 'online', expectedIdentities, live, uri, readProcesses: () => all,
    stopVed: () => { stops++; ved.pid = 0; ved.pm2_env.status = 'stopped'; },
    checkPort: async () => { ports++; }, activeOperations: async () => 0 });
  assert.equal(stops, 1); assert.equal(ports, 1); assert.equal(JSON.stringify(unrelated), before);
});

test('already-stopped maintenance requires explicit approval and does not invoke stop/start/restart', async () => {
  const all = [processRow('stopped'), unrelated];
  assert.equal(initialVedMode(maintenance, 4004), 'stopped');
  let stops = 0, checks = 0;
  await fenceVedWriters({ initialState: 'stopped', expectedIdentities: inspectVedProcesses(all, live, uri, 'stopped').map(processIdentity),
    live, uri, readProcesses: () => all, stopVed: () => { stops++; }, checkPort: async () => { checks++; }, activeOperations: async () => 0 });
  assert.equal(stops, 0); assert.equal(checks, 1);
  assert.throws(() => initialVedMode({ initialVedState: 'stopped-maintenance' }, 4004));
  assert.throws(() => initialVedMode(maintenance, 3001));
  assert.throws(() => initialVedMode({ ...maintenance, maintenanceApproval: { ...maintenance.maintenanceApproval, approved: false } }, 4004));
  assert.throws(() => initialVedMode({ ...maintenance, maintenanceApproval: { ...maintenance.maintenanceApproval, nginxMaintenanceConfirmed: false } }, 4004));
  assert.throws(() => inspectVedProcesses(all, live, uri, 'online'));
});

test('unexpected identities, extra writers, active operations and listeners fail closed', async () => {
  assert.throws(() => inspectVedProcesses([], live, uri, 'stopped'));
  assert.throws(() => inspectVedProcesses([{ ...processRow('stopped'), pid: 123 }], live, uri, 'stopped'));
  const wrong = processRow('stopped'); wrong.pm2_env.pm_cwd = '/unexpected';
  assert.throws(() => inspectVedProcesses([wrong], live, uri, 'stopped'));
  assert.throws(() => inspectVedProcesses([processRow('stopped'), { ...unrelated, name: 'ved-affiliate-worker' }], live, uri, 'stopped'));
  assert.throws(() => inspectVedProcesses([processRow('stopped'), { ...unrelated, pm2_env: { ...unrelated.pm2_env, pm_cwd: live } }], live, uri, 'stopped'));
  await assert.rejects(assertVedQuiet(async () => {}, async () => 1));
  await assert.rejects(assertVedQuiet(async () => { throw new Error('listener remains'); }, async () => 0));
  const all = [processRow('stopped')];
  await assert.rejects(fenceVedWriters({ initialState: 'stopped', expectedIdentities: [{ ...processIdentity(all[0]), id: 99 }], live, uri,
    readProcesses: () => all, stopVed: () => { throw new Error('Must not stop unexpected identity'); }, checkPort: async () => {}, activeOperations: async () => 0 }));
});

test('dry run is read-only; apply requires correctly parsed exact approval before any action', () => {
  const digest = 'a'.repeat(64);
  assert.equal(releaseIsApproved(parseReleaseArguments(['--config', '/private/config.json']), digest), false);
  let actions = 0;
  const apply = (args: string[]) => { if (releaseIsApproved(parseReleaseArguments(args), digest)) actions++; };
  assert.throws(() => apply(['--config', '/private/config.json', '--apply', '--approve', 'b'.repeat(64)]));
  assert.equal(actions, 0);
  for (const args of [[], ['--config'], ['--config', '/private/config.json', '--apply'], ['--config', '/private/config.json', '--approve', digest], ['--config', '/private/config.json', '--apply', '--approve', 'invalid'], ['--config', '/private/config.json', '--apply', '--approve', digest, '--force']]) assert.throws(() => parseReleaseArguments(args));
  apply(['--config', '/private/config.json', '--apply', '--approve', digest]); assert.equal(actions, 1);
});

test('approval binds reviewed SHA, configuration, artifacts, PM2 identities, initial state and restore policy', () => {
  const plan = { reviewedCommit: '1'.repeat(40), configDigest: 'config-digest', artifactDigest: 'asset-digest',
    processes: [processIdentity(processRow('stopped'))], initialState: 'stopped', backupRestorePolicy: { network: 'none', fullDocumentIndexOptionsComparison: true } };
  const digest = releaseApprovalDigest(plan);
  assert.match(digest, /^[a-f\d]{64}$/);
  for (const key of Object.keys(plan)) assert.notEqual(releaseApprovalDigest({ ...plan, [key]: 'changed' }), digest);
});

test('preflight failures never disclose raw errors, credential URIs or process environment', () => {
  const secret = 'mongodb+srv://private-user:private-password@example.invalid/private-db';
  const result = safeFailure(new Error(secret), 'PRIVATE_CONFIG');
  assert.ok(result.includes('PRIVATE_CONFIG')); assert.ok(!result.includes(secret)); assert.ok(!result.includes('private-password'));
  try { releaseIsApproved(parseReleaseArguments(['--config', '/private/config.json', '--apply', '--approve', 'b'.repeat(64)]), 'a'.repeat(64)); }
  catch (error) { assert.ok(safeFailure(error, 'EXPLICIT_RELEASE_APPROVAL').includes('Approval digest does not match')); }
});
