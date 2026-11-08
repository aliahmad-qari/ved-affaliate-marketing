import mongoose from 'mongoose';
import { Campaign } from '../models/Campaign.ts';
import { CampaignMobileClaim } from '../models/CampaignMobileClaim.ts';
import { normalizeCustomerMobile } from '../../shared/customerMobile.ts';

export const DUPLICATE_MOBILE_MESSAGE = 'Your application has already been registered for this campaign.';
export const duplicateMobileError = () => Object.assign(new Error(DUPLICATE_MOBILE_MESSAGE), {
  status: 409, code: 'DUPLICATE_CAMPAIGN_MOBILE',
});

export function claimCollision(error: any): boolean {
  return error?.code === 11000 && (
    (error?.keyPattern?.canonicalCampaignId === 1 && error?.keyPattern?.normalizedMobile === 1)
    || String(error?.message || '').includes('unique_campaign_mobile')
  );
}

export const LeadDuplicateProtection = {
  normalize: normalizeCustomerMobile,

  async assertReady(): Promise<void> {
    const db = mongoose.connection.db;
    if (mongoose.connection.readyState !== 1 || !db) {
      throw Object.assign(new Error('Lead submission is temporarily unavailable.'), { status: 503 });
    }
    try {
      const state = await db.collection('leadDeduplicationState').findOne({ _id: 'campaign-mobile-v1' as any });
      if (!state?.ready || state.version !== 1 || state.coverageVerified !== true || state.unidentifiedHistoryCount !== 0) {
        throw new Error('not-ready');
      }
      const indexes = await db.collection('campaignmobileclaims').indexes();
      const fullUniqueIndex = indexes.some(index => index.name === 'unique_campaign_mobile'
        && index.unique === true
        && index.key?.canonicalCampaignId === 1
        && index.key?.normalizedMobile === 1
        && Object.keys(index.key).length === 2
        && !index.partialFilterExpression && !index.sparse && index.expireAfterSeconds == null);
      if (!fullUniqueIndex) throw new Error('not-ready');
    } catch {
      throw Object.assign(new Error('Campaign duplicate protection is not prepared; submissions are temporarily unavailable.'), { status: 503, code: 'CAMPAIGN_MOBILE_REGISTRY_NOT_READY' });
    }
  },

  async resolveCampaign(value: string, session?: mongoose.ClientSession): Promise<any> {
    const filter = mongoose.isValidObjectId(value)
      ? { $or: [{ _id: value }, { slug: value }] }
      : { slug: value };
    const campaign = await Campaign.findOne(filter).select('_id slug').session(session || null).lean().exec();
    if (!campaign) throw Object.assign(new Error('Campaign could not be resolved.'), { status: 400 });
    return campaign;
  },

  async claim(campaignId: string, rawMobile: unknown, leadId: string, partnerId: string, session: mongoose.ClientSession): Promise<string> {
    const mobile = normalizeCustomerMobile(rawMobile);
    if (!mobile) throw Object.assign(new Error('Please enter a valid 10-digit Indian mobile number.'), { status: 400, code: 'INVALID_CUSTOMER_MOBILE' });
    const existing = await CampaignMobileClaim.findOne({ canonicalCampaignId: campaignId, normalizedMobile: mobile })
      .select('+partnerId').session(session).lean().exec();
    if (existing) {
      if (existing.state === 'CLAIMED' && existing.leadId === leadId && existing.partnerId === partnerId.toUpperCase()) return mobile;
      throw duplicateMobileError();
    }
    try {
      await CampaignMobileClaim.create([{
        canonicalCampaignId: campaignId, normalizedMobile: mobile, leadId,
        partnerId: partnerId.toUpperCase(), state: 'CLAIMED', historicalCount: 1,
      }], { session });
    } catch (error) {
      if (claimCollision(error)) throw duplicateMobileError();
      throw error;
    }
    return mobile;
  },
};
