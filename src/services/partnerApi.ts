import {
  DashboardData,
  PartnerCampaignItem,
  LeadItem,
  SubmitLeadInput,
  WalletData,
  ReferralsData,
  EarningsItem,
} from '../types/partner.ts';
import { getInMemoryToken } from './authApi.ts';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function partnerFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  const token = getInMemoryToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    error.errors = data.errors;
    throw error;
  }

  return data;
}

export async function fetchPartnerDashboard(): Promise<DashboardData> {
  const res = await partnerFetch('/api/partner/dashboard');
  return res.data;
}

export async function fetchPartnerCampaigns(): Promise<PartnerCampaignItem[]> {
  const res = await partnerFetch('/api/partner/campaigns');
  return res.data;
}

export async function submitPartnerLead(input: SubmitLeadInput): Promise<LeadItem> {
  const res = await partnerFetch('/api/partner/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function fetchPartnerLeads(params: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ leads: LeadItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const res = await partnerFetch(`/api/partner/leads${qs ? `?${qs}` : ''}`);
  return {
    leads: res.data,
    total: res.total,
  };
}

export async function fetchPartnerEarnings(filter: string = 'all'): Promise<{
  summary: { totalEarnings: number; pendingEarnings: number; approvedEarnings: number; paidEarnings: number };
  items: EarningsItem[];
}> {
  const res = await partnerFetch(`/api/partner/earnings?filter=${filter}`);
  return {
    summary: res.summary,
    items: res.data,
  };
}

export async function fetchPartnerWallet(): Promise<WalletData> {
  const res = await partnerFetch('/api/partner/wallet');
  return res.data;
}

export async function requestPartnerWithdrawal(data: {
  amount: number;
  paymentMethod: 'UPI' | 'BANK_TRANSFER';
  destination?: string;
}): Promise<any> {
  const res = await partnerFetch('/api/partner/wallet/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res;
}

export async function fetchPartnerReferrals(): Promise<ReferralsData> {
  const res = await partnerFetch('/api/partner/referrals');
  return res.data;
}
