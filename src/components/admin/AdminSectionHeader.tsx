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
  return (
    <header className="mb-6 flex items-center gap-4 pb-4 border-b border-[#1C273C]">
      <div className="rounded-xl border border-[#D4AF37]/40 bg-gradient-to-br from-[#D4AF37]/15 to-[#D4AF37]/5 p-3 text-[#D4AF37] shadow-lg shadow-[#D4AF37]/10">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">{details.title}</h2>
        <p className="mt-1 text-xs sm:text-sm leading-5 text-[#AAB3C2]">{details.description}</p>
      </div>
    </header>
  );
};
