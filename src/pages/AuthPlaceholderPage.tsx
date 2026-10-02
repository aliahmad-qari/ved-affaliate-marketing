import React from 'react';
import { ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { WhatsAppButton } from '../components/ui/WhatsAppButton.tsx';
import { VedLogo } from '../components/ui/VedLogo.tsx';

interface AuthPlaceholderPageProps {
  mode: 'login' | 'register';
  onNavigate: (tab: string) => void;
}

export const AuthPlaceholderPage: React.FC<AuthPlaceholderPageProps> = ({ mode, onNavigate }) => {
  const isRegister = mode === 'register';

  return (
    <div className="py-12 sm:py-20 max-w-xl mx-auto px-4">
      <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-6 sm:p-8 text-center relative shadow-2xl">
        
        {/* Official Logo */}
        <div className="flex justify-center mb-4">
          <VedLogo size="lg" variant="badge" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#070B14] border border-[#D4AF37]/40 text-xs font-semibold text-[#D4AF37] mb-2">
          <span>Milestone 2 Onboarding</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] mb-1">
          {isRegister ? 'Partner Registration' : 'Partner Sign In'}
        </h1>

        <p className="text-xs text-[#D4AF37] font-semibold uppercase tracking-wider mb-4">
          VED AFFILIATE PVT. LIMITED
        </p>

        <p className="text-xs sm:text-sm text-[#AAB3C2] leading-relaxed mb-6">
          {isRegister
            ? 'Partner registration with manual PAN verification, bank KYC submission, and unique Partner ID is coming in Milestone 2.'
            : 'Partner sign-in with JWT security and live wallet dashboard access will launch in Milestone 2.'}
        </p>

        {/* Required Fields Preview */}
        <div className="bg-[#070B14] border border-[#1C273C] rounded-xl p-4 text-left mb-6">
          <div className="text-xs font-bold text-[#F8FAFC] flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Onboarding Fields</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-[#AAB3C2]">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Full Name & Mobile</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Email & City</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>PAN (Manual KYC)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Bank & UPI ID</span>
            </div>
          </div>
        </div>

        {/* WhatsApp & Navigation */}
        <div className="space-y-3">
          <WhatsAppButton
            phoneNumber="7064866056"
            defaultMessage="Hello VED Affiliate Team, I want to pre-register as a partner."
            className="w-full"
          />

          <div className="flex items-center justify-center gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => onNavigate('campaigns')}>
              View Campaigns
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('home')}>
              Home
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
