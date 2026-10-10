export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
export type UserRole = 'PARTNER' | 'ADMIN';

export interface BankDetails {
  accountHolderName: string;
  accountNumber?: string;
  maskedAccountNumber?: string;
  ifscCode: string;
  bankName: string;
}

export interface Partner {
  _id?: string;
  id?: string;
  partnerId: string;
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  pan?: string;
  maskedPan?: string;
  bankDetails?: BankDetails;
  upiId?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  kycStatus: KycStatus;
  kycRejectionReason?: string;
  referralCode: string;
  referredBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterInput {
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  pan?: string;
  bankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  upiId?: string;
  password: string;
  confirmPassword: string;
  referralCodeInput?: string;
}

export interface LoginInput {
  identifier: string; // Email OR Mobile
  password: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  city?: string;
  state?: string;
  upiId?: string;
  bankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface KycInput {
  pan: string;
  upiId: string;
  bankDetails: { accountHolderName: string; accountNumber: string; ifscCode: string; bankName: string };
}
