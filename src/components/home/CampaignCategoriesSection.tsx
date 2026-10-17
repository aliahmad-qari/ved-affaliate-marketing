import React from 'react';
import { TrendingUp, Coins, ShieldCheck, HandCoins, Landmark, CreditCard, ArrowUpRight, Layers } from 'lucide-react';
import { useSiteSettings } from '../../context/SiteSettingsContext.tsx';

export const categoryPresentation: Record<string, { icon: typeof Layers; description: string; color: string }> = {
  'Demat & Trading': { icon: TrendingUp, description: 'Demat accounts, trading & brokerage', color: '#19d6b1' },
  'Mutual Funds': { icon: Coins, description: 'SIP, lump sum & investment campaigns', color: '#b694ff' },
  Insurance: { icon: ShieldCheck, description: 'Life, health, term & general cover', color: '#40bdff' },
  Loans: { icon: HandCoins, description: 'Personal & business loan campaigns', color: '#f3c35b' },
  Banking: { icon: Landmark, description: 'Bank accounts & banking products', color: '#78b4ff' },
  'UPI & Credit': { icon: CreditCard, description: 'UPI products & credit campaigns', color: '#f5a6c8' },
};
export function CampaignCategoriesSection({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { campaignCategories } = useSiteSettings();
  return <section aria-labelledby="campaign-categories-title" className="border-b border-[#1C273C] bg-[#050b14] py-10 sm:py-14"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div className="border-l-4 border-[#D4AF37] pl-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#D4AF37]">Find your opportunity</p><h2 id="campaign-categories-title" className="text-2xl font-bold text-white sm:text-3xl">Campaign Categories</h2></div><button type="button" className="flex items-center gap-2 text-xs font-semibold text-[#D4AF37] hover:text-amber-200" onClick={() => onNavigate('campaigns')}>View all campaigns <ArrowUpRight className="h-4 w-4" /></button></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{campaignCategories.map(category => {
      const details = categoryPresentation[category] || { icon: Layers, description: 'Explore available financial campaigns', color: '#D4AF37' }; const Icon = details.icon;
      return <button key={category} onClick={() => onNavigate(`campaigns?category=${encodeURIComponent(category)}`)} style={{ '--category-color': details.color } as React.CSSProperties} className="group flex min-w-0 flex-col items-start rounded-xl border border-[var(--category-color)]/35 bg-gradient-to-br from-[var(--category-color)]/10 to-[#070d19] p-4 text-left transition hover:-translate-y-1 hover:border-[var(--category-color)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] sm:p-5"><span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--category-color)]/25 bg-[var(--category-color)]/10 text-[var(--category-color)]"><Icon className="h-6 w-6" /></span><h3 className="break-words text-sm font-bold text-white">{category}</h3><p className="mb-5 mt-2 flex-1 text-[11px] leading-relaxed text-[#AAB3C2]">{details.description}</p><ArrowUpRight className="h-4 w-4 text-[var(--category-color)] transition group-hover:translate-x-1" /></button>;
    })}</div>
  </div></section>;
}
