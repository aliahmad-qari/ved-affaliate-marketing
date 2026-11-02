import mongoose from 'mongoose';
import { Campaign } from '../models/Campaign.ts';
import { CampaignMobileClaim } from '../models/CampaignMobileClaim.ts';
import { normalizeCustomerMobile } from '../../shared/customerMobile.ts';

export const DUPLICATE_MOBILE_MESSAGE = 'This mobile number has already been submitted for this campaign.';
export const CONTINUATION_EXPLANATION = 'VED has not verified an application-resume service for this campaign. No new lead has been created. Use the provider’s official application login or contact VED Support. This action does not resume or confirm completion of an application.';
export function duplicateMobileError() {
  return Object.assign(new Error(DUPLICATE_MOBILE_MESSAGE), { status: 409, code: 'DUPLICATE_CAMPAIGN_MOBILE' });
}
export function duplicateMobileResponse() {
  return { success: false, code: 'DUPLICATE_CAMPAIGN_MOBILE', message: DUPLICATE_MOBILE_MESSAGE,
    continuation: { supported: false, label: 'If Not Completed, Click Here', message: CONTINUATION_EXPLANATION } };
}
export function isClaimCollision(error: any): boolean {
  return error?.code === 11000 && (error?.keyPattern?.canonicalCampaignId === 1 && error?.keyPattern?.normalizedMobile === 1 || String(error?.message || '').includes('unique_campaign_mobile'));
}
export function requireCustomerMobile(value: unknown): string {
  const mobile = normalizeCustomerMobile(value);
  if (!mobile) throw Object.assign(new Error('A valid Indian customer mobile number is required.'), { status: 422, code: 'CUSTOMER_MOBILE_REQUIRED' });
  return mobile;
}

export const LeadDuplicateProtection = {
  async assertReady(): Promise<void> {
    // No application startup/model initialization or writes in readiness checks.
    const db = mongoose.connection.db;
    if (mongoose.connection.readyState !== 1 || !db) throw Object.assign(new Error('Lead submission is temporarily unavailable.'), { status: 503 });
    const state = await db.collection('leadDeduplicationState').findOne({ _id: 'campaign-mobile-v1' as any });
    if (!state?.ready || state.version !== 1) throw Object.assign(new Error('Lead duplicate protection is awaiting database preparation.'), { status: 503 });
    const indexes = await db.collection('campaignmobileclaims').indexes();
    if (!indexes.some(index => index.unique === true && index.key?.canonicalCampaignId === 1 && index.key?.normalizedMobile === 1 && Object.keys(index.key).length === 2 && !index.partialFilterExpression && !index.sparse)) {
      throw Object.assign(new Error('Lead duplicate protection is awaiting its required index.'), { status: 503 });
    }
  },
  async resolveCampaign(value: string): Promise<any> {
    const filter = mongoose.isValidObjectId(value) ? { $or: [{ _id: value }, { slug: value }] } : { slug: value };
    const campaign = await Campaign.findOne(filter).select('_id slug').lean().exec();
    if (!campaign) throw Object.assign(new Error('Campaign could not be resolved.'), { status: 400 });
    return campaign;
  },
  async find(campaignId: string, mobile: string, session: mongoose.ClientSession): Promise<any> {
    return CampaignMobileClaim.findOne({ canonicalCampaignId: campaignId, normalizedMobile: mobile }).select('+partnerId').session(session).lean().exec();
  },
  async claim(campaignId: string, mobile: string, leadId: string, partnerId: string, session: mongoose.ClientSession): Promise<void> {
    const existing = await this.find(campaignId, mobile, session);
    if (existing) {
      if (existing.state === 'CLAIMED' && existing.leadId === leadId && existing.partnerId === partnerId) return;
      throw duplicateMobileError();
    }
    try {
      await CampaignMobileClaim.create([{ canonicalCampaignId: campaignId, normalizedMobile: mobile, leadId, partnerId, state: 'CLAIMED' }], { session });
    } catch (error) { if (isClaimCollision(error)) throw duplicateMobileError(); throw error; }
  },
};
