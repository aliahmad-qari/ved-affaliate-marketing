import React from 'react';
import { MapPin, Mail, Phone, FileText, ArrowRight, BadgeCheck } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import founderImage from '../assets/images/client image.jpeg';
import udyamCertificateUrl from '../assets/images/udyam-registration.pdf?url';

// Edit these two values to personalise the page.
const FOUNDER_NAME = '';
const FOUNDER_BIO =
  'VED AFFILIATE PVT. LIMITED was founded in Rourkela, Odisha to give Indian partners a transparent, compliance-first way to promote verified financial campaigns and earn structured commissions.';

interface FounderPageProps {
  onNavigate: (tab: string) => void;
}

export const FounderPage: React.FC<FounderPageProps> = ({ onNavigate }) => {
  return (
    <div className="py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="border-b border-[#1C273C] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1424] border border-[#D4AF37]/30 text-xs font-semibold text-[#D4AF37] mb-3">
            <span>Leadership</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight">
            Meet the Founder
          </h1>
          <p className="text-sm font-semibold text-[#D4AF37] mt-1 uppercase tracking-wider">
            Promote • Earn • Grow
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          <div className="md:col-span-2 bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-2 overflow-hidden">
            <img
              src={founderImage}
              alt={FOUNDER_NAME ? `${FOUNDER_NAME}, Founder of VED AFFILIATE PVT. LIMITED` : 'Founder of VED AFFILIATE PVT. LIMITED'}
              className="w-full h-auto rounded-xl object-cover"
              loading="lazy"
            />
          </div>

          <div className="md:col-span-3 space-y-5">
            <div>
              {FOUNDER_NAME && (
                <h2 className="text-2xl font-bold text-[#F8FAFC]">{FOUNDER_NAME}</h2>
              )}
              <p className="text-sm font-semibold text-[#D4AF37] mt-1">
                Founder, VED AFFILIATE PVT. LIMITED
              </p>
            </div>

            <p className="text-sm text-[#AAB3C2] leading-relaxed">{FOUNDER_BIO}</p>

            <div className="bg-[#0D1424] border border-[#1C273C] rounded-xl p-4 space-y-2.5 text-xs sm:text-sm text-[#AAB3C2]">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Rourkela, Odisha, India</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a href="mailto:vedaffiliateltd@gmail.com" className="hover:text-[#F8FAFC] truncate">
                  vedaffiliateltd@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a
                  href="https://wa.me/917064866056"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#F8FAFC]"
                >
                  WhatsApp: 7064866056
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#080C16] border border-[#1C273C] rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <BadgeCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-[#F8FAFC]">Registration & License</h2>
          </div>
          <p className="text-xs sm:text-sm text-[#AAB3C2] mb-4">
            VED AFFILIATE PVT. LIMITED operates as a registered Indian enterprise. View the official
            Udyam registration certificate below.
          </p>
          <a
            href={udyamCertificateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111A2D] border border-[#D4AF37]/40 text-xs sm:text-sm font-semibold text-[#D4AF37] hover:bg-[#162340] transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>View Udyam Registration Certificate</span>
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => onNavigate('register')}>
            <span>Join as Partner</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('about')}>
            About Us
          </Button>
        </div>
      </div>
    </div>
  );
};
