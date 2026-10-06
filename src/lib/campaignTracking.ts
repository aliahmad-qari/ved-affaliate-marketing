export function campaignSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/campaigns\/([^/]+)\/?$/i);
  if (!match) return null;
  try { return decodeURIComponent(match[1]).toLowerCase(); }
  catch { return null; }
}

export function campaignCaptureUrl(pathname: string, search: string, apiBase = ''): string | null {
  const slug = campaignSlugFromPath(pathname);
  if (!slug) return null;
  const params = new URLSearchParams(search);
  if (!params.has('ref') && !params.has('pid')) return null;
  const query = new URLSearchParams();
  for (const key of ['ref', 'pid']) {
    if (params.has(key)) query.set(key, params.get(key)!);
  }
  return `${apiBase.replace(/\/$/, '')}/api/public/campaigns/${encodeURIComponent(slug)}/go?${query}`;
}
