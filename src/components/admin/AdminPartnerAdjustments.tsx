import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi.ts';

export function AdminPartnerAdjustments({ partnerId, revision }: { partnerId: string; revision: number }) {
  const [data,setData] = useState<any>(null); const [error,setError] = useState('');
  useEffect(() => { let active = true; setError('');
    adminApi.get(`/admin/partners/${partnerId}/balance-adjustments`).then(result => { if (active) setData(result); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  },[partnerId,revision]);
  return <section className="rounded-xl border border-[#263650] bg-[#0B1325] p-4"><h3 className="text-sm font-bold text-white">Partner balance & adjustment history</h3>{error ? <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p> : <><p className="mt-2 text-sm text-slate-300">Available balance: <strong className="text-[#D4AF37]">{data ? `₹${data.availableBalance.toLocaleString('en-IN')}` : 'Loading…'}</strong></p>{data?.data?.length ? <div className="mt-4 space-y-3">{data.data.map((item: any) => <div key={item.transactionId} className="rounded-lg border border-[#263650] p-3 text-xs text-slate-300"><p className="font-semibold text-rose-300">−₹{item.amount.toLocaleString('en-IN')} · {item.relatedLeadId || item.referenceId}</p><p className="mt-1">{item.internalNote}</p><p className="mt-1 text-slate-400">{item.adjustmentAdminEmail || item.processedBy} · {new Date(item.createdAt).toLocaleString()}</p><p className="mt-1 font-mono">₹{item.balanceBefore} → ₹{item.balanceAfter} · {item.transactionId}</p></div>)}</div> : data && <p className="mt-3 text-xs text-slate-400">No approval reversals recorded.</p>}<p className="mt-3 text-[10px] text-slate-500">Latest 100 approval adjustments. Original financial transactions are preserved.</p></>}</section>;
}
