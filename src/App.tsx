import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/layout/Navbar.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { MobileBottomNav } from './components/layout/MobileBottomNav.tsx';
import { WhatsAppButton } from './components/ui/WhatsAppButton.tsx';
import { CampaignDetailModal } from './components/ui/CampaignDetailModal.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { FounderPage } from './pages/FounderPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { NotificationsPage } from './pages/NotificationsPage.tsx';
import { CampaignsPage } from './pages/CampaignsPage.tsx';
import { SupportPage } from './pages/SupportPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { PartnerLeadsPage } from './pages/PartnerLeadsPage.tsx';
import { PartnerWalletPage } from './pages/PartnerWalletPage.tsx';
import { PartnerEarningsPage } from './pages/PartnerEarningsPage.tsx';
import { PartnerReferralsPage } from './pages/PartnerReferralsPage.tsx';
import { LegalPage } from './pages/LegalPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { fetchCampaigns } from './services/api.ts';
import { Campaign } from './types/campaign.ts';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function MainApp() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>('home');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState<boolean>(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [continueUrl, setContinueUrl] = useState<string | undefined>(undefined);

  // Sync route with URL path or hash
  const parseRouteFromLocation = useCallback(() => {
    const rawPath = window.location.pathname.replace(/^\//, '').replace(/\/$/, '').toLowerCase();
    // Partner tracking links look like /campaigns/<slug>?ref=...; render them on the campaigns page
    if (/^campaigns\/[^/]+$/.test(rawPath)) return 'campaigns';
    // Normalize aliases
    const path = rawPath === 'contact' ? 'support' : rawPath;
    const validRoutes = [
      'home',
      'about',
      'founder',
      'admin',
      'admin/login',
      'campaigns',
      'support',
      'login',
      'register',
      'profile',
      'dashboard',
      'leads',
      'wallet',
      'earnings',
      'referrals',
      'notifications',
      'privacy',
      'terms',
    ];
    if (path && validRoutes.includes(path)) {
      return path;
    }
    // Also check hash
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    const hash = rawHash === 'contact' ? 'support' : rawHash;
    if (hash && validRoutes.includes(hash)) {
      return hash;
    }
    if (!rawPath && !rawHash) {
      return 'home';
    }
    return rawPath ? 'notfound' : 'home';
  }, []);

  useEffect(() => {
    const initialRoute = parseRouteFromLocation();
    setCurrentRoute(initialRoute);

    const handlePopState = () => {
      setCurrentRoute(parseRouteFromLocation());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseRouteFromLocation]);

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    window.history.pushState({}, '', route === 'home' ? '/' : `/${route}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Route protection
  useEffect(() => {
    if (!authLoading) {
      const protectedRoutes = ['dashboard', 'leads', 'wallet', 'earnings', 'referrals', 'profile', 'notifications'];
      if (protectedRoutes.includes(currentRoute) && !isAuthenticated) {
        navigateTo('login');
      } else if ((currentRoute === 'login' || currentRoute === 'register') && isAuthenticated) {
        navigateTo('dashboard');
      }
    }
  }, [currentRoute, isAuthenticated, authLoading]);

  // Load campaigns from backend API
  const loadCampaigns = async () => {
    try {
      setIsLoadingCampaigns(true);
      setCampaignsError(null);
      const res = await fetchCampaigns();
      if (res && res.data) {
        setCampaigns(res.data);
      }
    } catch (err: any) {
      console.warn('[VED API] Could not load live campaigns from API:', err.message);
      setCampaignsError(err.message || 'Unable to connect to the campaigns service.');
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  // Keep the partner referral code from a tracking link so registration can pre-fill it
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) sessionStorage.setItem('ved_ref', ref.toUpperCase().trim());
  }, []);

  // Open the campaign details when arriving via /campaigns/<slug>
  useEffect(() => {
    const match = window.location.pathname.match(/^\/campaigns\/([^/]+)\/?$/i);
    if (!match || campaigns.length === 0) return;
    const found = campaigns.find((c) => c.slug.toLowerCase() === decodeURIComponent(match[1]).toLowerCase());
    if (found) {
      const params = new URLSearchParams(window.location.search);
      const query = new URLSearchParams();
      if (params.get('ref')) query.set('ref', params.get('ref')!);
      if (params.get('pid')) query.set('pid', params.get('pid')!);
      setContinueUrl(query.size ? `${API_BASE}/api/public/campaigns/${encodeURIComponent(found.slug)}/go?${query}` : undefined);
      setSelectedCampaign(found);
      setIsModalOpen(true);
    }
  }, [campaigns]);

  const handleOpenDetailModal = (campaign: Campaign) => {
    setContinueUrl(undefined);
    setSelectedCampaign(campaign);
    setIsModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsModalOpen(false);
    setSelectedCampaign(null);
  };
  const isAdminRoute = currentRoute === 'admin' || currentRoute.startsWith('admin/');

  return (
    <div className="min-h-screen flex flex-col bg-[#070B14] text-[#F8FAFC]">
      {/* Top Navigation */}
      {!isAdminRoute && <Navbar currentTab={currentRoute} onNavigate={navigateTo} />}

      {/* Main Page Content */}
      <main className="flex-1 pb-16 md:pb-0">
        {currentRoute === 'home' && (
          <HomePage
            campaigns={campaigns}
            isLoadingCampaigns={isLoadingCampaigns}
            onSelectCampaign={handleOpenDetailModal}
            onNavigate={navigateTo}
          />
        )}

        {currentRoute === 'dashboard' && (
          <DashboardPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'leads' && (
          <PartnerLeadsPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'wallet' && (
          <PartnerWalletPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'earnings' && (
          <PartnerEarningsPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'referrals' && (
          <PartnerReferralsPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'about' && (
          <AboutPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'founder' && (
          <FounderPage onNavigate={navigateTo} />
        )}

        {isAdminRoute && <AdminPage route={currentRoute} onNavigate={navigateTo} />}

        {currentRoute === 'notifications' && <NotificationsPage />}

        {currentRoute === 'campaigns' && (
          <CampaignsPage
            campaigns={campaigns}
            isLoading={isLoadingCampaigns}
            error={campaignsError}
            onRetry={loadCampaigns}
            onSelectCampaign={handleOpenDetailModal}
            onNavigate={navigateTo}
          />
        )}

        {currentRoute === 'support' && (
          <SupportPage />
        )}

        {currentRoute === 'register' && (
          <RegisterPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'login' && (
          <LoginPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'profile' && (
          <ProfilePage onNavigate={navigateTo} />
        )}

        {currentRoute === 'privacy' && (
          <LegalPage initialTab="privacy" />
        )}

        {currentRoute === 'terms' && (
          <LegalPage initialTab="terms" />
        )}

        {![
          'home',
          'dashboard',
          'leads',
          'wallet',
          'earnings',
          'referrals',
          'about',
          'founder',
          'admin',
          'admin/login',
          'campaigns',
          'support',
          'login',
          'register',
          'profile',
          'notifications',
          'privacy',
          'terms',
        ].includes(currentRoute) && (
          <NotFoundPage onNavigate={navigateTo} />
        )}
      </main>

      {/* Campaign Detail Modal */}
      <CampaignDetailModal
        campaign={selectedCampaign}
        isOpen={isModalOpen}
        onClose={handleCloseDetailModal}
        onSelectRegister={() => navigateTo(isAuthenticated ? 'leads' : 'register')}
        continueUrl={continueUrl}
        isPartner={isAuthenticated}
      />

      {/* Floating Direct WhatsApp Action (bottom right) */}
      {!isAdminRoute && <WhatsAppButton
        phoneNumber="7064866056"
        defaultMessage="Hello VED Affiliate Team, I would like more information about your partner marketing opportunities."
        variant="floating"
      />}

      {/* Mobile Bottom Navigation (for Android / mobile users) */}
      {!isAdminRoute && <MobileBottomNav currentTab={currentRoute} onNavigate={navigateTo} />}

      {/* Global Footer */}
      {!isAdminRoute && <Footer onNavigate={navigateTo} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
