import {
  Partner,
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from '../types/auth.ts';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// In-memory token storage (if cross-origin without 3rd party cookies)
let inMemoryToken: string | null = null;

export function setInMemoryToken(token: string | null) {
  inMemoryToken = token;
}

export function getInMemoryToken(): string | null {
  return inMemoryToken;
}

async function authFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (inMemoryToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Ensures HTTP-only cookies are passed
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.errors = data.errors;
    error.code = data.code;
    throw error;
  }

  return data;
}

export async function registerPartner(input: RegisterInput): Promise<{ partner: Partner; token: string }> {
  const res = await authFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (res.data && res.data.token) {
    setInMemoryToken(res.data.token);
  }
  return res.data;
}

export async function loginPartner(input: LoginInput): Promise<{ partner: Partner; token: string }> {
  const res = await authFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (res.data && res.data.token) {
    setInMemoryToken(res.data.token);
  }
  return res.data;
}

export async function logoutPartner(): Promise<void> {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    setInMemoryToken(null);
  }
}

export async function getCurrentUser(): Promise<Partner | null> {
  try {
    const res = await authFetch('/api/auth/me');
    return res.data;
  } catch {
    return null;
  }
}

export async function forgotPasswordRequest(email: string): Promise<string> {
  const res = await authFetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.message;
}

export async function getPartnerProfile(): Promise<Partner> {
  const res = await authFetch('/api/partner/profile');
  return res.data;
}

export async function updatePartnerProfile(input: UpdateProfileInput): Promise<Partner> {
  const res = await authFetch('/api/partner/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function changePartnerPassword(input: ChangePasswordInput): Promise<string> {
  const res = await authFetch('/api/partner/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.message;
}
