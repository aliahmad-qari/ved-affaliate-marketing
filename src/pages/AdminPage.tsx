import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApi.ts';
import { Button } from '../components/ui/Button.tsx';

type AdminTab = 'overview' | 'campaigns' | 'partners' | 'referrals' | 'leads' | 'withdrawals' | 'support' | 'announcements' | 'notifications' | 'reports' | 'settings' | 'audit';

const tabs: { id: AdminTab; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'campaigns', label: 'Campaigns' },
  { id: 'partners', label: 'Partners' }, { id: 'referrals', label: 'Referrals' }, { id: 'leads', label: 'Leads' },
  { id: 'withdrawals', label: 'Withdrawals' }, { id: 'support', label: 'Support' },
  { id: 'announcements', label: 'Announcements' }, { id: 'notifications', label: 'Notifications' },
  { id: 'reports', label: 'Reports' }, { id: 'settings', label: 'Settings' }, { id: 'audit', label: 'Audit log' },
];

const inputClass = 'w-full rounded-lg border border-[#263650] bg-[#080D17] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]';
const selectClass = `${inputClass} sm:w-auto`;
const emptyCampaign = { name: '', slug: '', companyName: '', campaignType: 'Demat & Trading', description: '', requiredAction: '', payout: '0', payoutTerms: 'Subject to Admin manual lead verification', status: 'DRAFT', baseTrackingUrl: '', logoUrl: '', startDate: '', endDate: '', rulesText: '', termsEligibility: '', termsValidation: '', termsTimeline: '', termsFraud: '', sortOrder: '0', isFeatured: false };

export const AdminPage: React.FC<{ route: string; onNavigate: (route: string) => void }> = ({ route, onNavigate }) => {
  const [admin, setAdmin] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [kycDetails, setKycDetails] = useState<any>(null);
  const [supportResponses, setSupportResponses] = useState<Record<string, string>>({});
  const [reportFilters, setReportFilters] = useState({ startDate: '', endDate: '', status: '', campaignId: '', partnerId: '' });
  const [campaign, setCampaign] = useState({ ...emptyCampaign });
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [notification, setNotification] = useState({ type: 'ANNOUNCEMENT', title: '', message: '', target: 'all', partnerId: '', partnerIds: '' });
  const [announcement, setAnnouncement] = useState({ title: '', message: '' });

  const load = async (target = tab) => {
    setError('');
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (status !== 'ALL') query.set('status', status);
      const suffix = query.size ? `?${query}` : '';
      const paths: Record<AdminTab, string> = {
        overview: '/admin/dashboard', campaigns: '/admin/campaigns', partners: `/admin/partners${suffix}`, referrals: `/admin/referrals${suffix}`,
        leads: `/admin/leads${suffix}`, withdrawals: `/admin/withdrawals${suffix}`, support: `/admin/support${suffix}`,
        announcements: '/admin/announcements', notifications: '/admin/notifications', reports: '/admin/dashboard',
        settings: '/admin/settings', audit: '/admin/audit',
      };
      const result = await adminApi.get(paths[target]);
      setData(result?.data ?? result);
    } catch (err: any) { setError(err.message || 'Unable to load Admin data.'); }
  };

  useEffect(() => {
    if (route === 'admin/login') {
      setAuthReady(true);
      return;
    }
    adminApi.me().then((result) => setAdmin(result.data)).catch(() => setAdmin(null)).finally(() => setAuthReady(true));
  }, [route]);

  useEffect(() => {
    if (admin) void load(tab);
  }, [admin, tab]);

  const run = async (operation: () => Promise<any>, reload = true) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      if (reload) await load();
    } catch (err: any) { setError(err.message || 'Request failed.'); }
    finally { setBusy(false); }
  };

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const result = await adminApi.login(email, password);
      setAdmin(result.data.admin);
      setPassword('');
      onNavigate('admin');
    }, false);
  };

  const logout = async () => {
    await adminApi.logout().catch(() => undefined);
    setAdmin(null);
    onNavigate('admin/login');
  };

  if (!authReady) return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-[#AAB3C2]">Checking Admin session…</div>;
  if (!admin || route === 'admin/login') {
    return (
      <div className="mx-auto flex min-h-[72vh] max-w-md items-center px-4 py-12">
        <form onSubmit={login} className="w-full border border-[#273650] bg-[#0D1424] p-6 sm:p-8">
          <p className="mb-2 text-xs font-bold uppercase text-[#D4AF37]">VED AFFILIATE</p>
          <h1 className="mb-6 text-2xl font-bold text-white">Admin sign in</h1>
          {error && <p role="alert" className="mb-4 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
          <label className="mb-4 block text-sm text-[#AAB3C2]">Email<input className={`${inputClass} mt-1`} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className="mb-6 block text-sm text-[#AAB3C2]">Password<input className={`${inputClass} mt-1`} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <Button type="submit" variant="primary" fullWidth disabled={busy}>Sign in</Button>
        </form>
      </div>
    );
  }

  const records: any[] = Array.isArray(data) ? data : data?.data || [];
  const saveCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const payload = { ...campaign, payout: Number(campaign.payout), sortOrder: Number(campaign.sortOrder), rules: campaign.rulesText.split(/\r?\n/).map((rule) => rule.trim()).filter(Boolean), terms: { eligibility: campaign.termsEligibility, validationRejection: campaign.termsValidation, payoutTimeline: campaign.termsTimeline, duplicateFraudRules: campaign.termsFraud } };
      if (editingCampaignId) await adminApi.patch(`/admin/campaigns/${editingCampaignId}`, payload);
      else await adminApi.post('/admin/campaigns', payload);
      setCampaign({ ...emptyCampaign });
      setEditingCampaignId(null);
    });
  };

  const downloadReport = async (type: string) => {
    try {
      const query = new URLSearchParams(Object.entries(reportFilters).filter(([, value]) => Boolean(value)));
      const blob = await adminApi.get(`/admin/reports/${type}.csv${query.size ? `?${query}` : ''}`);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `ved-${type}.csv`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (err: any) { setError(err.message); }
  };

  const content = () => {
    if (tab === 'overview') {
      const metrics = data || {};
      const items: Array<[string, any, AdminTab]> = [
        ['Total Partners', metrics.totalPartners, 'partners'],
        ['Active Partners', metrics.activePartners, 'partners'],
        ['Total Leads', metrics.totalLeads, 'leads'],
        ['Approved Leads', metrics.approvedLeads, 'leads'],
        ['Pending Leads', metrics.pendingLeads, 'leads'],
        ['Total Earnings', `₹${metrics.totalEarnings || 0}`, 'reports'],
        ['Pending Payout', `₹${metrics.pendingPayout || 0}`, 'withdrawals'],
        ['Paid Payout', `₹${metrics.paidPayout || 0}`, 'withdrawals'],
        ['Withdrawal Requests', metrics.withdrawalRequests, 'withdrawals'],
      ];
      return <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{items.map(([label, value, targetTab]) => <button key={String(label)} onClick={() => setTab(targetTab)} className="border border-[#263650] bg-[#0D1424] p-4 hover:border-[#D4AF37] hover:bg-[#0D1424]/80 transition-all cursor-pointer text-left"><p className="text-xs text-[#AAB3C2]">{label}</p><p className="mt-2 text-2xl font-bold text-[#D4AF37]">{value ?? 0}</p></button>)}</div>;
    }
    if (tab === 'campaigns') return <div className="space-y-5">
      <form onSubmit={saveCampaign} className="grid gap-3 border border-[#263650] bg-[#0D1424] p-4 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-lg font-bold">{editingCampaignId ? 'Edit campaign' : 'Add campaign'}</h2>
        {([['name','Campaign name'],['slug','Slug'],['companyName','Company'],['requiredAction','Required action'],['payout','Payout ₹'],['payoutTerms','Payout terms'],['baseTrackingUrl','Base tracking URL'],['logoUrl','Logo URL'],['sortOrder','Display order']] as const).map(([field, label]) => <label key={field} className="text-xs text-[#AAB3C2]">{label}<input className={`${inputClass} mt-1`} value={(campaign as any)[field]} onChange={(event) => setCampaign({ ...campaign, [field]: event.target.value })} required={['name','slug','companyName','requiredAction','payoutTerms'].includes(field)} type={field === 'payout' || field === 'sortOrder' ? 'number' : 'text'} min={field === 'payout' ? 0 : undefined} step={field === 'payout' ? 0.01 : 1} /></label>)}
        <label className="text-xs text-[#AAB3C2]">Category<select className={`${inputClass} mt-1`} value={campaign.campaignType} onChange={(event) => setCampaign({ ...campaign, campaignType: event.target.value })}>{['Demat & Trading','Mutual Funds','Banking & Credit','Fintech & Wallets'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-[#AAB3C2]">Status<select className={`${inputClass} mt-1`} value={campaign.status} onChange={(event) => setCampaign({ ...campaign, status: event.target.value })}>{['DRAFT','LIVE','PAUSED','ENDED'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-[#AAB3C2]">Start date<input className={`${inputClass} mt-1`} type="date" value={campaign.startDate} onChange={(event) => setCampaign({ ...campaign, startDate: event.target.value })} /></label>
        <label className="text-xs text-[#AAB3C2]">End date<input className={`${inputClass} mt-1`} type="date" value={campaign.endDate} onChange={(event) => setCampaign({ ...campaign, endDate: event.target.value })} /></label>
        <label className="text-xs text-[#AAB3C2] sm:col-span-2">Description<textarea className={`${inputClass} mt-1`} value={campaign.description} onChange={(event) => setCampaign({ ...campaign, description: event.target.value })} required rows={3} /></label>
        <label className="text-xs text-[#AAB3C2] sm:col-span-2">Rules, one per line<textarea className={`${inputClass} mt-1`} value={campaign.rulesText} onChange={(event) => setCampaign({ ...campaign, rulesText: event.target.value })} rows={3} /></label>
        {([['termsEligibility', 'Terms: Eligibility'], ['termsValidation', 'Terms: Validation / rejection conditions'], ['termsTimeline', 'Terms: Payout timeline'], ['termsFraud', 'Terms: Duplicate / fraud rules']] as const).map(([field, label]) => <label key={field} className="text-xs text-[#AAB3C2] sm:col-span-2">{label}<textarea className={`${inputClass} mt-1`} value={(campaign as any)[field]} onChange={(event) => setCampaign({ ...campaign, [field]: event.target.value })} rows={2} maxLength={2000} /></label>)}
        <label className="flex items-center gap-2 text-sm text-[#AAB3C2]"><input type="checkbox" checked={campaign.isFeatured} onChange={(event) => setCampaign({ ...campaign, isFeatured: event.target.checked })} />Featured campaign</label>
        <div className="flex gap-2"><Button type="submit" variant="primary" disabled={busy}>{editingCampaignId ? 'Save campaign' : 'Create campaign'}</Button>{editingCampaignId && <Button type="button" variant="outline" onClick={() => { setEditingCampaignId(null); setCampaign({ ...emptyCampaign }); }}>Cancel</Button>}</div>
      </form>
      <div className="space-y-2">{records.map((item) => <section key={item._id} className="flex flex-col gap-3 border border-[#263650] bg-[#0D1424] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">{item.name} <span className="text-xs text-[#D4AF37]">{item.status}</span></h3><p className="text-xs text-[#AAB3C2]">{item.companyName} · ₹{item.payout ?? 0} · {item.slug}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { setEditingCampaignId(item._id); setCampaign({ ...emptyCampaign, ...item, payout: String(item.payout ?? 0), startDate: item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : '', endDate: item.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : '', rulesText: (item.rules || []).join('\n'), termsEligibility: item.terms?.eligibility || '', termsValidation: item.terms?.validationRejection || '', termsTimeline: item.terms?.payoutTimeline || '', termsFraud: item.terms?.duplicateFraudRules || '', sortOrder: String(item.sortOrder ?? 0) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</Button><label className="cursor-pointer rounded border border-[#263650] px-3 py-2 text-xs">Logo upload<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => adminApi.upload(`/admin/campaigns/${item._id}/logo`, file)); }} /></label><Button variant="outline" size="sm" onClick={() => void run(() => adminApi.delete(`/admin/campaigns/${item._id}`))}>Archive</Button></div></section>)}</div>
    </div>;
    if (tab === 'partners') return <div className="space-y-2">{records.map((item) => <section key={item._id} className="flex flex-col gap-3 border border-[#263650] bg-[#0D1424] p-4 md:flex-row md:items-center md:justify-between"><div><h3 className="font-semibold">{item.fullName} <span className="text-xs text-[#D4AF37]">{item.partnerId}</span></h3><p className="text-xs text-[#AAB3C2]">{item.email} · {item.mobile} · KYC {item.kycStatus} · {item.accountStatus}</p><p className="text-xs text-[#8F9DB2]">Leads {item.performance?.totalLeads || 0} · Approved {item.performance?.approvedLeads || 0} · Pending {item.performance?.pendingLeads || 0} · Earned ₹{item.performance?.earnings || 0}</p><p className="text-xs text-[#8F9DB2]">PAN {item.maskedPan || 'not available'} · A/C {item.bankDetails?.maskedAccountNumber || 'not available'}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void run(async () => { const result = await adminApi.get(`/admin/partners/${item._id}/kyc`); setKycDetails(result.data); }, false)}>View KYC</Button><select className={selectClass} value={item.kycStatus} onChange={(event) => { const value = event.target.value; const rejectionReason = value === 'REJECTED' ? window.prompt('KYC rejection reason') || '' : ''; if (value !== 'REJECTED' || rejectionReason) void run(() => adminApi.patch(`/admin/partners/${item._id}`, { kycStatus: value, kycRejectionReason: rejectionReason })); }}>{['PENDING','VERIFIED','REJECTED'].map((value) => <option key={value}>{value}</option>)}</select><select className={selectClass} value={item.accountStatus} onChange={(event) => void run(() => adminApi.patch(`/admin/partners/${item._id}`, { accountStatus: event.target.value }))}>{['ACTIVE','INACTIVE','SUSPENDED','PENDING'].map((value) => <option key={value}>{value}</option>)}</select></div></section>)}</div>;
    if (tab === 'referrals') return <div className="space-y-3">{records.length === 0 && <p className="border border-[#263650] bg-[#0D1424] p-4 text-sm text-[#AAB3C2]">No referred partners found.</p>}{records.map((item) => <section key={item.referredPartnerId} className="border border-[#263650] bg-[#0D1424] p-4"><div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center"><div><p className="mb-1 text-[11px] font-semibold uppercase text-[#AAB3C2]">Referrer</p><h3 className="font-semibold text-white">{item.referrerName}</h3><p className="text-xs text-[#AAB3C2]">{item.referrerPartnerId} · {item.referrerEmail || 'Email unavailable'}</p></div><div className="text-center text-sm font-semibold text-[#D4AF37]" aria-label="referred">referred</div><div><p className="mb-1 text-[11px] font-semibold uppercase text-[#AAB3C2]">New partner</p><h3 className="font-semibold text-white">{item.referredName}</h3><p className="text-xs text-[#AAB3C2]">{item.referredPartnerId} · {item.referredEmail}</p><p className="text-xs text-[#8F9DB2]">Code {item.referralCode} · Joined {item.joinedAt ? new Date(item.joinedAt).toLocaleDateString() : 'Unknown'}</p></div></div><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#263650] pt-3 text-xs"><span className="text-[#AAB3C2]">Qualified leads: <strong className="text-white">{item.qualifiedLeads}</strong></span><span className="text-[#AAB3C2]">Qualification: <strong className={item.qualificationStatus === 'QUALIFIED' ? 'text-emerald-400' : 'text-amber-300'}>{item.qualificationStatus}</strong></span><span className="text-[#AAB3C2]">Referral reward: <strong className="text-[#D4AF37]">₹{item.rewardAmount}</strong> · {item.rewardStatus}</span></div></section>)}</div>;
    if (tab === 'leads') return <div className="space-y-2">{records.map((item) => <section key={item._id} className="border border-[#263650] bg-[#0D1424] p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{item.leadId} · {item.campaignName}</h3><p className="text-xs text-[#AAB3C2]">{item.partnerId} · {item.clientName} · {item.clientMobile} · {item.accountId}</p><p className="text-xs text-[#D4AF37]">{item.status} · Snapshot ₹{item.payoutSnapshot} {item.rejectionReason && `· ${item.rejectionReason}`}</p></div><div className="flex flex-wrap gap-2">{['PENDING','VERIFIED'].includes(item.status) && <Button size="sm" variant="outline" onClick={() => { const value = window.prompt('New payout for this lead (₹)', String(item.payoutSnapshot)); if (value !== null && value.trim() !== '') void run(() => adminApi.patch(`/admin/leads/${item._id}/payout`, { payoutSnapshot: Number(value) })); }}>Adjust payout</Button>}{item.status === 'PENDING' && <Button size="sm" variant="outline" onClick={() => void run(() => adminApi.patch(`/admin/leads/${item._id}/review`, { status: 'VERIFIED' }))}>Verify</Button>}{['PENDING','VERIFIED'].includes(item.status) && <Button size="sm" variant="primary" onClick={() => void run(() => adminApi.patch(`/admin/leads/${item._id}/review`, { status: 'APPROVED' }))}>Approve</Button>}{['PENDING','VERIFIED'].includes(item.status) && <Button size="sm" variant="outline" onClick={() => { const rejectionReason = window.prompt('Rejection reason'); if (rejectionReason) void run(() => adminApi.patch(`/admin/leads/${item._id}/review`, { status: 'REJECTED', rejectionReason })); }}>Reject</Button>}{item.status === 'APPROVED' && <Button size="sm" variant="primary" onClick={() => { const paymentReference = window.prompt('Manual commission payment reference'); if (paymentReference) void run(() => adminApi.patch(`/admin/leads/${item._id}/paid`, { paymentReference })); }}>Mark paid</Button>}</div></div></section>)}</div>;
    if (tab === 'withdrawals') return <div className="space-y-2">{records.map((item) => <section key={item._id} className="border border-[#263650] bg-[#0D1424] p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="font-semibold">₹{item.amount} · {item.status}</h3><p className="text-xs text-[#AAB3C2]">{item.partner?.fullName} ({item.partnerId}) · {item.partner?.email}</p><p className="break-all text-xs text-[#D4AF37]">{item.paymentMethod}: {item.payoutDestination}</p><p className="text-xs text-[#8F9DB2]">{item.transactionId} · {new Date(item.createdAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2">{item.status === 'PENDING' && <Button size="sm" variant="outline" onClick={() => void run(() => adminApi.patch(`/admin/withdrawals/${item._id}`, { status: 'PROCESSING' }))}>Processing</Button>}{['PENDING','PROCESSING'].includes(item.status) && <Button size="sm" variant="primary" onClick={() => void run(() => adminApi.patch(`/admin/withdrawals/${item._id}`, { status: 'APPROVED' }))}>Approve</Button>}{['PENDING','PROCESSING','APPROVED'].includes(item.status) && <Button size="sm" variant="outline" onClick={() => { const note = window.prompt('Rejection reason'); if (note) void run(() => adminApi.patch(`/admin/withdrawals/${item._id}`, { status: 'REJECTED', internalNote: note })); }}>Reject</Button>}{['PROCESSING','APPROVED'].includes(item.status) && <Button size="sm" variant="primary" onClick={() => { const paymentReference = window.prompt('Manual payment reference (required)'); if (paymentReference) void run(() => adminApi.patch(`/admin/withdrawals/${item._id}`, { status: 'PAID', paymentReference })); }}>Mark paid</Button>}</div></div></section>)}</div>;
    if (tab === 'support') return <div className="space-y-2">{records.map((item) => <section key={item._id} className="border border-[#263650] bg-[#0D1424] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><h3 className="font-semibold">{item.subject} <span className="text-xs text-[#D4AF37]">{item.status}</span></h3><p className="text-xs text-[#AAB3C2]">{item.name} · {item.email} · {item.mobile}</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.message}</p><textarea className={`${inputClass} mt-3`} aria-label="Admin response" placeholder="Write a response" rows={3} value={supportResponses[item._id] ?? item.adminResponse ?? ''} onChange={(event) => setSupportResponses({ ...supportResponses, [item._id]: event.target.value })} /></div><div className="flex flex-wrap gap-2"><select className={selectClass} value={item.status} onChange={(event) => void run(() => adminApi.patch(`/admin/support/${item._id}`, { status: event.target.value, adminResponse: supportResponses[item._id] ?? item.adminResponse ?? '' }))}>{['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].map((value) => <option key={value}>{value}</option>)}</select><Button variant="primary" size="sm" onClick={() => void run(() => adminApi.patch(`/admin/support/${item._id}`, { status: item.status, adminResponse: supportResponses[item._id] ?? item.adminResponse ?? '' }))}>Save response</Button></div></div></section>)}</div>;
    if (tab === 'settings') return <form className="max-w-lg border border-[#263650] bg-[#0D1424] p-5" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => adminApi.patch('/admin/settings', { minimumWithdrawalAmount: Number(form.get('minimumWithdrawalAmount')) })); }}><h2 className="mb-4 text-lg font-bold">Business settings</h2><label className="mb-4 block text-sm text-[#AAB3C2]">Minimum withdrawal (₹)<input className={`${inputClass} mt-1`} name="minimumWithdrawalAmount" type="number" min="1" step="0.01" defaultValue={data?.minimumWithdrawalAmount ?? 200} required /></label><Button type="submit" variant="primary" disabled={busy}>Save setting</Button></form>;
    if (tab === 'announcements') return <div className="space-y-4"><form className="grid gap-3 border border-[#263650] bg-[#0D1424] p-4" onSubmit={(event) => { event.preventDefault(); void run(async () => { await adminApi.post('/admin/announcements', { ...announcement, status: 'PUBLISHED' }); setAnnouncement({ title: '', message: '' }); }); }}><h2 className="text-lg font-bold">Publish announcement</h2><input className={inputClass} placeholder="Title" value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} required /><textarea className={inputClass} placeholder="Message" rows={3} value={announcement.message} onChange={(event) => setAnnouncement({ ...announcement, message: event.target.value })} required /><Button type="submit" variant="primary" disabled={busy}>Publish</Button></form>{records.map((item) => <section key={item._id} className="border border-[#263650] bg-[#0D1424] p-4"><h3 className="font-semibold">{item.title} · {item.status}</h3><p className="mt-1 text-sm text-[#AAB3C2]">{item.message}</p></section>)}</div>;
    if (tab === 'notifications') return <div className="max-w-2xl space-y-4"><form className="grid gap-3 border border-[#263650] bg-[#0D1424] p-4" onSubmit={(event) => { event.preventDefault(); void run(async () => { await adminApi.post('/admin/notifications', { type: notification.type, title: notification.title, message: notification.message, allActive: notification.target === 'all', partnerId: notification.target === 'partner' ? notification.partnerId : undefined, partnerIds: notification.target === 'selected' ? notification.partnerIds.split(',').map((id) => id.trim()).filter(Boolean) : undefined }); setNotification({ ...notification, title: '', message: '' }); }); }}><h2 className="text-lg font-bold">Send notification</h2><select className={inputClass} value={notification.type} onChange={(event) => setNotification({ ...notification, type: event.target.value })}>{['NEW_CAMPAIGN','CAMPAIGN_RATE_CHANGE','LEAD_UPDATE','PAYMENT_UPDATE','WITHDRAWAL_UPDATE','ANNOUNCEMENT','ACCOUNT_UPDATE'].map((value) => <option key={value}>{value}</option>)}</select><select className={inputClass} value={notification.target} onChange={(event) => setNotification({ ...notification, target: event.target.value })}><option value="all">All active partners</option><option value="partner">One partner</option><option value="selected">Selected partners</option></select>{notification.target === 'partner' && <input className={inputClass} placeholder="Partner ID" value={notification.partnerId} onChange={(event) => setNotification({ ...notification, partnerId: event.target.value })} required />}{notification.target === 'selected' && <input className={inputClass} placeholder="Partner IDs separated by commas" value={notification.partnerIds} onChange={(event) => setNotification({ ...notification, partnerIds: event.target.value })} required />}<input className={inputClass} placeholder="Title" value={notification.title} onChange={(event) => setNotification({ ...notification, title: event.target.value })} required /><textarea className={inputClass} placeholder="Message" rows={3} value={notification.message} onChange={(event) => setNotification({ ...notification, message: event.target.value })} required /><Button type="submit" variant="primary" disabled={busy}>Send</Button></form>{records.map((item) => <p key={item._id} className="border border-[#263650] bg-[#0D1424] p-3 text-sm">{item.title} · {item.partnerId}</p>)}</div>;
    if (tab === 'reports') return <div className="space-y-4"><div className="grid gap-3 border border-[#263650] bg-[#0D1424] p-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs text-[#AAB3C2]">From<input className={`${inputClass} mt-1`} type="date" value={reportFilters.startDate} onChange={(event) => setReportFilters({ ...reportFilters, startDate: event.target.value })} /></label><label className="text-xs text-[#AAB3C2]">To<input className={`${inputClass} mt-1`} type="date" value={reportFilters.endDate} onChange={(event) => setReportFilters({ ...reportFilters, endDate: event.target.value })} /></label><label className="text-xs text-[#AAB3C2]">Status<input className={`${inputClass} mt-1`} value={reportFilters.status} onChange={(event) => setReportFilters({ ...reportFilters, status: event.target.value })} placeholder="Optional" /></label><label className="text-xs text-[#AAB3C2]">Campaign ID<input className={`${inputClass} mt-1`} value={reportFilters.campaignId} onChange={(event) => setReportFilters({ ...reportFilters, campaignId: event.target.value })} placeholder="Optional" /></label><label className="text-xs text-[#AAB3C2]">Partner ID<input className={`${inputClass} mt-1`} value={reportFilters.partnerId} onChange={(event) => setReportFilters({ ...reportFilters, partnerId: event.target.value })} placeholder="Optional" /></label></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{['partners','campaigns','leads','earnings','payouts','withdrawals'].map((type) => <Button key={type} variant="outline" onClick={() => void downloadReport(type)}>Download {type} CSV</Button>)}</div></div>;
    if (tab === 'audit') return <div className="overflow-x-auto border border-[#263650]"><table className="w-full min-w-180 text-left text-sm"><thead className="bg-[#0D1424] text-[#AAB3C2]"><tr>{['Time','Admin','Action','Entity','ID'].map((value) => <th key={value} className="p-3">{value}</th>)}</tr></thead><tbody>{records.map((item) => <tr key={item._id} className="border-t border-[#263650]"><td className="p-3">{new Date(item.createdAt).toLocaleString()}</td><td className="p-3">{item.adminEmail}</td><td className="p-3">{item.action}</td><td className="p-3">{item.entityType}</td><td className="p-3">{item.entityId}</td></tr>)}</tbody></table></div>;
    return <p className="text-sm text-[#AAB3C2]">Select a section.</p>;
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#263650] pb-4">
        <div><p className="text-xs font-bold uppercase text-[#D4AF37]">Administration</p><h1 className="text-2xl font-bold text-white">Operations</h1><p className="text-xs text-[#AAB3C2]">Signed in as {admin.email}</p></div>
        <Button variant="outline" size="sm" onClick={logout}>Sign out</Button>
      </header>
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-2" aria-label="Admin sections">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`shrink-0 border px-3 py-2 text-xs font-semibold ${tab === item.id ? 'border-[#D4AF37] bg-[#D4AF37] text-black' : 'border-[#263650] text-[#AAB3C2] hover:text-white'}`}>{item.label}</button>)}</nav>
      {error && <p role="alert" className="mb-4 border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {['partners','referrals','leads','withdrawals','support'].includes(tab) && <div className="mb-4 flex flex-col gap-2 sm:flex-row"><input className={inputClass} placeholder={tab === 'referrals' ? 'Search referrer, new partner, or referral code' : 'Search'} value={search} onChange={(event) => setSearch(event.target.value)} /><select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{['PENDING','VERIFIED','APPROVED','REJECTED','PAID','ACTIVE','INACTIVE','SUSPENDED','OPEN','IN_PROGRESS','RESOLVED','CLOSED','PROCESSING','QUALIFIED','NOT_QUALIFIED','AVAILABLE','PROCESSED'].map((value) => <option key={value}>{value}</option>)}</select><Button variant="outline" onClick={() => void load()}>Apply</Button></div>}
      {content()}
      {kycDetails && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="presentation" onClick={() => setKycDetails(null)}><section role="dialog" aria-modal="true" aria-labelledby="kyc-title" className="w-full max-w-lg space-y-3 border border-[#263650] bg-[#0D1424] p-5" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 id="kyc-title" className="text-lg font-bold">KYC details · {kycDetails.partnerId}</h2><button className="text-sm text-[#D4AF37]" onClick={() => setKycDetails(null)}>Close</button></div><p>{kycDetails.fullName} · {kycDetails.kycStatus}</p><p className="text-sm text-[#AAB3C2]">PAN: <span className="font-mono text-white">{kycDetails.pan}</span></p><div className="space-y-1 border-t border-[#263650] pt-3 text-sm text-[#AAB3C2]"><p>Account holder: {kycDetails.bankDetails?.accountHolderName}</p><p>Account number: <span className="font-mono text-white">{kycDetails.bankDetails?.accountNumber}</span></p><p>IFSC: {kycDetails.bankDetails?.ifscCode}</p><p>Bank: {kycDetails.bankDetails?.bankName}</p></div></section></div>}
    </div>
  );
};