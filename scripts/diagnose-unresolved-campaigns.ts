import mongoose from 'mongoose';
import { diagnoseUnresolvedCampaigns, diagnosticLabel } from './lib/unresolvedCampaignDiagnostics.ts';

// Standalone raw-client read-only snapshot. No app/models/startup or dotenv imports.
async function main() {
  const uri = process.env.AUDIT_MONGODB_URI;
  const key = process.env.AUDIT_DIAGNOSTIC_KEY ?? '';
  if (!uri) throw new Error('An authorized read-only connection is required.');
  diagnosticLabel(key, 'reference', 'validate-key');
  const client = new mongoose.mongo.MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db();
    const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
    if (!names.has('campaigns') || !names.has('leads')) throw new Error('Required collections unavailable.');
    const session = client.startSession();
    let result: ReturnType<typeof diagnoseUnresolvedCampaigns> | undefined;
    const read = async (name: string, filter: any, projection: any) => {
      const rows = await db.collection(name).find(filter, { projection, session, maxTimeMS: 60000 }).limit(100001).toArray();
      if (rows.length > 100000) throw new Error('Diagnostic limit exceeded; no partial result will be reported.');
      return rows;
    };
    try {
      await session.withTransaction(async () => {
        const campaigns = await read('campaigns', {}, { _id: 1, slug: 1 });
        const leads = await read('leads', {}, { _id: 0, campaignId: 1, status: 1 });
        const audits = names.has('auditlogs') ? await read('auditlogs', { entityType: 'Campaign' }, {
          _id: 0, entityType: 1, entityId: 1, action: 1,
          'before.slug': 1, 'before._id': 1, 'after.slug': 1, 'after._id': 1,
        }) : [];
        result = diagnoseUnresolvedCampaigns(campaigns, leads, audits, key, names.has('auditlogs'));
      }, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
    } finally { await session.endSession(); }
    if (!result) throw new Error('No verified diagnostic result.');
    console.log(JSON.stringify(result, null, 2));
  } finally { await client.close(); }
}
main().catch(() => {
  console.error('Read-only diagnostic incomplete. Check credentials, key, permissions, topology and limits privately. No raw errors or partial results are printed.');
  process.exitCode = 1;
});
