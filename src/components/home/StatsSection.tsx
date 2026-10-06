import React, { useEffect, useState } from 'react';
import { Layers, Users, CheckCircle, IndianRupee } from 'lucide-react';
import { fetchPublicStats, type PublicStats } from '../../services/api.ts';

export const StatsSection: React.FC = () => {
  const [data, setData] = useState<PublicStats | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicStats(controller.signal)
      .then((stats) => { if (!controller.signal.aborted) setData(stats); })
      .catch(() => { /* Keep placeholders when real statistics are unavailable. */ });
    return () => controller.abort();
  }, []);

  const formatCount = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString('en-IN');
  const stats = [
    {
      label: 'Live Campaigns',
      value: formatCount(data?.liveCampaigns),
      detail: 'Demat, Trading & AMC',
      icon: Layers,
    },
    {
      label: 'Active Partners',
      value: formatCount(data?.activePartners),
      detail: 'Partner accounts',
      icon: Users,
    },
    {
      label: 'Approved Leads',
      value: formatCount(data?.approvedLeads),
      detail: 'Verified campaign conversions',
      icon: CheckCircle,
    },
    {
      label: 'Total Payouts',
      value: data ? `₹${data.totalPayouts.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '₹—',
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
