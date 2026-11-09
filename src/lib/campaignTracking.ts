export function campaignSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/campaigns\/([^/]+)\/?$/i);
  if (!match) return null;
  try { return decodeURIComponent(match[1]).toLowerCase(); }
  catch { return null; }
}

/** Build the frontend campaign link copied by partner campaign cards. */
export function buildPartnerCampaignUrl(origin: string, slug: string, referralCode: string, partnerId: string, subTeamTrackingId = ''): string {
  const safeSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(safeSlug)) throw new TypeError('Invalid campaign slug.');
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new TypeError('Invalid application origin.');
  const url = new URL(`/campaigns/${encodeURIComponent(safeSlug)}`, base.origin);
  url.searchParams.set('ref', referralCode.trim());
  url.searchParams.set('pid', partnerId.trim());
  if (subTeamTrackingId) url.searchParams.set('subteam', subTeamTrackingId);
  return url.toString();
}

function safeApiOrigin(apiBase: string): string {
  const value = apiBase.trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) return '';
    return url.origin;
  } catch {
    return '';
  }
}

export function campaignCaptureUrl(pathname: string, search: string, apiBase = ''): string | null {
  const slug = campaignSlugFromPath(pathname);
  if (!slug) return null;
  const params = new URLSearchParams(search);
  const ref = params.get('ref')?.trim() || '';
  const pid = params.get('pid')?.trim() || '';
  const codePattern = /^[A-Za-z0-9-]{3,40}$/;
  if (!codePattern.test(ref) || !codePattern.test(pid)) return null;
  const query = new URLSearchParams();
  for (const key of ['ref', 'pid', 'subteam']) {
    if (params.has(key)) query.set(key, params.get(key)!);
  }
  return `${safeApiOrigin(apiBase)}/api/public/campaigns/${encodeURIComponent(slug)}/go?${query}`;
}
