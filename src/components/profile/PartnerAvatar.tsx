import React, { useState } from 'react';
import { UserRound } from 'lucide-react';

export function PartnerAvatar({ name, photoUrl, className = 'h-14 w-14' }: { name: string; photoUrl?: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'P';
  return (
    <div aria-label={`${name || 'Partner'} profile photo`} className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D4AF37]/40 bg-[#121D36] text-[#D4AF37] ${className}`}>
      {photoUrl && failedUrl !== photoUrl
        ? <img src={photoUrl} alt="" className="h-full w-full object-cover" onError={() => setFailedUrl(photoUrl)} />
        : <><span aria-hidden="true" className="text-sm font-bold">{initials}</span><UserRound aria-hidden="true" className="absolute bottom-0 right-0 h-3 w-3 translate-x-1 translate-y-1 rounded-full bg-[#121D36]" /></>}
    </div>
  );
}
