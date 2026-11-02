import mongoose from 'mongoose';
import { readInventory } from './lib/campaignMobileInventory.ts';
import { loadHistoricalManifest } from './lib/historicalReferenceManifest.ts';

async function main() {
  if (!process.env.AUDIT_MONGODB_URI) throw new Error('Configure an authorized read-only AUDIT_MONGODB_URI outside shell history.');
  const approval = loadHistoricalManifest(process.env.HISTORICAL_REFERENCE_MANIFEST, process.env.APPROVED_HISTORICAL_MANIFEST_SHA256);
  const client = new mongoose.mongo.MongoClient(process.env.AUDIT_MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect(); const db = client.db();
    const hello = await db.admin().command({ hello: 1 });
    const indexes = await db.collection('leads').indexes();
    const { summary } = await readInventory(db, approval?.manifest);
    console.log(JSON.stringify({ ...summary, transactionCapableTopology: !!hello.setName || hello.msg === 'isdbgrid', leadIndexCount: indexes.length,
      hasExistingAccountUniqueIndex: indexes.some(index => index.unique && index.key?.partnerId === 1 && index.key?.campaignId === 1 && index.key?.accountId === 1) }, null, 2));
  } finally { await client.close(); }
}
main().catch(() => { console.error('Read-only inventory could not complete. No credentials or customer details are displayed.'); process.exitCode = 1; });
