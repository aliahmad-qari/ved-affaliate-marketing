import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { app } from '../server/app.ts';
import { startServer } from '../server/server.ts';
import { Campaign } from '../server/models/Campaign.ts';
import { seedDevelopmentCampaigns } from '../server/seeds/seedDevelopmentCampaigns.ts';

test('production startup connects and listens without seed reads or mutations', async t => {
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'isolated-startup-test-secret-with-enough-characters';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/never-connect';
  const connect = t.mock.method(mongoose, 'connect', async () => ({ connection: { readyState: 1, host: 'mock' } }));
  const calls: string[] = [];
  for (const method of ['countDocuments', 'insertMany', 'updateOne', 'updateMany', 'bulkWrite', 'create', 'deleteMany'] as const) {
    t.mock.method(Campaign, method, () => { calls.push(method); throw new Error('Unexpected campaign operation'); });
  }
  const fakeServer = {};
  t.mock.method(app, 'listen', () => fakeServer as any);
  assert.equal(await startServer(), fakeServer);
  assert.equal(connect.mock.callCount(), 1);
  assert.deepEqual(calls, []);
  await assert.rejects(seedDevelopmentCampaigns(), /Development seeding requires/);
  assert.deepEqual(calls, []);
});

test('development seed is explicit, insert-only and preserves populated databases', async t => {
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  process.env.NODE_ENV = 'development';
  delete process.env.CONFIRM_DEVELOPMENT_SEED;
  await assert.rejects(seedDevelopmentCampaigns(), /explicit confirmation/);
  process.env.CONFIRM_DEVELOPMENT_SEED = 'YES';
  let count = 1;
  t.mock.method(Campaign, 'countDocuments', async () => count);
  const insert = t.mock.method(Campaign, 'insertMany', async () => []);
  const update = t.mock.method(Campaign, 'updateOne', () => { throw new Error('Must not update'); });
  assert.equal(await seedDevelopmentCampaigns(), false);
  assert.equal(insert.mock.callCount(), 0);
  count = 0;
  assert.equal(await seedDevelopmentCampaigns(), true);
  assert.equal(insert.mock.callCount(), 1);
  assert.equal(update.mock.callCount(), 0);
});

test('both startup entry points exclude automatic seeding', () => {
  for (const file of ['../server/server.ts', '../vite.config.ts']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /ensureSeededData|seedDevelopmentCampaigns|initialCampaignSeeds/);
  }
});
