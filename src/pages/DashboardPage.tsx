import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  PlusCircle,
  Share2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { fetchPartnerDashboard } from '../services/partnerApi.ts';
import { DashboardData } from '../types/partner.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
  onOpenSubmitLead?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenSubmitLead }) => {
  const { partner } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchPartnerDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = data?.summary || {
    totalEarnings: 0,
    pendingEarnings: 0,
    approvedEarnings: 0,
    paidEarnings: 0,
    totalLeads: 0,
    successfulLeads: 0,
    rejectedLeads: 0,
    pendingLeads: 0,
    availableWalletBalance: 0,
    totalWithdrawn: 0,
  };

  return (
    <div className="py-6 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Welcome & Partner Identification Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-5 sm:p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#121D36] text-[#D4AF37] border border-[#D4AF37]/30 font-mono">
              {partner?.partnerId || 'PARTNER'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-semibold">
              KYC: {partner?.kycStatus || 'PENDING'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] mt-1.5">
            Partner Portal · {partner?.fullName || 'Partner'}
          </h1>
          <p className="text-xs text-[#AAB3C2] mt-0.5">
            Real-time verified earnings, lead processing, and payout management.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('leads')}
            className="flex-1 sm:flex-initial"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            <span>Submit Lead</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('wallet')}
            className="flex-1 sm:flex-initial"
          >
            <Wallet className="w-4 h-4 mr-1.5" />
            <span>Wallet</span>
          </Button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-lg bg-[#111A2D] border border-[#1C273C] text-[#AAB3C2] hover:text-[#F8FAFC] transition-colors cursor-pointer"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#D4AF37]' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-4 text-xs text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Main Financial KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        
        {/* Available Wallet Balance */}
        <div className="col-span-2 sm:col-span-1 bg-linear-to-br from-[#111A2D] to-[#0A1224] border border-[#D4AF37]/50 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between text-[#D4AF37] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Available Wallet</span>
            <Wallet className="w-5 h-5" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] font-mono">
            ₹{summary.availableWalletBalance.toLocaleString('en-IN')}
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#1C273C]">
            <span className="text-[11px] text-[#AAB3C2]">Min withdrawal: ₹200</span>
            <button
              onClick={() => onNavigate('wallet')}
              className="text-[11px] text-[#D4AF37] font-semibold hover:underline inline-flex items-center cursor-pointer"
            >
              <span>Withdraw</span>
              <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Pending Clearance Earnings */}
        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-[#F8FAFC] font-mono">
            ₹{summary.pendingEarnings.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-[#AAB3C2] mt-2">
            {summary.pendingLeads} leads awaiting admin verification
          </p>
        </div>

        {/* Approved & Credited Earnings */}
        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Approved Earnings</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-[#F8FAFC] font-mono">
            ₹{summary.approvedEarnings.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-[#AAB3C2] mt-2">
            {summary.successfulLeads} verified approved conversions
          </p>
        </div>

        {/* Total Lifetime Earnings */}
        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-[#D4AF37] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Earned</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-[#F8FAFC] font-mono">
            ₹{summary.totalEarnings.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-[#AAB3C2] mt-2">
            Lifetime verified partner earnings
          </p>
        </div>
      </div>

      {/* Secondary Performance Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 bg-[#0B1325] border border-[#1C273C] rounded-xl p-4 text-xs">
        <div>
          <span className="text-[#AAB3C2] block">Total Leads Submitted</span>
          <span className="text-base font-bold text-[#F8FAFC] font-mono">{summary.totalLeads}</span>
        </div>
        <div>
          <span className="text-[#AAB3C2] block">Approved / Successful</span>
          <span className="text-base font-bold text-emerald-400 font-mono">{summary.successfulLeads}</span>
        </div>
        <div>
          <span className="text-[#AAB3C2] block">Under Admin Review</span>
          <span className="text-base font-bold text-amber-400 font-mono">{summary.pendingLeads}</span>
        </div>
        <div>
          <span className="text-[#AAB3C2] block">Rejected Leads</span>
          <span className="text-base font-bold text-rose-400 font-mono">{summary.rejectedLeads}</span>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div 
          onClick={() => onNavigate('campaigns')}
          className="bg-[#0B1325] border border-[#1E2E4E] hover:border-[#D4AF37]/50 rounded-xl p-4 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#F8FAFC] group-hover:text-[#D4AF37] transition-colors">
              Browse LIVE Campaigns
            </span>
            <ArrowUpRight className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-xs text-[#AAB3C2] mt-1">
            Access 12+ active financial campaigns with your unique tracking links.
          </p>
        </div>

        <div 
          onClick={() => onNavigate('leads')}
          className="bg-[#0B1325] border border-[#1E2E4E] hover:border-[#D4AF37]/50 rounded-xl p-4 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#F8FAFC] group-hover:text-[#D4AF37] transition-colors">
              Leads & Verification
            </span>
            <ArrowUpRight className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-xs text-[#AAB3C2] mt-1">
            Submit new client leads and monitor real-time approval status.
          </p>
        </div>

        <div 
          onClick={() => onNavigate('referrals')}
          className="bg-[#0B1325] border border-[#1E2E4E] hover:border-[#D4AF37]/50 rounded-xl p-4 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#F8FAFC] group-hover:text-[#D4AF37] transition-colors">
              Partner Referral Program
            </span>
            <Share2 className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-xs text-[#AAB3C2] mt-1">
            ₹50 referral bonus, subject to eligibility and campaign terms.
          </p>
        </div>

      </div>

      {/* Recent Leads Section */}
      <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#D4AF37]" />
            <h2 className="text-sm sm:text-base font-bold text-[#F8FAFC]">
              Recent Lead Submissions
            </h2>
          </div>
          <button
            onClick={() => onNavigate('leads')}
            className="text-xs text-[#D4AF37] hover:underline font-semibold cursor-pointer"
          >
            View All Leads ({summary.totalLeads})
          </button>
        </div>

        {data?.recentLeads && data.recentLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#1C273C] text-[#AAB3C2] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Lead ID</th>
                  <th className="py-2.5 px-3">Campaign</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Account ID</th>
                  <th className="py-2.5 px-3">Payout</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C273C]/60 text-[#F8FAFC]">
                {data.recentLeads.map((lead) => (
                  <tr key={lead.leadId} className="hover:bg-[#111A2D]/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-[#D4AF37]">
                      {lead.leadId}
                    </td>
                    <td className="py-3 px-3 font-medium">
                      {lead.campaignName}
                    </td>
                    <td className="py-3 px-3 text-[#AAB3C2]">
                      {lead.clientName}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">
                      {lead.accountId}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                      ₹{lead.payoutSnapshot}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          lead.status === 'APPROVED' || lead.status === 'PAID'
                            ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                            : lead.status === 'REJECTED'
                            ? 'bg-rose-950/60 border border-rose-700 text-rose-300'
                            : 'bg-amber-950/60 border border-amber-700 text-amber-300'
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 bg-[#070B14] rounded-xl border border-[#1C273C]">
            <FileText className="w-8 h-8 text-[#AAB3C2]/40 mx-auto mb-2" />
            <p className="text-xs text-[#AAB3C2]">No leads submitted yet.</p>
            <div className="mt-3">
              <Button variant="primary" size="sm" onClick={() => onNavigate('leads')}>
                Submit Your First Lead
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
