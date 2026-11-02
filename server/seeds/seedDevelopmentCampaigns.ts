import { Campaign } from '../models/Campaign.ts';
import { initialCampaignSeeds } from './campaignSeeds.ts';

/** Explicit development provisioning only; never updates existing campaigns. */
export async function seedDevelopmentCampaigns() {
  if (process.env.NODE_ENV !== 'development' || process.env.CONFIRM_DEVELOPMENT_SEED !== 'YES') {
    throw new Error('Development seeding requires NODE_ENV=development and explicit confirmation.');
  }
  if (await Campaign.countDocuments() !== 0) return false;
  await Campaign.insertMany(initialCampaignSeeds);
  return true;
}
