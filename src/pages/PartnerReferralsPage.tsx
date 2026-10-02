import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  Gift,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { fetchPartnerReferrals } from '../services/partnerApi.ts';
import { ReferralsData } from '../types/partner.ts';

interface PartnerReferralsPageProps {
  onNavigate: (tab: string) => void;
}

export const PartnerReferralsPage: React.FC<PartnerReferralsPageProps> = ({ onNavigate }) => {
  const [data, setData] = useState<ReferralsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchPartnerReferrals();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load referral program data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!data?.referralCode) return;
    navigator.clipboard.writeText(data.referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!data) return;
    const text = encodeURIComponent(
      `Join VED AFFILIATE PVT. LIMITED to promote leading financial apps in India and earn verified commissions! Register using my official partner referral link:\n${data.referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="py-6 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Header & Program Banner */}
      <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-5 h-5 text-[#D4AF37]" />
              <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                Partner Growth Initiative
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
              Referral Program
            </h1>
            <p className="text-xs text-[#AAB3C2] mt-1 max-w-lg">
              Invite affiliates to VED. A <span className="text-[#D4AF37] font-semibold">₹50</span> referral bonus may apply when your referred partner completes their first approved campaign task, subject to eligibility and campaign terms.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 rounded-lg bg-[#111A2D] border border-[#1C273C] text-[#AAB3C2] hover:text-[#F8FAFC] transition-colors cursor-pointer self-end md:self-center"
            aria-label="Refresh referrals"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#D4AF37]' : ''}`} />
          </button>
        </div>

        {/* Referral Link & Code Box */}
        <div className="mt-6 pt-6 border-t border-[#1C273C] grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div className="bg-[#070B14] p-4 rounded-xl border border-[#1C273C]">
            <span className="text-[11px] font-bold text-[#AAB3C2] uppercase tracking-wider block mb-1">
              Your Referral Code
            </span>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-lg font-mono font-bold text-[#D4AF37]">
                {data?.referralCode || '...'}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyCode}
                className="!py-1 !text-xs !min-h-[32px]"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </div>

          <div className="bg-[#070B14] p-4 rounded-xl border border-[#1C273C]">
            <span className="text-[11px] font-bold text-[#AAB3C2] uppercase tracking-wider block mb-1">
              Direct Referral Link
            </span>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                readOnly
                value={data?.referralLink || ''}
                className="w-full bg-[#111A2D] border border-[#1C273C] rounded px-2.5 py-1 text-xs text-[#AAB3C2] font-mono outline-none truncate"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyLink}
                className="!py-1 !text-xs !min-h-[32px] shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleShareWhatsApp}
                className="!py-1 !text-xs !min-h-[32px] !bg-[#25D366] !text-black !hover:bg-[#20ba59] shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 mr-1" />
                <span>WhatsApp</span>
              </Button>
            </div>
          </div>

        </div>
      </div>

      {error && (
        <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-4">
          <span className="text-xs text-[#AAB3C2] block">Total Referred</span>
          <div className="text-2xl font-extrabold text-[#F8FAFC] font-mono mt-1">
            {data?.totalReferred || 0}
          </div>
          <span className="text-[10px] text-[#AAB3C2] mt-1 block">Registered partners</span>
        </div>

        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-4">
          <span className="text-xs text-emerald-400 block">Task Completed</span>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
            {data?.qualifiedReferred || 0}
          </div>
          <span className="text-[10px] text-[#AAB3C2] mt-1 block">Eligible for ₹50 bonus</span>
        </div>

        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-4">
          <span className="text-xs text-[#D4AF37] block">Earned Referral Bonus</span>
          <div className="text-2xl font-extrabold text-[#F8FAFC] font-mono mt-1">
            ₹{data?.earnedRewards || 0}
          </div>
          <span className="text-[10px] text-[#AAB3C2] mt-1 block">From verified tasks</span>
        </div>

        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-4">
          <span className="text-xs text-amber-400 block">Pending Potential</span>
          <div className="text-2xl font-extrabold text-[#F8FAFC] font-mono mt-1">
            ₹{data?.potentialRewards || 0}
          </div>
          <span className="text-[10px] text-[#AAB3C2] mt-1 block">Awaiting first approved task</span>
        </div>
      </div>

      {/* Referred Partners Table */}
      <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl shadow-xl overflow-hidden p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-base font-bold text-[#F8FAFC]">
              Referred Affiliates ({data?.referredPartners.length || 0})
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#AAB3C2]">
            <Clock className="w-6 h-6 animate-spin mx-auto text-[#D4AF37] mb-2" />
            <span>Loading referrals...</span>
          </div>
        ) : !data?.referredPartners || data.referredPartners.length === 0 ? (
          <div className="text-center py-12 border border-[#1C273C] rounded-xl bg-[#070B14]">
            <Users className="w-8 h-8 text-[#AAB3C2]/40 mx-auto mb-2" />
            <p className="text-xs text-[#AAB3C2]">
              You have not referred any partners yet. Share your referral code or link to begin earning rewards.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#070B14] border-b border-[#1C273C] text-[#AAB3C2] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Partner ID</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Joined Date</th>
                  <th className="py-3 px-3">Task Status</th>
                  <th className="py-3 px-3 text-right">Referral Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C273C]/60 text-[#F8FAFC]">
                {data.referredPartners.map((rp) => (
                  <tr key={rp.partnerId} className="hover:bg-[#111A2D]/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-[#D4AF37]">
                      {rp.partnerId}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#F8FAFC]">
                      {rp.fullName}
                    </td>
                    <td className="py-3 px-3 font-mono text-[#AAB3C2]">
                      {rp.maskedMobile}
                    </td>
                    <td className="py-3 px-3 text-[#AAB3C2] whitespace-nowrap">
                      {rp.joinDate ? new Date(rp.joinDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          rp.rewardEarned
                            ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                            : 'bg-amber-950/60 border border-amber-700 text-amber-300'
                        }`}
                      >
                        {rp.rewardEarned ? 'Task Completed' : 'Awaiting First Task'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span className={rp.rewardEarned ? 'text-emerald-400' : 'text-[#AAB3C2]'}>
                        {rp.rewardEarned ? '+₹50' : '₹50 (Pending)'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
