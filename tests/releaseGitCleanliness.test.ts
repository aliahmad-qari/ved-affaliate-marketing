import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, symlinkSync, unlinkSync, rmdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertOperationalPathsUntracked, permittedUntrackedPaths, verifyCheckoutCleanliness } from '../scripts/lib/releaseGitCleanliness.ts';

test('only the exact two untracked root paths are permitted in live status', () => {
  const status = '?? deploy.sh\0?? ecosystem.config.cjs\0';
  assert.deepEqual(permittedUntrackedPaths(status, true), ['deploy.sh', 'ecosystem.config.cjs']);
  assert.deepEqual(permittedUntrackedPaths('', false), []);
  assert.throws(() => permittedUntrackedPaths(status, false));
  for (const rejected of ['?? private.json\0', '?? folder/deploy.sh\0', '?? deploy.sh/child\0', '?? ./deploy.sh\0', '?? deploy.sh.bak\0',
    ' M server.ts\0', 'M  server.ts\0', 'A  deploy.sh\0', 'D  deploy.sh\0', 'UU server.ts\0', 'R  deploy.sh\0old.sh\0',
    '?? deploy.sh\0?? other.js\0', '?? deploy.sh\0?? deploy.sh\0', '?? deploy.sh', '?? deploy.sh\n']) assert.throws(() => permittedUntrackedPaths(rejected, true));
});

test('allowed operational files are read-only fingerprinted and must exist as regular non-symlink files', t => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ved-git-policy-'));
  const first = path.join(root, 'deploy.sh'), second = path.join(root, 'ecosystem.config.cjs');
  writeFileSync(first, '# synthetic deployment fixture\n'); writeFileSync(second, '// synthetic PM2 fixture\n');
  t.after(() => { unlinkSync(first); unlinkSync(second); rmdirSync(root); });
  const before = [readFileSync(first), readFileSync(second)];
  const fingerprints = verifyCheckoutCleanliness(root, '?? deploy.sh\0?? ecosystem.config.cjs\0', true);
  assert.equal(fingerprints.length, 2);
  assert.deepEqual([readFileSync(first), readFileSync(second)], before);
  assert.deepEqual(verifyCheckoutCleanliness(root, '?? ecosystem.config.cjs\0?? deploy.sh\0', true), fingerprints);
  assert.throws(() => verifyCheckoutCleanliness(root, '?? deploy.sh\0', false));
  const empty = mkdtempSync(path.join(os.tmpdir(), 'ved-git-missing-'));
  try {
    assert.throws(() => verifyCheckoutCleanliness(empty, '?? deploy.sh\0', true));
    mkdirSync(path.join(empty, 'deploy.sh'));
    assert.throws(() => verifyCheckoutCleanliness(empty, '?? deploy.sh\0', true));
    rmdirSync(path.join(empty, 'deploy.sh'));
    try { symlinkSync(first, path.join(empty, 'deploy.sh'), 'file'); }
    catch (error: any) { if (process.platform === 'win32' && error.code === 'EPERM') return; throw error; }
    try { assert.throws(() => verifyCheckoutCleanliness(empty, '?? deploy.sh\0', true)); }
    finally { unlinkSync(path.join(empty, 'deploy.sh')); }
  } finally { rmdirSync(empty); }
});

test('checkout cannot overwrite or remove operational paths via tracked source files', () => {
  assert.doesNotThrow(() => assertOperationalPathsUntracked(['server.ts'], ['server.ts', 'package.json']));
  for (const file of ['deploy.sh', 'ecosystem.config.cjs', 'deploy.sh/child']) {
    assert.throws(() => assertOperationalPathsUntracked([file], ['server.ts']));
    assert.throws(() => assertOperationalPathsUntracked(['server.ts'], [file]));
  }
});
