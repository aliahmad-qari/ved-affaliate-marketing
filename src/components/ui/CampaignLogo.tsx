import React, { useState } from 'react';

export const CampaignLogo: React.FC<{ name: string; logoUrl?: string }> = ({ name, logoUrl }) => {
  const [failedUrl, setFailedUrl] = useState<string>();
  return logoUrl && failedUrl !== logoUrl
    ? <img src={logoUrl} alt={`${name} logo`} loading="lazy" className="h-full w-full rounded-[inherit] object-contain" onError={() => setFailedUrl(logoUrl)} />
    : <>{name.substring(0, 2).toUpperCase()}</>;
};
