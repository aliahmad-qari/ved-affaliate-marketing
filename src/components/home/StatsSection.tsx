import React from 'react';
import { Layers, Users, CheckCircle, IndianRupee } from 'lucide-react';

interface StatsSectionProps {
  campaignCount: number;
}

export const StatsSection: React.FC<StatsSectionProps> = ({ campaignCount }) => {
  const stats = [
    {
      label: 'Live Campaigns',
      value: campaignCount > 0 ? `${campaignCount}` : '12',
      detail: 'Demat, Trading & AMC',
      icon: Layers,
    },
    {
      label: 'Active Partners',
      value: '—',
      detail: 'Partner accounts',
      icon: Users,
    },
    {
      label: 'Approved Leads',
      value: '—',
      detail: 'Verified campaign conversions',
      icon: CheckCircle,
    },
    {
      label: 'Total Payouts',
      value: '₹—',
      detail: 'Direct Bank & UPI',
      icon: IndianRupee,
    },
  ];

  return (
    <section className="py-8 sm:py-10 bg-[#0B1325] border-b border-[#1C273C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="bg-[#101A31] border border-[#1E2C48] hover:border-[#D4AF37]/50 rounded-xl p-4 sm:p-5 transition-colors group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#AAB3C2] font-semibold">
                    {stat.label}
                  </span>
                  <Icon className="w-4 h-4 text-[#D4AF37]" />
                </div>
                
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-[#F8FAFC] tracking-tight mb-1">
                  {stat.value}
                </div>

                <div className="text-[11px] text-[#AAB3C2]">
                  {stat.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
