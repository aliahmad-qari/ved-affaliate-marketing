import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { fetchPartnerReportCampaigns, downloadPartnerLeadReport } from '../../services/partnerApi.ts';
import { Button } from '../ui/Button.tsx';

export function PartnerLeadReportControls({ campaignId, status, search, onCampaign }: { campaignId: string; status: string; search: string; onCampaign: (value: string) => void }) {
  const [campaigns, setCampaigns] = useState<{ _id: string; name: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetchPartnerReportCampaigns().then(data => { if (active) setCampaigns(data); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const download = async () => {
    setBusy(true); setError('');
    try {
      const blob = await downloadPartnerLeadReport({ campaignId, status, search });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'ved-my-campaign-leads.csv'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) { setError(err.message || 'Unable to download your lead report.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-[#234459] bg-gradient-to-r from-[#0b2030] to-[#0B1325] p-4 sm:p-5" aria-labelledby="partner-reports-heading"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 id="partner-reports-heading" className="flex items-center gap-2 text-sm font-bold text-white"><FileSpreadsheet className="h-4 w-4 text-[#D4AF37]" />Campaign lead reports</h2><p className="mt-2 max-w-xl text-xs leading-relaxed text-[#AAB3C2]">Select a campaign for your lead report. CSV includes all matching pages and the selected status/search filters. Mobile numbers are masked; timestamps are in UTC.</p></div><div className="flex min-w-0 flex-col gap-2 sm:flex-row lg:max-w-xl lg:flex-1"><label className="min-w-0 flex-1 text-xs text-[#AAB3C2]"><span className="sr-only">Filter your leads by campaign</span><select aria-label="Filter your leads by campaign" className="w-full min-w-0 rounded-lg border border-[#263650] bg-[#080D17] px-3 py-2.5 text-sm text-white" value={campaignId} disabled={loading} onChange={event => onCampaign(event.target.value)}><option value="ALL">All Campaigns</option>{campaigns.map(campaign => <option key={campaign._id} value={campaign._id}>{campaign.name} · {campaign.status}</option>)}</select></label><Button variant="outline" size="sm" disabled={busy || loading} onClick={() => void download()}><Download className="mr-2 h-4 w-4" />{busy ? 'Downloading…' : 'Download CSV'}</Button></div></div>{error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}</section>;
}
