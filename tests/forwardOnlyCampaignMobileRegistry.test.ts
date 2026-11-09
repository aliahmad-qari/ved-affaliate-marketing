import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { CAMPAIGN_MOBILE_STATE_ID, buildForwardOnlyReadinessMarker, isForwardOnlyRegistryReady } from '../server/services/forwardOnlyCampaignMobileRegistry.ts';
import { LeadDuplicateProtection } from '../server/services/leadDuplicateProtection.ts';

const uniqueIndex = {
  name: 'unique_campaign_mobile',
  key: { canonicalCampaignId: 1, normalizedMobile: 1 },
  unique: true,
};

test('forward-only readiness is explicit and never reports historical coverage', () => {
  const marker = buildForwardOnlyReadinessMarker(new Date('2026-11-09T00:00:00.000Z'));
  assert.equal(marker._id, CAMPAIGN_MOBILE_STATE_ID);
  assert.equal(marker.mode, 'forward-only');
  assert.equal(marker.ready, true);
  assert.equal(marker.coverageVerified, false);
  assert.equal(marker.historicalCoverage, 'not-imported');
  assert.equal(isForwardOnlyRegistryReady(marker), true);
  assert.equal(isForwardOnlyRegistryReady({ ...marker, coverageVerified: true }), false);
  assert.equal(isForwardOnlyRegistryReady({ ...marker, uniqueIndexVerified: false }), false);
  assert.equal(isForwardOnlyRegistryReady({ ...marker, transactionTopologyVerified: false }), false);
  assert.equal(isForwardOnlyRegistryReady({ ...marker, activatedAt: undefined }), false);
});

test('readiness accepts forward-only mode only with its exact marker and full unique registry index', async t => {
  const oldFlag = process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT;
  const oldState = mongoose.connection.readyState;
  const oldDb = (mongoose.connection as any).db;
  process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT = 'true';
  mongoose.connection.readyState = 1;
  const marker = buildForwardOnlyReadinessMarker();
  (mongoose.connection as any).db = {
    collection(name: string) {
      if (name === 'leadDeduplicationState') return { findOne: async () => marker };
      if (name === 'campaignmobileclaims') return { indexes: async () => [{ name: '_id_', key: { _id: 1 }, unique: true }, uniqueIndex] };
      throw new Error('Unexpected collection read');
    },
  };
  t.after(() => {
    if (oldFlag === undefined) delete process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT;
    else process.env.VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT = oldFlag;
    mongoose.connection.readyState = oldState;
    (mongoose.connection as any).db = oldDb;
  });

  await LeadDuplicateProtection.assertReady();
  (mongoose.connection as any).db.collection = (name: string) => name === 'leadDeduplicationState'
    ? { findOne: async () => ({ ...marker, historicalCoverage: 'verified' }) }
    : { indexes: async () => [{ name: '_id_', key: { _id: 1 }, unique: true }, uniqueIndex] };
  await assert.rejects(LeadDuplicateProtection.assertReady(), (error: any) => error.code === 'CAMPAIGN_MOBILE_REGISTRY_NOT_READY');
});
