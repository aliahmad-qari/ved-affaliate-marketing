import React, { useEffect, useState } from 'react';
import { Copy, Link2, Share2, Users, MousePointerClick, CheckCircle2, TrendingUp, Plus, Archive, RotateCcw, Pencil } from 'lucide-react';
import { fetchPartnerCampaigns, fetchPartnerSubTeamLinks, createPartnerSubTeamLink, updatePartnerSubTeamLink } from '../../services/partnerApi.ts';
import { PartnerCampaignItem, PartnerSubTeamLinkItem } from '../../types/partner.ts';
import { copyText } from '../../lib/clipboard.ts';
import { ManualCopyField } from '../ui/ManualCopyField.tsx';
import { Button } from '../ui/Button.tsx';

export function PartnerSubTeamLinks() {
  const [links, setLinks] = useState<PartnerSubTeamLinkItem[]>([]);
  const [campaigns, setCampaigns] = useState<PartnerCampaignItem[]>([]);
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [manualCopy, setManualCopy] = useState<string | null>(null);

  const load = async () => {
    try {
      const [linkRows, campaignRows] = await Promise.all([fetchPartnerSubTeamLinks(), fetchPartnerCampaigns()]);
      setLinks(linkRows);
      const live = campaignRows.filter(campaign => campaign.status === 'LIVE');
      setCampaigns(live);
      setCampaignId(current => current || live[0]?.slug || live[0]?._id || '');
      setError('');
    } catch (err: any) { setError(err.message || 'Unable to load sub-team links.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await createPartnerSubTeamLink({ name, campaignId });
      setName(''); setNotice('Sub-team tracking link created.'); await load();
    } catch (err: any) { setError(err.message || 'Unable to create this link.'); }
    finally { setBusy(false); }
  };

  const update = async (link: PartnerSubTeamLinkItem, patch: { name?: string; status?: 'ACTIVE' | 'ARCHIVED' }) => {
    setBusy(true); setError(''); setNotice('');
    try { await updatePartnerSubTeamLink(link._id, patch); await load(); setNotice('Sub-team link updated.'); }
    catch (err: any) { setError(err.message || 'Unable to update this link.'); }
    finally { setBusy(false); }
  };

  const share = (link: PartnerSubTeamLinkItem) => {
    if (!link.trackingUrl) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(`Apply for ${link.campaignName} through ${link.name}: ${link.trackingUrl}`)}`, '_blank', 'noopener,noreferrer');
  };

  const number = (value: number) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const input = 'w-full rounded-lg border border-[#263650] bg-[#080D17] px-3 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]';

  return <section className="space-y-4 rounded-2xl border border-[#1E2E4E] bg-gradient-to-br from-[#0B1325] to-[#070B14] p-4 shadow-lg sm:p-5" aria-labelledby="sub-team-links-title">
    {manualCopy !== null && <ManualCopyField text={manualCopy} onClose={() => setManualCopy(null)} />}
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="sub-team-links-title" className="flex items-center gap-2 text-base font-bold text-white"><Users className="h-5 w-5 text-[#D4AF37]" />Sub-Team Tracking Links</h2><p className="mt-1 text-xs leading-5 text-[#AAB3C2]">Create campaign links for your sub-teams and view their attributed activity. Sub-teams do not receive separate accounts or balances.</p></div><span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-[10px] font-semibold text-[#D4AF37]">Partner-owned</span></div>
    <form onSubmit={event => void create(event)} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
      <label className="text-xs text-[#AAB3C2]">Sub-team name<input className={`${input} mt-1`} value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={60} required placeholder="For example, North Team" disabled={busy} /></label>
      <label className="text-xs text-[#AAB3C2]">Live campaign<select className={`${input} mt-1`} value={campaignId} onChange={event => setCampaignId(event.target.value)} disabled={busy || loading || !campaigns.length} required><option value="">Select a campaign</option>{campaigns.map(campaign => <option key={campaign._id || campaign.slug} value={campaign.slug}>{campaign.name}</option>)}</select></label>
      <div className="flex items-end"><Button type="submit" variant="primary" size="sm" disabled={busy || loading || !campaignId || name.trim().length < 2}><Plus className="mr-1 h-4 w-4" />Create Link</Button></div>
    </form>
    {notice && <p role="status" className="text-xs text-emerald-300">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-200">{error}</p>}
    {loading ? <p role="status" className="text-xs text-[#AAB3C2]">Loading your sub-team links…</p> : links.length ? <div className="grid gap-3 lg:grid-cols-2">{links.map(link => <article key={link._id} className="min-w-0 space-y-3 rounded-xl border border-[#263650] bg-[#080D17]/80 p-4">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-bold text-white">{link.name}</h3><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${link.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{link.status}</span></div><p className="mt-1 truncate text-xs text-[#AAB3C2]">{link.campaignName}</p></div><button type="button" aria-label={`Rename ${link.name}`} title="Rename link" disabled={busy} onClick={() => { const next = window.prompt('New sub-team name', link.name); if (next !== null) void update(link, { name: next }); }} className="rounded-lg p-2 text-[#AAB3C2] hover:bg-white/5 hover:text-white disabled:opacity-40"><Pencil className="h-4 w-4" /></button></div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><div className="rounded-lg bg-[#111A2D] p-2"><span className="flex items-center gap-1 text-[#AAB3C2]"><MousePointerClick className="h-3.5 w-3.5" />Clicks</span><strong className="mt-1 block text-white">{number(link.clickCount)}</strong></div><div className="rounded-lg bg-[#111A2D] p-2"><span className="flex items-center gap-1 text-[#AAB3C2]"><Link2 className="h-3.5 w-3.5" />Leads</span><strong className="mt-1 block text-white">{number(link.leads)}</strong></div><div className="rounded-lg bg-[#111A2D] p-2"><span className="flex items-center gap-1 text-[#AAB3C2]"><CheckCircle2 className="h-3.5 w-3.5" />Approved</span><strong className="mt-1 block text-emerald-300">{number(link.approvedConversions)}</strong></div><div className="rounded-lg bg-[#111A2D] p-2"><span className="flex items-center gap-1 text-[#AAB3C2]"><TrendingUp className="h-3.5 w-3.5" />Earnings</span><strong className="mt-1 block text-[#D4AF37]">₹{number(link.attributedEarnings)}</strong></div></div>
      {link.trackingUrl && <p className="break-all rounded-lg border border-[#263650] bg-[#070B14] p-2 font-mono text-[10px] leading-4 text-slate-300">{link.trackingUrl}</p>}
      <div className="flex flex-wrap gap-2">{link.trackingUrl && <><Button size="sm" variant="outline" disabled={busy} onClick={async () => { if (await copyText(link.trackingUrl!)) setNotice('Link copied.'); else setManualCopy(link.trackingUrl!); }}><Copy className="mr-1 h-3.5 w-3.5" />Copy Link</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => share(link)}><Share2 className="mr-1 h-3.5 w-3.5" />Share</Button></>}{link.status === 'ACTIVE' ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => void update(link, { status: 'ARCHIVED' })}><Archive className="mr-1 h-3.5 w-3.5" />Archive</Button> : <Button size="sm" variant="ghost" disabled={busy} onClick={() => void update(link, { status: 'ACTIVE' })}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reactivate</Button>}</div>
    </article>)}</div> : <div className="rounded-xl border border-dashed border-[#263650] p-5 text-center"><p className="text-sm font-semibold text-white">No sub-team links yet</p><p className="mt-1 text-xs text-[#AAB3C2]">Choose a live campaign and create your first named tracking link.</p></div>}
  </section>;
}
