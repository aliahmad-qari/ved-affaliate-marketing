import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Partner, KycInput } from '../../types/auth.ts';
import { submitPartnerKyc } from '../../services/authApi.ts';
import { Button } from '../ui/Button.tsx';

export function PartnerKycForm({ partner, onSaved }: { partner: Partner; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<KycInput>({ pan: '', upiId: partner.upiId || '', bankDetails: {
    accountHolderName: partner.bankDetails?.accountHolderName || partner.fullName, accountNumber: '',
    bankName: partner.bankDetails?.bankName || '', ifscCode: partner.bankDetails?.ifscCode || '',
  } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const verified = partner.kycStatus === 'VERIFIED';
  const fieldClass = 'mt-2 w-full rounded-lg border border-[#263650] bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess(''); setErrors({});
    try {
      await submitPartnerKyc(form); await onSaved();
      setForm(prev => ({ ...prev, pan: '', bankDetails: { ...prev.bankDetails, accountNumber: '' } }));
      setSuccess('KYC submitted successfully. Your details are pending admin review.');
    } catch (err: any) { setError(err.message || 'Unable to submit KYC.'); setErrors(err.errors || {}); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-[#1E2E4E] bg-[#0B1325] p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><ShieldCheck className="h-5 w-5 text-[#D4AF37]" />Complete KYC</h2><span className={`rounded-lg border px-3 py-1 text-xs font-semibold ${verified ? 'border-emerald-800 text-emerald-300' : partner.kycStatus === 'REJECTED' ? 'border-rose-800 text-rose-300' : 'border-amber-800 text-amber-300'}`}>{partner.kycStatus}</span></div>
    <p className="mt-3 text-sm text-[#AAB3C2]">Admin reviews your PAN and payout details before withdrawals are enabled.</p>
    <Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await onSaved(); } finally { setBusy(false); } }}>Refresh KYC status</Button>
    {partner.kycStatus === 'REJECTED' && <p role="alert" className="mt-4 rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">{partner.kycRejectionReason || 'Please correct your KYC details and resubmit.'}</p>}
    {(partner.maskedPan || partner.bankDetails?.maskedAccountNumber) && <p className="mt-3 text-xs text-[#AAB3C2]">Saved PAN: {partner.maskedPan || 'Not submitted'} · Bank account: {partner.bankDetails?.maskedAccountNumber || 'Not submitted'}</p>}
    {verified ? <p className="mt-4 text-sm text-emerald-300">KYC verified. Contact Support if your verified details need changing.</p> : <form onSubmit={submit} className="mt-5 space-y-4">
      <p className="text-xs text-[#AAB3C2]">Enter complete details to submit or resubmit. Saved PAN and account numbers are masked for your privacy.</p>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {(['pan', 'upiId'] as const).map(key => <label key={key} className="text-xs text-[#AAB3C2]">{key === 'pan' ? 'Permanent Account Number (PAN)' : 'Payout UPI ID'} *<input className={fieldClass} value={form[key]} required maxLength={key === 'pan' ? 10 : 256} autoComplete="off" placeholder={key === 'pan' ? 'ABCDE1234F' : 'name@bank'} onChange={event => setForm({ ...form, [key]: key === 'pan' ? event.target.value.toUpperCase() : event.target.value })} />{errors[key] && <span className="mt-1 block text-rose-300">{errors[key]}</span>}</label>)}
        {([['accountHolderName','Account holder name'],['accountNumber','Bank account number'],['ifscCode','IFSC code'],['bankName','Bank name']] as const).map(([key,label]) => <label key={key} className="text-xs text-[#AAB3C2]">{label} *<input className={fieldClass} type={key === 'accountNumber' ? 'password' : 'text'} inputMode={key === 'accountNumber' ? 'numeric' : undefined} autoComplete="off" required maxLength={key === 'ifscCode' ? 11 : key === 'accountNumber' ? 20 : 100} value={form.bankDetails[key]} onChange={event => setForm({ ...form, bankDetails: { ...form.bankDetails, [key]: key === 'ifscCode' ? event.target.value.toUpperCase() : event.target.value } })} />{errors[key] && <span className="mt-1 block text-rose-300">{errors[key]}</span>}</label>)}
      </div>
      <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Submitting…' : partner.kycStatus === 'REJECTED' ? 'Resubmit KYC' : 'Submit KYC for review'}</Button>
    </form>}
  </section>;
}
