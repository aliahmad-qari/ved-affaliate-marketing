import React, { useEffect, useState } from 'react';
import { fetchPublicSuccessfulLeads, type PublicSuccessfulLeadPartner } from '../../services/api.ts';

const monthLabel = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-IN', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});

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
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#f2ce63]">Verified partner results · Asia/Kolkata</p>
        <h2 id="public-successful-leads-title" className="mt-2 text-2xl font-bold text-[#F8FAFC] sm:text-3xl">Monthly Top Partners</h2>
        {month && <p className="mt-1 text-sm text-[#AAB3C2]">{monthLabel(month)}</p>}
      </div>
      {loaded && !rows.length
        ? <p className="rounded-xl border border-[#20506c] bg-[#081421] p-5 text-center text-sm text-[#AAB3C2]">No admin-approved conversions this month yet.</p>
        : !loaded
          ? <p role="status" className="rounded-xl border border-[#20506c] bg-[#081421] p-5 text-center text-sm text-[#AAB3C2]">Loading monthly rankings…</p>
          : <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-[#20506c] bg-[#081421]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#20506c] text-xs uppercase tracking-wide text-[#AAB3C2]"><tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Partner</th><th className="px-4 py-3 text-right">Approved Leads</th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={`${row.rank}-${index}`} className="border-b border-[#173247] last:border-0 text-[#E7EDF6]">
                <td className="px-4 py-3 font-bold text-[#f2ce63]">#{row.rank}</td><td className="px-4 py-3">{row.partnerName}</td>
                <td className="px-4 py-3 text-right font-semibold text-[#f2ce63]">{row.approvedConversions.toLocaleString('en-IN')}</td>
              </tr>)}</tbody>
            </table>
          </div>}
    </div>
  </section>;
}
