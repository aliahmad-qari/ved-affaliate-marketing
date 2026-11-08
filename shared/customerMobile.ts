/** Normalize supported Indian mobile formats to the ten-digit national form. */
export function normalizeCustomerMobile(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40 || !/^[+\d\s()-]+$/.test(value)) return null;
  const mobile = value.trim().replace(/[\s()-]/g, '').replace(/^(?:\+91|91)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(mobile) ? mobile : null;
}
