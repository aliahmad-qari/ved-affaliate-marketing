import React from 'react';
import { Target, Award, Users, CheckCircle2, ArrowRight, MapPin, Mail, Phone } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { VedLogo } from '../components/ui/VedLogo.tsx';

interface AboutPageProps {
  onNavigate: (tab: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <div className="py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
        
        {/* Header with Logo */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-[#1C273C] pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1424] border border-[#D4AF37]/30 text-xs font-semibold text-[#D4AF37] mb-3">
              <span>Corporate Overview</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight">
              About VED AFFILIATE
            </h1>
            <p className="text-sm font-semibold text-[#D4AF37] mt-1 uppercase tracking-wider">
              Promote • Earn • Grow
            </p>
            <p className="text-xs sm:text-sm text-[#AAB3C2] mt-2 max-w-xl">
              VED AFFILIATE PVT. LIMITED is an Indian partner marketing company headquartered in Rourkela, Odisha, connecting affiliates with leading financial and wealth brands.
            </p>
          </div>

          <div className="bg-[#0B1220] border border-[#1C273C] p-4 rounded-2xl flex items-center justify-center shrink-0">
            <VedLogo size="lg" variant="badge" />
          </div>
        </div>

        {/* 3 Pillar Cards with Contrast */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#0D1424] border border-[#1C273C] hover:border-[#D4AF37]/40 rounded-xl p-5 sm:p-6 transition-colors">
            <Target className="w-8 h-8 text-[#D4AF37] mb-3" />
            <h3 className="text-base font-bold text-[#F8FAFC] mb-2">Our Mission</h3>
            <p className="text-xs sm:text-sm text-[#AAB3C2] leading-relaxed">
              Empower Indian publishers, influencers, and financial partners to earn structured commissions promoting verified brokerages and mutual fund schemes.
            </p>
          </div>

          <div className="bg-[#080D18] border border-[#1C273C] hover:border-[#D4AF37]/40 rounded-xl p-5 sm:p-6 transition-colors">
            <Award className="w-8 h-8 text-[#D4AF37] mb-3" />
            <h3 className="text-base font-bold text-[#F8FAFC] mb-2">Manual Verification</h3>
            <p className="text-xs sm:text-sm text-[#AAB3C2] leading-relaxed">
              Every lead submitted by partners undergoes strict compliance review against broker vendor records to ensure authentic client acquisition.
            </p>
          </div>

          <div className="bg-[#0D1424] border border-[#1C273C] hover:border-[#D4AF37]/40 rounded-xl p-5 sm:p-6 transition-colors">
            <Users className="w-8 h-8 text-[#D4AF37] mb-3" />
            <h3 className="text-base font-bold text-[#F8FAFC] mb-2">Reliable Payouts</h3>
            <p className="text-xs sm:text-sm text-[#AAB3C2] leading-relaxed">
              Minimum withdrawal of ₹200 processed directly to Indian Bank Accounts or UPI IDs with transaction reference numbers recorded by Admin.
            </p>
          </div>
        </div>

        {/* Operational Flow */}
        <div className="bg-[#080C16] border border-[#1C273C] rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-[#F8FAFC] mb-4">
            How the Platform Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-[#AAB3C2]">
            <div className="flex items-start gap-2 bg-[#0E1526] p-3 rounded-lg border border-[#1C273C]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Partners access live campaigns (Angel One, Upstox, Choice, etc.).</span>
            </div>
            <div className="flex items-start gap-2 bg-[#0E1526] p-3 rounded-lg border border-[#1C273C]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Clients complete online KYC and digital onboarding.</span>
            </div>
            <div className="flex items-start gap-2 bg-[#0E1526] p-3 rounded-lg border border-[#1C273C]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Partner submits lead record via the portal (status: Pending).</span>
            </div>
            <div className="flex items-start gap-2 bg-[#0E1526] p-3 rounded-lg border border-[#1C273C]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Admin verifies and approves lead, releasing wallet earnings.</span>
            </div>
          </div>
        </div>

        {/* Contact Strip */}
        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#F8FAFC]">Corporate Office</h3>
            <p className="text-xs text-[#AAB3C2] flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Rourkela, Odisha, India</span>
              <span className="text-[#AAB3C2]" aria-hidden="true">·</span>
              <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>vedaffiliateltd@gmail.com</span>
              <span className="text-[#AAB3C2]" aria-hidden="true">·</span>
              <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>7064866056</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => onNavigate('register')}>
              <span>Join as Partner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onNavigate('campaigns')}>
              View Campaigns
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
