import React from 'react';
import { UserPlus, Compass, Send, ShieldCheck, Wallet, ArrowDownToLine, AlertCircle } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Partner Registration',
      desc: 'Sign up with KYC and bank details.',
      icon: UserPlus,
    },
    {
      num: '02',
      title: 'Choose Campaign',
      desc: 'Pick from active Demat & Mutual Fund apps.',
      icon: Compass,
    },
    {
      num: '03',
      title: 'Process & Submit Lead',
      desc: 'Submit client lead details in Partner Portal.',
      icon: Send,
    },
    {
      num: '04',
      title: 'Admin Verification',
      desc: 'Admin cross-checks with vendor records.',
      icon: ShieldCheck,
      highlight: true,
    },
    {
      num: '05',
      title: 'Commission Credited',
      desc: 'Approved leads release wallet earnings.',
      icon: Wallet,
    },
    {
      num: '06',
      title: 'Withdraw Payout',
      desc: 'Withdrawal request to registered Bank / UPI, subject to verification and processing (Min ₹200).',
      icon: ArrowDownToLine,
    },
  ];

  return (
    <section className="py-12 sm:py-16 bg-[#04060C] border-b border-[#1C273C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <div className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold mb-1">
            Simple 6 Steps
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
            How It Works
          </h2>
          <p className="text-xs sm:text-sm text-[#AAB3C2] mt-1">
            From registration to verified bank withdrawal.
          </p>
        </div>

        {/* 6 Steps Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className={`bg-[#0A0E18] border rounded-xl p-4 flex flex-col justify-between transition-colors ${
                  step.highlight
                    ? 'border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.15)]'
                    : 'border-[#1C273C]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-[#D4AF37]">
                      {step.num}
                    </span>
                    <Icon className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#F8FAFC] mb-1">
                    {step.title}
                  </h3>
                  <p className="text-[11px] text-[#AAB3C2] leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rule Notice */}
        <div className="mt-8 bg-[#0B101D] border border-amber-900/50 rounded-xl p-3.5 sm:p-4 flex items-center gap-3 text-xs text-[#AAB3C2]">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong className="text-[#F8FAFC]">Verification Policy: </strong>
            Lead submission does not automatically approve commission. Admin manually confirms validity before payout.
          </span>
        </div>

      </div>
    </section>
  );
};
