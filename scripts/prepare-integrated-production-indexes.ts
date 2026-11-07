import mongoose from 'mongoose';
import { REQUIRED_COLLECTIONS, REQUIRED_INDEXES, PRODUCTION_DATABASE, compareIndex, missingCollections, type ExistingIndex, type RequiredIndex } from './lib/productionIndexPlan.ts';

mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

type SchemaModel = {
  collection: { name: string };
  schema: { indexes: () => Array<[Record<string, unknown>, Record<string, unknown>]> };
};

class OperatorError extends Error {}

function safeError(error: unknown): { name: string; code?: string | number } {
  const value = error as { name?: string; code?: string | number };
  return { name: value?.name || 'Error', ...(value?.code !== undefined ? { code: value.code } : {}) };
}

function schemaIndexMatches(model: SchemaModel, expected: RequiredIndex): boolean {
  return model.schema.indexes().some(([key, options]) => {
    const expectedOptions = expected.options;
    const normalizedKey = Object.entries(key);
    const expectedKey = Object.entries(expected.key);
    return options.name === expected.name
      && normalizedKey.length === expectedKey.length
      && normalizedKey.every(([field, direction], i) => expectedKey[i]?.[0] === field && expectedKey[i]?.[1] === direction)
      && (options.unique === true) === (expectedOptions.unique === true)
      && (options.sparse === true) === (expectedOptions.sparse === true)
      && options.expireAfterSeconds === expectedOptions.expireAfterSeconds;
  });
}

async function duplicateSummary(collection: any, index: RequiredIndex): Promise<{ groups: number; extraRecords: number }> {
  const field = Object.keys(index.key)[0];
  const isEventKeyArray = index.collection === 'leads' && field === 'payoutCommission.eventKeys';
  const pipeline = isEventKeyArray
    ? [
      { $project: { values: { $cond: [
        { $eq: [{ $type: `$${field}` }, 'missing'] },
        [],
        { $cond: [{ $isArray: `$${field}` }, `$${field}`, [`$${field}`]] },
      ] } } },
      { $unwind: '$values' },
      { $group: { _id: '$values', owners: { $addToSet: '$_id' } } },
      { $project: { count: { $size: '$owners' } } },
      { $match: { count: { $gt: 1 } } },
      { $group: { _id: null, groups: { $sum: 1 }, extraRecords: { $sum: { $subtract: ['$count', 1] } } } },
      { $project: { _id: 0, groups: 1, extraRecords: 1 } },
    ]
    : [
      { $group: { _id: `$${field}`, owners: { $addToSet: '$_id' } } },
      { $project: { count: { $size: '$owners' } } },
      { $match: { count: { $gt: 1 } } },
      { $group: { _id: null, groups: { $sum: 1 }, extraRecords: { $sum: { $subtract: ['$count', 1] } } } },
      { $project: { _id: 0, groups: 1, extraRecords: 1 } },
    ];
  const rows = await collection.aggregate(pipeline, { maxTimeMS: 20_000 }).toArray();
  return { groups: rows[0]?.groups ?? 0, extraRecords: rows[0]?.extraRecords ?? 0 };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const allowedArgs = new Set(['--apply', '--dry-run', '--confirm-target=VedAffiliatemarket', '--maintenance-approved']);
  for (const arg of args) if (!allowedArgs.has(arg)) throw new OperatorError(`Unsupported argument: ${arg}`);
  if (args.has('--apply') && args.has('--dry-run')) throw new OperatorError('Choose either --dry-run or --apply.');
  const apply = args.has('--apply');
  const targetConfirmed = args.has('--confirm-target=VedAffiliatemarket');
  const maintenanceApproved = args.has('--maintenance-approved');
  if (apply && (!targetConfirmed || !maintenanceApproved)) {
    throw new OperatorError('Apply requires --confirm-target=VedAffiliatemarket and --maintenance-approved.');
  }

  const uri = apply ? process.env.PROD_SCHEMA_PREPARE_URI : process.env.PROD_AUDIT_MONGODB_URI;
  if (!uri) throw new OperatorError(apply ? 'PROD_SCHEMA_PREPARE_URI is required.' : 'PROD_AUDIT_MONGODB_URI is required.');
  let parsed: URL;
  try { parsed = new URL(uri); } catch { throw new OperatorError('Configured MongoDB URI is invalid.'); }
  const uriDatabase = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (uriDatabase !== PRODUCTION_DATABASE) throw new OperatorError('Configured URI does not target the approved production database.');

  const { Lead } = await import('../server/models/Lead.ts');
  const { PartnerSignupChallenge } = await import('../server/models/PartnerSignupChallenge.ts');
  const { PartnerSubTeamLink } = await import('../server/models/PartnerSubTeamLink.ts');
  const { AdvertiserReceipt } = await import('../server/models/AdvertiserReceipt.ts');
  const { MonthlyLeaderboardReward } = await import('../server/models/MonthlyLeaderboardReward.ts');
  const { MonthlyRewardPolicy } = await import('../server/models/MonthlyRewardPolicy.ts');

  const modelByCollection: Record<string, SchemaModel> = {
    leads: Lead as unknown as SchemaModel,
    partnerSignupChallenges: PartnerSignupChallenge as unknown as SchemaModel,
    partnersubteamlinks: PartnerSubTeamLink as unknown as SchemaModel,
    advertiserreceipts: AdvertiserReceipt as unknown as SchemaModel,
    monthlyleaderboardrewards: MonthlyLeaderboardReward as unknown as SchemaModel,
    monthlyrewardpolicies: MonthlyRewardPolicy as unknown as SchemaModel,
  };
  for (const name of REQUIRED_COLLECTIONS) {
    if (modelByCollection[name]?.collection.name !== name) throw new OperatorError(`Schema collection name mismatch for ${name}.`);
  }
  for (const spec of REQUIRED_INDEXES) {
    if (!schemaIndexMatches(modelByCollection[spec.collection], spec)) throw new OperatorError(`Reviewed index definition differs from schema: ${spec.collection}.${spec.name}.`);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 8_000, autoIndex: false, autoCreate: false });
  } catch (error) {
    console.error(JSON.stringify({ stage: 'connect', error: safeError(error) }));
    throw new OperatorError('Production database connection failed.');
  }
  try {
    const db = mongoose.connection.db;
    if (!db || db.databaseName !== PRODUCTION_DATABASE) throw new OperatorError('Resolved MongoDB database does not match the approved production target.');
    const existingNames = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
    const collectionsToCreate = missingCollections(existingNames);
    const indexesToCreate: RequiredIndex[] = [];
    const conflicts: Array<{ index: string; groups: number; extraRecords: number }> = [];

    for (const spec of REQUIRED_INDEXES) {
      const indexes: ExistingIndex[] = existingNames.has(spec.collection)
        ? await db.collection(spec.collection).listIndexes().toArray() as ExistingIndex[]
        : [];
      if (compareIndex(spec, indexes) === 'present') continue;
      indexesToCreate.push(spec);
      if (spec.options.unique && existingNames.has(spec.collection)) {
        const summary = await duplicateSummary(db.collection(spec.collection), spec);
        if (summary.groups) conflicts.push({ index: `${spec.collection}.${spec.name}`, ...summary });
      }
    }

    const report = { target: PRODUCTION_DATABASE, mode: apply ? 'apply' : 'dry-run', collectionsToCreate, indexesToCreate, uniqueConflicts: conflicts };
    console.log(JSON.stringify(report, null, 2));
    if (conflicts.length) throw new OperatorError('Unique-index duplicate conflicts found; no writes performed.');
    if (!apply) return;

    for (const name of collectionsToCreate) {
      try { await db.createCollection(name); }
      catch (error) {
        if ((error as { code?: number }).code === 48) continue;
        console.error(JSON.stringify({ stage: 'createCollection', collection: name, error: safeError(error) }));
        throw new OperatorError('Collection preparation stopped; completed objects were preserved.');
      }
    }
    for (const spec of indexesToCreate) {
      try { await db.collection(spec.collection).createIndex(spec.key, { ...spec.options, name: spec.name }); }
      catch (error) {
        console.error(JSON.stringify({ stage: 'createIndex', collection: spec.collection, index: spec.name, error: safeError(error) }));
        throw new OperatorError('Index preparation stopped; completed objects were preserved.');
      }
    }
    const finalNames = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
    for (const name of REQUIRED_COLLECTIONS) {
      if (!finalNames.has(name)) throw new OperatorError(`Post-apply verification failed for collection ${name}.`);
    }
    for (const spec of REQUIRED_INDEXES) {
      const finalIndexes = await db.collection(spec.collection).listIndexes().toArray() as ExistingIndex[];
      if (compareIndex(spec, finalIndexes) !== 'present') throw new OperatorError(`Post-apply verification failed for index ${spec.collection}.${spec.name}.`);
    }
    console.log(JSON.stringify({ result: 'prepared-and-verified', collections: REQUIRED_COLLECTIONS.length, indexes: REQUIRED_INDEXES.length }));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof OperatorError) console.error(error.message);
  else console.error(JSON.stringify({ stage: 'database_operation', error: safeError(error) }));
  process.exitCode = 1;
});
