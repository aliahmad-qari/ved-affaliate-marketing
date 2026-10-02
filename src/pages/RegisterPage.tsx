import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  UserCheck,
  Shield,
  Building,
  CreditCard,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Gift,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { VedLogo } from '../components/ui/VedLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface RegisterPageProps {
  onNavigate: (tab: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    city: '',
    state: '',
    pan: '',
    bankDetails: {
      accountHolderName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
    },
    upiId: '',
    password: '',
    confirmPassword: '',
    referralCodeInput: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Parse referral code from URL if present (e.g. /register?ref=VED9X4K)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref') || urlParams.get('referral');
    if (ref) {
      setFormData((prev) => ({ ...prev, referralCodeInput: ref.toUpperCase().trim() }));
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      onNavigate('profile');
    }
  }, [isAuthenticated, onNavigate]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.fullName.trim() || formData.fullName.trim().length < 3) {
      errors.fullName = 'Full Name must be at least 3 characters.';
    }

    if (!/^[6-9]\d{9}$/.test(formData.mobile.trim())) {
      errors.mobile = 'Enter a valid 10-digit Indian mobile number.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    if (!formData.city.trim()) {
      errors.city = 'City is required.';
    }

    if (!formData.state.trim()) {
      errors.state = 'State is required.';
    }

    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan.trim().toUpperCase())) {
      errors.pan = 'Valid 10-digit Indian PAN required (e.g. ABCDE1234F).';
    }

    if (!formData.bankDetails.accountHolderName.trim()) {
      errors.accountHolderName = 'Account Holder Name is required.';
    }

    if (!formData.bankDetails.accountNumber.trim() || formData.bankDetails.accountNumber.trim().length < 6) {
      errors.accountNumber = 'Valid account number required.';
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.bankDetails.ifscCode.trim().toUpperCase())) {
      errors.ifscCode = 'Valid 11-character IFSC required (e.g. HDFC0001234).';
    }

    if (!formData.bankDetails.bankName.trim()) {
      errors.bankName = 'Bank Name is required.';
    }

    if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(formData.upiId.trim())) {
      errors.upiId = 'Valid UPI ID required (e.g. name@bank).';
    }

    if (formData.password.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(formData.password)) {
      errors.password = 'Must be 8+ characters and contain letters and numbers.';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);
      await register({
        fullName: formData.fullName,
        mobile: formData.mobile,
        email: formData.email,
        city: formData.city,
        state: formData.state,
        pan: formData.pan.toUpperCase(),
        bankDetails: {
          accountHolderName: formData.bankDetails.accountHolderName,
          accountNumber: formData.bankDetails.accountNumber,
          ifscCode: formData.bankDetails.ifscCode.toUpperCase(),
          bankName: formData.bankDetails.bankName,
        },
        upiId: formData.upiId.toLowerCase(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        referralCodeInput: formData.referralCodeInput || undefined,
      });

      setIsSuccess(true);
      setTimeout(() => {
        onNavigate('profile');
      }, 1500);
    } catch (err: any) {
      if (err.errors) {
        setFieldErrors(err.errors);
      }
      setServerError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-8 sm:py-14 max-w-3xl mx-auto px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-3">
          <VedLogo size="lg" variant="badge" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1424] border border-[#D4AF37]/40 text-xs font-semibold text-[#D4AF37] mb-2">
          <span>Partner Enrollment</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
          Join VED AFFILIATE
        </h1>
        <p className="text-xs sm:text-sm text-[#AAB3C2] mt-1 max-w-md mx-auto">
          Create your verified partner account to promote financial campaigns and receive verified bank payouts.
        </p>
      </div>

      {isSuccess ? (
        <div className="bg-[#0B1325] border border-emerald-500/40 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-bold text-[#F8FAFC]">Registration Successful!</h2>
          <p className="text-xs sm:text-sm text-[#AAB3C2]">
            Your partner record has been created. Redirecting to your partner profile...
          </p>
          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={() => onNavigate('profile')}>
              Proceed to Profile
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-5 sm:p-8 shadow-2xl space-y-6">
          
          {serverError && (
            <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-3.5 text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Section 1: Personal Details */}
          <div>
            <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider mb-3">
              <UserCheck className="w-4 h-4" />
              <span>1. Partner Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Full Name (as on PAN) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Rajesh Kumar"
                  className={`w-full bg-[#070B14] border ${
                    fieldErrors.fullName ? 'border-rose-500' : 'border-[#1C273C]'
                  } focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none`}
                />
                {fieldErrors.fullName && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.fullName}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Mobile Number (10 digits) *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '') })}
                  placeholder="e.g. 9876543210"
                  className={`w-full bg-[#070B14] border ${
                    fieldErrors.mobile ? 'border-rose-500' : 'border-[#1C273C]'
                  } focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none font-mono`}
                />
                {fieldErrors.mobile && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.mobile}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. partner@example.com"
                  className={`w-full bg-[#070B14] border ${
                    fieldErrors.email ? 'border-rose-500' : 'border-[#1C273C]'
                  } focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none`}
                />
                {fieldErrors.email && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Rourkela"
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                  />
                  {fieldErrors.city && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.city}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Odisha"
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                  />
                  {fieldErrors.state && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.state}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: KYC & PAN */}
          <div className="pt-2 border-t border-[#1C273C]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
                <Shield className="w-4 h-4" />
                <span>2. Manual PAN & Identity</span>
              </div>
              <span className="text-[11px] text-amber-400 font-medium bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                Manual Admin Review
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Permanent Account Number (PAN) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={formData.pan}
                  onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  placeholder="e.g. ABCDE1234F"
                  className={`w-full bg-[#070B14] border ${
                    fieldErrors.pan ? 'border-rose-500' : 'border-[#1C273C]'
                  } focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none font-mono uppercase`}
                />
                {fieldErrors.pan && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.pan}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Primary UPI ID (for payouts) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.upiId}
                  onChange={(e) => setFormData({ ...formData, upiId: e.target.value.toLowerCase() })}
                  placeholder="e.g. partner@okhdfcbank"
                  className={`w-full bg-[#070B14] border ${
                    fieldErrors.upiId ? 'border-rose-500' : 'border-[#1C273C]'
                  } focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none font-mono`}
                />
                {fieldErrors.upiId && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.upiId}</p>}
              </div>
            </div>
          </div>

          {/* Section 3: Bank Account */}
          <div className="pt-2 border-t border-[#1C273C]">
            <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider mb-3">
              <Building className="w-4 h-4" />
              <span>3. Bank Account (for Direct Wire)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.bankDetails.accountHolderName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankDetails: { ...formData.bankDetails, accountHolderName: e.target.value },
                    })
                  }
                  placeholder="Name as registered with bank"
                  className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                />
                {fieldErrors.accountHolderName && (
                  <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.accountHolderName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Account Number *
                </label>
                <input
                  type="password"
                  required
                  value={formData.bankDetails.accountNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankDetails: { ...formData.bankDetails, accountNumber: e.target.value.replace(/\D/g, '') },
                    })
                  }
                  placeholder="Enter Bank Account Number"
                  className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none font-mono"
                />
                {fieldErrors.accountNumber && (
                  <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.accountNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Bank IFSC Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={11}
                  value={formData.bankDetails.ifscCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankDetails: { ...formData.bankDetails, ifscCode: e.target.value.toUpperCase() },
                    })
                  }
                  placeholder="e.g. HDFC0001234"
                  className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none font-mono uppercase"
                />
                {fieldErrors.ifscCode && (
                  <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.ifscCode}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Bank Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.bankDetails.bankName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankDetails: { ...formData.bankDetails, bankName: e.target.value },
                    })
                  }
                  placeholder="e.g. HDFC Bank Ltd"
                  className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                />
                {fieldErrors.bankName && (
                  <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.bankName}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Security & Password */}
          <div className="pt-2 border-t border-[#1C273C]">
            <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider mb-3">
              <Lock className="w-4 h-4" />
              <span>4. Portal Security</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Password (8+ chars, letters & numbers) *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className={`w-full bg-[#070B14] border ${
                      fieldErrors.password ? 'border-rose-500' : 'border-[#1C273C]'
                    } focus:border-[#D4AF37] rounded-lg pl-3 pr-10 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#AAB3C2] hover:text-[#F8FAFC]"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.password}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    className={`w-full bg-[#070B14] border ${
                      fieldErrors.confirmPassword ? 'border-rose-500' : 'border-[#1C273C]'
                    } focus:border-[#D4AF37] rounded-lg pl-3 pr-10 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-[#AAB3C2] hover:text-[#F8FAFC]"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Optional Referral Code */}
            <div className="mt-3.5 pt-3 border-t border-[#1C273C]/60">
              <label className="block text-xs font-medium text-[#AAB3C2] mb-1 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Referral Code (Optional)</span>
              </label>
              <input
                type="text"
                value={formData.referralCodeInput}
                onChange={(e) => setFormData({ ...formData, referralCodeInput: e.target.value.toUpperCase() })}
                placeholder="e.g. VED7M2Q"
                className="w-full sm:w-1/2 bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none font-mono uppercase"
              />
              <p className="text-[11px] text-[#AAB3C2] mt-1">
                Your referrer may earn a ₹50 referral bonus, subject to eligibility and campaign terms.
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting}
            >
              <span>{isSubmitting ? 'Creating Partner Account...' : 'Complete Partner Registration'}</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>

          <div className="text-center pt-2 text-xs text-[#AAB3C2]">
            <span>Already registered with VED AFFILIATE? </span>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-[#D4AF37] hover:underline font-semibold cursor-pointer"
            >
              Partner Sign In
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
