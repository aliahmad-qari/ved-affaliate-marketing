import crypto from 'crypto';

export function generateLeadId(): string {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VED-LD-${suffix}`;
}

export function generateTransactionId(): string {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VED-TXN-${suffix}`;
}
