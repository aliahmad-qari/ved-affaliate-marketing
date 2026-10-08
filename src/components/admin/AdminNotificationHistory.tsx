import React, { useState } from 'react';
import { Bell, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export const AdminNotificationHistory: React.FC<{ records: any[] }> = ({ records }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const filtered = records.filter(item => [item.title, item.message, item.partnerId, item.type].some(value => String(value ?? '').toLowerCase().includes(search.trim().toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  const start = (current - 1) * 10;
  
  return (
    <section className="min-w-0 self-start bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-5 sm:p-6 shadow-lg">
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#1C273C] pb-4">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-[#D4AF37]" />
          <div>
            <h2 className="text-lg font-bold text-[#F8FAFC]">Notification History</h2>
            <p className="text-xs text-[#AAB3C2] mt-1">{records.length} sent notifications</p>
          </div>
        </div>
        <span className="rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-3 py-1.5 text-xs font-semibold text-[#D4AF37]">
          {records.length} records
        </span>
      </div>

      <label className="relative mb-4 block">
        <span className="sr-only">Search notification history</span>
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#D4AF37]" />
        <input 
          className="w-full rounded-lg border border-[#1C273C] bg-[#070B14] px-3 py-2.5 pl-9 text-xs text-[#F8FAFC] outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 transition-all"
          placeholder="Search title, message, partner ID or type" 
          value={search} 
          onChange={event => { setSearch(event.target.value); setPage(1); }} 
        />
      </label>

      <div className="divide-y divide-[#1C273C] bg-[#070B14] rounded-lg border border-[#1C273C] overflow-hidden">
        {filtered.slice(start, start + 10).map(item => (
          <article key={item._id} className="flex gap-3 py-4 px-4 hover:bg-[#111A2D]/40 transition-colors">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] font-semibold text-xs">
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#F8FAFC]">{item.title}</h3>
                {item.type && (
                  <span className="text-[10px] font-bold text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded whitespace-nowrap">
                    {String(item.type).replaceAll('_', ' ')}
                  </span>
                )}
              </div>
              
              {item.message && (
                <details className="mt-1.5 text-xs text-[#AAB3C2]">
                  <summary className="cursor-pointer text-[#D4AF37] font-semibold hover:underline">View message</summary>
                  <p className="mt-2 whitespace-pre-wrap text-[#AAB3C2] ml-3 border-l-2 border-[#D4AF37]/30 pl-3">
                    {item.message}
                  </p>
                </details>
              )}
              
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#8F9DB2]">
                <span className="text-[#D4AF37] font-mono">{item.partnerId || 'All partners'}</span>
                {item.createdAt && (
                  <time dateTime={item.createdAt} className="text-[#AAB3C2]">
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                )}
              </div>
            </div>
          </article>
        ))}
        
        {!filtered.length && (
          <div className="py-10 text-center px-4">
            <Bell className="mx-auto mb-3 h-7 w-7 text-[#AAB3C2]/40" />
            <p className="text-sm font-semibold text-[#AAB3C2]">
              {search ? 'No matching notifications' : 'No notifications yet'}
            </p>
            <p className="mt-1 text-xs text-[#8F9DB2]">
              {search ? 'Try another title or partner ID.' : 'Sent notifications will appear here.'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#1C273C]">
        <p role="status" className="text-[11px] text-[#AAB3C2]">
          {filtered.length ? `${start + 1}–${Math.min(start + 10, filtered.length)} of ${filtered.length}` : '0 records'} · Page {current} of {pages}
        </p>
        <div className="flex gap-2">
          <button 
            type="button" 
            aria-label="Previous notification page" 
            disabled={current <= 1} 
            onClick={() => setPage(current - 1)} 
            className="rounded-lg border border-[#1C273C] bg-[#070B14] hover:border-[#D4AF37]/40 hover:bg-[#111A2D] p-2 disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="h-4 w-4 text-[#AAB3C2]" />
          </button>
          <button 
            type="button" 
            aria-label="Next notification page" 
            disabled={current >= pages} 
            onClick={() => setPage(current + 1)} 
            className="rounded-lg border border-[#1C273C] bg-[#070B14] hover:border-[#D4AF37]/40 hover:bg-[#111A2D] p-2 disabled:opacity-30 transition-all"
          >
            <ChevronRight className="h-4 w-4 text-[#AAB3C2]" />
          </button>
        </div>
      </div>
    </section>
  );
};
