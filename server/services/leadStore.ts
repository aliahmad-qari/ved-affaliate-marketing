import mongoose from 'mongoose';
import { Lead } from '../models/Lead.ts';
import { WalletTransaction } from '../models/WalletTransaction.ts';
import { ILead, IWalletTransaction, DashboardSummary, LeadStatus } from '../types/index.ts';
import { isMongooseReady } from './partnerStore.ts';
import { generateLeadId, generateTransactionId } from '../utils/idGenerator.ts';

// In-memory fallback stores
const memoryLeads: ILead[] = [];
const memoryTransactions: IWalletTransaction[] = [];

export const LeadStore = {
  async createLead(data: {
    partnerId: string;
    campaignId: string;
    campaignName: string;
    campaignType?: string;
    clientName: string;
    clientMobile: string;
    accountId: string;
    action: string;
    submittedData?: Record<string, any>;
    payoutSnapshot: number;
  }): Promise<ILead> {
    const cleanAccountId = data.accountId.trim();

    // Check for duplicate account submission by same partner for same campaign
    if (isMongooseReady()) {
      const existing = await Lead.findOne({
        partnerId: data.partnerId.toUpperCase(),
        campaignId: data.campaignId,
        accountId: cleanAccountId,
      }).exec();

      if (existing) {
        const error: any = new Error(
          `A lead with Account/Reference ID '${cleanAccountId}' has already been submitted for this campaign.`
        );
        error.code = 'DUPLICATE_LEAD';
        error.status = 409;
        throw error;
      }

      const leadId = generateLeadId();
      const newLead = new Lead({
        ...data,
        partnerId: data.partnerId.toUpperCase(),
        accountId: cleanAccountId,
        leadId,
        status: 'PENDING', // Submissions ALWAYS start as PENDING
        rejectionReason: '',
        currency: 'INR',
      });

      await newLead.save();
      return newLead.toJSON();
    }

    // Memory fallback
    const duplicate = memoryLeads.find(
      (l) =>
        l.partnerId === data.partnerId.toUpperCase() &&
        l.campaignId === data.campaignId &&
        l.accountId.toLowerCase() === cleanAccountId.toLowerCase()
    );

    if (duplicate) {
      const error: any = new Error(
        `A lead with Account/Reference ID '${cleanAccountId}' has already been submitted for this campaign.`
      );
      error.code = 'DUPLICATE_LEAD';
      error.status = 409;
      throw error;
    }

    const lead: ILead = {
      ...data,
      partnerId: data.partnerId.toUpperCase(),
      accountId: cleanAccountId,
      leadId: generateLeadId(),
      status: 'PENDING',
      currency: 'INR',
      rejectionReason: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryLeads.unshift(lead);
    return JSON.parse(JSON.stringify(lead));
  },

  async findLeadsByPartner(
    partnerId: string,
    options: {
      status?: string;
      search?: string;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<{ leads: ILead[]; total: number }> {
    const pId = partnerId.toUpperCase();
    const { status, search, limit = 50, skip = 0 } = options;

    if (isMongooseReady()) {
      const query: Record<string, any> = { partnerId: pId };

      if (status && status !== 'ALL') {
        query.status = status.toUpperCase();
      }

      if (search && search.trim()) {
        const s = search.trim();
        query.$or = [
          { leadId: { $regex: s, $options: 'i' } },
          { clientName: { $regex: s, $options: 'i' } },
          { clientMobile: { $regex: s, $options: 'i' } },
          { accountId: { $regex: s, $options: 'i' } },
          { campaignName: { $regex: s, $options: 'i' } },
        ];
      }

      const total = await Lead.countDocuments(query);
      const docs = await Lead.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      return {
        leads: docs.map((d) => d.toJSON()),
        total,
      };
    }

    // Memory fallback
    let filtered = memoryLeads.filter((l) => l.partnerId === pId);

    if (status && status !== 'ALL') {
      filtered = filtered.filter((l) => l.status === status.toUpperCase());
    }

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.leadId.toLowerCase().includes(s) ||
          l.clientName.toLowerCase().includes(s) ||
          l.clientMobile.includes(s) ||
          l.accountId.toLowerCase().includes(s) ||
          l.campaignName.toLowerCase().includes(s)
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    return {
      leads: JSON.parse(JSON.stringify(paginated)),
      total,
    };
  },

  async getDashboardSummary(partnerId: string): Promise<DashboardSummary> {
    const pId = partnerId.toUpperCase();
    let leads: ILead[] = [];
    let transactions: IWalletTransaction[] = [];

    if (isMongooseReady()) {
      leads = await Lead.find({ partnerId: pId }).exec();
      transactions = await WalletTransaction.find({ partnerId: pId }).exec();
    } else {
      leads = memoryLeads.filter((l) => l.partnerId === pId);
      transactions = memoryTransactions.filter((t) => t.partnerId === pId);
    }

    let pendingEarnings = 0;
    let approvedEarnings = 0;
    let paidEarnings = 0;

    let successfulLeads = 0;
    let rejectedLeads = 0;
    let pendingLeads = 0;

    for (const lead of leads) {
      const payout = Number(lead.payoutSnapshot) || 0;
      switch (lead.status) {
        case 'PENDING':
        case 'VERIFIED':
          pendingEarnings += payout;
          pendingLeads++;
          break;
        case 'APPROVED':
          approvedEarnings += payout;
          successfulLeads++;
          break;
        case 'PAID':
          paidEarnings += payout;
          successfulLeads++;
          break;
        case 'REJECTED':
          rejectedLeads++;
          break;
      }
    }

    // Include referral rewards or adjustments if any
    let referralRewards = 0;
    let totalWithdrawn = 0;
    let pendingWithdrawals = 0;

    for (const tx of transactions) {
      if (tx.type === 'REFERRAL_REWARD' && (tx.status === 'AVAILABLE' || tx.status === 'PROCESSED')) {
        referralRewards += tx.amount;
      }
      if (tx.type === 'WITHDRAWAL') {
        if (tx.status === 'PROCESSED') {
          totalWithdrawn += tx.amount;
        } else if (tx.status === 'PENDING') {
          pendingWithdrawals += tx.amount;
        }
      }
    }

    // Available Wallet Balance = (Approved Earnings + Referral Rewards) - (Total Withdrawn + Pending Withdrawals)
    const totalEarned = approvedEarnings + paidEarnings + referralRewards;
    const availableWalletBalance = Math.max(0, approvedEarnings + referralRewards - (totalWithdrawn + pendingWithdrawals));

    return {
      totalEarnings: Math.round(totalEarned * 100) / 100,
      pendingEarnings: Math.round(pendingEarnings * 100) / 100,
      approvedEarnings: Math.round(approvedEarnings * 100) / 100,
      paidEarnings: Math.round(paidEarnings * 100) / 100,
      totalLeads: leads.length,
      successfulLeads,
      rejectedLeads,
      pendingLeads,
      availableWalletBalance: Math.round(availableWalletBalance * 100) / 100,
      totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
    };
  },

  async getEarningsBreakdown(
    partnerId: string,
    filter: 'today' | 'week' | 'month' | 'all' | 'custom' = 'all',
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const pId = partnerId.toUpperCase();
    let leads: ILead[] = [];

    if (isMongooseReady()) {
      leads = await Lead.find({ partnerId: pId }).sort({ createdAt: -1 }).exec();
    } else {
      leads = memoryLeads.filter((l) => l.partnerId === pId);
    }

    const now = new Date();
    let filterStart: Date | null = null;
    let filterEnd: Date | null = null;

    if (filter === 'today') {
      filterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      filterEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (filter === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      filterStart = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
      filterEnd = new Date();
    } else if (filter === 'month') {
      filterStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      filterEnd = new Date();
    } else if (filter === 'custom' && startDate) {
      filterStart = new Date(startDate);
      filterEnd = endDate ? new Date(endDate) : new Date();
    }

    const results = leads.filter((l) => {
      if (!filterStart) return true;
      const created = new Date(l.createdAt || now);
      if (filterEnd) {
        return created >= filterStart && created <= filterEnd;
      }
      return created >= filterStart;
    });

    return results.map((l) => ({
      leadId: l.leadId,
      campaignName: l.campaignName,
      campaignType: l.campaignType,
      accountId: l.accountId,
      action: l.action,
      payoutSnapshot: l.payoutSnapshot,
      currency: l.currency,
      status: l.status,
      date: l.createdAt,
    }));
  },

  async getWalletTransactions(partnerId: string): Promise<IWalletTransaction[]> {
    const pId = partnerId.toUpperCase();
    if (isMongooseReady()) {
      const docs = await WalletTransaction.find({ partnerId: pId })
        .sort({ createdAt: -1 })
        .exec();
      return docs.map((d) => d.toJSON());
    }

    const list = memoryTransactions.filter((t) => t.partnerId === pId);
    return JSON.parse(JSON.stringify(list)).sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async requestWithdrawal(
    partnerId: string,
    amount: number,
    paymentMethod: 'UPI' | 'BANK_TRANSFER',
    destination: string
  ): Promise<IWalletTransaction> {
    const pId = partnerId.toUpperCase();
    const cleanAmount = Math.round(Number(amount) * 100) / 100;

    if (isNaN(cleanAmount) || cleanAmount < 200) {
      const error: any = new Error('Minimum withdrawal amount is ₹200.');
      error.status = 400;
      throw error;
    }

    // Check available balance
    const summary = await this.getDashboardSummary(pId);
    if (cleanAmount > summary.availableWalletBalance) {
      const error: any = new Error(
        `Insufficient available wallet balance. Available: ₹${summary.availableWalletBalance}, Requested: ₹${cleanAmount}.`
      );
      error.status = 400;
      throw error;
    }

    const transactionId = generateTransactionId();
    const txData: IWalletTransaction = {
      transactionId,
      partnerId: pId,
      type: 'WITHDRAWAL',
      amount: cleanAmount,
      status: 'PENDING', // Admin reviews & processes manually
      referenceType: 'WITHDRAWAL_REQUEST',
      referenceId: transactionId,
      description: `Withdrawal request of ₹${cleanAmount} via ${paymentMethod}`,
      paymentMethod,
      payoutDestination: destination,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongooseReady()) {
      const tx = new WalletTransaction(txData);
      await tx.save();
      return tx.toJSON();
    }

    memoryTransactions.unshift(txData);
    return JSON.parse(JSON.stringify(txData));
  },
};
