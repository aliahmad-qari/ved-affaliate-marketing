import React from 'react';
import { Home, Layers, FileText, Wallet, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface MobileBottomNavProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentTab, onNavigate }) => {
  const { isAuthenticated } = useAuth();

  const tabs = [
    { id: isAuthenticated ? 'dashboard' : 'home', label: isAuthenticated ? 'Dashboard' : 'Home', icon: Home },
    { id: 'campaigns', label: 'Campaigns', icon: Layers },
    { id: 'leads', label: 'Leads', icon: FileText },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'profile', label: isAuthenticated ? 'Profile' : 'Sign In', icon: User },
  ];

  const handleTabClick = (tabId: string) => {
    if ((tabId === 'leads' || tabId === 'wallet' || tabId === 'dashboard') && !isAuthenticated) {
      onNavigate('login');
      return;
    }

    if (tabId === 'profile' && !isAuthenticated) {
      onNavigate('login');
      return;
    }

    onNavigate(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070B14]/95 backdrop-blur-lg border-t border-[#1C273C] px-2 py-2"
    >
      <div className="grid grid-cols-5 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors cursor-pointer relative ${
                isActive ? 'text-[#D4AF37]' : 'text-[#AAB3C2] hover:text-[#F8FAFC]'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium tracking-tight whitespace-nowrap">{tab.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#D4AF37] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
