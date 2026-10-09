import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import mongoose from 'mongoose';
import { FeaturedCampaignsSection } from '../src/components/home/FeaturedCampaignsSection.tsx';
import { HeroSection } from '../src/components/home/HeroSection.tsx';
import { WhyChooseSection } from '../src/components/home/WhyChooseSection.tsx';
import { AdminLeadCard } from '../src/components/admin/AdminLeadCard.tsx';
import { createApp } from '../server/app.ts';
import { Lead } from '../server/models/Lead.ts';
import { Partner } from '../server/models/Partner.ts';
import { Campaign } from '../server/models/Campaign.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { signToken } from '../server/utils/jwt.ts';

const description = 'VED AFFILIATE connects partners with leading financial campaigns across Demat, Trading, Mutual Funds, Loans & More. Submit eligible leads and earn on verified conversions.';
test('homepage exact copy, compact benefits, LIVE featured data and existing navigation', () => {
  const hero = renderToStaticMarkup(<HeroSection onNavigate={() => {}} />);
  assert.ok(hero.includes(description.replace('&', '&amp;')));
  const metadata = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(metadata.includes(`content="${description.replace('&', '&amp;')}"`));
  const benefits = renderToStaticMarkup(<WhyChooseSection />);
  for (const title of ['Top Brokerage Network', 'Real-Time Tracking', 'Partner Dashboard', 'Verified Partner KYC', 'Easy Withdrawals', '₹50 Referral Reward']) assert.ok(benefits.includes(title));
  assert.ok(benefits.includes('More Opportunities • Better Tools • Bigger Earnings'));
  assert.ok(benefits.includes('approved first-task rule'));
  const campaigns: any[] = ['LIVE', 'PAUSED', 'DRAFT', 'ENDED'].map(status => ({ slug: status, name: `${status} test broker`, companyName: 'Broker', status, isFeatured: true, payout: 0, description: 'Test description' }));
  campaigns.push({ ...campaigns[0], slug: 'non-featured', name: 'Not featured', isFeatured: false });
  const markup = renderToStaticMarkup(<FeaturedCampaignsSection campaigns={campaigns} onSelectCampaign={() => {}} onNavigate={() => {}} />);
  assert.ok(markup.includes('LIVE NOW') && markup.includes('View all') && markup.includes('₹0'));
  assert.ok(markup.includes('LIVE test broker'));
  for (const status of ['PAUSED', 'DRAFT', 'ENDED']) assert.ok(!markup.includes(`${status} test broker`));
  assert.ok(!markup.includes('Not featured'));
  const empty = renderToStaticMarkup(<FeaturedCampaignsSection campaigns={[]} onSelectCampaign={() => {}} onNavigate={() => {}} />);
  assert.ok(empty.includes('No featured LIVE campaigns'));
  let route = '';
  const tree: any = FeaturedCampaignsSection({ campaigns: [], onSelectCampaign: () => {}, onNavigate: target => { route = target; } });
  const visit = (node: any) => { if (!node || typeof node !== 'object') return; if (node.props?.onClick) node.props.onClick(); React.Children.forEach(node.props?.children, visit); };
  visit(tree);
  assert.equal(route, 'campaigns');
});

test('admin lead enrichment is batched, resolves submitting partner and remains authorized', async t => {
  process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'client-issues-test-secret-at-least-32-characters';
  mongoose.connection.readyState = 1;
  const rows: any[] = [
    { leadId: 'LEAD-1', partnerId: 'PARTNER-1', clientName: 'Customer <One>', clientMobile: '9876543210', accountId: 'ACCOUNT-1', campaignName: 'Broker', status: 'PENDING' },
    { leadId: 'LEAD-2', partnerId: 'PARTNER-1', clientName: '', clientMobile: '', accountId: 'ACCOUNT-2', campaignName: 'Broker', status: 'PENDING' },
    { leadId: 'LEAD-3', partnerId: 'DELETED-PARTNER', accountId: 'ACCOUNT-3', campaignName: 'Broker', status: 'PENDING' },
  ];
  const chain = (value: any): any => { const query: any = { exec: async () => value }; for (const method of ['sort','skip','limit','lean','select']) query[method] = () => query; query.then = (resolve: any, reject: any) => query.exec().then(resolve, reject); return query; };
  t.mock.method(AdminUser, 'findById', () => chain({ _id: 'admin-1', status: 'ACTIVE', toJSON: () => ({ email: 'admin@test.example' }) }));
  t.mock.method(Partner, 'findById', () => chain({ _id: 'partner-1', partnerId: 'PARTNER-1', accountStatus: 'ACTIVE', toJSON: () => ({ partnerId: 'PARTNER-1', accountStatus: 'ACTIVE' }) }));
  t.mock.method(Lead, 'find', () => chain(rows));
  t.mock.method(Lead, 'countDocuments', () => chain(rows.length));
  let lookups = 0; let selectedFields = '';
  t.mock.method(Partner, 'find', (query: any) => {
    lookups++; assert.deepEqual(query.partnerId.$in, ['PARTNER-1','DELETED-PARTNER']);
    const result = chain([{ partnerId: 'PARTNER-1', fullName: 'Actual Lead Partner' }]);
    result.select = (fields: string) => { selectedFields = fields; return result; }; return result;
  });
  const campaignFind = t.mock.method(Campaign, 'find', () => chain([]));
  const server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    assert.equal((await fetch(`${base}/api/admin/leads`)).status, 401);
    const partnerToken = signToken({ id: 'partner-1', partnerId: 'PARTNER-1', role: 'PARTNER' });
    assert.equal((await fetch(`${base}/api/admin/leads`, { headers: { Authorization: `Bearer ${partnerToken}` } })).status, 403);
    assert.equal(lookups, 0);
    const adminToken = signToken({ id: 'admin-1', email: 'admin@test.example', role: 'ADMIN' });
    const response = await fetch(`${base}/api/admin/leads`, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(response.status, 200); const data = (await response.json()).data;
    assert.equal(lookups, 1); assert.equal(selectedFields, 'partnerId fullName -_id');
    assert.equal(data[0].referringPartnerName, 'Actual Lead Partner'); assert.equal(data[1].referringPartnerName, 'Actual Lead Partner'); assert.equal(data[2].referringPartnerName, null);
    const card = renderToStaticMarkup(<AdminLeadCard item={data[0]} busy={false} onAction={() => {}} />);
    assert.ok(card.includes('Customer &lt;One&gt;') && card.includes('9876543210') && card.includes('Actual Lead Partner') && card.includes('Referred By (Partner Name)'));
    assert.ok(renderToStaticMarkup(<AdminLeadCard item={data[2]} busy={false} onAction={() => {}} />).includes('Partner name unavailable'));
    const featured = await fetch(`${base}/api/public/campaigns?status=LIVE&featured=true`);
    assert.equal(featured.status, 200); assert.deepEqual((await featured.json()).data, []);
    assert.equal(campaignFind.mock.calls.at(-1)?.arguments[0].status, 'LIVE');
    assert.equal(campaignFind.mock.calls.at(-1)?.arguments[0].isFeatured, true);
    mongoose.connection.readyState = 0;
    assert.equal((await fetch(`${base}/api/public/campaigns?status=LIVE&featured=true`)).status, 503);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); mongoose.connection.readyState = 0; }
});
