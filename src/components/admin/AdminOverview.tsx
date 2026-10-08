import React from 'react';
import { Users, UserCheck, ListChecks, BadgeCheck, Clock3, IndianRupee, Wallet, CreditCard, ArrowUpRight, ShieldCheck, LockKeyhole, FileCheck2 } from 'lucide-react';

export const AdminOverview: React.FC<{ metrics: Record<string, number> | null; onSelect: (tab: string) => void }> = ({ metrics, onSelect }) => {
  const items = [
    { label: 'Total Partners', key: 'totalPartners', icon: Users, color: '#10b981', bgColor: '#064e3b', target: 'partners', note: 'Registered partner accounts' },
    { label: 'Active Partners', key: 'activePartners', icon: UserCheck, color: '#34d399', bgColor: '#065f46', target: 'partners', note: 'Accounts ready to promote' },
    { label: 'Total Leads', key: 'totalLeads', icon: ListChecks, color: '#60a5fa', bgColor: '#1e3a8a', target: 'leads', note: 'All campaign submissions' },
    { label: 'Approved Leads', key: 'approvedLeads', icon: BadgeCheck, color: '#fbbf24', bgColor: '#78350f', target: 'leads', note: 'Approved and paid conversions' },
    { label: 'Pending Leads', key: 'pendingLeads', icon: Clock3, color: '#22d3ee', bgColor: '#164e63', target: 'leads', note: 'Awaiting review or approval' },
    { label: 'Total Earnings', key: 'totalEarnings', icon: IndianRupee, color: '#d4af37', bgColor: '#542e0a', target: 'reports', money: true, note: 'Approved campaign earnings' },
    { label: 'Pending Payout', key: 'pendingPayout', icon: Wallet, color: '#f472b6', bgColor: '#831843', target: 'withdrawals', money: true, note: 'Approved earnings awaiting payment' },
    { label: 'Paid Payout', key: 'paidPayout', icon: CreditCard, color: '#2dd4bf', bgColor: '#134e4a', target: 'withdrawals', money: true, note: 'Recorded completed payments' },
    { label: 'Withdrawal Requests', key: 'withdrawalRequests', icon: Wallet, color: '#38bdf8', bgColor: '#0c4a6e', target: 'withdrawals', note: 'Open requests for admin review' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">Business at a glance</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">Platform Overview</h2>
        </div>
        <span className="rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-2 text-xs font-semibold text-[#D4AF37]">
          Database totals · All time
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 lg:grid-cols-3">
        {items.map(({ key, label, icon: Icon, color, bgColor, target, money, note }) => (
          <button 
            key={key} 
            onClick={() => onSelect(target)} 
            className="group relative overflow-hidden rounded-xl border border-[#1E2E4E] bg-gradient-to-br from-[#0B1325] to-[#070B14] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#D4AF37]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
            <div className="flex items-start gap-4">
              <span 
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                style={{ color, backgroundColor: `${color}18` }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#AAB3C2]">{label}</p>
                <p className="my-2 text-2xl font-bold tabular-nums text-[#F8FAFC]">
                  {metrics?.[key] === undefined 
                    ? '—' 
                    : money 
                      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(metrics[key]) 
                      : metrics[key].toLocaleString('en-IN')
                  }
                </p>
                <p className="text-[10px] leading-4 text-[#8F9DB2]">{note}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-[#AAB3C2] transition group-hover:text-[#D4AF37] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </button>
        ))}
      </div>

      {/* Security Features */}
      <div className="grid gap-4 rounded-xl border border-[#1E2E4E] bg-gradient-to-br from-[#0B1325] to-[#070B14] p-5 md:grid-cols-3 shadow-lg">
        {[
          { icon: ShieldCheck, title: 'Admin-Controlled Operations', text: 'Review leads and partner payout requests.' },
          { icon: LockKeyhole, title: 'Protected Administration', text: 'Actions require an authenticated admin account.' },
          { icon: FileCheck2, title: 'Recorded Activity', text: 'Review payout decisions in the audit log.' }
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-[#D4AF37]/5 border border-[#D4AF37]/20">
            <Icon className="h-6 w-6 shrink-0 text-[#D4AF37] mt-1" />
            <div>
              <p className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">{title}</p>
              <p className="mt-1.5 text-[11px] leading-4 text-[#AAB3C2]">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
