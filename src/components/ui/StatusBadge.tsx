import React from 'react';
import { CampaignStatus } from '../../types/campaign.ts';

interface StatusBadgeProps {
  status: CampaignStatus;
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showDot = true,
  className = '',
}) => {
  const config = {
    LIVE: {
      color: 'text-emerald-400',
      dotColor: 'bg-emerald-400',
      label: 'LIVE CAMPAIGN',
    },
    PAUSED: {
      color: 'text-amber-400',
      dotColor: 'bg-amber-400',
      label: 'TEMPORARILY PAUSED',
    },
    DRAFT: {
      color: 'text-slate-400',
      dotColor: 'bg-slate-400',
      label: 'DRAFT',
    },
    ENDED: {
      color: 'text-rose-400',
      dotColor: 'bg-rose-400',
      label: 'CONCLUDED',
    },
  }[status] || {
    color: 'text-slate-400',
    dotColor: 'bg-slate-400',
    label: status,
  };

  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase ${config.color} ${className}`}>
      {showDot && (
        <span className="relative flex h-2 w-2">
          {status === 'LIVE' && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotColor}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
        </span>
      )}
      <span>{config.label}</span>
    </div>
  );
};
