import React, { useMemo, useState } from 'react';
import { adminApi } from '../../services/adminApi.ts';
import { Button } from '../ui/Button.tsx';

type CampaignOption = { _id: string; name: string; status?: string; payoutType?: string; campaignType?: string };
type PayoutRow = { campaignId: string; payout: string };
type PercentageRow = { campaignId: string; percentage: string };

const inputClass = 'w-full rounded-lg border border-[#263650] bg-[#080D17] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]';

export const AdminPartnerPayoutSettings: React.FC<{
  partner: any;
  campaigns: CampaignOption[];
  onSaved: () => void;
}> = ({ partner, campaigns, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [defaultPayout, setDefaultPayout] = useState(partner.payoutSettings?.defaultPayout == null ? '' : String(partner.payoutSettings.defaultPayout));
  const [rows, setRows] = useState<PayoutRow[]>((partner.payoutSettings?.campaignOverrides || []).map((row: any) => ({ campaignId: row.campaignId, payout: String(row.payout) })));
  const [defaultPercentage, setDefaultPercentage] = useState(partner.payoutSettings?.defaultPayoutPercentage == null ? '' : String(partner.payoutSettings.defaultPayoutPercentage));
  const [percentageRows, setPercentageRows] = useState<PercentageRow[]>((partner.payoutSettings?.campaignPercentageOverrides || []).map((row: any) => ({ campaignId: row.campaignId, percentage: String(row.percentage) })));
  const [newCampaign, setNewCampaign] = useState('');
  const [newPayout, setNewPayout] = useState('');
  const [newPercentageCampaign, setNewPercentageCampaign] = useState('');
  const [newPercentage, setNewPercentage] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(partner.updatedAt);
  const names = useMemo(() => new Map(campaigns.map(campaign => [campaign._id, campaign.name])), [campaigns]);

  const addCampaignOverride = () => {
    if (!newCampaign || newPayout === '' || !Number.isFinite(Number(newPayout)) || Number(newPayout) < 0) return;
    setRows(current => [...current.filter(row => row.campaignId !== newCampaign), { campaignId: newCampaign, payout: newPayout }]);
    setNewCampaign(''); setNewPayout(''); setMessage('');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const result = await adminApi.patch(`/admin/partners/${encodeURIComponent(partner._id)}/payout-settings`, {
        defaultPayout: defaultPayout === '' ? null : Number(defaultPayout),
        campaignOverrides: rows.map(row => ({ campaignId: row.campaignId, payout: Number(row.payout) })),
        defaultPayoutPercentage: defaultPercentage === '' ? null : Number(defaultPercentage),
        campaignPercentageOverrides: percentageRows.map(row => ({ campaignId: row.campaignId, percentage: Number(row.percentage) })),
        expectedUpdatedAt,
      });
      setExpectedUpdatedAt(result.data.updatedAt);
      setMessage('Payout settings saved. These rates apply to future lead/click snapshots only.');
      onSaved();
    } catch (error: any) {
      setMessage(error.message || 'Unable to save payout settings. Reload and try again.');
    } finally { setSaving(false); }
  };

  return <div className="mt-3">
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(value => !value)} aria-expanded={open}>Payout Settings</Button>
    {open && <form onSubmit={save} className="mt-3 grid gap-3 rounded-lg border border-[#D4AF37]/20 bg-[#080D17]/80 p-4 sm:grid-cols-2">
      <p className="text-xs leading-relaxed text-slate-400 sm:col-span-2">Fixed precedence: campaign-specific rupee override → partner-wide rupee override → campaign fixed amount. Percentage precedence: campaign-specific percentage → partner-wide percentage → campaign percentage. Each setting applies only to future click/lead snapshots; existing lead and wallet records are unchanged.</p>
      <label className="text-xs text-slate-400">Partner-wide payout (INR per eligible lead)
        <input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={defaultPayout} onChange={event => setDefaultPayout(event.target.value)} placeholder="Use campaign default" />
      </label>
      <label className="text-xs text-slate-400">Partner-wide percentage for percentage campaigns (%)
        <input className={`${inputClass} mt-1`} type="number" min="0.0001" max="100" step="0.0001" value={defaultPercentage} onChange={event => setDefaultPercentage(event.target.value)} placeholder="Use campaign percentage" />
      </label>
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <label className="text-xs text-slate-400">Campaign
          <select className={`${inputClass} mt-1`} value={newCampaign} onChange={event => setNewCampaign(event.target.value)}>
            <option value="">Select campaign</option>
            {campaigns.map(campaign => <option key={campaign._id} value={campaign._id}>{campaign.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">Payout (INR)
          <input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={newPayout} onChange={event => setNewPayout(event.target.value)} placeholder="0.00" />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={addCampaignOverride} disabled={!newCampaign || newPayout === ''}>Add</Button>
      </div>
      <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <label className="text-xs text-slate-400">Percentage campaign override
          <select className={`${inputClass} mt-1`} value={newPercentageCampaign} onChange={event => setNewPercentageCampaign(event.target.value)}><option value="">Select percentage campaign</option>{campaigns.filter(campaign => campaign.payoutType === 'PERCENTAGE').map(campaign => <option key={campaign._id} value={campaign._id}>{campaign.name}</option>)}</select>
        </label>
        <label className="text-xs text-slate-400">Rate (%)<input className={`${inputClass} mt-1`} type="number" min="0.0001" max="100" step="0.0001" value={newPercentage} onChange={event => setNewPercentage(event.target.value)} /></label>
        <Button type="button" variant="outline" size="sm" disabled={!newPercentageCampaign || !newPercentage} onClick={() => { setPercentageRows(current => [...current.filter(row => row.campaignId !== newPercentageCampaign), { campaignId: newPercentageCampaign, percentage: newPercentage }]); setNewPercentageCampaign(''); setNewPercentage(''); }}>Add</Button>
      </div>
      {percentageRows.length > 0 && <div className="grid gap-2 sm:col-span-2">{percentageRows.map(row => <div key={row.campaignId} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-2"><span className="truncate text-xs text-slate-300">{names.get(row.campaignId) || 'Campaign unavailable'}</span><input aria-label={`Percentage for ${names.get(row.campaignId) || 'campaign'}`} className={inputClass} type="number" min="0.0001" max="100" step="0.0001" value={row.percentage} onChange={event => setPercentageRows(current => current.map(item => item.campaignId === row.campaignId ? { ...item, percentage: event.target.value } : item))} /><Button type="button" variant="ghost" size="sm" onClick={() => setPercentageRows(current => current.filter(item => item.campaignId !== row.campaignId))}>Remove</Button></div>)}</div>}
      {rows.length > 0 && <div className="grid gap-2 sm:col-span-2">
        {rows.map(row => <div key={row.campaignId} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-2">
          <span className="truncate text-xs text-slate-300">{names.get(row.campaignId) || 'Campaign unavailable'}</span>
          <input aria-label={`Payout for ${names.get(row.campaignId) || 'campaign'}`} className={inputClass} type="number" min="0" step="0.01" value={row.payout} onChange={event => setRows(current => current.map(item => item.campaignId === row.campaignId ? { ...item, payout: event.target.value } : item))} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setRows(current => current.filter(item => item.campaignId !== row.campaignId))}>Remove</Button>
        </div>)}
      </div>}
      {message && <p role="status" className="text-xs text-amber-200 sm:col-span-2">{message}</p>}
      <Button type="submit" variant="primary" size="sm" disabled={saving || !expectedUpdatedAt}>{saving ? 'Saving…' : 'Save Payout Settings'}</Button>
    </form>}
  </div>;
};
