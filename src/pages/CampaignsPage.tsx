import React, { useState } from 'react';
import {
  Search,
  Building,
  CheckCircle2,
  Award,
  ChevronRight,
  Shield,
  Layers,
  Copy,
  Check,
  Share2,
  PlusCircle,
} from 'lucide-react';
import { Campaign, CampaignCategory } from '../types/campaign.ts';
import { StatusBadge } from '../components/ui/StatusBadge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { CampaignSkeletonCard } from '../components/ui/LoadingSkeleton.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { ErrorState } from '../components/ui/ErrorState.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface CampaignsPageProps {
  campaigns: Campaign[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectCampaign: (campaign: Campaign) => void;
  onNavigate: (tab: string) => void;
}

export const CampaignsPage: React.FC<CampaignsPageProps> = ({
  campaigns,
  isLoading,
  error,
  onRetry,
  onSelectCampaign,
  onNavigate,
}) => {
  const { isAuthenticated, partner } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: 'All Categories' },
    { id: 'Demat & Trading', label: 'Demat & Trading' },
    { id: 'Mutual Funds', label: 'Mutual Funds' },
    { id: 'Banking & Credit', label: 'Banking & Credit' },
  ];

  const statuses: { id: string; label: string }[] = [
    { id: 'all', label: 'All Status' },
    { id: 'LIVE', label: 'Live Campaigns' },
    { id: 'PAUSED', label: 'Paused' },
  ];

  // Client-side filtering on loaded campaigns
  const filteredCampaigns = campaigns.filter((c) => {
    // Category check
    if (selectedCategory !== 'all' && c.campaignType !== selectedCategory) {
      return false;
    }
    // Status check
    if (selectedStatus !== 'all' && c.status !== selectedStatus) {
      return false;
    }
    // Search check
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchCompany = c.companyName.toLowerCase().includes(q);
      const matchDesc = c.description.toLowerCase().includes(q);
      return matchName || matchCompany || matchDesc;
    }
    return true;
  });

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedStatus('all');
  };

  const getPartnerTrackingUrl = (slug: string) => {
    const origin = window.location.origin;
    if (partner) {
      return `${origin}/campaigns/${slug}?ref=${partner.referralCode}&pid=${partner.partnerId}`;
    }
    return `${origin}/campaigns/${slug}`;
  };

  const handleCopyPartnerLink = (slug: string) => {
    const link = getPartnerTrackingUrl(slug);
    navigator.clipboard.writeText(link);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleShareWhatsApp = (campaign: Campaign) => {
    const link = getPartnerTrackingUrl(campaign.slug);
    const text = encodeURIComponent(
      `Open an account on ${campaign.name} (${campaign.companyName})!\nRequired Action: ${campaign.requiredAction}\nApply here: ${link}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="py-12 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Page Header */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1424] border border-[#1C273C] text-xs font-semibold text-[#D4AF37] mb-3">
            <span>Verified Brokerage & Financial Portfolio</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F8FAFC] tracking-tight">
            Active Financial Campaigns
          </h1>
          <p className="text-sm sm:text-base text-[#AAB3C2] mt-3 leading-relaxed">
            Browse active Indian broking, investment, and demat campaigns.
            {isAuthenticated
              ? ' Copy your secure partner tracking links and submit client leads.'
              : ' Register as a partner to receive confidential tracking links and submit client leads.'}
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-[#0D1424] border border-[#1C273C] rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
            
            {/* Search Input */}
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 text-[#AAB3C2] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search campaigns, brokers, or fund houses..."
                className="w-full bg-[#111A2D] border border-[#1C273C] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#F8FAFC] placeholder-[#AAB3C2]/60 outline-none transition-colors"
              />
            </div>

            {/* Category Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-[#111A2D] border border-[#1C273C] focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-xs sm:text-sm text-[#F8FAFC] outline-none cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-[#111A2D] border border-[#1C273C] focus:border-[#D4AF37] rounded-xl px-3 py-2.5 text-xs sm:text-sm text-[#F8FAFC] outline-none cursor-pointer"
              >
                {statuses.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Active Filter Indicators */}
          <div className="flex items-center justify-between pt-3 border-t border-[#1C273C] text-xs text-[#AAB3C2]">
            <span>
              Showing <strong className="text-[#F8FAFC]">{filteredCampaigns.length}</strong> of {campaigns.length} campaigns
            </span>

            {(searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all') && (
              <button
                onClick={resetFilters}
                className="text-[#D4AF37] hover:underline font-medium cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CampaignSkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <ErrorState
            title="Failed to Load Campaigns"
            message={error}
            onRetry={onRetry}
          />
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredCampaigns.length === 0 && (
          <EmptyState
            title="No Campaigns Matched"
            description="We couldn't find any financial campaigns matching your search or filters. Try adjusting criteria."
            actionText="View All Live Campaigns"
            onAction={resetFilters}
          />
        )}

        {/* Campaign Cards Grid */}
        {!isLoading && !error && filteredCampaigns.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.slug}
                className="bg-[#0D1424] border border-[#1C273C] hover:border-[#D4AF37]/40 rounded-xl p-5 sm:p-6 transition-all duration-200 flex flex-col justify-between group hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-11 h-11 rounded-lg bg-[#111A2D] border border-[#1C273C] flex items-center justify-center text-[#D4AF37] font-bold text-sm group-hover:border-[#D4AF37]/50 transition-colors">
                      {campaign.name.substring(0, 2).toUpperCase()}
                    </div>

                    <StatusBadge status={campaign.status} />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#AAB3C2] mb-1">
                    <Building className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span className="truncate">{campaign.companyName}</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC] group-hover:text-[#D4AF37] transition-colors leading-snug mb-3">
                    {campaign.name}
                  </h3>

                  <p className="text-xs text-[#AAB3C2] leading-relaxed mb-5 line-clamp-2">
                    {campaign.description}
                  </p>

                  {/* Requirements & Payout Attributes */}
                  <div className="bg-[#111A2D]/60 border border-[#1C273C] rounded-lg p-3 space-y-2 mb-5">
                    <div className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[#AAB3C2]">Required Action: </span>
                        <span className="text-[#F8FAFC] font-medium block truncate max-w-55">
                          {campaign.requiredAction}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-xs">
                      <Award className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[#AAB3C2]">Potential Payout: </span>
                        <span className="text-[#D4AF37] font-medium">
                          {campaign.payout ? `₹${campaign.payout}` : 'Admin Configured'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-[#1C273C] space-y-2">
                  {isAuthenticated ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth
                          onClick={() => handleCopyPartnerLink(campaign.slug)}
                          className="py-1.5! text-xs!"
                        >
                          {copiedSlug === campaign.slug ? (
                            <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 mr-1" />
                          )}
                          <span>{copiedSlug === campaign.slug ? 'Copied Link' : 'Copy Link'}</span>
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleShareWhatsApp(campaign)}
                          className="py-1.5! px-2.5! bg-[#25D366]! text-black! hover:bg-[#20ba59]!"
                          aria-label="Share on WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
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
                          onClick={() => onNavigate('leads')}
                          disabled={campaign.status !== 'LIVE'}
                        >
                          <PlusCircle className="w-3.5 h-3.5 mr-1" />
                          <span>Submit Lead</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectCampaign(campaign)}
                      >
                        View Details
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onNavigate('register')}
                      >
                        <span>Join to Promote</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Affiliate Policy Disclaimer */}
        <div className="bg-[#0A0F1D] border border-[#1C273C] rounded-xl p-5 text-xs text-[#AAB3C2] leading-relaxed flex items-start gap-3">
          <Shield className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
          <div>
            <span className="text-[#F8FAFC] font-semibold">Affiliate Tracking Policy: </span>
            In compliance with our broker agreements and SEBI guidelines, affiliate tracking links and vendor redirection codes are strictly accessible within the authenticated Partner Portal. Public visitors must complete partner onboarding to obtain active links.
          </div>
        </div>

      </div>
    </div>
  );
};
