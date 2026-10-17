import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../server/app.ts';
import { Campaign } from '../server/models/Campaign.ts';
import { Lead } from '../server/models/Lead.ts';
import { Partner } from '../server/models/Partner.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { AppSetting } from '../server/models/AppSetting.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { WalletTransaction } from '../server/models/WalletTransaction.ts';
import { signToken } from '../server/utils/jwt.ts';
import { DEFAULT_CAMPAIGN_CATEGORIES } from '../shared/campaignCategories.ts';

function matches(row: any, query: any): boolean {
  return Object.entries(query).every(([key,value]: any) => {
    if (key === '$or') return value.some((part: any) => matches(row, part));
    const found = key.split('.').reduce((object: any, field: string) => object?.[field], row);
    if (value instanceof RegExp) return value.test(found || '');
    if (value && typeof value === 'object' && '$in' in value) return value.$in.includes(String(found));
    if (value && typeof value === 'object' && '$regex' in value) return new RegExp(value.$regex, value.$options).test(found || '');
    return String(found) === String(value);
  });
}
function chain(value: any): any {
  const query: any = { exec: async () => typeof value === 'function' ? value() : value };
  for (const method of ['select','sort','lean']) query[method] = () => query;
  query.then = (resolve: any, reject: any) => query.exec().then(resolve,reject);
  return query;
}

test('partner CSV privacy, historical campaigns, complete exports, categories, site settings and wallet totals', async t => {
  process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'website-launch-test-secret-32-characters'; mongoose.connection.readyState = 1;
  const partner = { _id: '507f1f77bcf86cd799439099', partnerId: 'VED-PTR-REPORT', accountStatus: 'ACTIVE', kycStatus: 'VERIFIED' };
  const campaignRows: any[] = DEFAULT_CAMPAIGN_CATEGORIES.map((category,i) => ({ _id: `507f1f77bcf86cd79943900${i}`, slug: `broker-${i}`, name: `Broker ${i}`, companyName: 'Test Broker', campaignType: category, status: i === 2 ? 'PAUSED' : i === 3 ? 'ENDED' : i === 4 ? 'DRAFT' : 'LIVE', requiredAction: 'Submit application', description: 'A test campaign', payoutTerms: 'Admin review', payout: 250 }));
  const statuses = ['PENDING','VERIFIED','APPROVED','REJECTED','PAID'];
  const leads: any[] = Array.from({ length: 125 }, (_,i) => ({ _id: `lead-${i}`, leadId: `LEAD-${i}`, partnerId: partner.partnerId, campaignId: i % 2 ? campaignRows[0].slug : campaignRows[0]._id, campaignName: 'Broker 0', clientName: i === 0 ? '=2+2' : `Customer "${i}"`, clientMobile: '9876543210', accountId: `ACCOUNT.${i}`, createdAt: new Date('2026-10-16T10:30:00Z'), updatedAt: new Date('2026-10-17T09:00:00Z'), status: statuses[i%5], payoutSnapshot: 250, currency: 'INR' }));
  leads.push({ ...leads[0], leadId: 'HISTORICAL', campaignId: campaignRows[3].slug, campaignName: campaignRows[3].name, status: 'APPROVED' });
  leads.push({ ...leads[0], leadId: 'OTHER-PARTNER-SECRET', partnerId: 'VED-PTR-OTHER', clientName: 'PRIVATE CUSTOMER', clientMobile: '9999999999', status: 'APPROVED' });
  const original = JSON.stringify(leads);
  let settings: any = { key: 'business', minimumWithdrawalAmount: 200, tickerMessage: 'Launch updates from Admin', campaignCategories: [...DEFAULT_CAMPAIGN_CATEGORIES], privateValue: 'DO NOT EXPOSE' };
  const audits: any[] = [];
  t.mock.method(AdminUser, 'findById', () => chain({ _id: 'admin', status: 'ACTIVE', toJSON: () => ({ email: 'admin@test.example' }) }));
  t.mock.method(Partner, 'findById', () => chain(partner));
  t.mock.method(Partner, 'countDocuments', () => chain(7));
  t.mock.method(AppSetting, 'findOne', () => chain(() => ({ ...settings })));
  t.mock.method(AppSetting, 'findOneAndUpdate', (_query: any, update: any) => chain(() => { settings = { ...settings, ...update.$set, updatedAt: new Date().toISOString() }; return settings; }));
  t.mock.method(AuditLog, 'create', async (row: any) => { audits.push(row); return row; });
  t.mock.method(Campaign, 'findOne', (query: any) => chain(campaignRows.find(row => matches(row,query)) || null));
  t.mock.method(Campaign, 'find', (query: any = {}) => chain(campaignRows.filter(row => matches(row,query))));
  t.mock.method(Campaign, 'countDocuments', (query: any = {}) => chain(campaignRows.filter(row => matches(row,query)).length));
  t.mock.method(Campaign, 'create', async (input: any) => { const doc = new Campaign(input); await doc.validate(); campaignRows.push(doc.toObject()); return doc; });
  t.mock.method(Lead, 'distinct', (field: string, query: any) => chain([...new Set(leads.filter(row => matches(row,query)).map(row => row[field]))]));
  t.mock.method(Lead, 'countDocuments', (query: any = {}) => chain(leads.filter(row => matches(row,query)).length));
  t.mock.method(Lead, 'find', (query: any) => {
    const found = leads.filter(row => matches(row,query)); let skip = 0, limit = found.length;
    const result = chain(() => found.slice(skip,skip+limit).map(row => ({ ...row, toJSON: () => ({ ...row }) })));
    result.skip = (value: number) => { skip=value; return result; }; result.limit = (value: number) => { limit=value; return result; };
    result.cursor = () => ({ async *[Symbol.asyncIterator]() { for (const row of found) yield { ...row }; }, close: async () => {} });
    return result;
  });
  t.mock.method(Lead, 'aggregate', () => chain([{ amount: 6250 }]));
  t.mock.method(WalletTransaction, 'aggregate', () => chain([{ amount: 1000 }]));
  t.mock.method(WalletTransaction, 'find', () => chain([{ partnerId: partner.partnerId, type: 'WITHDRAWAL', amount: 1000, status: 'PAID' }, { partnerId: partner.partnerId, type: 'WITHDRAWAL', amount: 200, status: 'PENDING' }]));
  const app = createApp().listen(0,'127.0.0.1'); await once(app,'listening'); const base=`http://127.0.0.1:${(app.address() as any).port}/api`;
  const ownerToken=signToken({ id: partner._id, partnerId: partner.partnerId, role: 'PARTNER' });
  const adminToken=signToken({ id: 'admin', role: 'ADMIN', email: 'admin@test.example' });
  const request=(path: string, token?: string, body?: any) => fetch(base+path,{ method: body ? 'PATCH' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type':'application/json' } : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) });
  try {
    const path='/partner/reports/leads.csv';
    assert.equal((await request(path)).status,401); assert.equal((await request(path,adminToken)).status,403);
    const allResponse=await request(path+'?partnerId=VED-PTR-OTHER',ownerToken); assert.equal(allResponse.status,200); assert.ok(allResponse.headers.get('content-type')?.includes('text/csv')); assert.equal(allResponse.headers.get('cache-control'),'private, no-store');
    const all=await allResponse.text(); assert.equal(all.trim().split('\r\n').length,127); assert.ok(all.includes('******3210')); assert.ok(!all.includes('9876543210') && !all.includes('PRIVATE CUSTOMER') && !all.includes('OTHER-PARTNER-SECRET')); assert.ok(all.includes("'=2+2")); assert.ok(all.includes('Customer ""1""')); assert.ok(all.includes('2026-10-16T10:30:00.000Z'));
    for (const categoryId of [campaignRows[0]._id,campaignRows[0].slug]) {
      const csv=await (await request(`${path}?campaignId=${categoryId}`,ownerToken)).text(); assert.equal(csv.trim().split('\r\n').length,126); assert.ok(!csv.includes('HISTORICAL'));
    }
    const approved=await (await request(`${path}?campaignId=${campaignRows[0]._id}&status=APPROVED`,ownerToken)).text(); assert.equal(approved.trim().split('\r\n').length,26);
    const search=await (await request(`${path}?campaignId=${campaignRows[0]._id}&status=PENDING&search=ACCOUNT.0`,ownerToken)).text(); assert.equal(search.trim().split('\r\n').length,2);
    const matchingList=await(await request(`/partner/leads?campaignId=${campaignRows[0]._id}&status=PENDING&search=ACCOUNT.0`,ownerToken)).json();assert.equal(matchingList.total,1);
    const list=await (await request(`/partner/leads?campaignId=${campaignRows[0]._id}`,ownerToken)).json(); assert.equal(list.total,125); assert.equal(list.data.length,50);
    const lastPage=await (await request(`/partner/leads?campaignId=${campaignRows[0]._id}&page=3`,ownerToken)).json(); assert.equal(lastPage.data.length,25);
    const historic=await (await request(`${path}?campaignId=${campaignRows[3]._id}`,ownerToken)).text(); assert.ok(historic.includes('HISTORICAL'));
    const empty=await (await request(`${path}?campaignId=${campaignRows[2]._id}`,ownerToken)).text(); assert.equal(empty.trim().split('\r\n').length,1);
    assert.equal((await request(`${path}?campaignId=unknown`,ownerToken)).status,400);
    const options=(await (await request('/partner/lead-campaigns',ownerToken)).json()).data; assert.ok(options.some((row: any)=>row.status==='ENDED')); assert.ok(options.some((row: any)=>row.status==='PAUSED')); assert.ok(!options.some((row: any)=>row.status==='DRAFT'));
    const publicSettings=await (await request('/public/site-settings')).json(); assert.deepEqual(publicSettings.data.campaignCategories,[...DEFAULT_CAMPAIGN_CATEGORIES]); assert.ok(!JSON.stringify(publicSettings).includes('DO NOT EXPOSE')); assert.equal(publicSettings.data.tickerMessage,settings.tickerMessage);
    assert.equal((await request('/admin/settings',ownerToken,{ tickerMessage:'Unauthorized' })).status,403);
    assert.equal((await request('/admin/settings',adminToken,{ tickerMessage:'New launch message' })).status,200); assert.equal(settings.minimumWithdrawalAmount,200);
    assert.equal((await (await request('/public/site-settings')).json()).data.tickerMessage,'New launch message');
    assert.equal((await request('/admin/settings',adminToken,{ minimumWithdrawalAmount:199 })).status,400);
    assert.equal((await request('/admin/settings',adminToken,{ tickerMessage:'x'.repeat(501) })).status,400);
    assert.equal((await request('/admin/settings',adminToken,{ campaignCategories:['<script>'] })).status,400);
    assert.equal((await request('/admin/settings',adminToken,{ campaignCategories:['Travel Finance','travel finance'] })).status,200); assert.equal(settings.campaignCategories.length,7);
    const custom=(await (await request('/public/site-settings')).json()).data.campaignCategories; assert.ok(custom.includes('Travel Finance')); assert.equal(custom.filter((name:string)=>name.toLowerCase()==='travel finance').length,1);
    for (const [i,category] of [...DEFAULT_CAMPAIGN_CATEGORIES,'Travel Finance'].entries()) {
      const created=await fetch(base+'/admin/campaigns',{ method:'POST',headers:{ Authorization:`Bearer ${adminToken}`,'Content-Type':'application/json' },body:JSON.stringify({ name:'Category test',slug:`category-test-${i}`,companyName:'Test',campaignType:category,description:'Test description',requiredAction:'Test action',status:'DRAFT' }) }); assert.equal(created.status,201);
    }
    const invalidCategory=await fetch(base+'/admin/campaigns',{ method:'POST',headers:{ Authorization:`Bearer ${adminToken}`,'Content-Type':'application/json' },body:JSON.stringify({ campaignType:'Unconfigured category' }) }); assert.equal(invalidCategory.status,400);
    const stats=(await (await request('/public/stats')).json()).data; assert.equal(stats.liveCampaigns,3); assert.equal(stats.activePartners,7); assert.equal(stats.totalPayouts,7250);
    const wallet=(await (await request('/partner/wallet',ownerToken)).json()).data; assert.equal(wallet.pendingBalance,12500); assert.equal(wallet.totalEarned,12750); assert.equal(wallet.availableBalance,5300); assert.equal(wallet.totalWithdrawn,1000); assert.equal(wallet.totalDisbursed,7250); assert.equal(wallet.minimumWithdrawal,200);
    assert.equal(JSON.stringify(leads),original); assert.ok(audits.some(row=>row.action==='BUSINESS_SETTINGS_UPDATED'));
    mongoose.connection.readyState=0; assert.equal((await request('/public/site-settings')).status,503);
  } finally { app.closeAllConnections(); await new Promise<void>(resolve=>app.close(()=>resolve())); mongoose.connection.readyState=0; }
});
