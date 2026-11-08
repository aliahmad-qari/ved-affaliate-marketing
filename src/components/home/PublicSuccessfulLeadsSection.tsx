import React, { useEffect, useState } from 'react';
import { fetchPublicSuccessfulLeads, type PublicSuccessfulLeadPartner } from '../../services/api.ts';

export function PublicSuccessfulLeadsSection() {
  const [rows, setRows] = useState<PublicSuccessfulLeadPartner[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchPublicSuccessfulLeads(controller.signal).then(setRows).catch(() => setRows([])).finally(() => { if (!controller.signal.aborted) setLoaded(true); });
    return () => controller.abort();
  }, []);
  return <section aria-labelledby="public-successful-leads-title" className="border-b border-[#173247] bg-[#030b14] py-10 sm:py-14">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#f2ce63]">Verified partner results</p><h2 id="public-successful-leads-title" className="mt-2 text-2xl font-bold text-[#F8FAFC] sm:text-3xl">Successful Leads</h2></div>
      {loaded && !rows.length ? <p className="rounded-xl border border-[#20506c] bg-[#081421] p-5 text-center text-sm text-[#AAB3C2]">No verified successful leads yet.</p> : !loaded ? <p role="status" className="rounded-xl border border-[#20506c] bg-[#081421] p-5 text-center text-sm text-[#AAB3C2]">Loading approved results…</p> : <div className="overflow-x-auto rounded-xl border border-[#20506c] bg-[#081421]">
        <table className="w-full min-w-[460px] text-left text-sm"><thead className="border-b border-[#20506c] text-xs uppercase tracking-wide text-[#AAB3C2]"><tr><th className="px-4 py-3">Partner</th><th className="px-4 py-3">Partner ID</th><th className="px-4 py-3 text-right">Successful Leads</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.partnerId}-${index}`} className="border-b border-[#173247] last:border-0 text-[#E7EDF6]"><td className="px-4 py-3">{row.partnerName}</td><td className="px-4 py-3 font-mono">{row.partnerId}</td><td className="px-4 py-3 text-right font-semibold text-[#f2ce63]">{row.successfulLeads.toLocaleString('en-IN')}</td></tr>)}</tbody>
        </table>
      </div>}
    </div>
  </section>;
}
