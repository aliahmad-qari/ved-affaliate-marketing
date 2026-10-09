import React, { useEffect, useState } from 'react';
import { fetchCampaigns } from '../services/api.ts';
import { HeroSection } from '../components/home/HeroSection.tsx';
import { StatsSection } from '../components/home/StatsSection.tsx';
import { FeaturedCampaignsSection } from '../components/home/FeaturedCampaignsSection.tsx';
import { HowItWorksSection } from '../components/home/HowItWorksSection.tsx';
import { WhyChooseSection } from '../components/home/WhyChooseSection.tsx';
import { Campaign } from '../types/campaign.ts';
import { Button } from '../components/ui/Button.tsx';
import { VedLogo } from '../components/ui/VedLogo.tsx';
import { ArrowRight, MessageSquare } from 'lucide-react';

interface HomePageProps {
  campaigns: Campaign[];
  isLoadingCampaigns: boolean;
  onSelectCampaign: (campaign: Campaign) => void;
  onNavigate: (tab: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  campaigns,
  onSelectCampaign,
  onNavigate,
}) => {
  const [featuredCampaigns, setFeaturedCampaigns] = useState<Campaign[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  useEffect(() => {
    let active = true;
    fetchCampaigns({ status: 'LIVE', featured: true }, { allowFallback: false })
      .then(result => { if (active) setFeaturedCampaigns(result.data); })
      .catch(() => { if (active) setFeaturedCampaigns([]); })
      .finally(() => { if (active) setLoadingFeatured(false); });
    return () => { active = false; };
  }, []);
  return (
    <div className="space-y-0">
      <HeroSection onNavigate={onNavigate} />
      
      <StatsSection />

      <FeaturedCampaignsSection
        campaigns={featuredCampaigns}
        isLoading={loadingFeatured}
        onSelectCampaign={onSelectCampaign}
        onNavigate={onNavigate}
      />

      <HowItWorksSection />

      <WhyChooseSection />

      {/* Conversion Banner Section with Gold Accent Border */}
      <section className="py-12 sm:py-16 bg-[#060A13] border-b border-[#1C273C] text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="bg-[#0B1220] border border-[#D4AF37]/40 rounded-2xl p-6 sm:p-10 shadow-2xl">
            <VedLogo size="md" variant="badge" className="mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] mb-2">
              Ready to Start Earning?
            </h2>
            <p className="text-xs sm:text-sm text-[#AAB3C2] max-w-lg mx-auto mb-6">
              Join VED AFFILIATE PVT. LIMITED. Promote active financial campaigns and withdraw commissions directly to your bank account or UPI.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={() => onNavigate('register')}
                className="w-full sm:w-auto"
              >
                <span>Join as Partner</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>

              <Button
                variant="secondary"
                size="md"
                onClick={() => onNavigate('support')}
                className="w-full sm:w-auto"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                <span>Contact Support</span>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
