import React, { useState } from 'react';
import { Button } from '../ui/Button.tsx';
import { LeadItem } from '../../types/partner.ts';
import { CheckCircle2, Clock, AlertCircle, DollarSign } from 'lucide-react';
import { AdminLeadDecisionDialog } from './AdminLeadDecisionDialog.tsx';

interface AdminLeadCardProps {
  item: LeadItem;
  busy: boolean;
  onAction: (path: string, body: Record<string, unknown>) => void;
}

export const AdminLeadCard: React.FC<AdminLeadCardProps> = ({ item, busy, onAction }) => {
  const [decision, setDecision] = useState<'reject' | 'reverse' | null>(null);
  const [verifiedBaseAmount, setVerifiedBaseAmount] = useState('');
  const [receipt, setReceipt] = useState({ paymentReference: '', evidenceReference: '', details: '' });
  const [receiptAttested, setReceiptAttested] = useState(false);
  const isEnquiry = item.submittedData?.source === 'CUSTOMER_FORM';
  const canReview = ['PENDING', 'VERIFIED'].includes(item.status);
  const notSubmitted = isEnquiry && item.submittedData?.processStatus === 'NOT_SUBMITTED';
  const selectClass = 'w-full rounded-lg border border-[#1C273C] bg-[#070B14] px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 sm:w-auto transition-all';
  const path = `/admin/leads/${item._id}`;
  const percentage = item.payoutTypeSnapshot === 'PERCENTAGE';
  const commission = (item as any).payoutCommission;
  const canApprovePercentage = percentage && !notSubmitted && ['PENDING', 'VERIFIED', 'APPROVED'].includes(item.status)
    && (!commission || ['AWAITING_REVIEW', 'REPORT_REJECTED'].includes(commission.state));

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
              <h3 className="min-w-0 text-sm font-bold text-[#F8FAFC] [overflow-wrap:anywhere]">{item.clientName || 'Customer name unavailable'}</h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${config.border} ${config.bg} ${config.color}`}>
                <StatusIcon className="w-3 h-3" />
                {item.status}
              </span>
            </div>
            <p className="text-xs font-semibold text-[#D4AF37] mb-1">{item.campaignName}</p>
            <div className="space-y-1 text-xs text-[#AAB3C2] [overflow-wrap:anywhere]">
              <p><span className="text-[#8F9DB2]">Customer Name:</span> {item.clientName || 'Unavailable'}</p>
              <p><span className="text-[#8F9DB2]">Customer Mobile Number:</span> {item.clientMobile || 'Unavailable'}</p>
              <p><span className="text-[#8F9DB2]">Referred By (Partner Name):</span> {item.referringPartnerName || 'Partner name unavailable'} <span className="text-[#8F9DB2]">({item.partnerId})</span></p>
              <p><span className="text-[#8F9DB2]">Lead ID:</span> {item.leadId}</p>
              <p><span className="text-[#8F9DB2]">Account ID:</span> {item.accountId}</p>
            </div>
          </div>

          {/* Payout Info */}
          <div className="bg-[#111A2D]/60 border border-[#1C273C] rounded-lg p-3 min-w-max">
            <p className="text-[10px] text-[#AAB3C2] font-semibold uppercase mb-1">Payout</p>
            <p className="text-lg font-bold text-[#D4AF37]">₹{item.payoutSnapshot}</p>
            {percentage && <div className="mt-2 space-y-1 text-[10px] text-slate-300">
              <p>{item.payoutRateSnapshot ?? 'Unconfigured'}% × {item.payoutBasisSnapshot === 'LOAN_DISBURSED_AMOUNT' ? 'verified disbursed loan amount' : item.payoutBasisSnapshot === 'INSURANCE_ELIGIBLE_PREMIUM' ? 'verified eligible premium' : 'missing verified basis'}</p>
              {commission && <><p>Verified base: ₹{commission.verifiedBaseAmount ?? '—'} · calculated: ₹{commission.calculatedAmount ?? '—'}</p><p>Commission: <strong>{commission.state}</strong>{commission.state === 'AVAILABLE' ? ' · Included in available wallet balance' : ` · VED receipt: ${commission.receiptConfirmedAt ? 'confirmed' : 'not confirmed'}`}</p>{commission.reportReference && <p>Source: {commission.source} · Report: {commission.reportReference} · Advertiser ref: {commission.advertiserReference}</p>}{commission.evidenceReference && <p>MIS evidence: {commission.evidenceReference}</p>}{commission.verifiedBy && <p>Approved by admin: {commission.verifiedBy} · {commission.verifiedAt ? new Date(commission.verifiedAt).toLocaleString() : ''}</p>}{commission.receiptReference && <p>Receipt: {commission.receiptReference} · {commission.receiptEvidenceReference}</p>}</>}
              {!commission && <p>Enter the actual confirmed amount and approve to calculate the commission. The approved amount is added to the partner's available balance.</p>}
            </div>}
            {item.rejectionReason && (
              <p className="text-[10px] text-rose-400 mt-2 max-w-xs">{item.rejectionReason}</p>
            )}
          </div>
        </div>

        {canApprovePercentage && <form className="grid gap-3 rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); onAction(`${path}/review`, { status: 'APPROVED', verifiedBaseAmount: Number(verifiedBaseAmount) }); }}>
          <p className="text-xs text-amber-200 sm:col-span-2">Enter the actual confirmed {item.payoutBasisSnapshot === 'LOAN_DISBURSED_AMOUNT' ? 'loan amount disbursed' : 'eligible insurance premium'} and approve. Your authorized approval verifies this amount, calculates the commission using the configured rate, and makes it available in the partner wallet.</p>
          <p className="text-xs text-slate-300 sm:col-span-2">Configured rate: {item.payoutRateSnapshot ?? 'Unconfigured'}% · {item.payoutTermsSnapshot || (item.payoutBasisSnapshot === 'LOAN_DISBURSED_AMOUNT' ? 'Actual disbursed amount' : 'Campaign-approved premium terms')}{item.payoutEligibilitySnapshot?.eligibility ? ` · Eligibility: ${item.payoutEligibilitySnapshot.eligibility}` : ''}</p>
          <label className="text-xs text-slate-300 sm:col-span-2">{item.payoutBasisSnapshot === 'LOAN_DISBURSED_AMOUNT' ? 'Confirmed disbursed loan amount (₹)' : 'Confirmed eligible insurance premium (₹)'}<input required min="0.01" step="0.01" type="number" inputMode="decimal" className={`${selectClass} mt-1`} value={verifiedBaseAmount} onChange={event => setVerifiedBaseAmount(event.target.value)} /></label>
          <Button size="sm" variant="primary" type="submit" disabled={busy || !verifiedBaseAmount}>Approve</Button>
        </form>}
        {percentage && commission?.state === 'PENDING' && <form className="grid gap-2 rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); onAction(`${path}/percentage-payout/confirm-receipt`, { ...receipt, fullSingleLeadReceipt: receiptAttested }); }}><p className="text-xs text-amber-200 sm:col-span-2">Pending ₹{commission.calculatedAmount}. Confirm only a full receipt allocated to this single lead; partial or multi-lead receipt allocation is unsupported.</p>{([['paymentReference','Advertiser payment reference'],['evidenceReference','Payment evidence location/reference'],['details','Receipt audit details']] as const).map(([key,label]) => <label key={key} className="text-xs text-slate-300">{label}<input required maxLength={key === 'details' || key === 'evidenceReference' ? 500 : 160} className={`${selectClass} mt-1`} value={(receipt as any)[key]} onChange={event => setReceipt({ ...receipt, [key]: event.target.value })} /></label>)}<label className="flex gap-2 text-xs text-slate-200 sm:col-span-2"><input type="checkbox" checked={receiptAttested} onChange={event => setReceiptAttested(event.target.checked)} />I verified full advertiser receipt for this one lead and did not allocate a partial or multi-lead payment.</label><Button size="sm" variant="primary" type="submit" disabled={busy || !receiptAttested}>Confirm receipt and release to Available Balance</Button></form>}

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
            {canReview && !percentage && (
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
            
            {canReview && !notSubmitted && !percentage && (
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
                onClick={() => setDecision('reject')}
              >
                Reject
              </Button>
            )}
            
            {item.status === 'APPROVED' && (!percentage || commission?.state === 'AVAILABLE') && (
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
            {item.status === 'APPROVED' && <Button size="sm" variant="outline" disabled={busy} onClick={() => setDecision('reverse')}>Reverse Approval</Button>}
          </div>
        </div>
      </div>
      {decision && <AdminLeadDecisionDialog kind={decision} leadId={item.leadId} amount={item.payoutSnapshot} busy={busy} onCancel={() => setDecision(null)} onConfirm={body => { onAction(`${path}/${decision === 'reverse' ? 'reverse-approval' : 'review'}`, body); setDecision(null); }} />}
    </section>
  );
};
