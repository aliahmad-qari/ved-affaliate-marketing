import React, { useState } from 'react';
import { Button } from '../ui/Button.tsx';

export function AdminLeadDecisionDialog({ kind, leadId, amount, busy, onCancel, onConfirm }: {
  kind: 'reject' | 'reverse'; leadId: string; amount: number; busy: boolean; onCancel: () => void; onConfirm: (body: Record<string, unknown>) => void;
}) {
  const [code,setCode] = useState(''); const [reason,setReason] = useState('');
  const reversal = kind === 'reverse';
  return <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/85 p-4"><form role="dialog" aria-modal="true" aria-labelledby="lead-decision-title" className="my-auto w-full max-w-md space-y-4 rounded-xl border border-[#34516b] bg-[#0D182a] p-5 sm:p-6" onSubmit={event => {
    event.preventDefault();
    if (reversal) onConfirm({ reason: reason.trim() });
    else onConfirm({ status: 'REJECTED', rejectionReasonCode: code, rejectionReason: code === 'OTHER' ? reason.trim() : code === 'NO_LEAD_FOUND' ? 'No Lead Found' : 'Duplicate Lead' });
  }}><h2 id="lead-decision-title" className="text-lg font-bold text-white">{reversal ? 'Reverse Approval' : 'Reject lead'}</h2><p className="font-mono text-xs text-[#D4AF37]">{leadId}</p>
    {reversal ? <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100">Reverse only this lead's commission: <strong>₹{amount.toLocaleString('en-IN')}</strong>. The original transaction stays in history with a separate debit adjustment. Paid leads and insufficient unreserved balances cannot be reversed here.</div> : <label className="block text-sm text-slate-300">Rejection reason<select aria-label="Rejection reason" className="mt-2 w-full rounded-lg border border-[#34516b] bg-[#080D17] px-3 py-2.5 text-sm text-white" value={code} onChange={event => setCode(event.target.value)} required><option value="" disabled>Choose a reason</option><option value="NO_LEAD_FOUND">No Lead Found</option><option value="DUPLICATE_LEAD">Duplicate Lead</option><option value="OTHER">Other</option></select></label>}
    {(reversal || code === 'OTHER') && <label className="block text-sm text-slate-300">{reversal ? 'Reason for reversal' : 'Explain the rejection'} *<textarea aria-label={reversal ? 'Reason for reversal' : 'Explain the rejection'} className="mt-2 w-full rounded-lg border border-[#34516b] bg-[#080D17] p-3 text-sm text-white" value={reason} onChange={event => setReason(event.target.value)} required minLength={3} maxLength={1000} rows={3} /></label>}
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button><Button type="submit" variant="primary" size="sm" disabled={busy || (!reversal && !code) || ((reversal || code === 'OTHER') && reason.trim().length < 3)}>{reversal ? `Confirm reversal · ₹${amount.toLocaleString('en-IN')}` : 'Confirm rejection'}</Button></div>
  </form></div>;
}
