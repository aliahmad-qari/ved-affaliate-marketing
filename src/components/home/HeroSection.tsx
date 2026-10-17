import React from 'react';
import { ArrowRight, ShieldCheck, Headphones, ListChecks, TrendingUp, Coins, HandCoins } from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import tradingBackground from '../../assets/images/hero-trading-workstation.webp';

export const HeroSection: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => <section className="relative overflow-hidden border-b border-[#1C273C] bg-[#040b13] py-6 sm:py-10">
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(14,116,144,.17),transparent_55%)]" />
  <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="relative overflow-hidden rounded-2xl border border-[#17506b] bg-gradient-to-br from-[#092335] via-[#06121e] to-[#030912] p-5 sm:p-8 lg:p-10">
    <img src={tradingBackground} alt="" aria-hidden="true" fetchPriority="high" width={1536} height={1024} className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[65%_center]" />
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#020e1c]/95 via-[#020e1c]/75 to-[#020e1c]/20" />
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020e1c]/95 via-transparent to-[#020e1c]/15" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-44 w-[75%] -rotate-12 border-t border-[#D4AF37]/60 bg-gradient-to-b from-[#D4AF37]/10 to-transparent" />
    <div className="relative grid items-center gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
      <div className="min-w-0"><p className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#e5c45a] sm:text-xs">Your growth partner in</p><h1 className="max-w-2xl text-3xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-5xl xl:text-6xl">Financial Services <span className="mt-1 block text-[#f2ce63]">Partner Platform</span></h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#bcc9da] sm:text-base">VED AFFILIATE connects partners with leading financial campaigns across Demat, Trading, Mutual Funds, Loans & More. Submit eligible leads and earn on verified conversions.</p>
        <div className="my-6 flex flex-wrap gap-x-5 gap-y-3 text-xs text-slate-200">{[[ShieldCheck,'Admin-reviewed leads'],[ListChecks,'Transparent earnings'],[Headphones,'Partner support']].map(([Icon,label]: any) => <span key={label} className="flex items-center gap-2"><Icon className="h-5 w-5 text-[#e5c45a]" />{label}</span>)}</div>
        <div className="flex flex-col gap-3 min-[400px]:flex-row"><Button variant="primary" size="lg" onClick={() => onNavigate('campaigns')} className="justify-center rounded-full! bg-gradient-to-r from-[#f5d56a] to-[#dfb338] text-[#08101a]">Explore Campaigns <ArrowRight className="ml-2 h-4 w-4" /></Button><Button variant="outline" size="lg" onClick={() => onNavigate('register')} className="justify-center">Join Partner</Button></div>
        <p className="mt-4 text-xs text-[#AAB3C2]">Already a partner? <button onClick={() => onNavigate('login')} className="font-semibold text-[#f2ce63] underline-offset-4 hover:underline">Login to your dashboard</button></p>
      </div>
      <div className="relative min-w-0 lg:ml-auto lg:w-full lg:max-w-xs">
        <div className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-1">{[
          { icon: TrendingUp, label: 'Demat & Trading', category: 'Demat & Trading', color: '#19d6b1' },
          { icon: Coins, label: 'Mutual Funds', category: 'Mutual Funds', color: '#b694ff' },
          { icon: ShieldCheck, label: 'Insurance', category: 'Insurance', color: '#40bdff' },
          { icon: HandCoins, label: 'Loan Services', category: 'Loans', color: '#f3c35b' },
        ].map(({ icon: Icon, label, category, color }) => <button key={category} type="button" onClick={() => onNavigate(`campaigns?category=${encodeURIComponent(category)}`)} style={{ '--hero-accent': color } as React.CSSProperties} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-[#246078] bg-[#031727]/90 p-3 text-left shadow-lg backdrop-blur-sm transition hover:border-[var(--hero-accent)] hover:bg-[#092335] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f2ce63]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--hero-accent)]/30 bg-[var(--hero-accent)]/15 text-[var(--hero-accent)]"><Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} /></span><span className="flex-1 text-sm font-semibold text-white">{label}</span><ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#bdcce0] transition group-hover:translate-x-1" /></button>)}</div>
        <p className="mt-5 text-center text-sm font-medium italic leading-relaxed text-[#f2ce63] lg:text-right">One platform. More opportunities.</p>
      </div>
    </div>
  </div></div>
</section>;
