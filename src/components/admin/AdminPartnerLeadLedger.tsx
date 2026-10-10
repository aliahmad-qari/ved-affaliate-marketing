import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, ListChecks } from 'lucide-react';
import { adminApi } from '../../services/adminApi.ts';
import { Button } from '../ui/Button.tsx';
import { AdminLeadCard } from './AdminLeadCard.tsx';

const initialFilters = { search: '', status: 'ALL', campaignId: 'ALL', startDate: '', endDate: '' };
const statuses = ['ALL','PENDING','VERIFIED','APPROVED','REJECTED','PAID'];
const inputClass = 'w-full min-w-0 rounded-lg border border-[#263650] bg-[#080D17] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]';
const dateText = (value?: string) => value ? new Date(value).toLocaleString() : 'Unavailable';

export function AdminPartnerLeadLedger({ partner, campaigns, onBack }: { partner: any; campaigns: any[]; onBack: () => void }) {
  const [draft, setDraft] = useState({ ...initialFilters });
  const [filters, setFilters] = useState({ ...initialFilters });
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const detailRequest = useRef(0);
  useEffect(() => {
    let active = true; setLoading(true); setResponse(null); setError('');
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    for (const [key,value] of Object.entries(filters)) {
      if (!value || value === 'ALL') continue;
      query.set(key, key === 'startDate' ? new Date(`${value}T00:00:00`).toISOString() : key === 'endDate' ? new Date(`${value}T23:59:59.999`).toISOString() : value);
    }
    adminApi.get(`/admin/partners/${partner._id}/leads?${query}`).then(result => { if (active) setResponse(result); }).catch(err => { if (active) setError(err.message || 'Unable to load lead ledger.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [partner._id, filters, page, revision]);
  useEffect(() => () => { detailRequest.current++; }, []);
  const open = async (id: string) => {
    const request = ++detailRequest.current; setError(''); setBusy(true);
    try { const result = await adminApi.get(`/admin/leads/${id}`); if (request === detailRequest.current) setDetail(result); }
    catch (err: any) { if (request === detailRequest.current) setError(err.message); }
    finally { if (request === detailRequest.current) setBusy(false); }
  };
  const action = async (path: string, body: Record<string, unknown>) => {
    setBusy(true); setError('');
    try {
      await adminApi.patch(path, body);
      setRevision(value => value + 1);
      if (detail?.data?._id) setDetail(await adminApi.get(`/admin/leads/${detail.data._id}`));
    } catch (err: any) { setError(err.message || 'Unable to update lead.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold text-white"><ListChecks className="h-5 w-5 text-[#D4AF37]" />Partner Lead Ledger</h2><p className="mt-1 text-sm text-slate-400">{partner.fullName} · <span className="font-mono text-[#D4AF37]">{partner.partnerId}</span></p></div><Button size="sm" variant="outline" onClick={onBack} disabled={busy}><ArrowLeft className="mr-2 h-4 w-4" />Back to Partners</Button></div>
    <p className="text-xs text-slate-400">Counts cover all leads for this partner. Statuses are counted separately; filtered results appear below.</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{statuses.map(status => <div key={status} className="rounded-xl border border-[#263650] bg-[#0B1325] p-3"><p className="text-[10px] font-semibold uppercase text-slate-400">{status === 'ALL' ? 'Total leads' : status}</p><p className="mt-1 text-xl font-bold text-white">{response?.summary?.[status] ?? '—'}</p></div>)}</div>
    <form className="admin-filters grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={event => { event.preventDefault(); setPage(1); setFilters({ ...draft }); }}>
      <label className="text-xs text-slate-400">Search<input className={`${inputClass} mt-1`} placeholder="Customer, phone, lead or account ID" value={draft.search} onChange={event => setDraft({ ...draft, search: event.target.value })} /></label>
      <label className="text-xs text-slate-400">Campaign<select className={`${inputClass} mt-1`} value={draft.campaignId} onChange={event => setDraft({ ...draft, campaignId: event.target.value })}><option value="ALL">All Campaigns</option>{campaigns.map(campaign => <option key={campaign._id} value={campaign._id}>{campaign.name} · {campaign.status}</option>)}</select></label>
      <label className="text-xs text-slate-400">Status<select className={`${inputClass} mt-1`} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{statuses.map(status => <option key={status} value={status}>{status === 'ALL' ? 'All statuses' : status}</option>)}</select></label>
      <label className="text-xs text-slate-400">From (local date)<input type="date" className={`${inputClass} mt-1`} value={draft.startDate} max={draft.endDate || undefined} onChange={event => setDraft({ ...draft, startDate: event.target.value })} /></label>
      <label className="text-xs text-slate-400">To (local date)<input type="date" className={`${inputClass} mt-1`} value={draft.endDate} min={draft.startDate || undefined} onChange={event => setDraft({ ...draft, endDate: event.target.value })} /></label>
      <div className="flex items-end gap-2"><Button size="sm" variant="primary" type="submit" disabled={loading}><Search className="mr-1 h-4 w-4" />Apply</Button><Button size="sm" variant="outline" type="button" onClick={() => { setDraft({ ...initialFilters }); setFilters({ ...initialFilters }); setPage(1); }}>Reset</Button></div>
    </form>
    {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
    {loading ? <p role="status" className="text-sm text-slate-400">Loading partner leads…</p> : response && <>
      <p className="text-xs text-slate-400">{response.total} matching leads · Page {response.page} of {response.totalPages}</p>
      {response.data.length === 0 ? <div className="rounded-xl border border-[#263650] p-8 text-center text-sm text-slate-400">No leads match these filters.</div> : <div className="overflow-x-auto rounded-xl border border-[#263650]"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-[#0B1325] text-slate-400"><tr>{['Lead / date','Campaign','Customer / mobile','Account / reference','Payout','Status','Action'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{response.data.map((lead: any) => <tr key={lead._id} className="border-t border-[#263650] text-slate-300"><td className="p-3"><p className="font-mono text-[#D4AF37]">{lead.leadId}</p><p className="mt-1 text-[10px] text-slate-400">{dateText(lead.createdAt)}</p></td><td className="p-3">{lead.campaignName}</td><td className="p-3"><p>{lead.clientName || 'Unavailable'}</p><p className="mt-1 font-mono text-slate-400">{lead.clientMobile || 'Unavailable'}</p></td><td className="max-w-48 break-all p-3 font-mono">{lead.accountId}</td><td className="p-3 font-semibold text-[#D4AF37]">₹{lead.payoutSnapshot ?? 0}</td><td className="p-3"><span className="rounded border border-[#263650] px-2 py-1">{lead.status}</span></td><td className="p-3"><Button size="sm" variant="outline" disabled={busy} onClick={() => void open(lead._id)}>Open lead</Button></td></tr>)}</tbody></table></div>}
      <div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= response.totalPages || loading} onClick={() => setPage(value => value + 1)}>Next</Button></div>
    </>}
    {detail && <section role="dialog" aria-modal="true" aria-labelledby="ledger-lead-title" className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4 sm:p-8"><div className="mx-auto max-w-4xl space-y-4 rounded-xl border border-[#263650] bg-[#0D1424] p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><h3 id="ledger-lead-title" className="text-lg font-bold text-white">Lead details & history</h3><Button size="sm" variant="outline" disabled={busy} onClick={() => { detailRequest.current++; setDetail(null); }}>Close</Button></div>{error && <p role="alert" className="text-sm text-rose-300">{error}</p>}<AdminLeadCard item={detail.data} busy={busy} onAction={(path,body) => void action(path,body)} /><h4 className="text-sm font-semibold text-white">Recorded history</h4><p className="text-xs text-slate-400">Created: {dateText(detail.data.createdAt)}. Only recorded audit events are shown; missing historical changes cannot be reconstructed.</p>{detail.history.length === 0 ? <p className="text-sm text-slate-400">No audit changes recorded for this lead.</p> : <ol className="space-y-3">{detail.history.map((event: any) => <li key={event._id} className="rounded-lg border border-[#263650] p-3 text-xs text-slate-300"><p className="font-semibold text-white">{event.action.replaceAll('_',' ')}</p><p className="mt-1 text-slate-400">{event.adminEmail || 'Admin unavailable'} · {dateText(event.createdAt)}</p>{[...new Set([...Object.keys(event.before || {}), ...Object.keys(event.after || {})])].map(key => <p className="mt-1 break-words" key={key}>{key}: {String(event.before?.[key] ?? '—')} → {String(event.after?.[key] ?? '—')}</p>)}</li>)}</ol>}</div></section>}
  </div>;
}
