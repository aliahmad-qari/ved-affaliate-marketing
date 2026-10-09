import React, { useEffect, useState } from 'react';
import { fetchPublicStats, type PublicStats } from '../../services/api.ts';
import { ActivityTicker } from './ActivityTicker.tsx';

export const PartnerActivityStrip: React.FC = () => {
  const [stats, setStats] = useState<PublicStats | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const result = await fetchPublicStats(controller.signal);
        if (!controller.signal.aborted) setStats(result);
      } catch { if (!controller.signal.aborted) setStats(null); }
    };
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  return <ActivityTicker stats={stats} />;
};
