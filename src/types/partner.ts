export type LeadStatus = 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface LeadItem {
  _id?: string;
  leadId: string;
  partnerId: string;
  campaignId: string;
  campaignName: string;
  campaignType?: string;
  clientName: string;
  clientMobile: string;
  accountId: string;
  action: string;
  submittedData?: {
    notes?: string;
    submittedIp?: string;
  };
  status: LeadStatus;
  payoutSnapshot: number;
  currency: string;
  rejectionReason?: string;
  verifiedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardSummary {
  totalEarnings: number;
  pendingEarnings: number;
  approvedEarnings: number;
  paidEarnings: number;
  totalLeads: number;
  successfulLeads: number;
  rejectedLeads: number;
  pendingLeads: number;
  availableWalletBalance: number;
  totalWithdrawn: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  recentLeads: LeadItem[];
}

export interface PartnerCampaignItem {
  _id?: string;
  name: string;
  slug: string;
  companyName: string;
  campaignType: string;
  description: string;
  requiredAction: string;
  payout: number | null;
  currency: string;
  payoutTerms: string;
  rules: string[];
  terms?: {
    eligibility?: string;
    validationRejection?: string;
    payoutTimeline?: string;
    duplicateFraudRules?: string;
  };
  status: string;
  logoUrl?: string;
  trackingUrl: string;
  whatsappShareUrl: string;
  isFeatured?: boolean;
}

export interface SubmitLeadInput {
  campaignId: string;
  clientName: string;
  clientMobile: string;
  accountId: string;
  submittedNotes?: string;
}

export interface WalletTransactionItem {
  _id?: string;
  transactionId: string;
  partnerId: string;
  type: 'LEAD_EARNING' | 'REFERRAL_REWARD' | 'WITHDRAWAL' | 'ADJUSTMENT';
  amount: number;
  status: 'PENDING' | 'AVAILABLE' | 'PROCESSING' | 'APPROVED' | 'PROCESSED' | 'PAID' | 'REJECTED' | 'CANCELLED';
  referenceType: string;
  referenceId: string;
  description: string;
  paymentMethod?: 'UPI' | 'BANK_TRANSFER';
  payoutDestination?: string;
  createdAt: string;
}

export interface WalletData {
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  minimumWithdrawal: number;
  transactions: WalletTransactionItem[];
}

export interface ReferredPartnerItem {
  partnerId: string;
  fullName: string;
  maskedMobile: string;
  joinDate: string;
  taskStatus: 'COMPLETED' | 'PENDING_FIRST_TASK';
  rewardAmount: number;
  rewardEarned: boolean;
}

export interface ReferralsData {
  referralCode: string;
  referralLink: string;
  rewardPerActiveReferral: number;
  totalReferred: number;
  qualifiedReferred: number;
  pendingReferred: number;
  earnedRewards: number;
  potentialRewards: number;
  referredPartners: ReferredPartnerItem[];
}

export interface EarningsItem {
  leadId: string;
  campaignName: string;
  campaignType?: string;
  accountId: string;
  action: string;
  payoutSnapshot: number;
  currency: string;
  status: LeadStatus;
  date: string;
}
