import React from 'react';
import { campaignCategories, DEFAULT_CAMPAIGN_CATEGORIES, DEFAULT_TICKER_MESSAGE } from '../../../shared/campaignCategories.ts';
import { Button } from '../ui/Button.tsx';

export function AdminBusinessSettings({ settings, busy, onSave }: { settings: any; busy: boolean; onSave: (input: Record<string, unknown>) => void }) {
  const fieldClass = 'mt-2 w-full rounded-lg border border-[#263650] bg-[#080D17] px-3 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]';
  return <form key={settings?.updatedAt || 'settings'} className="max-w-3xl space-y-6 rounded-xl border border-[#263650] bg-[#0b1627] p-5 sm:p-6" onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    onSave({ minimumWithdrawalAmount: Number(form.get('minimumWithdrawalAmount')), tickerMessage: String(form.get('tickerMessage') || ''), campaignCategories: campaignCategories(String(form.get('additionalCategories') || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean)) });
  }}><div><h2 className="text-lg font-bold text-white">Website & Business Settings</h2><p className="mt-2 text-xs text-slate-400">Manage public updates and campaign categories. Changes appear on the website after its next refresh.</p></div>
    <label className="block text-sm text-slate-300">Minimum withdrawal (₹)<input className={fieldClass} name="minimumWithdrawalAmount" type="number" min="200" step="0.01" defaultValue={settings?.minimumWithdrawalAmount ?? 200} required /><span className="mt-2 block text-xs text-slate-400">The existing minimum is ₹200. Website/category edits do not change payout balances.</span></label>
    <label className="block text-sm text-slate-300">VED Updates message<textarea className={fieldClass} name="tickerMessage" maxLength={500} rows={3} defaultValue={settings?.tickerMessage ?? DEFAULT_TICKER_MESSAGE} /><span className="mt-2 block text-xs text-slate-400">Up to 500 characters on one line. Live campaign and platform counts remain database-driven.</span></label>
    <div><h3 className="text-sm font-semibold text-slate-300">Default campaign categories</h3><div className="mt-3 flex flex-wrap gap-2">{DEFAULT_CAMPAIGN_CATEGORIES.map(category => <span key={category} className="rounded-lg border border-[#28445e] bg-[#102035] px-3 py-2 text-xs text-slate-200">{category}</span>)}</div></div>
    <label className="block text-sm text-slate-300">Additional categories (one per line)<textarea className={fieldClass} name="additionalCategories" rows={4} defaultValue={campaignCategories(settings?.campaignCategories).filter(value => !(DEFAULT_CAMPAIGN_CATEGORIES as readonly string[]).includes(value)).join('\n')} /><span className="mt-2 block text-xs text-slate-400">Up to 30 total categories. Existing campaign records retain their categories if an additional category is removed.</span></label>
    <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save Settings'}</Button>
  </form>;
}
