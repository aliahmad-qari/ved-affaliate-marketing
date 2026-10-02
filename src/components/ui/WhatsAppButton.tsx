import React from 'react';
import { MessageSquare } from 'lucide-react';

interface WhatsAppButtonProps {
  phoneNumber?: string;
  defaultMessage?: string;
  variant?: 'primary' | 'secondary' | 'floating';
  className?: string;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  phoneNumber = '7064866056',
  defaultMessage = 'Hello VED Affiliate Support, I would like more information about partner onboarding and active financial campaigns.',
  variant = 'primary',
  className = '',
}) => {
  const formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
  const url = `https://wa.me/91${formattedPhone}?text=${encodeURIComponent(defaultMessage)}`;

  if (variant === 'floating') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Direct WhatsApp Support"
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-3 rounded-full shadow-lg shadow-[#25D366]/20 transition-all duration-200 hover:scale-105 active:scale-95 text-xs font-semibold tracking-wide ${className}`}
      >
        <MessageSquare className="w-4 h-4 fill-current" />
        <span className="hidden sm:inline">WhatsApp Help</span>
      </a>
    );
  }

  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[44px] px-5 py-2.5 text-sm gap-2 select-none';

  const styles =
    variant === 'primary'
      ? 'bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold shadow-sm'
      : 'bg-[#0D1424] hover:bg-[#111A2D] text-[#25D366] border border-[#25D366]/30';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseStyles} ${styles} ${className}`}
    >
      <MessageSquare className="w-4 h-4 fill-current" />
      <span>Chat on WhatsApp (7064866056)</span>
    </a>
  );
};
