import { isValidPan, isValidIfsc, isValidUpi } from './partnerIdGenerator.ts';

// Shared by submission and admin approval; never accepts a client supplied status.
export function validateKyc(input: any): Record<string, string> {
  const errors: Record<string, string> = {};
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  if (!isValidPan(text(input?.pan))) errors.pan = 'Enter a valid PAN (e.g. ABCDE1234F).';
  if (!isValidUpi(text(input?.upiId))) errors.upiId = 'Enter a valid payout UPI ID.';
  const bank = input?.bankDetails;
  if (text(bank?.accountHolderName).length < 3) errors.accountHolderName = 'Account holder name must contain at least 3 characters.';
  if (!/^\d{6,20}$/.test(text(bank?.accountNumber))) errors.accountNumber = 'Enter a bank account number containing 6–20 digits.';
  if (!isValidIfsc(text(bank?.ifscCode))) errors.ifscCode = 'Enter a valid 11-character IFSC code.';
  if (text(bank?.bankName).length < 2) errors.bankName = 'Enter the bank name.';
  return errors;
}

export function normalizeKyc(input: any) {
  return {
    pan: input.pan.trim().toUpperCase(), upiId: input.upiId.trim().toLowerCase(),
    bankDetails: {
      accountHolderName: input.bankDetails.accountHolderName.trim(),
      accountNumber: input.bankDetails.accountNumber.trim(),
      ifscCode: input.bankDetails.ifscCode.trim().toUpperCase(),
      bankName: input.bankDetails.bankName.trim(),
    },
  };
}
