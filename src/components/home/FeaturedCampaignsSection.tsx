import React from 'react';
import { ArrowRight, Building, CheckCircle2, Award } from 'lucide-react';
import { Campaign } from '../../types/campaign.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { Button } from '../ui/Button.tsx';
import { CampaignLogo } from '../ui/CampaignLogo.tsx';

interface FeaturedCampaignsSectionProps {
  campaigns: Campaign[];
  onSelectCampaign: (campaign: Campaign) => void;
  onNavigate: (tab: string) => void;
  isLoading?: boolean;
}

export const FeaturedCampaignsSection: React.FC<FeaturedCampaignsSectionProps> = ({
  campaigns,
  onSelectCampaign,
  onNavigate,
  isLoading = false,
}) => {
  const featured = campaigns.filter(campaign => campaign.status === 'LIVE' && campaign.isFeatured).slice(0, 4);

  return (
    <section className="py-12 sm:py-16 bg-[#070B14] border-b border-[#1C273C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold mb-1">
              LIVE NOW
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
              Featured Campaigns
            </h2>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('campaigns')}
            className="self-start sm:self-auto"
          >
            <span>View all</span>
            <ArrowRight aria-hidden="true" className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Cards Grid */}
        {isLoading ? <p role="status" className="rounded-xl border border-[#1C273C] bg-[#0E1628] p-6 text-sm text-[#AAB3C2]">Loading live campaigns…</p> : featured.length === 0 ? <p className="rounded-xl border border-[#1C273C] bg-[#0E1628] p-6 text-sm text-[#AAB3C2]">No featured LIVE campaigns are available right now. View all campaigns for current opportunities.</p> : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {!isLoading && featured.map((campaign) => (
            <div
              key={campaign.slug}
              className="bg-[#0E1628] border border-[#1C273C] hover:border-[#D4AF37]/50 rounded-xl p-4 sm:p-6 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-[#142038] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] font-extrabold text-sm">
                      <CampaignLogo name={campaign.name} logoUrl={campaign.logoUrl} />
                    </div>
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                      <div className="text-xs text-[#AAB3C2] flex items-center gap-1">
                        <Building className="w-3 h-3 text-[#D4AF37]" />
                        <span>{campaign.companyName}</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC] group-hover:text-[#D4AF37] transition-colors">
                        {campaign.name}
                      </h3>
                    </div>
                  </div>

                  <StatusBadge status={campaign.status} />
                </div>

                <p className="text-xs sm:text-sm text-[#AAB3C2] line-clamp-2 mb-4">
                  {campaign.description}
                </p>

                {/* Quick Attributes */}
                <div className="bg-[#090F1C] border border-[#19243C] rounded-lg p-3 space-y-1.5 mb-4 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-[#AAB3C2]">Action:</span>
                    <span className="text-[#F8FAFC] font-medium truncate">{campaign.requiredAction}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                    <span className="text-[#AAB3C2]">Potential Payout:</span>
                    <span className="text-[#D4AF37] font-semibold">
                      {campaign.payout !== null ? `₹${campaign.payout}` : 'Admin Configured'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#1C273C] flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[#AAB3C2] truncate">
                  {campaign.campaignType}
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectCampaign(campaign)}
                  >
                    Details
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onNavigate('register')}
                  >
                    <span>Promote</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
