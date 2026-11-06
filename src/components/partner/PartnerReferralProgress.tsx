import React, { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { fetchPartnerReferrals } from '../../services/partnerApi.ts';
import { ReferredPartnerItem } from '../../types/partner.ts';

export function PartnerReferralProgress({ onNavigate }: { onNavigate: (route: string) => void }) {
  const [referrals, setReferrals] = useState<ReferredPartnerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPartnerReferrals()
      .then(data => { if (active) setReferrals(data.referredPartners); })
      .catch(() => { if (active) setReferrals([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (!loading && referrals.length === 0) return null;
  return <section className="space-y-3 rounded-2xl border border-[#1E2E4E] bg-gradient-to-br from-[#0B1325] to-[#070B14] p-4 shadow-lg sm:p-5" aria-labelledby="referral-progress-title">
    <div className="flex items-center justify-between gap-3">
      <div><h2 id="referral-progress-title" className="flex items-center gap-2 text-base font-bold text-white"><Gift className="h-5 w-5 text-[#D4AF37]" />Referral reward progress</h2><p className="mt-1 text-xs text-[#AAB3C2]">₹100 may be issued after five valid Admin-approved leads.</p></div>
      <button type="button" onClick={() => onNavigate('referrals')} className="text-xs font-semibold text-[#D4AF37] hover:underline">View referrals</button>
    </div>
    {loading ? <p role="status" className="text-sm text-slate-400">Loading referral progress...</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{referrals.slice(0, 6).map(referral => <div key={referral.partnerId} className="rounded-xl border border-[#263650] bg-[#080D17]/70 p-3">
      <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-white">{referral.fullName}</p><span className="shrink-0 font-mono text-[10px] text-slate-400">{referral.partnerId}</span></div>
      <div className="mt-2 flex items-center justify-between text-xs"><span className="text-slate-400">Valid approved leads</span><span className="font-mono font-bold text-[#D4AF37]">{referral.approvedLeadCount}/{referral.requiredApprovedLeads}</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#1C273C]" role="progressbar" aria-valuemin={0} aria-valuemax={referral.requiredApprovedLeads} aria-valuenow={Math.min(referral.approvedLeadCount, referral.requiredApprovedLeads)} aria-label={`${referral.fullName}: progress toward referral reward`}>
        <div className="h-full bg-[#D4AF37] transition-all" style={{ width: `${Math.min(100, referral.approvedLeadCount / referral.requiredApprovedLeads * 100)}%` }} />
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{referral.taskStatus === 'REWARDED' ? `Reward recorded: ${referral.rewardStatus}` : referral.taskStatus === 'REVIEW_REQUIRED' ? 'Threshold reached; Admin review required' : 'In progress'}</p>
    </div>)}</div>}
  </section>;
}
