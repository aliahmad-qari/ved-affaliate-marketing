import React from 'react';
import { LeadDateFilters, emptyLeadDateFilters, LEAD_FILTER_TIMEZONE } from '../../../shared/leadDateFilters.ts';

export function LeadDateFilterControls({ value, onChange, onReset }: { value: LeadDateFilters; onChange: (value: LeadDateFilters) => void; onReset: () => void }) {
  const input = 'mt-1 w-full min-w-0 rounded-lg border border-[#263650] bg-[#080D17] px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-[#D4AF37]';
  return <section aria-label="Lead date filters" className="rounded-xl border border-[#263650] bg-[#0B1325] p-4">
    <p className="mb-3 text-xs text-[#AAB3C2]">Lead creation dates · {LEAD_FILTER_TIMEZONE} (IST, UTC+05:30). Date and month/year filters combine.</p>
    <div className="grid min-w-0 grid-cols-1 items-end gap-3 min-[400px]:grid-cols-2 lg:grid-cols-5">
      <label className="min-w-0 text-xs text-[#AAB3C2]">From Date<input type="date" className={input} value={value.startDate} onChange={event => onChange({ ...value, startDate: event.target.value })} /></label>
      <label className="min-w-0 text-xs text-[#AAB3C2]">To Date<input type="date" className={input} value={value.endDate} onChange={event => onChange({ ...value, endDate: event.target.value })} /></label>
      <label className="min-w-0 text-xs text-[#AAB3C2]">Month<select className={input} value={value.month} onChange={event => onChange({ ...value, month: event.target.value, year: event.target.value && !value.year ? new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: LEAD_FILTER_TIMEZONE }).format(new Date()) : value.year })}><option value="">All months</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, index, 1)))}</option>)}</select></label>
      <label className="min-w-0 text-xs text-[#AAB3C2]">Year<input type="number" min={1970} max={9998} placeholder="All years" className={input} value={value.year} onChange={event => onChange({ ...value, year: event.target.value, month: event.target.value ? value.month : '' })} /></label>
      <button type="button" className="rounded-lg border border-[#D4AF37]/40 px-3 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10" onClick={() => { onChange({ ...emptyLeadDateFilters }); onReset(); }}>Reset Filters</button>
    </div>
  </section>;
}
