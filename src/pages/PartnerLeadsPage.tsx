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
import {
  fetchPartnerLeads,
  submitPartnerLead,
  fetchPartnerCampaigns,
} from '../services/partnerApi.ts';
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

  // Submit Lead Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [liveCampaigns, setLiveCampaigns] = useState<PartnerCampaignItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [clientMobile, setClientMobile] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [submittedNotes, setSubmittedNotes] = useState<string>('');
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

  // Load campaigns for modal
  useEffect(() => {
    if (isSubmitModalOpen && liveCampaigns.length === 0) {
      fetchPartnerCampaigns()
        .then((camps) => {
          setLiveCampaigns(camps);
          if (camps.length > 0) {
            setSelectedCampaignId(camps[0].slug || camps[0]._id || '');
          }
        })
        .catch(() => {});
    }
  }, [isSubmitModalOpen, liveCampaigns.length]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLeads();
  };

  const handleOpenSubmitModal = (preselectedCampaignId?: string) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    if (preselectedCampaignId) {
      setSelectedCampaignId(preselectedCampaignId);
    }
    setIsSubmitModalOpen(true);
  };

  const handleCloseSubmitModal = () => {
    setIsSubmitModalOpen(false);
    setClientName('');
    setClientMobile('');
    setAccountId('');
    setSubmittedNotes('');
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const selectedCampaign = liveCampaigns.find(
    (c) => c.slug === selectedCampaignId || c._id === selectedCampaignId
  );

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!selectedCampaignId) {
      setSubmitError('Please select a campaign.');
      return;
    }

    if (!clientName.trim() || clientName.trim().length < 2) {
      setSubmitError('Enter client full name.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(clientMobile.trim())) {
      setSubmitError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!accountId.trim()) {
      setSubmitError('Enter account or application reference ID.');
      return;
    }

    try {
      setIsSubmitting(true);
      await submitPartnerLead({
        campaignId: selectedCampaignId,
        clientName: clientName.trim(),
        clientMobile: clientMobile.trim(),
        accountId: accountId.trim(),
        submittedNotes: submittedNotes.trim() || undefined,
      });

      setSubmitSuccess('Lead submitted successfully! It has been recorded as PENDING for admin review.');
      setTimeout(() => {
        handleCloseSubmitModal();
        loadLeads();
      }, 1800);
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
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC]">
            Lead Management & Submissions
          </h1>
          <p className="text-xs text-[#AAB3C2] mt-0.5">
            Submit customer leads against verified LIVE campaigns and track manual admin review status.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => handleOpenSubmitModal()}
          className="w-full sm:w-auto"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          <span>Submit New Lead</span>
        </Button>
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
              placeholder="Search Client, Lead ID, Account..."
              className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#F8FAFC] outline-none"
            />
            <Search className="w-3.5 h-3.5 text-[#AAB3C2] absolute left-2.5 top-2.5" />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="!py-1.5 !text-xs">
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
                : 'You have not submitted any customer leads yet. Process a campaign and submit the resulting lead to earn payouts.'}
            </p>
            <div className="mt-4">
              <Button variant="primary" size="sm" onClick={() => handleOpenSubmitModal()}>
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
                        <div className="text-[11px] text-[#AAB3C2]">{lead.action}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#F8FAFC]">{lead.clientName}</div>
                        <div className="font-mono text-[11px] text-[#AAB3C2]">{lead.clientMobile}</div>
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
                      <span>Client: {lead.clientName} ({lead.clientMobile})</span>
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
                    <span>Submitted:</span>
                    <span>{lead.createdAt ? new Date(lead.createdAt).toLocaleString('en-IN') : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submit Lead Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#0D1424] border border-[#1C273C] rounded-2xl p-6 shadow-2xl text-left my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#1C273C] mb-4">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-base font-bold text-[#F8FAFC]">Submit Partner Lead</h3>
              </div>
              <button
                onClick={handleCloseSubmitModal}
                className="text-[#AAB3C2] hover:text-[#F8FAFC] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="py-6 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-[#F8FAFC]">Submission Recorded</h4>
                <p className="text-xs text-[#AAB3C2]">{submitSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitLead} className="space-y-4">
                
                {submitError && (
                  <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Campaign Selection */}
                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                    Select LIVE Campaign *
                  </label>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                  >
                    {liveCampaigns.map((camp) => (
                      <option key={camp.slug || camp._id} value={camp.slug || camp._id}>
                        {camp.name} — Payout: ₹{camp.payout} ({camp.companyName})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCampaign && (
                  <div className="bg-[#111A2D] border border-[#1C273C] rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#AAB3C2]">Required Action:</span>
                      <span className="font-semibold text-[#F8FAFC]">{selectedCampaign.requiredAction}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#AAB3C2]">Locked Payout Snapshot:</span>
                      <span className="font-mono font-bold text-emerald-400">₹{selectedCampaign.payout}</span>
                    </div>
                  </div>
                )}

                {/* Client Name */}
                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                    Customer / Client Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Full name as on customer account"
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                  />
                </div>

                {/* Client Mobile */}
                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                    Customer 10-Digit Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={clientMobile}
                    onChange={(e) => setClientMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none font-mono"
                  />
                </div>

                {/* Account / Application ID */}
                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                    Account / Application / Reference ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="e.g. Demat UCC, App ID, or Bank Application Reference"
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none font-mono"
                  />
                  <p className="text-[11px] text-[#AAB3C2] mt-1">
                    This ID is verified by VED compliance with the financial institution before approving payout.
                  </p>
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                    Additional Submission Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={submittedNotes}
                    onChange={(e) => setSubmittedNotes(e.target.value)}
                    placeholder="e.g. Completed first trade on 02/10/2026"
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={handleCloseSubmitModal}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
                    {isSubmitting ? 'Recording Lead...' : 'Submit for Verification'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
