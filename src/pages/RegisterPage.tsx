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
  Mail,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { VedLogo } from '../components/ui/VedLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface RegisterPageProps {
  onNavigate: (tab: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register, verifySignupOtp, resendSignupOtp, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    city: '',
    state: '',
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
  const [signupStep, setSignupStep] = useState<'details' | 'otp'>('details');
  const [signupOtp, setSignupOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  // Parse referral code from URL if present (e.g. /register?ref=VED9X4K)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref') || urlParams.get('referral') || sessionStorage.getItem('ved_ref');
    if (ref) {
      setFormData((prev) => ({ ...prev, referralCodeInput: ref.toUpperCase().trim() }));
    }
  }, []);

  useEffect(() => {
    if (signupStep !== 'otp' || resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [signupStep, resendSeconds]);

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
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        referralCodeInput: formData.referralCodeInput || undefined,
      });
      setOtpMessage('If these details can be registered, a verification code has been sent. Check your inbox and spam folder.');
      setSignupStep('otp');
      setSignupOtp('');
      setResendSeconds(60);
    } catch (err: any) {
      if (err.errors) {
        setFieldErrors(err.errors);
      }
      setServerError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (!/^\d{6}$/.test(signupOtp)) {
      setServerError('Enter the 6-digit code from your email.');
      return;
    }
    try {
      setIsSubmitting(true);
      await verifySignupOtp(formData.email.trim().toLowerCase(), signupOtp);
      setIsSuccess(true);
      setTimeout(() => onNavigate('profile'), 1000);
    } catch (err: any) {
      setServerError(err.message || 'The verification code is invalid or expired.');
    } finally { setIsSubmitting(false); }
  };

  const handleResendOtp = async () => {
    setServerError(null);
    try {
      setIsSubmitting(true);
      const message = await resendSignupOtp(formData.email.trim().toLowerCase());
      setOtpMessage(message);
      setSignupOtp('');
      setResendSeconds(60);
    } catch (err: any) {
      setServerError(err.message || 'We could not send the verification email. Please try again shortly.');
    } finally { setIsSubmitting(false); }
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
          Create your partner account, then complete KYC in Profile to receive verified payouts.
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
      ) : signupStep === 'otp' ? (
        <form onSubmit={handleVerifyOtp} className="mx-auto max-w-lg bg-[#0B1325] border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/40 bg-[#121D36] text-[#D4AF37]"><Mail className="h-7 w-7" aria-hidden="true" /></div>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">Email verification</p>
            <h2 className="mt-2 text-xl sm:text-2xl font-bold text-[#F8FAFC]">Check your inbox</h2>
            <p className="mt-2 text-sm text-[#AAB3C2]">Enter the 6-digit code sent to <span className="font-medium text-[#F8FAFC]">{formData.email.trim().toLowerCase()}</span>. It expires in 10 minutes.</p>
          </div>
          {otpMessage && <p role="status" className="rounded-lg border border-[#D4AF37]/20 bg-[#070B14] p-3 text-xs text-[#C5CDD9]">{otpMessage}</p>}
          {serverError && <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{serverError}</div>}
          <label htmlFor="partner-signup-otp" className="block text-sm font-medium text-[#AAB3C2]">Verification code</label>
          <input id="partner-signup-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={signupOtp} onChange={event => setSignupOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-xl border border-[#35435C] bg-[#070B14] px-4 py-4 text-center font-mono text-2xl tracking-[0.45em] text-white outline-none focus:border-[#D4AF37]" aria-describedby="partner-signup-otp-help" />
          <p id="partner-signup-otp-help" className="text-center text-xs text-[#AAB3C2]">The code can be used once. Never share it with anyone.</p>
          <Button type="submit" variant="primary" size="lg" fullWidth disabled={isSubmitting || signupOtp.length !== 6}>{isSubmitting ? 'Verifying…' : 'Verify Email & Create Account'} <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          <div className="flex flex-col items-center gap-3 text-sm">
            <button type="button" disabled={isSubmitting || resendSeconds > 0} onClick={() => void handleResendOtp()} className="inline-flex items-center gap-2 text-[#D4AF37] hover:underline disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />{resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend verification code'}</button>
            <button type="button" disabled={isSubmitting} onClick={() => { setSignupStep('details'); setServerError(null); setSignupOtp(''); }} className="text-[#AAB3C2] hover:text-white disabled:opacity-50">Change signup details</button>
          </div>
        </form>
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

          <p className="rounded-lg border border-[#1C273C] bg-[#070B14] p-3 text-xs text-[#AAB3C2]">Complete PAN, bank and payout KYC from your Profile after registration. Admin verification is required before withdrawals.</p>
          {/* Security & Password */}
          <div className="pt-2 border-t border-[#1C273C]">
            <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider mb-3">
              <Lock className="w-4 h-4" />
              <span>2. Portal Security</span>
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
              <label className="flex text-xs font-medium text-[#AAB3C2] mb-1 items-center gap-1.5">
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
                Your referrer may earn a one-time ₹100 reward after you complete five valid Admin-approved leads.
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
              <span>{isSubmitting ? 'Sending Verification Code...' : 'Continue to Email Verification'}</span>
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
