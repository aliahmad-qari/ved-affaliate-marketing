import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import mongoose from 'mongoose';
import { databaseConnectionOptions } from '../server/config/db.ts';
import { developmentSeedTarget, seedEmptyDevelopmentDatabase } from '../server/seeds/developmentSafety.ts';

test('production start connects and opens its listener without business-data reads or writes', async t => {
  const old = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET, MONGODB_URI: process.env.MONGODB_URI };
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'isolated-startup-test-secret-not-a-real-credential';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1/ved_startup_test';
  t.after(() => { for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const connect = t.mock.method(mongoose, 'connect', async (uri: string) => {
    assert.equal(uri, 'mongodb://127.0.0.1/ved_startup_test');
    return { connection: { readyState: 1, host: 'isolated-mock' } } as any;
  });
  const { startServer } = await import('../server/server.ts');
  const { app } = await import('../server/app.ts');
  const listener = { isolated: true };
  const listen = t.mock.method(app, 'listen', () => listener as any);
  const calls = [];
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    for (const method of ['countDocuments', 'create', 'insertMany', 'updateOne', 'updateMany', 'findOneAndUpdate', 'deleteMany', 'bulkWrite'] as const) {
      calls.push(t.mock.method(model, method, () => { throw new Error('Unexpected startup business-data operation.'); }));
    }
  }
  assert.equal(await startServer(), listener);
  assert.equal(connect.mock.callCount(), 1);
  assert.equal(connect.mock.calls[0].arguments[1]?.autoIndex, false);
  assert.equal(connect.mock.calls[0].arguments[1]?.autoCreate, false);
  assert.equal(listen.mock.callCount(), 1);
  for (const operation of calls) assert.equal(operation.mock.callCount(), 0);
});

test('database startup disables automatic indexes and collections only in production', () => {
  assert.deepEqual(databaseConnectionOptions('production'), {
    serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000, autoIndex: false, autoCreate: false,
  });
  assert.deepEqual(databaseConnectionOptions('development'), {
    serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000, autoIndex: true, autoCreate: true,
  });
  assert.deepEqual(databaseConnectionOptions('test'), {
    serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000, autoIndex: true, autoCreate: true,
  });
});

test('API and Vite startup have no seeding entry point; explicit command is separate', () => {
  for (const file of ['../server/server.ts', '../vite.config.ts', '../server/controllers/campaignController.ts']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /ensureSeededData|seedDevelopment|seedEmptyDevelopmentDatabase/);
  }
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.scripts['seed:development'], 'tsx scripts/seed-development.ts');
  assert.equal(manifest.scripts.start, 'tsx server.ts');
});

test('development seed guard rejects production, unapproved, remote and production-named targets', () => {
  const local = 'mongodb://127.0.0.1:27017/ved_local_dev';
  assert.equal(developmentSeedTarget('development', local, true), local);
  assert.equal(developmentSeedTarget('development', 'mongodb://localhost/ved_local_test', true), 'mongodb://localhost/ved_local_test');
  for (const env of ['production', 'test', undefined]) assert.throws(() => developmentSeedTarget(env, local, true));
  assert.throws(() => developmentSeedTarget('development', local, false));
  for (const uri of [undefined, '', 'mongodb+srv://example.invalid/ved_local_dev', 'mongodb://example.invalid/ved_local_dev', 'mongodb://127.0.0.1/VedAffiliatemarket', 'mongodb://localhost/ved_local_dev/extra', 'mongodb://localhost/ved_local_dev#fragment']) {
    assert.throws(() => developmentSeedTarget('development', uri, true));
  }
});

test('explicit development seed refuses any existing records and does not repeat insertion', async () => {
  let rows = 0, inserts = 0;
  const db = {
    listCollections: () => ({ toArray: async () => [{ name: 'campaigns' }, { name: 'partners' }] }),
    collection: () => ({ countDocuments: async () => rows }),
  };
  const insert = async () => { inserts++; rows++; };
  await seedEmptyDevelopmentDatabase(db, insert);
  await assert.rejects(seedEmptyDevelopmentDatabase(db, insert), /containing any records/);
  assert.equal(inserts, 1);
  let written = false;
  await assert.rejects(seedEmptyDevelopmentDatabase({ ...db, collection: name => ({ countDocuments: async () => name === 'partners' ? 1 : 0 }) }, async () => { written = true; }));
  assert.equal(written, false);
});
