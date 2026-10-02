import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, LogIn, AlertCircle, ArrowRight, CheckCircle2, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { VedLogo } from '../components/ui/VedLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { forgotPasswordRequest } from '../services/authApi.ts';

interface LoginPageProps {
  onNavigate: (tab: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, isAuthenticated } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      onNavigate('profile');
    }
  }, [isAuthenticated, onNavigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Please enter your registered Email address or 10-digit Mobile number.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    try {
      setIsLoading(true);
      await login({
        identifier: identifier.trim(),
        password,
      });
      onNavigate('profile');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid credentials. Please verify your Email/Mobile and Password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    try {
      setForgotLoading(true);
      const msg = await forgotPasswordRequest(forgotEmail.trim());
      setForgotSuccessMessage(msg);
    } catch (err: any) {
      setForgotSuccessMessage(
        'If an account with that email address is registered, instructions to reset your password have been sent.'
      );
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="py-12 sm:py-20 max-w-md mx-auto px-4">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-3">
          <VedLogo size="lg" variant="badge" />
        </div>
        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#0D1424] border border-[#D4AF37]/30 text-xs font-semibold text-[#D4AF37] mb-2">
          <span>Partner Access Portal</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
          Sign In to Your Account
        </h1>
        <p className="text-xs text-[#AAB3C2] mt-1">
          VED AFFILIATE PVT. LIMITED · Secure Partner Session
        </p>
      </div>

      <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
        {errorMessage && (
          <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
              Email Address or 10-Digit Mobile *
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. partner@example.com or 9876543210"
              className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-[#F8FAFC] outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[#AAB3C2]">
                Password *
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotSuccessMessage(null);
                }}
                className="text-[11px] text-[#D4AF37] hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password"
                className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-[#F8FAFC] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#AAB3C2] hover:text-[#F8FAFC]"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={isLoading}
            className="mt-2"
          >
            <LogIn className="w-4 h-4 mr-1.5" />
            <span>{isLoading ? 'Verifying Credentials...' : 'Sign In as Partner'}</span>
          </Button>
        </form>

        <div className="pt-4 border-t border-[#1C273C] text-center text-xs text-[#AAB3C2]">
          <span>Not registered yet? </span>
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="text-[#D4AF37] font-semibold hover:underline inline-flex items-center cursor-pointer ml-1"
          >
            <span>Join as Partner</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-[#0D1424] border border-[#1C273C] rounded-2xl p-6 shadow-2xl text-left">
            <div className="flex items-center gap-2 text-[#D4AF37] mb-2">
              <KeyRound className="w-5 h-5" />
              <h3 className="text-base font-bold text-[#F8FAFC]">Password Recovery</h3>
            </div>
            <p className="text-xs text-[#AAB3C2] mb-4">
              Enter your registered email address to receive password reset instructions.
            </p>

            {forgotSuccessMessage ? (
              <div className="space-y-4">
                <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-3 text-xs text-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{forgotSuccessMessage}</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setShowForgotModal(false)}
                >
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                    Registered Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForgotModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Processing...' : 'Send Reset Link'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
