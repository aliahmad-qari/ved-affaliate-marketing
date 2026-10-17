import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { DEFAULT_CAMPAIGN_CATEGORIES } from '../shared/campaignCategories.ts';

test('launch UI renders all categories, editable settings, exact wallet wording and honest public statistics', async () => {
  const vite = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, appType: 'custom' });
  try {
    const modules = await Promise.all([
      vite.ssrLoadModule('/src/components/home/HeroSection.tsx'),
      vite.ssrLoadModule('/src/components/home/CampaignCategoriesSection.tsx'),
      vite.ssrLoadModule('/src/components/layout/ActivityTicker.tsx'),
      vite.ssrLoadModule('/src/components/admin/AdminBusinessSettings.tsx'),
      vite.ssrLoadModule('/src/components/partner/PartnerLeadReportControls.tsx'),
      vite.ssrLoadModule('/src/pages/CampaignsPage.tsx'),
      vite.ssrLoadModule('/src/context/AuthContext.tsx'),
      vite.ssrLoadModule('/src/pages/PartnerWalletPage.tsx'),
      vite.ssrLoadModule('/src/components/home/StatsSection.tsx'),
      vite.ssrLoadModule('/src/pages/PartnerLeadsPage.tsx'),
      vite.ssrLoadModule('/src/pages/DashboardPage.tsx'),
    ]);
    const [{ HeroSection },{ CampaignCategoriesSection },{ ActivityTicker },{ AdminBusinessSettings },{ PartnerLeadReportControls },{ CampaignsPage },{ AuthProvider },{ PartnerWalletPage },{ StatsSection },{ PartnerLeadsPage },{ DashboardPage }] = modules;
    const hero=renderToStaticMarkup(React.createElement(HeroSection,{ onNavigate:()=>{} }));
    for (const label of ['Financial Services','Partner Platform','Explore Campaigns','Join Partner','Login to your dashboard']) assert.ok(hero.includes(label));
    assert.ok(!hero.includes('12+ Financial Campaigns'));
    const categories=renderToStaticMarkup(React.createElement(CampaignCategoriesSection,{ onNavigate:()=>{} }));
    for(const category of DEFAULT_CAMPAIGN_CATEGORIES) assert.ok(categories.includes(category.replaceAll('&','&amp;')));
    assert.ok(categories.includes('grid-cols-2') && categories.includes('lg:grid-cols-6'));
    const ticker=renderToStaticMarkup(React.createElement(ActivityTicker,{ stats:{ liveCampaigns:0,activePartners:2,approvedLeads:3,totalPayouts:400 },announcement:'Updated <message>' }));
    for(const text of ['Updated &lt;message&gt;','0 campaigns currently LIVE','2 active partners','Pause scrolling updates','₹400']) assert.ok(ticker.includes(text));
    const noStats=renderToStaticMarkup(React.createElement(StatsSection)); assert.ok(noStats.includes('₹—')); assert.ok(!noStats.includes('10,440'));
    const settings=renderToStaticMarkup(React.createElement(AdminBusinessSettings,{ settings:{ tickerMessage:'Admin <text>', campaignCategories:[...DEFAULT_CAMPAIGN_CATEGORIES,'Custom Product'],minimumWithdrawalAmount:200 }, busy:false,onSave:()=>{} }));
    assert.ok(settings.includes('Admin &lt;text&gt;') && settings.includes('Custom Product') && settings.includes('min="200"'));
    for(const category of DEFAULT_CAMPAIGN_CATEGORIES) assert.ok(settings.includes(category.replaceAll('&','&amp;')));
    const controls=renderToStaticMarkup(React.createElement(PartnerLeadReportControls,{ campaignId:'ALL',status:'ALL',search:'',onCampaign:()=>{} }));
    for(const text of ['All Campaigns','Download CSV','Mobile numbers are masked','all matching pages']) assert.ok(controls.includes(text));
    const wrap=(component: any,props: any) => renderToStaticMarkup(React.createElement(AuthProvider,{},React.createElement(component,props)));
    const campaigns=wrap(CampaignsPage,{ campaigns:[],isLoading:false,error:null,onRetry:()=>{},onSelectCampaign:()=>{},onNavigate:()=>{} });
    for(const category of DEFAULT_CAMPAIGN_CATEGORIES) assert.ok(campaigns.includes(category.replaceAll('&','&amp;')));
    const wallet=wrap(PartnerWalletPage,{ onNavigate:()=>{} }); assert.ok(wallet.includes('Withdraw approved commission earnings directly to your verified UPI ID or bank account.')); assert.ok(!wallet.includes('Indian bank account')); assert.ok(wallet.includes('₹—'));
    const leads=wrap(PartnerLeadsPage,{ onNavigate:()=>{} }); assert.ok(leads.includes('Download CSV') && leads.includes('Previous') && leads.includes('Next'));
    const dashboard=wrap(DashboardPage,{ onNavigate:()=>{} }); assert.ok(dashboard.includes('Download CSV') && !dashboard.includes('12+ active financial campaigns'));
  } finally { await vite.close(); }
});
