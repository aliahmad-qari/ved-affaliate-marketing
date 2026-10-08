import React from 'react';
import { Button } from '../ui/Button.tsx';
import { LeadItem } from '../../types/partner.ts';
import { CheckCircle2, Clock, AlertCircle, DollarSign } from 'lucide-react';

interface AdminLeadCardProps {
  item: LeadItem;
  busy: boolean;
  onAction: (path: string, body: Record<string, unknown>) => void;
}

export const AdminLeadCard: React.FC<AdminLeadCardProps> = ({ item, busy, onAction }) => {
  const isEnquiry = item.submittedData?.source === 'CUSTOMER_FORM';
  const canReview = ['PENDING', 'VERIFIED'].includes(item.status);
  const notSubmitted = isEnquiry && item.submittedData?.processStatus === 'NOT_SUBMITTED';
  const selectClass = 'w-full rounded-lg border border-[#1C273C] bg-[#070B14] px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 sm:w-auto transition-all';
  const path = `/admin/leads/${item._id}`;

  const statusConfig = {
    PENDING: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-700' },
    VERIFIED: { icon: CheckCircle2, color: 'text-sky-400', bg: 'bg-sky-950/40', border: 'border-sky-700' },
    APPROVED: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-700' },
    REJECTED: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-700' },
    PAID: { icon: DollarSign, color: 'text-green-400', bg: 'bg-green-950/40', border: 'border-green-700' },
  };

  const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.PENDING;
  const StatusIcon = config.icon;

  return (
    <section className="border border-[#1E2E4E] bg-gradient-to-br from-[#0B1325] to-[#070B14] rounded-xl p-4 hover:border-[#D4AF37]/40 transition-all shadow-lg">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-[#F8FAFC]">{item.leadId}</h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${config.border} ${config.bg} ${config.color}`}>
                <StatusIcon className="w-3 h-3" />
                {item.status}
              </span>
            </div>
            <p className="text-xs font-semibold text-[#D4AF37] mb-1">{item.campaignName}</p>
            <div className="space-y-1 text-xs text-[#AAB3C2]">
              <p><span className="text-[#8F9DB2]">Partner:</span> {item.partnerId}</p>
              <p><span className="text-[#8F9DB2]">Customer:</span> {item.clientName} · {item.clientMobile}</p>
              <p><span className="text-[#8F9DB2]">Account ID:</span> {item.accountId}</p>
            </div>
          </div>

          {/* Payout Info */}
          <div className="bg-[#111A2D]/60 border border-[#1C273C] rounded-lg p-3 min-w-max">
            <p className="text-[10px] text-[#AAB3C2] font-semibold uppercase mb-1">Payout</p>
            <p className="text-lg font-bold text-[#D4AF37]">₹{item.payoutSnapshot}</p>
            {item.rejectionReason && (
              <p className="text-[10px] text-rose-400 mt-2 max-w-xs">{item.rejectionReason}</p>
            )}
          </div>
        </div>

        {/* Customer Enquiry Info */}
        {isEnquiry && (
          <div className="bg-[#111A2D]/40 border border-[#1C273C] rounded-lg p-2.5">
            <p className="text-[10px] text-[#AAB3C2] font-semibold uppercase mb-1">Customer Enquiry</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#AAB3C2]">
              <span className={`px-2 py-1 rounded ${canReview && !notSubmitted ? 'bg-emerald-950/40 border border-emerald-700 text-emerald-300' : 'bg-amber-950/40 border border-amber-700 text-amber-300'}`}>
                {canReview ? (notSubmitted ? 'Not Submitted' : 'In Process') : item.status}
              </span>
              {item.createdAt && (
                <span className="text-[#8F9DB2]">Started {new Date(item.createdAt).toLocaleString()}</span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1C273C]">
          {isEnquiry && canReview && (
            <label className="text-xs text-[#AAB3C2]">
              Application progress
              <select 
                className={`${selectClass} mt-1`} 
                disabled={busy} 
                value={item.submittedData?.processStatus || 'IN_PROCESS'} 
                onChange={(event) => onAction(`${path}/process`, { processStatus: event.target.value })}
              >
                <option value="IN_PROCESS">In Process</option>
                <option value="NOT_SUBMITTED">Not Submitted</option>
              </select>
            </label>
          )}
          
          <div className="flex flex-wrap gap-2 ml-auto">
            {canReview && (
              <Button 
                disabled={busy} 
                size="sm" 
                variant="secondary"
                onClick={() => {
                  const value = window.prompt('New payout for this lead (₹)', String(item.payoutSnapshot));
                  if (value !== null && value.trim() !== '') onAction(`${path}/payout`, { payoutSnapshot: Number(value) });
                }}
              >
                Adjust Payout
              </Button>
            )}
            
            {item.status === 'PENDING' && !notSubmitted && (
              <Button 
                disabled={busy} 
                size="sm" 
                variant="secondary"
                onClick={() => onAction(`${path}/review`, { status: 'VERIFIED' })}
              >
                Verify
              </Button>
            )}
            
            {canReview && !notSubmitted && (
              <Button 
                disabled={busy} 
                size="sm" 
                variant="primary"
                onClick={() => onAction(`${path}/review`, { status: 'APPROVED' })}
              >
                Approve
              </Button>
            )}
            
            {canReview && (
              <Button 
                disabled={busy} 
                size="sm" 
                variant="secondary"
                onClick={() => {
                  const rejectionReason = window.prompt('Rejection reason');
                  if (rejectionReason) onAction(`${path}/review`, { status: 'REJECTED', rejectionReason });
                }}
              >
                Reject
              </Button>
            )}
            
            {item.status === 'APPROVED' && (
              <Button 
                disabled={busy} 
                size="sm" 
                variant="primary"
                onClick={() => {
                  const paymentReference = window.prompt('Manual commission payment reference');
                  if (paymentReference) onAction(`${path}/paid`, { paymentReference });
                }}
              >
                Mark Paid
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
