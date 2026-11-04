import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { developmentSeedTarget, seedEmptyDevelopmentDatabase } from '../server/seeds/developmentSafety.ts';

export async function seedDevelopment() {
  // Validate before importing models or attempting any connection.
  const uri = developmentSeedTarget(process.env.NODE_ENV, process.env.MONGODB_URI,
    process.argv.slice(2).includes('--confirm-development-seed'));
  try {
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
    const database = mongoose.connection.db;
    if (!database) throw new Error('Development database is unavailable.');
    const { Campaign } = await import('../server/models/Campaign.ts');
    const { initialCampaignSeeds } = await import('../server/seeds/campaignSeeds.ts');
    await seedEmptyDevelopmentDatabase(database, () => Campaign.insertMany(initialCampaignSeeds));
    console.log('Development campaigns inserted into an empty local database. No existing records were updated.');
  } finally { await mongoose.disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  seedDevelopment().catch(() => {
    console.error('Development seed refused or failed. Check local-only target, explicit confirmation and database emptiness. No raw database error is printed.');
    process.exitCode = 1;
  });
}
