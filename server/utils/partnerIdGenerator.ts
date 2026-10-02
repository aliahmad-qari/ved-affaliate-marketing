import crypto from 'crypto';

export function generatePartnerId(): string {
  // Generates unique, non-guess-dependent Partner ID e.g. VED-PTR-9X4K2A
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VED-PTR-${randomSuffix}`;
}

export function generateReferralCode(prefix = 'VED'): string {
  // Generates unique referral code e.g. VED7M2Q
  const randomChars = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${randomChars}`;
}

// Validation helpers
export function isValidPan(pan: string): boolean {
  if (!pan || typeof pan !== 'string') return false;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
}

export function isValidMobile(mobile: string): boolean {
  if (!mobile || typeof mobile !== 'string') return false;
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(mobile.trim());
}

export function isValidUpi(upi: string): boolean {
  if (!upi || typeof upi !== 'string') return false;
  // Standard UPI format: username@bank / mobile@upi
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return upiRegex.test(upi.trim().toLowerCase());
}

export function isValidIfsc(ifsc: string): boolean {
  if (!ifsc || typeof ifsc !== 'string') return false;
  // Standard RBI IFSC format: 4 alphabetic characters, 0, and 6 alphanumeric characters
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
}
