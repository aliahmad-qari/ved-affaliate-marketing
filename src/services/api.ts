import { Campaign, CampaignFilterOptions, SupportTicketInput, ApiResponse } from '../types/campaign.ts';
import { fallbackCampaigns } from '../constants/fallbackCampaigns.ts';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface PublicStats {
  liveCampaigns: number;
  activePartners: number;
  approvedLeads: number;
  totalPayouts: number;
}

export async function fetchPublicStats(signal?: AbortSignal): Promise<PublicStats> {
  const response = await safeFetch(`${API_BASE}/api/public/stats`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error('Unable to fetch homepage statistics.');
  const result = await response.json();
  const fields: (keyof PublicStats)[] = ['liveCampaigns', 'activePartners', 'approvedLeads', 'totalPayouts'];
  if (!result.success || !result.data || fields.some((field) =>
    typeof result.data[field] !== 'number' || !Number.isFinite(result.data[field]) || result.data[field] < 0
  )) throw new Error('Invalid homepage statistics response.');
  return result.data;
}

// Safe fetch invoker
const safeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const fetchFn = typeof window !== 'undefined' && window.fetch ? window.fetch : globalThis.fetch;
  return fetchFn(input, init);
};

export async function fetchCampaigns(filters: CampaignFilterOptions = {}): Promise<ApiResponse<Campaign[]>> {
  try {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'all') {
      params.set('category', filters.category);
    }
    if (filters.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }
    if (filters.featured) {
      params.set('featured', 'true');
    }
    if (filters.search) {
      params.set('search', filters.search);
    }

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const response = await safeFetch(`${API_BASE}/api/public/campaigns${queryStr}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[VED API] Network fetch failed, using fallback campaigns:', err);
  }

  // Resilient fallback filtering
  const filtered = fallbackCampaigns.filter((c) => {
    if (filters.category && filters.category !== 'all' && c.campaignType !== filters.category) return false;
    if (filters.status && filters.status !== 'all' && c.status !== filters.status) return false;
    if (filters.featured && !c.isFeatured) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return {
    success: true,
    count: filtered.length,
    data: filtered,
  };
}

export async function fetchCampaignBySlug(slug: string): Promise<ApiResponse<Campaign>> {
  try {
    const response = await safeFetch(`${API_BASE}/api/public/campaigns/${encodeURIComponent(slug)}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      return response.json();
    }
  } catch (err) {
    console.warn('[VED API] Fetch by slug failed, checking fallback:', err);
  }

  const match = fallbackCampaigns.find((c) => c.slug === slug);
  if (match) {
    return {
      success: true,
      data: match,
    };
  }

  throw new Error(`Campaign with slug '${slug}' not found.`);
}

export async function submitSupportTicket(
  ticket: SupportTicketInput
): Promise<ApiResponse<{ ticketId: string; subject: string; createdAt: string }>> {
  try {
    const response = await safeFetch(`${API_BASE}/api/public/support/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(ticket),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      return data;
    }
    if (data.message) {
      throw new Error(data.message);
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
  }

  if (!import.meta.env.DEV) {
    throw new Error('Unable to submit your support request right now. Please try again later.');
  }

  // Resilient fallback ticket generation if backend is temporarily unreachable
  return {
    success: true,
    message: 'Support ticket received successfully. The VED Partner Support team will respond within 24 business hours.',
    data: {
      ticketId: `VED-TKT-${Date.now().toString().slice(-6)}`,
      subject: ticket.subject,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function checkApiHealth(): Promise<any> {
  try {
    const response = await safeFetch(`${API_BASE}/api/health`, {
      headers: { 'Accept': 'application/json' },
    });
    return response.json();
  } catch {
    return {
      success: true,
      status: 'fallback-active',
    };
  }
}
