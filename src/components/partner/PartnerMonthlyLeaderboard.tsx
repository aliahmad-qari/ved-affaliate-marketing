import React, { useEffect, useState } from 'react';
import { Award, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { fetchPartnerMonthlyLeaderboard } from '../../services/partnerApi.ts';
import { PartnerMonthlyLeaderboardData } from '../../types/partner.ts';
import { monthKeyInTimeZone, shiftMonth } from '../../../shared/monthlyLeaderboard.ts';

const monthLabel = (monthKey: string) => new Date(`${monthKey}-15T12:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const money = (value: number, currency: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

export function PartnerMonthlyLeaderboard() {
  const [month, setMonth] = useState(() => monthKeyInTimeZone());
  const [data, setData] = useState<PartnerMonthlyLeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentMonth = monthKeyInTimeZone();

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPartnerMonthlyLeaderboard(month)
      .then(result => { if (active) { setData(result); setError(''); } })
      .catch(err => { if (active) setError(err.message || 'Unable to load this month\'s leaderboard.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month]);

  return <section className="space-y-4 rounded-2xl border border-[#1E2E4E] bg-gradient-to-br from-[#0B1325] to-[#070B14] p-4 shadow-lg sm:p-5" aria-labelledby="monthly-leaderboard-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="monthly-leaderboard-title" className="flex items-center gap-2 text-base font-bold text-white"><Trophy className="h-5 w-5 text-[#D4AF37]" />Monthly Partner Leaderboard</h2><p className="mt-1 text-xs leading-5 text-[#AAB3C2]">Only admin-approved conversions count. Reporting month: {data?.timeZone || 'Asia/Kolkata'}.</p></div>
      <div className="flex items-center gap-2"><button type="button" aria-label="Previous month" onClick={() => setMonth(value => shiftMonth(value, -1))} className="rounded-lg border border-[#263650] p-2 text-slate-300 hover:border-[#D4AF37] hover:text-[#D4AF37]"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-32 text-center text-sm font-semibold text-white">{monthLabel(month)}</span><button type="button" aria-label="Next month" disabled={month >= currentMonth} onClick={() => setMonth(value => shiftMonth(value, 1))} className="rounded-lg border border-[#263650] p-2 text-slate-300 hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight className="h-4 w-4" /></button></div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-200">{error}</p>}
    {loading ? <p role="status" className="text-sm text-slate-400">Loading monthly rankings...</p> : <>
      <div className="overflow-x-auto rounded-xl border border-[#263650]"><table className="w-full min-w-130 text-left text-xs"><thead className="bg-[#111A2D] text-[#D4AF37]"><tr><th className="p-3">Rank</th><th className="p-3">Partner</th><th className="p-3">Partner ID</th><th className="p-3 text-right">Approved conversions</th></tr></thead><tbody className="divide-y divide-[#263650]">{(data?.rankings || []).map(row => <tr key={row.partnerId} className="text-slate-200"><td className="p-3 font-bold text-[#D4AF37]">#{row.rank}</td><td className="p-3 font-semibold">{row.fullName}</td><td className="p-3 font-mono text-slate-400">{row.partnerId}</td><td className="p-3 text-right font-mono">{row.approvedConversions}</td></tr>)}</tbody></table></div>
      {!data?.rankings.length && <p className="rounded-lg border border-dashed border-[#263650] p-4 text-center text-sm text-slate-400">No admin-approved conversions for this month yet.</p>}
      <div className="space-y-2 rounded-xl border border-[#263650] bg-[#080D17]/70 p-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Award className="h-4 w-4 text-[#D4AF37]" />My reward history</h3>{data?.rewards.length ? data.rewards.map(reward => <div key={reward._id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#263650] pt-2 text-xs"><span className="text-slate-300">{reward.label}</span><span className="font-semibold text-[#D4AF37]">{money(reward.amount, reward.currency)}</span><span className={`rounded-full px-2 py-1 font-bold ${reward.paymentStatus === 'PAID' ? 'bg-emerald-950 text-emerald-300' : reward.paymentStatus === 'PROCESSING' ? 'bg-amber-950 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>{reward.paymentStatus === 'PAID' ? 'PAID (ADMIN RECORDED)' : reward.paymentStatus}</span></div>) : <p className="text-xs text-slate-500">No reward records for this month.</p>}</div>
    </>}
  </section>;
}
