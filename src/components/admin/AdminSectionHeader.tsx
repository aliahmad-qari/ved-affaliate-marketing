import React from 'react';
import { Layers, Users, Link2, ListChecks, Headphones, Megaphone, Bell, BarChart3, Settings, FileText } from 'lucide-react';

const sections = {
  campaigns: { icon: Layers, title: 'Campaigns', description: 'Manage campaign details, logos and publishing.' },
  partners: { icon: Users, title: 'Partners', description: 'Review partner accounts, performance and KYC details.' },
  referrals: { icon: Link2, title: 'Referrals', description: 'Review referred partners, qualifications and rewards.' },
  leads: { icon: ListChecks, title: 'Leads', description: 'Review enquiries, application progress and commissions.' },
  support: { icon: Headphones, title: 'Support', description: 'Review partner requests and manage responses.' },
  announcements: { icon: Megaphone, title: 'Announcements', description: 'Publish updates and review previous announcements.' },
  notifications: { icon: Bell, title: 'Notifications', description: 'Send updates to partners and review notification records.' },
  reports: { icon: BarChart3, title: 'Reports', description: 'Filter and download campaign workbooks and data exports.' },
  settings: { icon: Settings, title: 'Settings', description: 'Manage the business settings for partner withdrawals.' },
  audit: { icon: FileText, title: 'Audit log', description: 'Review recorded admin actions and their timestamps.' },
};

export const AdminSectionHeader: React.FC<{ section: string }> = ({ section }) => {
  const details = sections[section as keyof typeof sections];
  if (!details) return null;
  const Icon = details.icon;
  return <header className="mb-5 flex items-center gap-3">
    <span className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-sky-300"><Icon className="h-6 w-6" /></span>
    <div><h2 className="text-2xl font-bold text-white">{details.title}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{details.description}</p></div>
  </header>;
};
