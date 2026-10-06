const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function adminFetch(path: string, init: RequestInit = {}): Promise<any> {
  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/json');
  const response = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv') || contentType.includes('spreadsheetml')) return response.blob();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed with status ${response.status}`);
  return data;
}

export const adminApi = {
  get: (path: string) => adminFetch(path),
  post: (path: string, body?: unknown) => adminFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
  patch: (path: string, body?: unknown) => adminFetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
  delete: (path: string) => adminFetch(path, { method: 'DELETE' }),
  upload: (path: string, file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return adminFetch(path, { method: 'POST', body: form });
  },
  login: (email: string, password: string) => adminFetch('/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }),
  me: () => adminFetch('/admin/auth/me'),
  logout: () => adminFetch('/auth/logout', { method: 'POST' }),
};