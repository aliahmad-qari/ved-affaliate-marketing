import React, { createContext, useContext, useEffect, useState } from 'react';
import { campaignCategories, DEFAULT_TICKER_MESSAGE } from '../../shared/campaignCategories.ts';

export interface SiteSettings { tickerMessage: string; campaignCategories: string[] }
const defaults: SiteSettings = { tickerMessage: DEFAULT_TICKER_MESSAGE, campaignCategories: campaignCategories([]) };
const SiteSettingsContext = createContext(defaults);
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(defaults);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/public/site-settings`, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) return;
        const result = await response.json();
        if (!controller.signal.aborted && result.success && typeof result.data?.tickerMessage === 'string') setSettings({ tickerMessage: result.data.tickerMessage, campaignCategories: campaignCategories(result.data.campaignCategories) });
      } catch { /* Retain non-statistical defaults or the last successful configuration. */ }
    };
    void refresh(); const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return <SiteSettingsContext.Provider value={settings}>{children}</SiteSettingsContext.Provider>;
}
export const useSiteSettings = () => useContext(SiteSettingsContext);
