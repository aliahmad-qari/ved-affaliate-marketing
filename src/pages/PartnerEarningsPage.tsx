import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { fetchPartnerEarnings } from '../services/partnerApi.ts';
import { EarningsItem } from '../types/partner.ts';

interface PartnerEarningsPageProps {
  onNavigate: (tab: string) => void;
}

export const PartnerEarningsPage: React.FC<PartnerEarningsPageProps> = ({ onNavigate }) => {
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [items, setItems] = useState<EarningsItem[]>([]);
  const [summary, setSummary] = useState({
    totalEarnings: 0,
    pendingEarnings: 0,
    approvedEarnings: 0,
    paidEarnings: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEarnings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchPartnerEarnings(filter);
      setItems(res.items);
      setSummary(res.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load earnings report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEarnings();
  }, [filter]);

  const filterTabs = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
  ];

  return (
    <div className="py-6 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-5 sm:p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
            <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
              Performance Analytics
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC]">
            Earnings & Commissions Report
          </h1>
          <p className="text-xs text-[#AAB3C2] mt-0.5">
            Historical commission breakdown locked to the payout snapshot at the time of each lead submission.
          </p>
        </div>

        <button
          onClick={loadEarnings}
          disabled={isLoading}
          className="p-2.5 rounded-lg bg-[#111A2D] border border-[#1C273C] text-[#AAB3C2] hover:text-[#F8FAFC] transition-colors cursor-pointer self-end sm:self-center"
          aria-label="Refresh earnings"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#D4AF37]' : ''}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-4">
          <span className="text-xs text-[#AAB3C2] block">Total Earnings</span>
          <div className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] font-mono mt-1">
            ₹{summary.totalEarnings.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-4">
          <span className="text-xs text-amber-400 block">Pending Clearance</span>
          <div className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] font-mono mt-1">
            ₹{summary.pendingEarnings.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-4">
          <span className="text-xs text-emerald-400 block">Approved & Available</span>
          <div className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] font-mono mt-1">
            ₹{summary.approvedEarnings.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-4">
          <span className="text-xs text-indigo-400 block">Paid Disbursed</span>
          <div className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] font-mono mt-1">
            ₹{summary.paidEarnings.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Period Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1C273C] pb-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filter === tab.id
                ? 'bg-[#D4AF37] text-black'
                : 'text-[#AAB3C2] hover:text-[#F8FAFC] bg-[#111A2D]/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={loadEarnings}>
            Retry
          </Button>
        </div>
      )}

      {/* Detailed List */}
      <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl shadow-xl overflow-hidden p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#F8FAFC]">
          Itemized Earning Records ({items.length})
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#AAB3C2]">
            <Clock className="w-6 h-6 animate-spin mx-auto text-[#D4AF37] mb-2" />
            <span>Calculating earnings...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 border border-[#1C273C] rounded-xl bg-[#070B14]">
            <FileText className="w-8 h-8 text-[#AAB3C2]/40 mx-auto mb-2" />
            <p className="text-xs text-[#AAB3C2]">No earnings recorded for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#070B14] border-b border-[#1C273C] text-[#AAB3C2] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Lead ID</th>
                  <th className="py-3 px-3">Campaign</th>
                  <th className="py-3 px-3">Account ID</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Payout Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C273C]/60 text-[#F8FAFC]">
                {items.map((it) => (
                  <tr key={it.leadId} className="hover:bg-[#111A2D]/40 transition-colors">
                    <td className="py-3 px-3 text-[#AAB3C2] whitespace-nowrap">
                      {it.date ? new Date(it.date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-[#D4AF37]">
                      {it.leadId}
                    </td>
                    <td className="py-3 px-3 font-medium">
                      {it.campaignName}
                    </td>
                    <td className="py-3 px-3 font-mono text-[#AAB3C2]">
                      {it.accountId}
                    </td>
                    <td className="py-3 px-3 text-[#AAB3C2]">
                      {it.action}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          it.status === 'APPROVED' || it.status === 'PAID'
                            ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                            : it.status === 'REJECTED'
                            ? 'bg-rose-950/60 border border-rose-700 text-rose-300'
                            : 'bg-amber-950/60 border border-amber-700 text-amber-300'
                        }`}
                      >
                        {it.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      ₹{it.payoutSnapshot}
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
