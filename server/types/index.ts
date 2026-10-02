export type CampaignStatus = 'LIVE' | 'PAUSED' | 'DRAFT' | 'ENDED';

export type CampaignCategory = 
  | 'Demat & Trading' 
  | 'Mutual Funds' 
  | 'Banking & Credit' 
  | 'Fintech & Wallets';

export interface ICampaign {
  name: string;
  slug: string;
  companyName: string;
  campaignType: CampaignCategory;
  description: string;
  requiredAction: string;
  payout: number | null;
  currency: string;
  payoutTerms: string;
  rules: string[];
  status: CampaignStatus;
  logoUrl?: string;
  baseTrackingUrl?: string; // Private, not sent to public clients
  startDate?: Date;
  endDate?: Date;
  isFeatured: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISupportTicket {
  ticketId?: string;
  name: string;
  email: string;
  mobile: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt?: Date;
}

export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
export type UserRole = 'PARTNER' | 'ADMIN';

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}

export interface IPartner {
  partnerId: string;
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  pan: string;
  bankDetails: BankDetails;
  upiId: string;
  passwordHash: string;
  role: UserRole;
  accountStatus: AccountStatus;
  kycStatus: KycStatus;
  kycRejectionReason?: string;
  referralCode: string;
  referredBy?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuthTokenPayload {
  id: string;
  partnerId: string;
  email: string;
  role: UserRole;
  iat?: number;
  issuedAtMs?: number;
}

// Milestone 3: Lead & Financial Domain Types
export type LeadStatus = 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface ILead {
  leadId: string;
  partnerId: string;
  campaignId: string;
  campaignName: string;
  campaignType?: string;
  clientName: string;
  clientMobile: string;
  accountId: string;
  action: string;
  submittedData?: Record<string, any>;
  status: LeadStatus;
  payoutSnapshot: number;
  currency: string;
  rejectionReason?: string;
  verifiedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  paidAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TransactionType = 'LEAD_EARNING' | 'REFERRAL_REWARD' | 'WITHDRAWAL' | 'ADJUSTMENT';
export type TransactionStatus = 'PENDING' | 'AVAILABLE' | 'PROCESSED' | 'REJECTED' | 'CANCELLED';

export interface IWalletTransaction {
  transactionId: string;
  partnerId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  referenceType: 'LEAD' | 'REFERRAL' | 'WITHDRAWAL_REQUEST' | 'ADMIN';
  referenceId: string;
  description: string;
  paymentMethod?: 'UPI' | 'BANK_TRANSFER';
  payoutDestination?: string;
  createdAt?: Date;
  updatedAt?: Date;
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
