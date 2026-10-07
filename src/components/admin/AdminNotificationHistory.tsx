import React, { useState } from 'react';
import { Bell, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export const AdminNotificationHistory: React.FC<{ records: any[] }> = ({ records }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const filtered = records.filter(item => [item.title, item.message, item.partnerId, item.type].some(value => String(value ?? '').toLowerCase().includes(search.trim().toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  const start = (current - 1) * 10;
  return <section className="min-w-0 self-start">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Notification history</h2><span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs text-sky-300">{records.length} records</span></div>
    <label className="relative mb-4 block"><span className="sr-only">Search notification history</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-sky-400" /><input className="admin-notification-search w-full text-sm" placeholder="Search title, message, partner ID or type" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
    <div className="divide-y divide-[#203755]">
      {filtered.slice(start, start + 10).map(item => <article key={item._id} className="flex gap-3 py-4">
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300"><Bell aria-hidden="true" className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold [overflow-wrap:anywhere]">{item.title}</h3>
          {item.message && <details className="mt-1 text-xs text-slate-400"><summary className="cursor-pointer text-sky-300">View message</summary><p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{item.message}</p></details>}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500"><span className="text-sky-300">{item.partnerId || 'Partner unavailable'}</span>{item.type && <span>{String(item.type).replaceAll('_', ' ')}</span>}{item.createdAt && <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>}</div>
        </div>
      </article>)}
      {!filtered.length && <div className="py-10 text-center"><Bell aria-hidden="true" className="mx-auto mb-3 h-7 w-7 text-slate-500" /><p className="text-sm text-slate-300">{search ? 'No matching notifications' : 'No notifications yet'}</p><p className="mt-1 text-xs text-slate-500">{search ? 'Try another title or partner ID.' : 'Sent notifications will appear here.'}</p></div>}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#203755] pt-4"><p role="status" className="text-[11px] text-slate-400">{filtered.length ? `${start + 1}–${Math.min(start + 10, filtered.length)} of ${filtered.length}` : '0 records'} · Page {current} of {pages}</p><div className="flex gap-2"><button type="button" aria-label="Previous notification page" disabled={current <= 1} onClick={() => setPage(current - 1)} className="rounded-lg border border-[#234263] p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label="Next notification page" disabled={current >= pages} onClick={() => setPage(current + 1)} className="rounded-lg border border-[#234263] p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></div></div>
  </section>;
};
