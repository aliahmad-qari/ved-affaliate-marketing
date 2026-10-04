export type CampaignStatus = 'LIVE' | 'PAUSED' | 'DRAFT' | 'ENDED';

export type CampaignCategory = 
  | 'Demat & Trading' 
  | 'Mutual Funds' 
  | 'Banking & Credit' 
  | 'Fintech & Wallets';

export interface CampaignTerms {
  eligibility?: string;
  validationRejection?: string;
  payoutTimeline?: string;
  duplicateFraudRules?: string;
}

export interface Campaign {
  _id?: string;
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
  terms?: CampaignTerms;
  status: CampaignStatus;
  logoUrl?: string;
  startDate?: string;
  endDate?: string | null;
  isFeatured: boolean;
  sortOrder: number;
}

export interface CampaignFilterOptions {
  category?: string;
  status?: string;
  featured?: boolean;
  search?: string;
}

export interface SupportTicketInput {
  name: string;
  email: string;
  mobile: string;
  subject: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
  meta?: Record<string, any>;
}
