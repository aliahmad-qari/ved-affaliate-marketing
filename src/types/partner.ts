export type LeadStatus = 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface LeadItem {
  _id?: string;
  leadId: string;
  partnerId: string;
  referringPartnerName?: string | null;
  campaignId: string;
  campaignName: string;
  campaignType?: string;
  clientName?: string;
  clientMobile?: string;
  accountId: string;
  action: string;
  submittedData?: {
    notes?: string;
    submittedIp?: string;
    source?: 'CUSTOMER_FORM';
    processStatus?: 'IN_PROCESS' | 'NOT_SUBMITTED';
    consentAt?: string;
    consentVersion?: string;
  };
  status: LeadStatus;
  payoutSnapshot: number;
  payoutTypeSnapshot?: 'FIXED' | 'PERCENTAGE';
  payoutBasisSnapshot?: 'LOAN_DISBURSED_AMOUNT' | 'INSURANCE_ELIGIBLE_PREMIUM';
  payoutRateSnapshot?: number | null;
  payoutTermsSnapshot?: string;
  payoutEligibilitySnapshot?: Record<string, string>;
  payoutCommission?: {
    state: 'AWAITING_REVIEW' | 'REPORT_REJECTED' | 'PENDING' | 'AVAILABLE' | 'REVERSED';
    reportedBaseAmount?: number;
    verifiedBaseAmount?: number;
    calculatedAmount?: number;
    advertiserName?: string;
    advertiserReference?: string;
    reportReference?: string;
    reportDate?: string;
    evidenceReference?: string;
    verificationDetails?: string;
    verifiedBy?: string;
    verifiedAt?: string;
    receiptReference?: string;
    receiptEvidenceReference?: string;
    receiptConfirmedAt?: string;
  };
  commissionSummary?: { state: 'AWAITING_REVIEW' | 'REPORT_REJECTED' | 'PENDING' | 'AVAILABLE' | 'REVERSED'; verifiedBaseAmount?: number; calculatedAmount?: number; receiptConfirmed?: boolean };
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
  payoutType?: 'FIXED' | 'PERCENTAGE';
  payoutBasis?: 'LOAN_DISBURSED_AMOUNT' | 'INSURANCE_ELIGIBLE_PREMIUM';
  payoutPercentage?: number | null;
  payoutSnapshot?: number;
  payoutRateSnapshot?: number | null;
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
  subTeamLinkId?: string;
}

export interface PartnerSubTeamLinkItem {
  _id: string;
  campaignId: string;
  campaignSlug: string;
  campaignName: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  clickCount: number;
  leads: number;
  approvedConversions: number;
  attributedEarnings: number;
  trackingUrl?: string;
  createdAt?: string;
}

export interface PartnerMonthlyLeaderboardData {
  monthKey: string;
  timeZone: string;
  rankings: { rank: number; partnerId: string; fullName: string; approvedConversions: number }[];
  rewards: { _id: string; rewardType: string; label: string; amount: number; currency: string; paymentStatus: 'PENDING' | 'PROCESSING' | 'PAID'; paidAt?: string }[];
}

export interface WalletTransactionItem {
  direction?: 'DEBIT' | 'CREDIT';
  reversedBy?: string;
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
  totalDisbursed?: number;
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
  approvedLeadCount: number;
  requiredApprovedLeads: number;
  taskStatus: 'REWARDED' | 'IN_PROGRESS' | 'REVIEW_REQUIRED';
  rewardAmount: number;
  rewardStatus: string;
  rewardEarned: boolean;
  priorRewardExists: boolean;
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
  commissionSummary?: { state: 'AWAITING_REVIEW' | 'REPORT_REJECTED' | 'PENDING' | 'AVAILABLE' | 'REVERSED'; verifiedBaseAmount?: number; calculatedAmount?: number };
  currency: string;
  status: LeadStatus;
  date: string;
}
