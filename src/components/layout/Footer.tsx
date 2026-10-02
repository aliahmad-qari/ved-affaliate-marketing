import React from 'react';
import { Mail, Phone, MapPin, ExternalLink } from 'lucide-react';
import { VedLogo } from '../ui/VedLogo.tsx';

interface FooterProps {
  onNavigate: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#030509] border-t border-[#1C273C] text-[#AAB3C2] pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Col 1: Official Logo */}
          <div className="space-y-3">
            <VedLogo size="sm" variant="horizontal" />
            <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
              Promote • Earn • Grow
            </p>
            <p className="text-xs text-[#AAB3C2] leading-relaxed">
              Official Indian affiliate platform connecting partners with verified financial and broking campaigns.
            </p>
          </div>

          {/* Col 2: Navigation Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F8FAFC] mb-3">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('about')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('campaigns')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Active Campaigns
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('support')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Support & Help
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F8FAFC] mb-3">
              Legal & Terms
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('privacy')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('terms')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Terms & Conditions
                </button>
              </li>
              <li>
                <span className="text-[#AAB3C2]/70">Min Withdrawal: ₹200</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F8FAFC] mb-3">
              Official Desk
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Rourkela, Odisha, India</span>
              </li>
              <li className="flex items-center gap-2 truncate">
                <Mail className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a
                  href="mailto:vedaffiliateltd@gmail.com"
                  className="hover:text-[#F8FAFC] transition-colors truncate"
                >
                  vedaffiliateltd@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a
                  href="https://wa.me/917064866056"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#F8FAFC] transition-colors flex items-center gap-1"
                >
                  <span>WhatsApp: 7064866056</span>
                  <ExternalLink className="w-3 h-3 text-[#AAB3C2]" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-[#080C16] border border-[#1C273C] rounded-xl p-4 mb-6 text-[11px] leading-relaxed text-[#AAB3C2]/80">
          <p>
            VED AFFILIATE PVT. LIMITED is an affiliate marketing platform connecting partners with service providers. We are not a registered broker or financial adviser. Submitted leads are subject to manual Admin and broker verification before commission release.
          </p>
        </div>

        {/* Bottom */}
        <div className="pt-4 border-t border-[#1C273C] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <p>© {new Date().getFullYear()} VED AFFILIATE PVT. LIMITED. All rights reserved.</p>
          <span className="text-[11px] text-[#D4AF37]">
            Rourkela, Odisha · Registered Entity
          </span>
        </div>

      </div>
    </footer>
  );
};
