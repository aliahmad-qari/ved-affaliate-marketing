import React, { useEffect, useState } from 'react';
import { fetchCampaigns } from '../services/api.ts';
import { HeroSection } from '../components/home/HeroSection.tsx';
import { CampaignCategoriesSection } from '../components/home/CampaignCategoriesSection.tsx';
import { StatsSection } from '../components/home/StatsSection.tsx';
import { FeaturedCampaignsSection } from '../components/home/FeaturedCampaignsSection.tsx';
import { HowItWorksSection } from '../components/home/HowItWorksSection.tsx';
import { WhyChooseSection } from '../components/home/WhyChooseSection.tsx';
import { Campaign } from '../types/campaign.ts';
import { Button } from '../components/ui/Button.tsx';
import tradingBackground from '../assets/images/hero-trading-workstation.webp';
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
      <CampaignCategoriesSection onNavigate={onNavigate} />

      <FeaturedCampaignsSection
        campaigns={featuredCampaigns}
        isLoading={loadingFeatured}
        onSelectCampaign={onSelectCampaign}
        onNavigate={onNavigate}
      />

      <HowItWorksSection />

      <WhyChooseSection />

      {/* Conversion Banner Section with Gold Accent Border */}
      <section className="py-10 sm:py-14 bg-[#030b14] border-b border-[#173247] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative isolate overflow-hidden bg-[#061421] border border-[#246078] rounded-2xl p-6 sm:p-10 shadow-2xl lg:pl-[34%]">
            <img src={tradingBackground} alt="" aria-hidden="true" loading="lazy" width={1536} height={1024} className="absolute inset-0 -z-20 h-full w-full object-cover object-right opacity-40 lg:w-1/3 lg:opacity-80" />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#03111f]/70 via-[#03111f]/95 to-[#03111f]" />
            <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-[#f2ce63]">Become a partner today</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] mb-2">
              Ready to Start Earning?
            </h2>
            <p className="text-xs sm:text-sm text-[#AAB3C2] max-w-lg mx-auto mb-6">
              Join VED AFFILIATE PVT. LIMITED. Promote active financial campaigns and withdraw commissions directly to your bank account or UPI.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3">
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
