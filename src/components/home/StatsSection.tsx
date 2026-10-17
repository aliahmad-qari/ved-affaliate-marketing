import React, { useEffect, useState } from 'react';
import { Megaphone, Users, ShieldCheck, Wallet } from 'lucide-react';
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
      detail: 'Active product campaigns',
      icon: Megaphone,
    },
    {
      label: 'Active Partners',
      value: formatCount(data?.activePartners),
      detail: 'Active partner accounts',
      icon: Users,
    },
    {
      label: 'Approved Leads',
      value: formatCount(data?.approvedLeads),
      detail: 'Verified campaign conversions',
      icon: ShieldCheck,
    },
    {
      label: 'Total Payouts',
      value: data ? `₹${data.totalPayouts.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '₹—',
      detail: 'Direct Bank & UPI',
      icon: Wallet,
    },
  ];

  return (
    <section className="py-8 sm:py-10 bg-[#030b14] border-b border-[#173247]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                style={{ borderBottomColor: ['#19d6b1','#b694ff','#40bdff','#f2ce63'][idx] }} className="min-w-0 rounded-xl border border-b-4 border-[#20506c] bg-gradient-to-br from-[#0b2334] to-[#08101f] p-4 transition-colors hover:border-[#D4AF37]/50 sm:p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#AAB3C2] font-semibold">
                    {stat.label}
                  </span>
                  <Icon aria-hidden="true" style={{ color: ['#19d6b1','#b694ff','#40bdff','#f2ce63'][idx] }} className="ml-2 h-6 w-6 shrink-0" strokeWidth={1.8} />
                </div>
                
                <div className="mb-1 break-words font-mono text-2xl font-extrabold tabular-nums tracking-tight text-[#F8FAFC] min-[400px]:text-3xl sm:text-4xl">
                  {stat.value}
                </div>

                <div className="text-xs text-[#AAB3C2]">
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
