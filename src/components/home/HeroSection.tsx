import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { VedLogo } from '../ui/VedLogo.tsx';

interface HeroSectionProps {
  onNavigate: (tab: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate }) => {
  return (
    <section className="relative overflow-hidden pt-8 pb-12 sm:pt-14 sm:pb-18 bg-[#05080E] border-b border-[#1C273C]">
      {/* Golden Ambient Glow */}
      <div 
        aria-hidden="true" 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-100 pointer-events-none opacity-25 bg-[radial-gradient(circle_at_50%_0%,#D4AF37_0%,transparent_70%)]" 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Punchy Headline & CTAs */}
          <div className="lg:col-span-7 space-y-5 text-left">
            {/* Tagline */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1424] border border-[#D4AF37]/30 text-xs font-semibold text-[#D4AF37]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              <span>Promote • Earn • Grow</span>
            </div>

            {/* Display Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F8FAFC] tracking-tight leading-[1.15]">
              Promote Financial Apps. <br />
              <span className="text-[#D4AF37]">Earn on Verified Leads.</span>
            </h1>

            {/* Concise Value Proposition */}
            <p className="text-sm sm:text-base text-[#AAB3C2] leading-relaxed max-w-xl">
              VED AFFILIATE connects partners with leading Indian Demat, Trading, and Mutual Fund campaigns. Submit eligible leads and withdraw earnings directly.
            </p>

            {/* 4 Bullet Points */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs sm:text-sm text-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>12+ Financial Campaigns</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Admin Verified Manual Lead Approval</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Minimum Withdrawal Only ₹200 (UPI/Bank)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>₹50 Referral Bonus (T&C apply)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <Button
                variant="primary"
                size="lg"
                onClick={() => onNavigate('register')}
                className="group"
              >
                <span>JOIN AS PARTNER</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={() => onNavigate('campaigns')}
              >
                VIEW CAMPAIGNS
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => onNavigate('login')}
              >
                PARTNER LOGIN
              </Button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-[#AAB3C2]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Transparent process: All leads verified by Admin before payment.</span>
            </div>
          </div>

          {/* Right Column: Prominent Official Logo Emblem & Badge */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm bg-[#0B1222] border border-[#1C273C] hover:border-[#D4AF37]/50 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden group transition-all duration-300">
              
              {/* Subtle tech circuit background glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(212,175,55,0.12),transparent_70%)] pointer-events-none" />

              {/* Official Full VED Logo */}
              <VedLogo size="xl" variant="full" className="relative z-10 mb-4 transform group-hover:scale-105 transition-transform duration-300" />

              <div className="relative z-10 pt-4 border-t border-[#1C273C] w-full text-center">
                <p className="text-xs font-semibold text-[#F8FAFC]">
                  Partner Platform
                </p>
                <p className="text-[11px] text-[#AAB3C2] mt-0.5">
                  Rourkela, Odisha, India
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
