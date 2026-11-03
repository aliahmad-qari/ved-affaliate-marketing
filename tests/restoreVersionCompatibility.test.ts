import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseToolsVersion, restoreVersionPolicy, stableFcv, verifyRestoreServer } from '../scripts/lib/restoreVersionCompatibility.ts';
const image = 'mongo@sha256:' + 'a'.repeat(64);
const approval = { approved: true, sourceVersion: '8.0.36', verifierVersion: '8.0.34', fcv: '8.0', imageDigest: image };

test('exact versions remain the default; every unapproved mismatch fails closed', () => {
  assert.equal(restoreVersionPolicy('8.0.36', '8.0.36', '8.0', image).exception, null);
  for (const pair of [['8.0.36', '8.0.34'], ['8.0.37', '8.0.34'], ['8.0.36', '8.0.35'], ['8.0.34', '8.0.36'], ['8.0.36', '7.0.36']]) {
    assert.throws(() => restoreVersionPolicy(pair[0], pair[1], '8.0', image));
  }
  assert.throws(() => restoreVersionPolicy('8.0.36', '8.0.36', '8.0', image, approval));
});

test('only the approved exact pair, stable FCV and bound digest permit an exception', () => {
  const policy = restoreVersionPolicy('8.0.36', '8.0.34', '8.0', image, approval);
  assert.ok(policy.exception); assert.equal(policy.productionVersion, '8.0.36');
  for (const changed of [{ approved: false }, { imageDigest: 'mongo@sha256:' + 'b'.repeat(64) }, { fcv: '7.0' }, { verifierVersion: '8.0.35' }, { sourceVersion: '8.0.37' }]) {
    assert.throws(() => restoreVersionPolicy('8.0.36', '8.0.34', '8.0', image, { ...approval, ...changed }));
  }
  assert.throws(() => restoreVersionPolicy('8.0.37', '8.0.34', '8.0', image, approval));
  assert.throws(() => restoreVersionPolicy('8.0.36', '8.0.34', '7.0', image, approval));
  assert.throws(() => restoreVersionPolicy('8.0.36', '8.0.34', '8.0', 'mongo:8.0', approval));
  verifyRestoreServer(policy, '8.0.34', { version: '8.0' });
  assert.throws(() => verifyRestoreServer(policy, '8.0.35', { version: '8.0' }));
  assert.throws(() => verifyRestoreServer(policy, '8.0.34', { version: '7.0' }));
  assert.throws(() => stableFcv({ version: '8.0', targetVersion: '8.0' }));
  assert.throws(() => stableFcv(undefined));
});

test('database tools version is parsed strictly, never assumed from server versions', () => {
  assert.equal(databaseToolsVersion('mongodump version: 100.13.0\ngit version: example', 'mongodump'), '100.13.0');
  assert.equal(databaseToolsVersion('mongorestore version: 100.13.0\n', 'mongorestore'), '100.13.0');
  assert.throws(() => databaseToolsVersion('mongorestore version: unknown', 'mongorestore'));
  assert.throws(() => databaseToolsVersion('mongodump version: 100.13.0', 'mongorestore'));
});
