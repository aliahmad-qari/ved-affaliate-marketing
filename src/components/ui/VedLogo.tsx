import React from 'react';

interface VedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'badge' | 'horizontal';
  className?: string;
}

export const VedLogo: React.FC<VedLogoProps> = ({
  size = 'md',
  variant = 'horizontal',
  className = '',
}) => {
  // Dimensions
  const badgeDimensions = {
    sm: { width: 34, height: 34 },
    md: { width: 44, height: 44 },
    lg: { width: 64, height: 64 },
    xl: { width: 120, height: 120 },
  }[size];

  // The official circular badge with concentric gold rings, upward breakout arrow, and bold "VED"
  const BadgeSvg = ({ w = badgeDimensions.width, h = badgeDimensions.height }: { w?: number; h?: number }) => (
    <svg
      width={w}
      height={h}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-[0_4px_14px_rgba(212,175,55,0.3)]"
    >
      <defs>
        {/* Metallic Gold Primary Gradient */}
        <linearGradient id="vedGoldGrad" x1="40" y1="30" x2="200" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF2B2" />
          <stop offset="25%" stopColor="#F5D76E" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="80%" stopColor="#B3891D" />
          <stop offset="100%" stopColor="#8C660D" />
        </linearGradient>

        {/* Arrow Gold Gradient */}
        <linearGradient id="arrowGoldGrad" x1="90" y1="100" x2="190" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5D76E" />
          <stop offset="60%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#FFECA0" />
        </linearGradient>

        {/* Deep Black-Navy Metallic Surface */}
        <radialGradient id="badgeDarkSurface" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0B1324" />
          <stop offset="85%" stopColor="#060912" />
          <stop offset="100%" stopColor="#030408" />
        </radialGradient>
      </defs>

      {/* Outer Ring & Solid Surface */}
      <circle cx="120" cy="120" r="105" fill="url(#badgeDarkSurface)" stroke="url(#vedGoldGrad)" strokeWidth="5.5" />

      {/* Inner Concentric Ring */}
      <circle cx="120" cy="120" r="95" fill="none" stroke="url(#vedGoldGrad)" strokeWidth="2.5" opacity="0.9" />

      {/* Upward Dynamic Growth Arrow Breaking Through Top-Right */}
      {/* Curved Tail */}
      <path
        d="M 94 92 C 120 80, 148 64, 172 48 L 160 34 L 208 38 L 198 86 L 184 72 C 162 88, 134 102, 102 110 Z"
        fill="url(#arrowGoldGrad)"
        filter="drop-shadow(0 2px 5px rgba(0,0,0,0.7))"
      />

      {/* Bold "VED" Center Typography */}
      {/* Letter V */}
      <path
        d="M 52 112 L 71 112 L 87 158 L 103 112 L 122 112 L 96 172 L 77 172 Z"
        fill="url(#vedGoldGrad)"
        stroke="#060912"
        strokeWidth="2.5"
      />

      {/* Letter E */}
      <path
        d="M 115 112 L 152 112 L 152 125 L 131 125 L 131 135 L 149 135 L 149 148 L 131 148 L 131 159 L 153 159 L 153 172 L 115 172 Z"
        fill="url(#vedGoldGrad)"
        stroke="#060912"
        strokeWidth="2.5"
      />

      {/* Letter D */}
      <path
        d="M 158 112 L 183 112 C 199 112, 211 124, 211 142 C 211 160, 199 172, 183 172 L 158 172 Z M 172 125 L 172 159 L 181 159 C 190 159, 196 153, 196 142 C 196 131, 190 125, 181 125 Z"
        fill="url(#vedGoldGrad)"
        stroke="#060912"
        strokeWidth="2.5"
      />
    </svg>
  );

  // Badge only variant
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <BadgeSvg />
      </div>
    );
  }

  // Full stacked logo matching user's official corporate emblem
  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <BadgeSvg w={size === 'xl' ? 140 : size === 'lg' ? 96 : 68} h={size === 'xl' ? 140 : size === 'lg' ? 96 : 68} />
        <div className="mt-3 text-center">
          <span className="block text-base sm:text-xl font-black tracking-[0.24em] text-[#E5C35A] uppercase font-display leading-tight">
            AFFILIATE
          </span>
          <span className="block text-[10px] sm:text-xs font-bold tracking-[0.3em] text-[#F8FAFC] uppercase mt-1">
            PVT LIMITED
          </span>
        </div>
      </div>
    );
  }

  // Horizontal Lockup for Navbar and Headers
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BadgeSvg />
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5 leading-none">
          <span className="text-base sm:text-lg font-black tracking-wider text-[#F8FAFC]">
            VED
          </span>
          <span className="text-base sm:text-lg font-extrabold tracking-wider text-[#D4AF37]">
            AFFILIATE
          </span>
        </div>
        <span className="text-[9px] sm:text-[10px] font-semibold tracking-[0.22em] text-[#AAB3C2] uppercase mt-1">
          PVT. LIMITED
        </span>
      </div>
    </div>
  );
};
