import React from 'react';
import { X, CheckCircle2, ShieldCheck, ArrowRight, Building, Award } from 'lucide-react';
import { Campaign } from '../../types/campaign.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { Button } from './Button.tsx';
import { VedLogo } from './VedLogo.tsx';

interface CampaignDetailModalProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectRegister: () => void;
}

export const CampaignDetailModal: React.FC<CampaignDetailModalProps> = ({
  campaign,
  isOpen,
  onClose,
  onSelectRegister,
}) => {
  if (!isOpen || !campaign) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div 
        className="relative w-full max-w-xl bg-[#090F1E] border border-[#1E2E4E] rounded-2xl p-5 sm:p-7 shadow-2xl text-left my-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-modal-title"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-[#10182D] text-[#AAB3C2] hover:text-white border border-[#1C273C] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 pr-8 mb-5">
          <VedLogo size="sm" variant="badge" className="mt-0.5 shrink-0" />
          <div>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap text-xs text-[#AAB3C2]">
              <span className="flex items-center gap-1 font-medium text-[#D4AF37]">
                <Building className="w-3.5 h-3.5" />
                {campaign.companyName}
              </span>
              <span aria-hidden="true">·</span>
              <StatusBadge status={campaign.status} />
            </div>
            <h2 id="campaign-modal-title" className="text-lg sm:text-xl font-bold text-[#F8FAFC]">
              {campaign.name}
            </h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-[#AAB3C2] bg-[#0E162A] border border-[#1C273C] rounded-xl p-3.5 leading-relaxed">
            {campaign.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#0E162A] border border-[#1C273C] rounded-xl p-3.5">
              <div className="text-xs text-[#AAB3C2] mb-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Required Action
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#F8FAFC]">{campaign.requiredAction}</p>
            </div>

            <div className="bg-[#0E162A] border border-[#1C273C] rounded-xl p-3.5">
              <div className="text-xs text-[#AAB3C2] mb-1 flex items-center gap-1 font-medium">
                <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
                Payout Structure
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#D4AF37]">
                {campaign.payout ? `₹${campaign.payout} INR` : 'Admin Configured'}
              </p>
              <p className="text-[10px] text-[#AAB3C2] mt-0.5">{campaign.payoutTerms}</p>
            </div>
          </div>

          {campaign.rules && campaign.rules.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#AAB3C2] mb-2 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                Campaign Conditions
              </h3>
              <ul className="space-y-1.5 text-xs text-[#AAB3C2] bg-[#0E162A]/60 border border-[#1C273C] rounded-xl p-3">
                {campaign.rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1 shrink-0" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-[#05080F] border border-[#1C273C] rounded-lg p-3 text-[11px] text-[#AAB3C2] leading-relaxed">
            <span className="text-[#D4AF37] font-semibold">Verification Rule: </span>
            Submissions are audited manually by VED Admin before release to wallet.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-[#1C273C] flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onClose();
              onSelectRegister();
            }}
          >
            <span>Register to Promote</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};
