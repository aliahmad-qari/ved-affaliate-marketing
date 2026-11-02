import 'dotenv/config';
import mongoose from 'mongoose';
import { seedDevelopmentCampaigns } from '../server/seeds/seedDevelopmentCampaigns.ts';

// Reject before connecting. Use only a separately provisioned development database.
if (process.env.NODE_ENV !== 'development' || process.env.CONFIRM_DEVELOPMENT_SEED !== 'YES') {
  throw new Error('Development seeding requires explicit development mode and confirmation.');
}
const uri = process.env.DEVELOPMENT_MONGODB_URI;
if (!uri) throw new Error('A separate DEVELOPMENT_MONGODB_URI is required.');
try {
  await mongoose.connect(uri);
  const inserted = await seedDevelopmentCampaigns();
  console.log(inserted ? 'Development campaigns inserted.' : 'Existing campaigns preserved; nothing seeded.');
} finally {
  await mongoose.disconnect();
}
