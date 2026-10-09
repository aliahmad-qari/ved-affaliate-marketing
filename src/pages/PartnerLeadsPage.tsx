import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Info,
  Calendar,
  X,
  FileCheck,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { fetchPartnerLeads, fetchPartnerCampaigns, submitPartnerLead } from '../services/partnerApi.ts';
import { LeadItem, PartnerCampaignItem, LeadStatus } from '../types/partner.ts';

interface PartnerLeadsPageProps {
  onNavigate: (tab: string) => void;
}

export const PartnerLeadsPage: React.FC<PartnerLeadsPageProps> = ({ onNavigate }) => {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [liveCampaigns, setLiveCampaigns] = useState<PartnerCampaignItem[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientMobile, setClientMobile] = useState('');
  const [accountId, setAccountId] = useState('');
  const [submittedNotes, setSubmittedNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const loadLeads = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchPartnerLeads({
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        search: searchTerm.trim() ? searchTerm.trim() : undefined,
      });
      setLeads(res.leads);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leads.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [selectedStatus]);

  useEffect(() => {
    if (!isSubmitModalOpen) return;
    let active = true;
    let refreshVersion = 0;
    const refresh = async () => {
      const version = ++refreshVersion;
      setCampaignsLoading(true);
      try {
        const campaigns = (await fetchPartnerCampaigns()).filter(campaign => ['LIVE', 'PAUSED'].includes(campaign.status));
        if (!active || version !== refreshVersion) return;
        setLiveCampaigns(campaigns);
        setSelectedCampaignId(current => current || campaigns[0]?.slug || campaigns[0]?._id || '');
      } catch {
        if (active && version === refreshVersion) { setLiveCampaigns([]); setSubmitError('Unable to verify available campaigns. Please try again.'); }
      } finally { if (active && version === refreshVersion) setCampaignsLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [isSubmitModalOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLeads();
  };

  const openSubmitModal = () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitModalOpen(true);
  };

  const closeSubmitModal = () => {
    setIsSubmitModalOpen(false);
    setClientName('');
    setClientMobile('');
    setAccountId('');
    setSubmittedNotes('');
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const selectedCampaign = liveCampaigns.find((campaign) => campaign.slug === selectedCampaignId || campaign._id === selectedCampaignId);
  const campaignUnavailable = !selectedCampaign || !['LIVE', 'PAUSED'].includes(selectedCampaign.status);
  const campaignWarning = 'Reports can only be submitted for LIVE or PAUSED campaigns. This campaign is unavailable for report submission.';

  const handleSubmitLead = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    if (!selectedCampaignId || clientName.trim().length < 2 || !/^[6-9]\d{9}$/.test(clientMobile.trim()) || !accountId.trim()) {
      setSubmitError('Enter a campaign, customer name, valid 10-digit mobile, and account/reference ID.');
      return;
    }
    try {
      setIsSubmitting(true);
      const campaigns = (await fetchPartnerCampaigns()).filter(campaign => ['LIVE', 'PAUSED'].includes(campaign.status));
      setLiveCampaigns(campaigns);
      if (!campaigns.some(campaign => campaign.slug === selectedCampaignId || campaign._id === selectedCampaignId)) {
        setSubmitError(campaignWarning);
        return;
      }
      await submitPartnerLead({ campaignId: selectedCampaignId, clientName: clientName.trim(), clientMobile: clientMobile.trim(), accountId: accountId.trim(), submittedNotes: submittedNotes.trim() || undefined });
      setSubmitSuccess('Lead submitted for Admin verification.');
      window.setTimeout(() => {
        closeSubmitModal();
        void loadLeads();
      }, 1200);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusFilters = ['ALL', 'PENDING', 'VERIFIED', 'APPROVED', 'REJECTED', 'PAID'];

  return (
    <div className="py-6 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-5 sm:p-6 shadow-xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
            Lead Management & Submissions
          </h1>
          <p className="text-sm text-[#AAB3C2] mt-0.5">
            Review submitted leads. Vendor-reported conversions also appear here automatically when campaign callbacks are connected.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={openSubmitModal} className="w-full sm:w-auto">
          <PlusCircle className="w-4 h-4 mr-2" />
          <span>Submit New Lead</span>
        </Button>
      </div>

      <div className="border border-[#263650] bg-[#0D1424] p-3 text-sm text-[#AAB3C2]">
        Automatic provider updates are additive. When a vendor callback is configured, those conversions will appear alongside manually submitted leads.
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0B1325] border border-[#1C273C] rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Status Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {statusFilters.map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedStatus === st
                  ? 'bg-[#D4AF37] text-black shadow-md'
                  : 'bg-[#111A2D] text-[#AAB3C2] hover:text-[#F8FAFC] border border-[#1C273C]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer, lead ID, or account..."
              className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#F8FAFC] outline-none"
            />
            <Search className="w-3.5 h-3.5 text-[#AAB3C2] absolute left-2.5 top-2.5" />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="py-1.5! text-xs!">
            Search
          </Button>
        </form>
      </div>

      {error && (
        <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={loadLeads}>
            Retry
          </Button>
        </div>
      )}

      {/* Leads Table / Cards */}
      <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-[#AAB3C2]">
            <Clock className="w-6 h-6 animate-spin mx-auto text-[#D4AF37] mb-2" />
            <span>Loading leads records...</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FileCheck className="w-10 h-10 text-[#AAB3C2]/40 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-[#F8FAFC]">No Leads Found</h3>
            <p className="text-xs text-[#AAB3C2] mt-1 max-w-sm mx-auto">
              {selectedStatus !== 'ALL'
                ? `No leads with status '${selectedStatus}' were found.`
                : 'You have not submitted any customer leads yet, and no provider conversions have reached VED.'}
            </p>
            <div className="mt-4">
              <Button variant="primary" size="sm" onClick={openSubmitModal}>
                Submit a Lead Now
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070B14] border-b border-[#1C273C] text-[#AAB3C2] font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Lead ID</th>
                    <th className="py-3 px-4">Campaign</th>
                    <th className="py-3 px-4">Client Details</th>
                    <th className="py-3 px-4">Account / Ref ID</th>
                    <th className="py-3 px-4">Payout Snapshot</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C273C]/60 text-[#F8FAFC]">
                  {leads.map((lead) => (
                    <tr key={lead.leadId} className="hover:bg-[#111A2D]/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#D4AF37]">
                        {lead.leadId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#F8FAFC]">{lead.campaignName}</div>
                        <div className="text-sm text-[#AAB3C2]">{lead.action}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#F8FAFC]">{lead.clientName || 'Not provided by provider'}</div>
                        <div className="font-mono text-xs text-[#AAB3C2]">{lead.clientMobile || 'Not provided by provider'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-[#AAB3C2]">
                        {lead.accountId}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">
                        ₹{lead.payoutSnapshot}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            lead.status === 'APPROVED' || lead.status === 'PAID'
                              ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                              : lead.status === 'REJECTED'
                              ? 'bg-rose-950/60 border border-rose-700 text-rose-300'
                              : lead.status === 'VERIFIED'
                              ? 'bg-cyan-950/60 border border-cyan-700 text-cyan-300'
                              : 'bg-amber-950/60 border border-amber-700 text-amber-300'
                          }`}
                        >
                          {lead.status}
                        </span>
                        {lead.status === 'REJECTED' && lead.rejectionReason && (
                          <div className="text-[11px] text-rose-300 mt-1 italic">
                            Reason: {lead.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right text-[11px] text-[#AAB3C2]">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-[#1C273C]/70">
              {leads.map((lead) => (
                <div key={lead.leadId} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#D4AF37]">
                      {lead.leadId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        lead.status === 'APPROVED' || lead.status === 'PAID'
                          ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                          : lead.status === 'REJECTED'
                          ? 'bg-rose-950/60 border border-rose-700 text-rose-300'
                          : lead.status === 'VERIFIED'
                          ? 'bg-cyan-950/60 border border-cyan-700 text-cyan-300'
                          : 'bg-amber-950/60 border border-amber-700 text-amber-300'
                      }`}
                    >
                      {lead.status}
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-[#F8FAFC]">{lead.campaignName}</div>
                    <div className="text-xs text-[#AAB3C2] flex items-center justify-between mt-1">
                      <span>Client: {lead.clientName || 'Details unavailable'} ({lead.clientMobile || 'Phone unavailable'})</span>
                      <span className="font-mono font-bold text-emerald-400">₹{lead.payoutSnapshot}</span>
                    </div>
                    <div className="text-xs font-mono text-[#AAB3C2] mt-0.5">
                      Account ID: {lead.accountId}
                    </div>
                  </div>

                  {lead.status === 'REJECTED' && lead.rejectionReason && (
                    <div className="text-xs bg-rose-950/40 border border-rose-800 rounded p-2 text-rose-300">
                      <strong>Rejection Reason:</strong> {lead.rejectionReason}
                    </div>
                  )}

                  <div className="text-[11px] text-[#AAB3C2] flex justify-between pt-1 border-t border-[#1C273C]/50">
                    <span>Received:</span>
                    <span>{lead.createdAt ? new Date(lead.createdAt).toLocaleString('en-IN') : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="presentation" onClick={closeSubmitModal}>
          <section role="dialog" aria-modal="true" aria-labelledby="submit-lead-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[#263650] bg-[#0D1424] p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b border-[#263650] pb-3">
              <h2 id="submit-lead-title" className="text-lg font-bold text-white">Submit Partner Lead</h2>
              <button type="button" onClick={closeSubmitModal} aria-label="Close lead form" className="text-[#AAB3C2] hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            {submitSuccess ? <p role="status" className="py-6 text-center text-sm text-emerald-300">{submitSuccess}</p> : (
              <form onSubmit={handleSubmitLead} className="space-y-3">
                {submitError && <p role="alert" className="border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-200">{submitError}</p>}
                <label className="block text-xs text-[#AAB3C2]">Campaign (LIVE / PAUSED)<select className="mt-1 w-full rounded border border-[#263650] bg-[#080D17] p-2 text-sm text-white" disabled={campaignsLoading || isSubmitting} value={selectedCampaignId} onChange={(event) => setSelectedCampaignId(event.target.value)} required><option value="">Select campaign</option>{liveCampaigns.map((campaign) => <option key={campaign.slug || campaign._id} value={campaign.slug || campaign._id}>{campaign.name} · {campaign.status} · ₹{campaign.payout}</option>)}</select></label>
                <label className="block text-xs text-[#AAB3C2]">Customer full name<input className="mt-1 w-full rounded border border-[#263650] bg-[#080D17] p-2 text-sm text-white" value={clientName} onChange={(event) => setClientName(event.target.value)} minLength={2} required /></label>
                <label className="block text-xs text-[#AAB3C2]">Customer mobile<input className="mt-1 w-full rounded border border-[#263650] bg-[#080D17] p-2 font-mono text-sm text-white" type="tel" inputMode="numeric" maxLength={10} value={clientMobile} onChange={(event) => setClientMobile(event.target.value.replace(/\D/g, ''))} placeholder="10-digit mobile" required /></label>
                <label className="block text-xs text-[#AAB3C2]">Account / application reference ID<input className="mt-1 w-full rounded border border-[#263650] bg-[#080D17] p-2 font-mono text-sm text-white" value={accountId} onChange={(event) => setAccountId(event.target.value)} required /></label>
                <label className="block text-xs text-[#AAB3C2]">Notes (optional)<textarea className="mt-1 w-full rounded border border-[#263650] bg-[#080D17] p-2 text-sm text-white" rows={2} value={submittedNotes} onChange={(event) => setSubmittedNotes(event.target.value)} /></label>
                {!campaignsLoading && campaignUnavailable && <p role="alert" className="rounded-lg border border-amber-600/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">{selectedCampaignId ? campaignWarning : "Choose a LIVE or PAUSED campaign to submit your report."}</p>}{campaignsLoading && <p role="status" className="text-xs text-[#AAB3C2]">Checking report campaign availability…</p>}{selectedCampaign && <p className="text-xs text-[#AAB3C2]">Required action: {selectedCampaign.requiredAction} · Potential payout ₹{selectedCampaign.payout}</p>}
                <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" size="sm" onClick={closeSubmitModal}>Cancel</Button><Button type="submit" variant="primary" disabled={isSubmitting || campaignsLoading || campaignUnavailable}>{isSubmitting ? 'Submitting…' : 'Submit for Verification'}</Button></div>
              </form>
            )}
          </section>
        </div>
      )}

    </div>
  );
};
