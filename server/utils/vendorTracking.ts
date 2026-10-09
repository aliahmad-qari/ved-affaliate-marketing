// mStock owns all parameters in its referral URLs. Keep VED attribution in
// TrackingClick; do not invent vendor click parameters without an agreed API.
export function preserveVendorTrackingUrl(target: URL): boolean {
  const host = target.hostname.toLowerCase();
  return host === 'mstock.com' || host.endsWith('.mstock.com');
}
