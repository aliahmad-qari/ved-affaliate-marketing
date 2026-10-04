import React, { useState } from 'react';
import { Menu, X, ArrowUpRight, User, LogOut, LayoutDashboard, Layers, FileText, Wallet, Gift, TrendingUp, Bell } from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { VedLogo } from '../ui/VedLogo.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onNavigate }) => {
  const { partner, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authenticated partner nav links
  const partnerNavLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'campaigns', label: 'Campaigns', icon: Layers },
    { id: 'leads', label: 'Leads', icon: FileText },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'earnings', label: 'Earnings', icon: TrendingUp },
    { id: 'referrals', label: 'Referrals', icon: Gift },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  // Public visitor nav links
  const publicNavLinks = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'support', label: 'Support' },
  ];

  const activeLinks = isAuthenticated ? partnerNavLinks : publicNavLinks;

  const handleLinkClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    onNavigate('home');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#05080F]/95 backdrop-blur-md border-b border-[#1C273C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-17 flex items-center justify-between">
        
        {/* Official VED Logo */}
        <button
          onClick={() => handleLinkClick(isAuthenticated ? 'dashboard' : 'home')}
          className="flex items-center text-left group cursor-pointer focus-visible:outline-none"
          aria-label="VED Affiliate Home"
        >
          <VedLogo size="sm" variant="horizontal" />
        </button>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#AAB3C2]" aria-label="Main Navigation">
          {activeLinks.map((link) => {
            const isActive = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => handleLinkClick(link.id)}
                className={`transition-colors hover:text-[#F8FAFC] cursor-pointer relative py-2 ${
                  isActive ? 'text-[#D4AF37] font-semibold' : ''
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden sm:flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleLinkClick('profile')}
                className={`font-mono text-xs ${currentTab === 'profile' ? 'border-[#D4AF37] text-[#D4AF37]' : 'text-[#F8FAFC]'}`}
              >
                <User className="w-3.5 h-3.5 mr-1 text-[#D4AF37]" />
                <span>{partner?.partnerId || 'Profile'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-[#AAB3C2] hover:text-rose-400"
                aria-label="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLinkClick('login')}
              >
                Partner Login
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleLinkClick('register')}
              >
                <span>Join as Partner</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex lg:hidden items-center gap-2">
          {isAuthenticated ? (
            <Button
              variant="secondary"
              size="sm"
              className="px-2.5! py-1! text-xs! min-h-8.5! font-mono text-[#D4AF37]"
              onClick={() => handleLinkClick('profile')}
            >
              <User className="w-3 h-3 mr-1" />
              <span>{partner?.partnerId}</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="px-3! py-1.5! text-xs! min-h-9!"
              onClick={() => handleLinkClick('register')}
            >
              Join
            </Button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-[#AAB3C2] hover:text-[#F8FAFC] hover:bg-[#111A2D] transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#1C273C] bg-[#0A0F1E] px-4 pt-3 pb-5 space-y-3">
          <div className="space-y-1">
            {activeLinks.map((link) => {
              const isActive = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleLinkClick(link.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    isActive
                      ? 'bg-[#111A2D] text-[#D4AF37] font-semibold border border-[#D4AF37]/30'
                      : 'text-[#AAB3C2] hover:bg-[#111A2D]/60 hover:text-[#F8FAFC]'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />}
                </button>
              );
            })}

            {isAuthenticated && (
              <button
                onClick={() => handleLinkClick('profile')}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-between ${
                  currentTab === 'profile'
                    ? 'bg-[#111A2D] text-[#D4AF37] font-semibold border border-[#D4AF37]/30'
                    : 'text-[#AAB3C2] hover:bg-[#111A2D]/60 hover:text-[#F8FAFC]'
                }`}
              >
                <span>Partner Profile ({partner?.partnerId})</span>
                {currentTab === 'profile' && <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />}
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-[#1C273C]">
            {isAuthenticated ? (
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={handleLogout}
                className="text-rose-400 border-rose-900/60"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Sign Out</span>
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => handleLinkClick('login')}
                >
                  Partner Login
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => handleLinkClick('register')}
                >
                  Join Partner
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
