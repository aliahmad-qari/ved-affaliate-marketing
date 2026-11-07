import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_COLLECTIONS, REQUIRED_INDEXES, compareIndex, missingCollections } from '../scripts/lib/productionIndexPlan.ts';
import { Lead } from '../server/models/Lead.ts';
import { PartnerSignupChallenge } from '../server/models/PartnerSignupChallenge.ts';
import { PartnerSubTeamLink } from '../server/models/PartnerSubTeamLink.ts';
import { AdvertiserReceipt } from '../server/models/AdvertiserReceipt.ts';
import { MonthlyLeaderboardReward } from '../server/models/MonthlyLeaderboardReward.ts';
import { MonthlyRewardPolicy } from '../server/models/MonthlyRewardPolicy.ts';

test('production preparation allowlist contains only the five reviewed collections and eight indexes', () => {
  assert.equal(REQUIRED_COLLECTIONS.length, 5);
  assert.equal(REQUIRED_INDEXES.length, 8);
  assert.equal(REQUIRED_INDEXES.filter((item) => item.options.unique).length, 4);
  assert.equal(REQUIRED_INDEXES.some((item) => /CampaignMobileClaim|leadDeduplicationState/i.test(item.collection)), false);
});

test('missing collection plan skips existing objects', () => {
  assert.deepEqual(missingCollections(new Set(['advertiserreceipts', 'partnersubteamlinks'])), [
    'monthlyleaderboardrewards', 'monthlyrewardpolicies', 'partnerSignupChallenges',
  ]);
});

test('index comparison recognizes exact existing index and missing index', () => {
  const expected = REQUIRED_INDEXES.find((item) => item.name === 'unique_percentage_payout_event_keys')!;
  assert.equal(compareIndex(expected, [{ name: expected.name, key: expected.key, unique: true, sparse: true }]), 'present');
  assert.equal(compareIndex(expected, []), 'missing');
});

test('index comparison fails closed on name or key option conflicts', () => {
  const expected = REQUIRED_INDEXES.find((item) => item.name === 'advertiser_receipt_unique_lead')!;
  assert.throws(() => compareIndex(expected, [{ name: expected.name, key: { other: 1 }, unique: true }]), /Index name conflict/);
  assert.throws(() => compareIndex(expected, [{ name: 'unexpected', key: expected.key, unique: true }]), /unexpected name/);
});

test('reviewed collection and index allowlist matches the integrated Mongoose schemas', () => {
  const models = new Map([
    ['leads', Lead],
    [PartnerSignupChallenge.collection.name, PartnerSignupChallenge],
    [PartnerSubTeamLink.collection.name, PartnerSubTeamLink],
    [AdvertiserReceipt.collection.name, AdvertiserReceipt],
    [MonthlyLeaderboardReward.collection.name, MonthlyLeaderboardReward],
    [MonthlyRewardPolicy.collection.name, MonthlyRewardPolicy],
  ]);
  for (const collection of REQUIRED_COLLECTIONS) assert.equal(models.has(collection), true, collection);
  for (const expected of REQUIRED_INDEXES) {
    const model = models.get(expected.collection)!;
    const found = model.schema.indexes().some(([key, options]) => options.name === expected.name
      && JSON.stringify(Object.entries(key)) === JSON.stringify(Object.entries(expected.key))
      && (options.unique === true) === (expected.options.unique === true)
      && (options.sparse === true) === (expected.options.sparse === true)
      && options.expireAfterSeconds === expected.options.expireAfterSeconds);
    assert.equal(found, true, `${expected.collection}.${expected.name}`);
  }
});
