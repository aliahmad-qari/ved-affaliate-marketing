import React from 'react';
import { Layers, LineChart, LayoutDashboard, Shield, IndianRupee, Gift } from 'lucide-react';

export const WhyChooseSection: React.FC = () => {
  const benefits = [
    {
      title: 'Top Brokerage Network',
      desc: 'Access campaigns from leading brokers, fintech platforms and mutual fund partners.',
      icon: Layers,
    },
    {
      title: 'Real-Time Tracking',
      desc: 'Track leads, approvals and payouts from the dashboard.',
      icon: LineChart,
    },
    {
      title: 'Partner Dashboard',
      desc: 'Manage campaigns, leads, earnings and withdrawals seamlessly.',
      icon: LayoutDashboard,
    },
    {
      title: 'Verified Partner KYC',
      desc: 'Secure PAN and bank verification for safer partner payments.',
      icon: Shield,
    },
    {
      title: 'Easy Withdrawals',
      desc: 'Request eligible earnings through bank transfer or UPI.',
      icon: IndianRupee,
    },
    {
      title: '₹50 Referral Reward',
      desc: 'Earn an additional ₹50 for eligible partner referrals, subject to the approved first-task rule.',
      icon: Gift,
    },
  ];

  return (
    <section className="py-12 sm:py-16 bg-[#0D1527] border-b border-[#1C273C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-7">
          <div className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold mb-1">
            Partner Advantages
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#F8FAFC]">
            Why Partner with <span className="text-[#D4AF37]">VED</span>
          </h2>
          <p className="mt-2 text-xs sm:text-sm leading-5 text-[#AAB3C2]">More Opportunities • Better Tools • Bigger Earnings</p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {benefits.map((benefit, idx) => {
            const Icon = benefit.icon;
            return (
              <div
                key={idx}
                className="flex min-w-0 items-start gap-3 bg-gradient-to-br from-[#101D32] to-[#080F1D] border border-[#D4AF37]/30 rounded-xl p-4 sm:p-5 shadow-lg shadow-black/10 group"
              >
                <div className="w-11 h-11 shrink-0 rounded-lg bg-[#D4AF37]/5 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 border-l border-[#D4AF37]/15 pl-3"><h3 className="text-base font-bold text-[#F8FAFC] mb-1">
                  {benefit.title}
                </h3>
                <p className="text-sm text-[#AAB3C2] leading-relaxed">
                  {benefit.desc}
                </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
