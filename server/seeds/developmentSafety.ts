export function developmentSeedTarget(environment: string | undefined, uri: string | undefined, approved: boolean): string {
  if (environment !== 'development' || !approved) {
    throw new Error('Seeding requires development mode and --confirm-development-seed.');
  }
  let target: URL;
  try { target = new URL(uri || ''); } catch { throw new Error('A local development database URI is required.'); }
  if (target.protocol !== 'mongodb:' || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || !/^\/ved_[a-z0-9_]+_(?:dev|test)$/.test(target.pathname) || target.hash) {
    throw new Error('Seeding accepts only a loopback MongoDB database named ved_*_dev or ved_*_test.');
  }
  return uri!;
}

interface SeedDatabase {
  listCollections(filter: Record<string, never>, options: { nameOnly: true }): { toArray(): Promise<{ name: string }[]> };
  collection(name: string): { countDocuments(filter: Record<string, never>, options: { limit: number }): Promise<number> };
}

// No application startup, index creation, existing-record updates or deletion.
export async function seedEmptyDevelopmentDatabase(database: SeedDatabase, insertCampaigns: () => Promise<unknown>) {
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  for (const collection of collections) {
    if (await database.collection(collection.name).countDocuments({}, { limit: 1 })) {
      throw new Error('Development seeding refuses a database containing any records.');
    }
  }
  await insertCampaigns();
}
