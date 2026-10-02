import React from 'react';
import { Layers, LineChart, LayoutDashboard, Shield, IndianRupee, Gift } from 'lucide-react';

export const WhyChooseSection: React.FC = () => {
  const benefits = [
    {
      title: 'Top Brokerages',
      desc: 'Angel One, Upstox, Choice, Nirmal Bang, 5Paisa & Mutual Funds.',
      icon: Layers,
    },
    {
      title: 'Transparent Tracking',
      desc: 'Real-time Pending, Approved, and Paid status reporting.',
      icon: LineChart,
    },
    {
      title: 'Partner Dashboard',
      desc: 'Dedicated mobile-first portal to manage leads and payouts.',
      icon: LayoutDashboard,
    },
    {
      title: 'Manual KYC Security',
      desc: 'Manual PAN & Bank verification for partner fraud prevention.',
      icon: Shield,
    },
    {
      title: 'Min ₹200 Withdrawal',
      desc: 'Direct payment to your Indian Bank Account or UPI ID.',
      icon: IndianRupee,
    },
    {
      title: '₹50 Referral Bonus',
      desc: '₹50 referral bonus, subject to eligibility and campaign terms.',
      icon: Gift,
    },
  ];

  return (
    <section className="py-12 sm:py-16 bg-[#0D1527] border-b border-[#1C273C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <div className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold mb-1">
            Partner Advantages
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
            Why Partner with VED
          </h2>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {benefits.map((benefit, idx) => {
            const Icon = benefit.icon;
            return (
              <div
                key={idx}
                className="bg-[#121C34] border border-[#1F2E4F] hover:border-[#D4AF37]/50 rounded-xl p-5 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#182544] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-3 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#F8FAFC] mb-1">
                  {benefit.title}
                </h3>
                <p className="text-xs text-[#AAB3C2] leading-relaxed">
                  {benefit.desc}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
