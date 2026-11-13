import React, { useEffect, useState } from 'react';
import { fetchPublicSuccessfulLeads, type PublicSuccessfulLeadPartner } from '../../services/api.ts';
import { monthlyLeaderboardTableLayout as tableLayout } from '../monthlyLeaderboardTableLayout.ts';

const monthLabel = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-IN', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

export function PublicSuccessfulLeadsSection() {
  const [rows, setRows] = useState<PublicSuccessfulLeadPartner[]>([]);
  const [month, setMonth] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchPublicSuccessfulLeads(controller.signal)
      .then(result => { setRows(result.rankings); setMonth(result.monthKey); })
      .catch(() => setRows([]))
      .finally(() => { if (!controller.signal.aborted) setLoaded(true); });
    return () => controller.abort();
  }, []);

  return <section aria-labelledby="public-successful-leads-title" className="border-b border-[#173247] bg-[#030b14] py-10 sm:py-14">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#f2ce63]">Verified partner results · UTC</p>
        <h2 id="public-successful-leads-title" className="mt-2 text-2xl font-bold text-[#F8FAFC] sm:text-3xl">Monthly Top Partners</h2>
        {month && <p className="mt-1 text-sm text-[#AAB3C2]">{monthLabel(month)}</p>}
      </div>
      {loaded && !rows.length
        ? <p className="rounded-xl border border-[#20506c] bg-[#081421] p-5 text-center text-sm text-[#AAB3C2]">No admin-approved conversions this month yet.</p>
        : !loaded
          ? <p role="status" className="rounded-xl border border-[#20506c] bg-[#081421] p-5 text-center text-sm text-[#AAB3C2]">Loading monthly rankings…</p>
          : <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-[#20506c] bg-[#081421]">
            <table className={tableLayout.table}>
              <colgroup>{tableLayout.columnWidths.map((width, index) => <col key={index} className={width} />)}</colgroup>
              <thead className="border-b border-[#20506c] text-[10px] uppercase tracking-wide text-[#AAB3C2] sm:text-xs"><tr><th className={tableLayout.header}>Rank</th><th className={tableLayout.header}>Partner</th><th className={`${tableLayout.header} text-right`}>Approved Leads</th><th className={`${tableLayout.header} text-right`}>Earnings (₹)</th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={`${row.rank}-${index}`} className="border-b border-[#173247] last:border-0 text-[#E7EDF6]">
                <td className={`${tableLayout.cell} font-bold text-[#f2ce63]`}>#{row.rank}</td><td className={`${tableLayout.partnerCell} font-medium`}>{row.partnerName}</td>
                <td className={`${tableLayout.cell} text-right font-semibold text-[#f2ce63]`}>{row.approvedConversions.toLocaleString('en-IN')}</td><td className={`${tableLayout.cell} text-right font-semibold`}>{money(row.approvedEarnings)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
    </div>
  </section>;
}
