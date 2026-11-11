import React, { useEffect, useState } from 'react';
import { Award, ChevronLeft, ChevronRight, Plus, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { adminApi } from '../../services/adminApi.ts';
import { monthKeyInTimeZone, shiftMonth } from '../../../shared/monthlyLeaderboard.ts';
import { Button } from '../ui/Button.tsx';

type RuleDraft = { rewardType: string; label: string; minimumApprovedConversions: string; amount: string };
type RewardRow = { _id: string; partnerId: string; partnerName: string; rewardType: string; label: string; amount: number; currency: string; minimumApprovedConversions: number; approvedConversionsAtGeneration: number; paymentStatus: 'PENDING' | 'PROCESSING' | 'PAID'; approvedAt?: string; paymentReference?: string };
const input = 'w-full rounded-lg border border-[#263650] bg-[#080D17] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]';
const emptyRule = (): RuleDraft => ({ rewardType: '', label: '', minimumApprovedConversions: '', amount: '' });
const monthLabel = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const money = (value: number, currency: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

export function AdminMonthlyLeaderboard() {
  const [month, setMonth] = useState(() => monthKeyInTimeZone());
  const [board, setBoard] = useState<any>(null);
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [clientApprovalReference, setClientApprovalReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await adminApi.get(`/admin/monthly-leaderboard?month=${encodeURIComponent(month)}`);
      setBoard(response.data);
      setRules((response.data.policy?.rules || []).map((rule: any) => ({ ...rule, minimumApprovedConversions: String(rule.minimumApprovedConversions), amount: String(rule.amount) })));
      setClientApprovalReference(response.data.policy?.clientApprovalReference || '');
    } catch (err: any) { setError(err.message || 'Unable to load monthly rewards.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [month]);

  const action = async (work: () => Promise<any>, success: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(success); await load(); }
    catch (err: any) { setError(err.message || 'The monthly reward action failed.'); }
    finally { setBusy(false); }
  };

  const saveRules = () => action(() => adminApi.put('/admin/monthly-leaderboard/reward-policy', {
    monthKey: month,
    rules: rules.map(rule => ({
      rewardType: rule.rewardType,
      label: rule.label,
      minimumApprovedConversions: Number(rule.minimumApprovedConversions),
      amount: Number(rule.amount),
    })),
  }), 'Reward rules saved. Record client approval before generating eligibility records.');

  const rewards: RewardRow[] = board?.rewards || [];
  const rankings = board?.rankings || [];
  const approvedPolicy = Boolean(board?.rewardIssuanceEnabled);

  return <div className="space-y-5">
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/80 to-[#070B14]/80 p-4">
      <div><h2 className="flex items-center gap-2 text-lg font-bold text-white"><Award className="h-5 w-5 text-[#D4AF37]" />Monthly Leaderboard & Rewards</h2><p className="mt-1 text-xs text-slate-400">Approved conversions are counted in {board?.timeZone || 'UTC'} and recalculate from current lead status.</p></div>
      <div className="flex items-center gap-2"><button aria-label="Previous month" onClick={() => setMonth(value => shiftMonth(value, -1))} className="rounded-lg border border-[#263650] p-2 text-slate-300 hover:border-[#D4AF37]"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-32 text-center text-sm font-semibold text-white">{monthLabel(month)}</span><button aria-label="Next month" disabled={month >= monthKeyInTimeZone()} onClick={() => setMonth(value => shiftMonth(value, 1))} className="rounded-lg border border-[#263650] p-2 text-slate-300 hover:border-[#D4AF37] disabled:opacity-35"><ChevronRight className="h-4 w-4" /></button><Button variant="outline" size="sm" disabled={loading || busy} onClick={() => void load()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button></div>
    </section>
    {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</p>}
    <section className="space-y-3 rounded-xl border border-[#D4AF37]/20 bg-[#0B1325]/70 p-4">
      <div><h3 className="font-bold text-white">Rankings</h3><p className="mt-1 text-xs text-slate-400">Only leads currently APPROVED or PAID with an admin reviewer and an approval timestamp in this month count. Vendor-only approvals and reversed approvals are excluded.</p></div>
      {loading ? <p role="status" className="text-sm text-slate-400">Loading rankings...</p> : <div className="overflow-x-auto rounded-lg border border-[#263650]"><table className="w-full min-w-130 text-left text-xs"><thead className="bg-[#111A2D] text-[#D4AF37]"><tr><th className="p-3">Rank</th><th className="p-3">Partner</th><th className="p-3">Partner ID</th><th className="p-3 text-right">Approved conversions</th></tr></thead><tbody className="divide-y divide-[#263650]">{rankings.map((row: any) => <tr key={row.partnerId} className="text-slate-200"><td className="p-3 font-bold text-[#D4AF37]">#{row.rank}</td><td className="p-3">{row.fullName}</td><td className="p-3 font-mono text-slate-400">{row.partnerId}</td><td className="p-3 text-right font-mono">{row.approvedConversions}</td></tr>)}</tbody></table>{!rankings.length && <p className="p-4 text-center text-slate-400">No qualifying conversions for this month.</p>}</div>}
    </section>
    <section className="space-y-4 rounded-xl border border-[#D4AF37]/20 bg-[#0B1325]/70 p-4">
      <div><h3 className="font-bold text-white">Monthly reward rules</h3><p className="mt-1 text-xs text-slate-400">No amounts or tiers are prefilled. Saving any rule clears its client approval until it is recorded again.</p></div>
      {rules.map((rule, index) => <div key={index} className="grid gap-2 rounded-lg border border-[#263650] p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_1fr_auto]">
        <label className="text-xs text-slate-400">Reward type<input className={`${input} mt-1`} value={rule.rewardType} onChange={e => setRules(rows => rows.map((row, i) => i === index ? { ...row, rewardType: e.target.value.toUpperCase() } : row))} placeholder="Admin-defined type" maxLength={40} /></label>
        <label className="text-xs text-slate-400">Reward label<input className={`${input} mt-1`} value={rule.label} onChange={e => setRules(rows => rows.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} placeholder="Admin-defined label" maxLength={80} /></label>
        <label className="text-xs text-slate-400">Minimum approved conversions<input className={`${input} mt-1`} type="number" min="1" step="1" value={rule.minimumApprovedConversions} onChange={e => setRules(rows => rows.map((row, i) => i === index ? { ...row, minimumApprovedConversions: e.target.value } : row))} placeholder="Required count" /></label>
        <label className="text-xs text-slate-400">Reward amount (INR)<input className={`${input} mt-1`} type="number" min="0.01" step="0.01" value={rule.amount} onChange={e => setRules(rows => rows.map((row, i) => i === index ? { ...row, amount: e.target.value } : row))} placeholder="Client-approved amount" /></label>
        <Button variant="ghost" disabled={busy} className="self-end" onClick={() => setRules(rows => rows.filter((_, i) => i !== index))}>Remove</Button>
      </div>)}
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => setRules(rows => [...rows, emptyRule()])}><Plus className="mr-1 h-4 w-4" />Add reward rule</Button><Button variant="primary" disabled={busy || !rules.length} onClick={() => void saveRules()}><Save className="mr-1 h-4 w-4" />Save rules</Button></div>
      <div className="grid gap-2 border-t border-[#263650] pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"><label className="text-xs text-slate-400">Client approval reference<input className={`${input} mt-1`} value={clientApprovalReference} onChange={e => setClientApprovalReference(e.target.value)} maxLength={120} placeholder="Record the approved policy reference" /></label><span className={`pb-2 text-xs font-semibold ${approvedPolicy ? 'text-emerald-300' : 'text-amber-300'}`}>{approvedPolicy ? 'Client rules approved' : 'Issuance disabled'}</span><Button variant="outline" disabled={busy || !clientApprovalReference.trim()} onClick={() => void action(() => adminApi.post('/admin/monthly-leaderboard/reward-policy/client-approval', { monthKey: month, clientApprovalReference }), 'Client approval reference recorded.')}><ShieldCheck className="mr-1 h-4 w-4" />Record client approval</Button></div>
      <p className="text-xs text-slate-500">Client-approved rules and Admin approval are both required. Rewards are not credited to partner wallets. Paid means an Admin recorded the external payment reference; it is not independently bank-verified.</p>
      <Button variant="primary" disabled={busy || !approvedPolicy} onClick={() => void action(() => adminApi.post('/admin/monthly-leaderboard/rewards/generate', { monthKey: month }), 'Eligible reward records generated idempotently.')}>Generate pending eligible rewards</Button>
    </section>
    <section className="space-y-3 rounded-xl border border-[#D4AF37]/20 bg-[#0B1325]/70 p-4">
      <h3 className="font-bold text-white">Reward history and manual payment status</h3>
      {rewards.length ? <div className="space-y-2">{rewards.map(reward => <article key={reward._id} className="grid gap-3 rounded-lg border border-[#263650] p-3 text-xs md:grid-cols-[1fr_auto_auto] md:items-center"><div><p className="font-semibold text-white">{reward.partnerName} <span className="font-mono text-[#D4AF37]">#{reward.partnerId}</span></p><p className="mt-1 text-slate-400">{reward.label} | {reward.approvedConversionsAtGeneration}/{reward.minimumApprovedConversions} conversions | {money(reward.amount, reward.currency)}</p>{reward.paymentReference && <p className="mt-1 text-slate-500">Payment reference recorded</p>}</div><span className={`w-fit rounded-full px-2 py-1 font-bold ${reward.paymentStatus === 'PAID' ? 'bg-emerald-950 text-emerald-300' : reward.paymentStatus === 'PROCESSING' ? 'bg-amber-950 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>{reward.paymentStatus}{reward.approvedAt ? ' | ADMIN APPROVED' : ''}</span><div className="flex flex-wrap gap-2">{!reward.approvedAt && <Button size="sm" variant="outline" disabled={busy || !approvedPolicy} onClick={() => { if (window.confirm(`Approve ${reward.label} for ${reward.partnerName}? This does not credit a wallet.`)) void action(() => adminApi.post(`/admin/monthly-leaderboard/rewards/${encodeURIComponent(reward._id)}/approve`, {}), 'Reward approved for manual payment.'); }}>Approve reward</Button>}{reward.approvedAt && reward.paymentStatus === 'PENDING' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void action(() => adminApi.patch(`/admin/monthly-leaderboard/rewards/${encodeURIComponent(reward._id)}/payment`, { paymentStatus: 'PROCESSING' }), 'Reward marked Processing.')}>Mark Processing</Button>}{reward.approvedAt && reward.paymentStatus === 'PROCESSING' && <Button size="sm" variant="primary" disabled={busy} onClick={() => { const reference = window.prompt('Payment reference after external payment'); if (reference?.trim()) void action(() => adminApi.patch(`/admin/monthly-leaderboard/rewards/${encodeURIComponent(reward._id)}/payment`, { paymentStatus: 'PAID', paymentReference: reference.trim() }), 'Manual payment recorded as Paid.'); }}>Mark Paid</Button>}</div></article>)}</div> : <p className="rounded-lg border border-dashed border-[#263650] p-4 text-center text-sm text-slate-400">No reward records generated for this month.</p>}
    </section>
  </div>;
}
