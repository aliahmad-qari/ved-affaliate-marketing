import React from 'react';
import { Users, UserCheck, ListChecks, BadgeCheck, Clock3, IndianRupee, Wallet, CreditCard, ArrowUpRight, ShieldCheck, LockKeyhole, FileCheck2 } from 'lucide-react';

export const AdminOverview: React.FC<{ metrics: Record<string, number> | null; onSelect: (tab: string) => void }> = ({ metrics, onSelect }) => {
  const items = [
    { label: 'Total Partners', key: 'totalPartners', icon: Users, color: '#38bdf8', target: 'partners', note: 'Registered partner accounts' },
    { label: 'Active Partners', key: 'activePartners', icon: UserCheck, color: '#34d399', target: 'partners', note: 'Accounts ready to promote' },
    { label: 'Total Leads', key: 'totalLeads', icon: ListChecks, color: '#60a5fa', target: 'leads', note: 'All campaign submissions' },
    { label: 'Approved Leads', key: 'approvedLeads', icon: BadgeCheck, color: '#fbbf24', target: 'leads', note: 'Approved and paid conversions' },
    { label: 'Pending Leads', key: 'pendingLeads', icon: Clock3, color: '#22d3ee', target: 'leads', note: 'Awaiting review or approval' },
    { label: 'Total Earnings', key: 'totalEarnings', icon: IndianRupee, color: '#d4af37', target: 'reports', money: true, note: 'Approved campaign earnings' },
    { label: 'Pending Payout', key: 'pendingPayout', icon: Wallet, color: '#f472b6', target: 'withdrawals', money: true, note: 'Approved earnings awaiting payment' },
    { label: 'Paid Payout', key: 'paidPayout', icon: CreditCard, color: '#2dd4bf', target: 'withdrawals', money: true, note: 'Recorded completed payments' },
    { label: 'Withdrawal Requests', key: 'withdrawalRequests', icon: Wallet, color: '#38bdf8', target: 'withdrawals', note: 'Open requests for admin review' },
  ];
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.2em] text-sky-400">Business at a glance</p><h2 className="text-xl font-bold text-white">Platform overview</h2></div><span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-300">Database totals · All time</span></div>
    <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 lg:grid-cols-3">
      {items.map(({ key, label, icon: Icon, color, target, money, note }) => <button key={key} onClick={() => onSelect(target)} className="group relative overflow-hidden rounded-xl border border-sky-900/50 bg-gradient-to-br from-[#112844] to-[#0b152a] p-5 text-left transition hover:-translate-y-0.5 hover:border-sky-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
        <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ color, backgroundColor: `${color}18` }}><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-300">{label}</p><p className="my-1.5 text-2xl font-bold tabular-nums text-white">{metrics?.[key] === undefined ? '—' : money ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(metrics[key]) : metrics[key].toLocaleString('en-IN')}</p><p className="text-[10px] leading-4 text-slate-400">{note}</p></div><ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:text-sky-300" /></div>
      </button>)}
    </div>
    <div className="grid gap-4 rounded-xl border border-cyan-700/30 bg-gradient-to-r from-cyan-950/60 to-[#0e1a2d] p-5 md:grid-cols-[1.3fr_1fr_1fr]">
      {[{ icon: ShieldCheck, title: 'Admin-controlled operations', text: 'Review leads and partner payout requests.' }, { icon: LockKeyhole, title: 'Protected administration', text: 'Actions require an authenticated admin account.' }, { icon: FileCheck2, title: 'Recorded activity', text: 'Review payout decisions in the audit log.' }].map(({ icon: Icon, title, text }) => <div key={title} className="flex items-center gap-3"><Icon className="h-8 w-8 shrink-0 text-cyan-300" /><div><p className="text-xs font-semibold text-white">{title}</p><p className="mt-1 text-[11px] leading-4 text-slate-400">{text}</p></div></div>)}
    </div>
  </div>;
};
