import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from '../services/adminApi.ts';
import { Button } from '../components/ui/Button.tsx';
import { AdminPartnerLeadLedger } from '../components/admin/AdminPartnerLeadLedger.tsx';
import { AdminLeadCard } from '../components/admin/AdminLeadCard.tsx';
import { AdminOverview } from '../components/admin/AdminOverview.tsx';
import { AdminNotificationHistory } from '../components/admin/AdminNotificationHistory.tsx';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader.tsx';
import '../components/admin/admin-theme.css';
import { AdminWithdrawals, defaultWithdrawalFilters } from '../components/admin/AdminWithdrawals.tsx';
import { VedLogo } from '../components/ui/VedLogo.tsx';
import { LayoutDashboard, Layers, Users, Link2, ListChecks, Wallet, Headphones, Megaphone, Bell, BarChart3, Settings, FileText, LogOut } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [withdrawalFilters, setWithdrawalFilters] = useState({ ...defaultWithdrawalFilters });
  const selectTab = (next: AdminTab) => { if (next === tab) return; setSearch(''); setStatus('ALL'); setLeadCampaign('ALL'); setLedgerPartner(null); setData(null); setTab(next); };
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [leadCampaign, setLeadCampaign] = useState('ALL');
  const [leadCampaigns, setLeadCampaigns] = useState<any[]>([]);
  const [ledgerPartner, setLedgerPartner] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [kycDetails, setKycDetails] = useState<any>(null);
  const [supportResponses, setSupportResponses] = useState<Record<string, string>>({});
  const [reportFilters, setReportFilters] = useState({ startDate: '', endDate: '', status: '', campaignId: '', partnerId: '' });
  const [campaign, setCampaign] = useState({ ...emptyCampaign });
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [notification, setNotification] = useState({ type: 'ANNOUNCEMENT', title: '', message: '', target: 'all', partnerId: '', partnerIds: '' });
  const [announcement, setAnnouncement] = useState({ title: '', message: '' });
  const loadRequestId = useRef(0);
  const activeTab = useRef(tab);
  activeTab.current = tab;

  const load = async (target = tab, reset = false) => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (target === 'withdrawals') {
        if (withdrawalFilters.search.trim()) query.set('search', withdrawalFilters.search.trim());
        if (withdrawalFilters.status !== 'ALL') query.set('status', withdrawalFilters.status);
        if (withdrawalFilters.paymentMethod !== 'ALL') query.set('paymentMethod', withdrawalFilters.paymentMethod);
        if (withdrawalFilters.startDate) query.set('startDate', new Date(withdrawalFilters.startDate + 'T00:00:00').toISOString());
        if (withdrawalFilters.endDate) query.set('endDate', new Date(withdrawalFilters.endDate + 'T23:59:59.999').toISOString());
        query.set('page', String(withdrawalFilters.page));
        query.set('limit', '20');
      } else {
        if (!reset && search.trim()) query.set('search', search.trim());
        if (!reset && status !== 'ALL') query.set('status', status);
        if (!reset && target === 'leads' && leadCampaign !== 'ALL') query.set('campaignId', leadCampaign);
      }
      const suffix = query.size ? `?${query}` : '';
      const paths: Record<AdminTab, string> = {
        overview: '/admin/dashboard', campaigns: '/admin/campaigns', partners: `/admin/partners${suffix}`, referrals: `/admin/referrals${suffix}`,
        leads: `/admin/leads${suffix}`, withdrawals: `/admin/withdrawals${suffix}`, support: `/admin/support${suffix}`,
        announcements: '/admin/announcements', notifications: '/admin/notifications', reports: '/admin/campaigns',
        settings: '/admin/settings', audit: '/admin/audit',
      };
      const result = await adminApi.get(paths[target]);
      if (requestId === loadRequestId.current && target === activeTab.current) setData(target === 'withdrawals' ? result : result?.data ?? result);
    } catch (err: any) {
      if (requestId === loadRequestId.current && target === activeTab.current) setError(err.message || 'Unable to load Admin data.');
    } finally {
      if (requestId === loadRequestId.current && target === activeTab.current) setLoading(false);
    }
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
    return () => { loadRequestId.current++; };
  }, [admin, tab, withdrawalFilters, leadCampaign]);

  useEffect(() => {
    if (!admin || tab !== 'leads') return;
    const timer = window.setInterval(() => {
      if (!document.hidden && !busy) void load('leads');
    }, 30000);
    return () => window.clearInterval(timer);
  }, [admin, tab, search, status, leadCampaign, busy]);

  useEffect(() => {
    if (!admin || (tab !== 'leads' && tab !== 'partners')) return;
    let active = true;
    adminApi.get('/admin/lead-campaigns').then(result => { if (active) setLeadCampaigns(result.data || []); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
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
        <form onSubmit={login} className="admin-login w-full border border-[#273650] bg-[#0D1424] p-6 sm:p-8">
          <div className="mb-6"><VedLogo size="sm" variant="badge" /></div>
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

  const downloadCampaignWorkbook = async (campaign?: { _id: string; slug?: string }) => {
    try {
      const query = new URLSearchParams();
      if (reportFilters.startDate) query.set('startDate', reportFilters.startDate);
      if (reportFilters.endDate) query.set('endDate', reportFilters.endDate);
      if (campaign?._id || reportFilters.campaignId) query.set('campaignId', campaign?._id || reportFilters.campaignId);
      const blob = await adminApi.get(`/admin/reports/campaign-report.xlsx${query.size ? `?${query}` : ''}`);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `ved-${campaign?._id || 'all-campaigns'}-campaign-report.xlsx`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (err: any) { setError(err.message || 'Unable to download campaign report.'); }
  };

  const content = () => {
    if (tab === 'overview') return <AdminOverview metrics={data} onSelect={(target) => selectTab(target as AdminTab)} />;
    if (tab === 'campaigns') return <div className="space-y-5">
      <form onSubmit={saveCampaign} className="grid gap-4 border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/80 to-[#070B14]/80 p-5 sm:grid-cols-2 rounded-xl backdrop-blur-sm">
        <h2 className="sm:col-span-2 text-lg font-bold text-white">🚀 {editingCampaignId ? 'Edit Campaign' : 'Create New Campaign'}</h2>
        {([['name','Campaign name'],['slug','Slug'],['companyName','Company'],['requiredAction','Required action'],['payout','Payout ₹'],['payoutTerms','Payout terms'],['baseTrackingUrl','Base tracking URL'],['logoUrl','Logo URL'],['sortOrder','Display order']] as const).map(([field, label]) => <label key={field} className="text-xs text-slate-400">{label}<input className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37] focus:ring-[#D4AF37]/10`} value={(campaign as any)[field]} onChange={(event) => setCampaign({ ...campaign, [field]: event.target.value })} required={['name','slug','companyName','requiredAction','payoutTerms'].includes(field)} type={field === 'payout' || field === 'sortOrder' ? 'number' : 'text'} min={field === 'payout' ? 0 : undefined} step={field === 'payout' ? 0.01 : 1} /></label>)}
        <label className="text-xs text-slate-400">Category<select className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} value={campaign.campaignType} onChange={(event) => setCampaign({ ...campaign, campaignType: event.target.value })}>{['Demat & Trading','Mutual Funds','Banking & Credit','Fintech & Wallets'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-slate-400">Status<select className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} value={campaign.status} onChange={(event) => setCampaign({ ...campaign, status: event.target.value })}>{['DRAFT','LIVE','PAUSED','ENDED'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-slate-400">Start date<input className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} type="date" value={campaign.startDate} onChange={(event) => setCampaign({ ...campaign, startDate: event.target.value })} /></label>
        <label className="text-xs text-slate-400">End date<input className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} type="date" value={campaign.endDate} onChange={(event) => setCampaign({ ...campaign, endDate: event.target.value })} /></label>
        <label className="text-xs text-slate-400 sm:col-span-2">Description<textarea className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} value={campaign.description} onChange={(event) => setCampaign({ ...campaign, description: event.target.value })} required rows={3} /></label>
        <label className="text-xs text-slate-400 sm:col-span-2">Rules (one per line)<textarea className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} value={campaign.rulesText} onChange={(event) => setCampaign({ ...campaign, rulesText: event.target.value })} rows={3} /></label>
        {([['termsEligibility', '📋 Eligibility'], ['termsValidation', '❌ Validation / rejection'], ['termsTimeline', '⏱️ Payout timeline'], ['termsFraud', '🚨 Duplicate / fraud rules']] as const).map(([field, label]) => <label key={field} className="text-xs text-slate-400 sm:col-span-2">{label}<textarea className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} value={(campaign as any)[field]} onChange={(event) => setCampaign({ ...campaign, [field]: event.target.value })} rows={2} maxLength={2000} /></label>)}
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={campaign.isFeatured} onChange={(event) => setCampaign({ ...campaign, isFeatured: event.target.checked })} className="rounded" />⭐ Featured campaign</label>
        <div className="flex gap-2"><Button type="submit" variant="primary" disabled={busy}>{editingCampaignId ? '💾 Save' : '➕ Create'}</Button>{editingCampaignId && <Button type="button" variant="outline" onClick={() => { setEditingCampaignId(null); setCampaign({ ...emptyCampaign }); }}>Cancel</Button>}</div>
      </form>
      <div className="space-y-3">{records.map((item) => <section key={item._id} className="flex flex-col gap-4 border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/60 to-[#070B14]/60 p-4 sm:flex-row sm:items-center sm:justify-between rounded-xl hover:border-[#D4AF37]/40 transition-colors backdrop-blur-sm"><div className="flex-1"><h3 className="font-bold text-white">{item.name} <span className={`text-xs px-2 py-1 rounded ml-2 font-semibold ${item.status === 'LIVE' ? 'bg-emerald-500/20 border border-emerald-700 text-emerald-300' : item.status === 'DRAFT' ? 'bg-slate-500/20 border border-slate-700 text-slate-300' : 'bg-amber-500/20 border border-amber-700 text-amber-300'}`}>{item.status}</span></h3><p className="text-xs text-slate-400 mt-1">{item.companyName} · <span className="font-mono text-[#D4AF37]">₹{item.payout ?? 0}</span> · <code className="text-slate-500">{item.slug}</code></p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { setEditingCampaignId(item._id); setCampaign({ ...emptyCampaign, ...item, payout: String(item.payout ?? 0), startDate: item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : '', endDate: item.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : '', rulesText: (item.rules || []).join('\n'), termsEligibility: item.terms?.eligibility || '', termsValidation: item.terms?.validationRejection || '', termsTimeline: item.terms?.payoutTimeline || '', termsFraud: item.terms?.duplicateFraudRules || '', sortOrder: String(item.sortOrder ?? 0) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>✏️ Edit</Button><label className="cursor-pointer rounded border border-[#D4AF37]/30 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10 px-3 py-2 text-xs font-semibold text-[#D4AF37] transition-colors">📤 Logo<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => adminApi.upload(`/admin/campaigns/${item._id}/logo`, file)); }} /></label><Button variant="outline" size="sm" onClick={() => void run(() => adminApi.delete(`/admin/campaigns/${item._id}`))}>🗑️ Archive</Button></div></section>)}</div>
    </div>;
    if (tab === 'partners' && ledgerPartner) return <AdminPartnerLeadLedger partner={ledgerPartner} campaigns={leadCampaigns} onBack={() => { setLedgerPartner(null); void load('partners'); }} />;
    if (tab === 'partners') return <div className="space-y-3">{records.map((item) => <section key={item._id} className="flex flex-col gap-4 border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/60 to-[#070B14]/60 p-4 md:flex-row md:items-center md:justify-between rounded-xl hover:border-[#D4AF37]/40 transition-colors backdrop-blur-sm"><div className="flex-1 min-w-0"><h3 className="font-bold text-white">{item.fullName} <span className="text-xs font-mono text-[#D4AF37]">#{item.partnerId}</span></h3><p className="text-xs text-slate-400 mt-1">📧 {item.email} · 📱 {item.mobile}</p><p className="text-xs text-slate-400 mt-2">🪪 KYC <span className={`font-semibold ${item.kycStatus === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'}`}>{item.kycStatus}</span> · 🔐 {item.accountStatus}</p><p className="text-xs text-slate-500 mt-2">📊 Leads {item.performance?.totalLeads || 0} · ✅ Approved {item.performance?.approvedLeads || 0} · ⏳ Pending {item.performance?.pendingLeads || 0} · 💰 Earned <span className="font-mono text-[#D4AF37]">₹{item.performance?.earnings || 0}</span></p><p className="text-xs text-slate-500">🏦 PAN {item.maskedPan || '—'} · Account {item.bankDetails?.maskedAccountNumber || '—'}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setLedgerPartner(item)}>View Lead Ledger</Button><Button variant="outline" size="sm" onClick={() => void run(async () => { const result = await adminApi.get(`/admin/partners/${item._id}/kyc`); setKycDetails(result.data); }, false)}>👁️ View KYC</Button><select className={selectClass} value={item.kycStatus} onChange={(event) => { const value = event.target.value; const rejectionReason = value === 'REJECTED' ? window.prompt('KYC rejection reason') || '' : ''; if (value !== 'REJECTED' || rejectionReason) void run(() => adminApi.patch(`/admin/partners/${item._id}`, { kycStatus: value, kycRejectionReason: rejectionReason })); }}>{['PENDING','VERIFIED','REJECTED'].map((value) => <option key={value}>{value}</option>)}</select><select className={selectClass} value={item.accountStatus} onChange={(event) => void run(() => adminApi.patch(`/admin/partners/${item._id}`, { accountStatus: event.target.value }))}>{['ACTIVE','INACTIVE','SUSPENDED','PENDING'].map((value) => <option key={value}>{value}</option>)}</select></div></section>)}</div>;
    if (tab === 'referrals') return (
      <div className="space-y-4">
        {records.length === 0 ? (
          <div className="border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/60 to-[#070B14]/60 rounded-xl p-6 text-center text-sm text-slate-400 backdrop-blur-sm">
            <Users className="w-8 h-8 text-slate-500/60 mx-auto mb-2" />
            <p>No referred partners found.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/60 to-[#070B14]/60 backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gradient-to-r from-[#0B1325]/80 to-[#070B14]/80 border-b border-[#D4AF37]/20 text-[#D4AF37] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-4 px-4">Referred Partner</th>
                    <th className="py-4 px-4">Contact Number</th>
                    <th className="py-4 px-4">Referred By</th>
                    <th className="py-4 px-4">Joined Date</th>
                    <th className="py-4 px-4">Referral Code</th>
                    <th className="py-4 px-4">Qualified Leads</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4 text-right">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4AF37]/10">
                  {records.map((item) => (
                    <tr key={item.referredPartnerId} className="hover:bg-[#D4AF37]/5 transition-colors">
                      <td className="py-4 px-4">
                        <div className="min-w-max">
                          <p className="font-bold text-white">{item.referredName}</p>
                          <p className="text-slate-400 text-[10px] mt-0.5">{item.referredPartnerId}</p>
                          <p className="text-slate-500 text-[10px]">{item.referredEmail}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono font-bold text-[#D4AF37]">{item.referredMobile || '—'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="min-w-max">
                          <p className="font-bold text-white">{item.referrerName}</p>
                          <p className="text-slate-400 text-[10px] mt-0.5">{item.referrerPartnerId}</p>
                          <p className="text-slate-500 text-[10px]">{item.referrerEmail}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap text-slate-300">
                        {item.joinedAt ? new Date(item.joinedAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono font-bold text-[#D4AF37]">{item.referralCode}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-white">{item.qualifiedLeads}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            item.qualificationStatus === 'QUALIFIED'
                              ? 'border-emerald-700/50 bg-emerald-500/10 text-emerald-300'
                              : 'border-amber-700/50 bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          {item.qualificationStatus}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-mono font-bold">
                          <p className={item.rewardStatus === 'AVAILABLE' || item.rewardStatus === 'PROCESSED' ? 'text-emerald-400' : 'text-slate-400'}>
                            ₹{item.rewardAmount}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{item.rewardStatus}</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
    if (tab === 'leads') return <div className="space-y-2">{records.map((item) =>
      <AdminLeadCard key={item._id} item={item} busy={busy} onAction={(path, body) => void run(() => adminApi.patch(path, body))} />
    )}</div>;
    if (tab === 'withdrawals') return <AdminWithdrawals response={data} filters={withdrawalFilters} busy={busy || loading} onFilters={setWithdrawalFilters} onAction={(path, body) => void run(() => adminApi.patch(path, body))} />;
    if (tab === 'support') return <div className="admin-support space-y-4">{records.map((item) => <section key={item._id} className="border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/60 to-[#070B14]/60 p-5 rounded-xl hover:border-[#D4AF37]/40 transition-colors backdrop-blur-sm"><div className="flex flex-col gap-5"><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-white">📩 {item.subject} <span className={`text-xs px-2 py-1 rounded ml-2 font-semibold ${item.status === 'RESOLVED' ? 'bg-emerald-500/20 border border-emerald-700 text-emerald-300' : item.status === 'OPEN' ? 'bg-amber-500/20 border border-amber-700 text-amber-300' : 'bg-slate-500/20 border border-slate-700 text-slate-300'}`}>{item.status}</span></h3></div></div><p className="text-xs text-slate-400 mt-1">👤 {item.name} · 📧 {item.email} · 📱 {item.mobile}</p><p className="mt-3 whitespace-pre-wrap text-sm text-slate-300 bg-[#0B1325]/30 p-3 rounded border border-[#D4AF37]/10">{item.message}</p><textarea className={`${inputClass} mt-3 border-[#D4AF37]/20 focus:border-[#D4AF37] focus:ring-[#D4AF37]/10`} aria-label="Admin response" placeholder="💬 Write your response here..." rows={3} value={supportResponses[item._id] ?? item.adminResponse ?? ''} onChange={(event) => setSupportResponses({ ...supportResponses, [item._id]: event.target.value })} /></div><div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#D4AF37]/10 pt-4"><select className={selectClass} value={item.status} onChange={(event) => void run(() => adminApi.patch(`/admin/support/${item._id}`, { status: event.target.value, adminResponse: supportResponses[item._id] ?? item.adminResponse ?? '' }))}>{['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].map((value) => <option key={value}>{value}</option>)}</select><Button className="self-center" variant="primary" size="sm" onClick={() => void run(() => adminApi.patch(`/admin/support/${item._id}`, { status: item.status, adminResponse: supportResponses[item._id] ?? item.adminResponse ?? '' }))}>💾 Save response</Button></div></div></section>)}</div>;
    if (tab === 'settings') return <form className="max-w-lg border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/80 to-[#070B14]/80 p-6 rounded-xl backdrop-blur-sm" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => adminApi.patch('/admin/settings', { minimumWithdrawalAmount: Number(form.get('minimumWithdrawalAmount')) })); }}><h2 className="mb-5 text-lg font-bold text-white">⚙️ Business Settings</h2><label className="mb-5 block text-sm text-slate-400">Minimum withdrawal (₹)<input className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37] focus:ring-[#D4AF37]/10`} name="minimumWithdrawalAmount" type="number" min="1" step="0.01" defaultValue={data?.minimumWithdrawalAmount ?? 200} required /></label><Button type="submit" variant="primary" disabled={busy}>💾 Save Setting</Button></form>;
    if (tab === 'announcements') return <div className="space-y-5"><form className="grid gap-4 border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/80 to-[#070B14]/80 p-5 rounded-xl backdrop-blur-sm" onSubmit={(event) => { event.preventDefault(); void run(async () => { await adminApi.post('/admin/announcements', { ...announcement, status: 'PUBLISHED' }); setAnnouncement({ title: '', message: '' }); }); }}><h2 className="text-lg font-bold text-white">📢 Publish Announcement</h2><input className={`${inputClass} border-[#D4AF37]/20 focus:border-[#D4AF37]`} placeholder="Title" value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} required /><textarea className={`${inputClass} border-[#D4AF37]/20 focus:border-[#D4AF37]`} placeholder="Message" rows={3} value={announcement.message} onChange={(event) => setAnnouncement({ ...announcement, message: event.target.value })} required /><Button type="submit" variant="primary" disabled={busy}>🚀 Publish</Button></form><div className="space-y-3">{records.map((item) => <section key={item._id} className="border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/60 to-[#070B14]/60 p-4 rounded-xl hover:border-[#D4AF37]/40 transition-colors backdrop-blur-sm"><h3 className="font-bold text-white">{item.title} · <span className={`text-xs px-2 py-1 rounded font-semibold ${item.status === 'PUBLISHED' ? 'bg-emerald-500/20 border border-emerald-700 text-emerald-300' : 'bg-slate-500/20 border border-slate-700 text-slate-300'}`}>{item.status}</span></h3><p className="mt-2 text-sm text-slate-300">{item.message}</p></section>)}</div></div>;
    if (tab === 'notifications') return <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"><form className="grid gap-4 border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/80 to-[#070B14]/80 p-5 rounded-xl backdrop-blur-sm" onSubmit={(event) => { event.preventDefault(); void run(async () => { await adminApi.post('/admin/notifications', { type: notification.type, title: notification.title, message: notification.message, allActive: notification.target === 'all', partnerId: notification.target === 'partner' ? notification.partnerId : undefined, partnerIds: notification.target === 'selected' ? notification.partnerIds.split(',').map((id) => id.trim()).filter(Boolean) : undefined }); setNotification({ ...notification, title: '', message: '' }); }); }}><h2 className="text-lg font-bold text-white">📤 Send Notification</h2><label className="text-xs text-slate-400">Notification type<select className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} value={notification.type} onChange={(event) => setNotification({ ...notification, type: event.target.value })}>{['NEW_CAMPAIGN','CAMPAIGN_RATE_CHANGE','LEAD_UPDATE','PAYMENT_UPDATE','WITHDRAWAL_UPDATE','ANNOUNCEMENT','ACCOUNT_UPDATE'].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs text-slate-400">Recipients<select className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} value={notification.target} onChange={(event) => setNotification({ ...notification, target: event.target.value })}><option value="all">All active partners</option><option value="partner">One partner</option><option value="selected">Selected partners</option></select></label>{notification.target === 'partner' && <input className={`${inputClass} border-[#D4AF37]/20 focus:border-[#D4AF37]`} placeholder="Partner ID" value={notification.partnerId} onChange={(event) => setNotification({ ...notification, partnerId: event.target.value })} required />}{notification.target === 'selected' && <input className={`${inputClass} border-[#D4AF37]/20 focus:border-[#D4AF37]`} placeholder="Partner IDs separated by commas" value={notification.partnerIds} onChange={(event) => setNotification({ ...notification, partnerIds: event.target.value })} required />}<label className="text-xs text-slate-400">Title<input className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} placeholder="Title" value={notification.title} onChange={(event) => setNotification({ ...notification, title: event.target.value })} required /></label><label className="text-xs text-slate-400">Message<textarea className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} placeholder="Message" rows={3} value={notification.message} onChange={(event) => setNotification({ ...notification, message: event.target.value })} required /></label><Button className="justify-self-start" size="sm" type="submit" variant="primary" disabled={busy}>🚀 Send</Button></form><AdminNotificationHistory records={records} /></div>;
    if (tab === 'reports') return <div className="space-y-5">
      <div className="grid gap-4 border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/80 to-[#070B14]/80 p-5 sm:grid-cols-2 lg:grid-cols-3 rounded-xl backdrop-blur-sm">
        <label className="text-xs text-slate-400">From<input className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} type="date" value={reportFilters.startDate} onChange={(event) => setReportFilters({ ...reportFilters, startDate: event.target.value })} /></label>
        <label className="text-xs text-slate-400">To<input className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} type="date" value={reportFilters.endDate} onChange={(event) => setReportFilters({ ...reportFilters, endDate: event.target.value })} /></label>
        <label className="text-xs text-slate-400">Status<input className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} value={reportFilters.status} onChange={(event) => setReportFilters({ ...reportFilters, status: event.target.value })} placeholder="Optional" /></label>
        <label className="text-xs text-slate-400">Campaign ID<input className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} value={reportFilters.campaignId} onChange={(event) => setReportFilters({ ...reportFilters, campaignId: event.target.value })} placeholder="Optional" /></label>
        <label className="text-xs text-slate-400">Partner ID<input className={`${inputClass} mt-2 border-[#D4AF37]/20 focus:border-[#D4AF37]`} value={reportFilters.partnerId} onChange={(event) => setReportFilters({ ...reportFilters, partnerId: event.target.value })} placeholder="Optional" /></label>
      </div>
      <section className="space-y-4 border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/60 to-[#070B14]/60 p-5 rounded-xl hover:border-[#D4AF37]/40 transition-colors backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-white text-lg">📊 Campaign Reports</h2>
          <Button variant="primary" onClick={() => void downloadCampaignWorkbook()}>📥 Download All Campaigns</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((item) => <Button key={item._id} variant="outline" onClick={() => void downloadCampaignWorkbook({ _id: item._id, slug: item.slug })}>{item.name}</Button>)}
          {records.length === 0 && <p className="text-sm text-slate-400">Campaign list unavailable.</p>}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">📄 Raw CSV Exports</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{['partners','campaigns','leads','earnings','payouts','withdrawals'].map((type) => <Button key={type} variant="outline" onClick={() => void downloadReport(type)}>📥 {type.charAt(0).toUpperCase() + type.slice(1)}</Button>)}</div>
      </section>
    </div>;
    if (tab === 'audit') return <div className="overflow-hidden rounded-xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B1325]/60 to-[#070B14]/60 backdrop-blur-sm"><div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-sm"><thead className="bg-gradient-to-r from-[#0B1325]/80 to-[#070B14]/80 border-b border-[#D4AF37]/20 text-[#D4AF37] font-bold uppercase tracking-wider"><tr>{['Time','Admin','Action','Entity','ID'].map((value) => <th key={value} className="p-4 text-xs">{value}</th>)}</tr></thead><tbody className="divide-y divide-[#D4AF37]/10">{records.map((item) => <tr key={item._id} className="hover:bg-[#D4AF37]/5 transition-colors"><td className="p-4 text-slate-400 text-xs">{new Date(item.createdAt).toLocaleString()}</td><td className="p-4 text-slate-300 font-semibold">{item.adminEmail}</td><td className="p-4 text-[#D4AF37] font-mono">{item.action}</td><td className="p-4 text-slate-300">{item.entityType}</td><td className="p-4 font-mono text-slate-400">{item.entityId}</td></tr>)}</tbody></table></div></div>;
    return <p className="text-sm text-[#AAB3C2]">Select a section.</p>;
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-3 border-b border-[#203755] pb-4"><VedLogo size="sm" variant="badge" /><p className="text-xs font-semibold text-slate-200">VED AFFILIATE PVT. LIMITED <span className="ml-3 border-l border-[#234263] pl-3 text-sky-400">Admin Panel</span></p></div>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#263650] pb-4">
        <div><p className="text-xs font-bold uppercase text-[#D4AF37]">Administration</p><h1 className="text-2xl font-bold text-white">Operations</h1><p className="text-xs text-[#AAB3C2]">Signed in as {admin.email}</p></div>
        <Button variant="outline" size="sm" onClick={logout}><LogOut className="h-3.5 w-3.5" />Sign out</Button>
      </header>
      <nav className="mb-6 flex gap-2 overflow-x-auto rounded-xl border border-[#1b304b] bg-[#0b1525] p-2" aria-label="Admin sections">{tabs.map((item) => {
        const icons = { overview: LayoutDashboard, campaigns: Layers, partners: Users, referrals: Link2, leads: ListChecks, withdrawals: Wallet, support: Headphones, announcements: Megaphone, notifications: Bell, reports: BarChart3, settings: Settings, audit: FileText };
        const Icon = icons[item.id];
        return <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => selectTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${tab === item.id ? 'border-[#D4AF37] bg-[#D4AF37] text-[#07101d] shadow-lg shadow-amber-500/10' : 'border-transparent text-slate-400 hover:border-sky-900 hover:bg-sky-500/5 hover:text-sky-200'}`}><Icon className="h-3.5 w-3.5" />{item.label}</button>;
      })}</nav>
      <AdminSectionHeader section={tab} />
      {error && <p role="alert" className="mb-4 border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {['partners','referrals','leads','support'].includes(tab) && !ledgerPartner && <div className={tab === 'leads' ? 'admin-filters mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]' : 'admin-filters mb-4 flex flex-col gap-2 sm:flex-row'}><input className={inputClass} placeholder={tab === 'referrals' ? 'Search referrer, new partner, or referral code' : 'Search'} value={search} onChange={(event) => setSearch(event.target.value)} />{tab === 'leads' && <select className={`${inputClass} min-w-0`} aria-label="Filter leads by campaign" value={leadCampaign} onChange={event => { setData(null); setLeadCampaign(event.target.value); }}><option value="ALL">All Campaigns</option>{leadCampaigns.map(item => <option key={item._id} value={item._id}>{item.name} · {item.status}</option>)}</select>}<select className={tab === 'leads' ? `${inputClass} min-w-0` : selectClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{tab === 'leads' && <><option value="IN_PROCESS">In Process</option><option value="NOT_SUBMITTED">Not Submitted</option></>}{['PENDING','VERIFIED','APPROVED','REJECTED','PAID','ACTIVE','INACTIVE','SUSPENDED','OPEN','IN_PROGRESS','RESOLVED','CLOSED','PROCESSING','QUALIFIED','NOT_QUALIFIED','AVAILABLE','PROCESSED'].map((value) => <option key={value}>{value}</option>)}</select><Button variant="outline" onClick={() => void load()}>Apply</Button>{tab === 'leads' && <Button variant="outline" onClick={() => { setSearch(''); setStatus('ALL'); setLeadCampaign('ALL'); void load('leads', true); }}>Reset</Button>}</div>}
      {loading && !data && tab !== 'overview' ? <div role="status" className="rounded-xl border border-[#203755] bg-[#0d192b] px-6 py-14 text-center text-sm text-slate-400">Loading records…</div> : <div className={tab === 'overview' || tab === 'withdrawals' ? undefined : 'admin-content'}>{content()}</div>}
      {kycDetails && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="presentation" onClick={() => setKycDetails(null)}><section role="dialog" aria-modal="true" aria-labelledby="kyc-title" className="admin-kyc w-full max-w-lg space-y-3 border border-[#263650] bg-[#0D1424] p-5" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 id="kyc-title" className="text-lg font-bold">KYC details · {kycDetails.partnerId}</h2><button className="text-sm text-[#D4AF37]" onClick={() => setKycDetails(null)}>Close</button></div><p>{kycDetails.fullName} · {kycDetails.kycStatus}</p><p className="text-sm text-[#AAB3C2]">PAN: <span className="font-mono text-white">{kycDetails.pan}</span></p><div className="space-y-1 border-t border-[#263650] pt-3 text-sm text-[#AAB3C2]"><p>Account holder: {kycDetails.bankDetails?.accountHolderName}</p><p>Account number: <span className="font-mono text-white">{kycDetails.bankDetails?.accountNumber}</span></p><p>IFSC: {kycDetails.bankDetails?.ifscCode}</p><p>Bank: {kycDetails.bankDetails?.bankName}</p><p>UPI: {kycDetails.upiId || 'Not submitted'}</p></div></section></div>}
    </div>
  );
};
