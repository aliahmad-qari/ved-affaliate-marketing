import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap select-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/50 active:scale-[0.98]';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-2 min-h-[36px] gap-1.5',
    md: 'text-sm px-5 py-2.5 min-h-[44px] gap-2',
    lg: 'text-base px-6 py-3.5 min-h-[48px] gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-[#D4AF37] hover:bg-[#E5C35A] text-[#070B14] font-semibold shadow-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.25)]',
    secondary:
      'bg-[#0D1424] hover:bg-[#111A2D] text-[#F8FAFC] border border-[#1C273C] hover:border-[#D4AF37]/40 shadow-sm',
    outline:
      'bg-transparent hover:bg-[#111A2D]/60 text-[#F8FAFC] border border-[#1C273C] hover:border-[#AAB3C2]/40',
    ghost:
      'bg-transparent hover:bg-[#111A2D] text-[#AAB3C2] hover:text-[#F8FAFC]',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
