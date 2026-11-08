export function buildVerifiedTrackingLink(slug: string, referralCode: string, partnerId: string, subTeamTrackingId = ''): string {
  const path = `/campaigns/${encodeURIComponent(slug)}`;
  const params = new URLSearchParams({ ref: referralCode, pid: partnerId });
  if (subTeamTrackingId) params.set('subteam', subTeamTrackingId);
  const query = params.toString();
  const configured = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL?.split(',')[0]?.trim() || '';
  if (!configured) return `${path}?${query}`;
  try {
    const base = new URL(configured);
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) return `${path}?${query}`;
    return new URL(`${path}?${query}`, base.origin).toString();
  } catch { return `${path}?${query}`; }
}
