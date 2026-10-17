import mongoose from 'mongoose';
import { Campaign } from '../models/Campaign.ts';
import { escapeRegex } from './adminServices.ts';

export async function buildAdminLeadQuery(input: Record<string, unknown>, partnerId?: string, options: { hideOldRejected?: boolean } = {}) {
  const query: Record<string, any> = {};
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (input.status === 'ARCHIVED') { query.status = 'REJECTED'; query.rejectedAt = { $lte: cutoff }; }
  else if (options.hideOldRejected && (!input.status || input.status === 'ALL')) query.$nor = [{ status: 'REJECTED', rejectedAt: { $lte: cutoff } }];
  if (typeof input.status === 'string' && input.status !== 'ALL' && input.status !== 'ARCHIVED') {
    const status = input.status.toUpperCase();
    if (['IN_PROCESS', 'NOT_SUBMITTED'].includes(status)) {
      query['submittedData.source'] = 'CUSTOMER_FORM'; query['submittedData.processStatus'] = status;
      query.status = { $in: ['PENDING', 'VERIFIED'] };
    } else query.status = status;
  }
  if (partnerId) query.partnerId = partnerId;
  else if (typeof input.partnerId === 'string') query.partnerId = input.partnerId.toUpperCase();
  if (typeof input.search === 'string' && input.search.trim()) {
    const pattern = new RegExp(escapeRegex(input.search.trim().slice(0, 80)), 'i');
    query.$or = [{ leadId: pattern }, { clientName: pattern }, { clientMobile: pattern }, { accountId: pattern }, { campaignName: pattern }];
  }
  if (typeof input.campaignId === 'string' && input.campaignId && input.campaignId !== 'ALL') {
    const value = input.campaignId;
    const lookup = mongoose.isValidObjectId(value) ? { $or: [{ _id: value }, { slug: value }] } : { slug: value };
    const campaign: any = await Campaign.findOne(lookup).select('_id slug').lean().exec();
    if (!campaign) throw Object.assign(new Error('Campaign not found.'), { status: 400 });
    // Customer-form leads use Mongo IDs; manual reports use slugs. Match both without rewriting history.
    query.campaignId = { $in: [String(campaign._id), campaign.slug] };
  }
  for (const [field, operator] of [['startDate','$gte'],['endDate','$lte']] as const) {
    if (input[field] === undefined || input[field] === '') continue;
    if (typeof input[field] !== 'string') throw Object.assign(new Error('Invalid date filter.'), { status: 400 });
    const date = new Date(input[field] as string);
    if (!Number.isFinite(date.getTime())) throw Object.assign(new Error('Invalid date filter.'), { status: 400 });
    query.createdAt = { ...query.createdAt, [operator]: date };
  }
  if (query.createdAt?.$gte > query.createdAt?.$lte) throw Object.assign(new Error('Start date must precede end date.'), { status: 400 });
  return query;
}
