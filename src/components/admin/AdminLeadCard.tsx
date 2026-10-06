import React from 'react';
import { Button } from '../ui/Button.tsx';
import { LeadItem } from '../../types/partner.ts';

interface AdminLeadCardProps {
  item: LeadItem;
  busy: boolean;
  onAction: (path: string, body: Record<string, unknown>) => void;
}

export const AdminLeadCard: React.FC<AdminLeadCardProps> = ({ item, busy, onAction }) => {
  const isEnquiry = item.submittedData?.source === 'CUSTOMER_FORM';
  const canReview = ['PENDING', 'VERIFIED'].includes(item.status);
  const notSubmitted = isEnquiry && item.submittedData?.processStatus === 'NOT_SUBMITTED';
  const selectClass = 'w-full rounded-lg border border-[#263650] bg-[#080D17] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37] sm:w-auto';
  const path = `/admin/leads/${item._id}`;

  return <section className="border border-[#263650] bg-[#0D1424] p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="[overflow-wrap:anywhere] font-semibold">{item.leadId} · {item.campaignName}</h3>
        <p className="break-all text-xs text-[#AAB3C2]">{item.partnerId} · {item.clientName} · {item.clientMobile} · {item.accountId}</p>
        <p className="[overflow-wrap:anywhere] text-xs text-[#D4AF37]">{item.status} · Snapshot ₹{item.payoutSnapshot} {item.rejectionReason && `· ${item.rejectionReason}`}</p>
        {isEnquiry && <p className="mt-1 text-xs text-[#AAB3C2]">
          Customer enquiry · {canReview ? (notSubmitted ? 'Not Submitted' : 'In Process') : item.status}
          {item.createdAt && ` · Started ${new Date(item.createdAt).toLocaleString()}`}
        </p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-[50%]">
        {isEnquiry && canReview && <label className="w-full text-xs text-[#AAB3C2] sm:w-auto">Application progress
          <select className={`${selectClass} mt-1`} disabled={busy} value={item.submittedData?.processStatus || 'IN_PROCESS'} onChange={(event) => onAction(`${path}/process`, { processStatus: event.target.value })}>
            <option value="IN_PROCESS">In Process</option><option value="NOT_SUBMITTED">Not Submitted</option>
          </select>
        </label>}
        {canReview && <Button disabled={busy} size="sm" variant="outline" onClick={() => {
          const value = window.prompt('New payout for this lead (₹)', String(item.payoutSnapshot));
          if (value !== null && value.trim() !== '') onAction(`${path}/payout`, { payoutSnapshot: Number(value) });
        }}>Adjust payout</Button>}
        {item.status === 'PENDING' && !notSubmitted && <Button disabled={busy} size="sm" variant="outline" onClick={() => onAction(`${path}/review`, { status: 'VERIFIED' })}>Verify</Button>}
        {canReview && !notSubmitted && <Button disabled={busy} size="sm" variant="primary" onClick={() => onAction(`${path}/review`, { status: 'APPROVED' })}>Approve</Button>}
        {canReview && <Button disabled={busy} size="sm" variant="outline" onClick={() => {
          const rejectionReason = window.prompt('Rejection reason');
          if (rejectionReason) onAction(`${path}/review`, { status: 'REJECTED', rejectionReason });
        }}>Reject</Button>}
        {item.status === 'APPROVED' && <Button disabled={busy} size="sm" variant="primary" onClick={() => {
          const paymentReference = window.prompt('Manual commission payment reference');
          if (paymentReference) onAction(`${path}/paid`, { paymentReference });
        }}>Mark paid</Button>}
      </div>
    </div>
  </section>;
};
