import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../server/app.ts';
import { Partner } from '../server/models/Partner.ts';
import { Lead } from '../server/models/Lead.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { WalletTransaction } from '../server/models/WalletTransaction.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { Notification } from '../server/models/Notification.ts';
import { AppSetting } from '../server/models/AppSetting.ts';
import { signToken } from '../server/utils/jwt.ts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminLeadDecisionDialog } from '../src/components/admin/AdminLeadDecisionDialog.tsx';
import { AdminLeadCard } from '../src/components/admin/AdminLeadCard.tsx';

const clone=(value:any)=>structuredClone(value);
const plain=(value:any):any=>Array.isArray(value)?value.map(plain):value?.toObject?value.toObject():value?.toJSON?value.toJSON():value;
const chain=(value:any):any=>{let lean=false; const q:any={exec:async()=>{const result=typeof value==='function'?await value():value;return lean?plain(result):result;}};for(const key of ['select','session','sort','skip','limit'])q[key]=()=>q;q.lean=()=>{lean=true;return q;};q.then=(resolve:any,reject:any)=>q.exec().then(resolve,reject);return q;};
const matches=(row:any,query:any):boolean=>Object.entries(query).every(([key,value]:any)=>{
  if(key==='$or')return value.some((item:any)=>matches(row,item));if(key==='$nor')return !value.some((item:any)=>matches(row,item));
  const found=key.split('.').reduce((object:any,field:string)=>object?.[field],row);
  if(value instanceof RegExp)return value.test(found||'');
  if(value&&typeof value==='object'){
    if('$in'in value)return value.$in.includes(found);if('$lte'in value)return found!=null&&new Date(found)<=value.$lte;if('$ne'in value)return found!==value.$ne;
  }return String(found)===String(value);
});

test('rejected archive, required reason options and transactional one-time approval reversals preserve financial history',async t=>{
  const now=new Date('2026-10-17T04:00:00Z');t.mock.timers.enable({apis:['Date'],now});
  process.env.NODE_ENV='test';process.env.JWT_SECRET='additional-issues-test-secret-32-characters';mongoose.connection.readyState=1;
  const partner={_id:'507f1f77bcf86cd799439090',partnerId:'VED-PTR-REVERSAL',fullName:'Test Partner',accountStatus:'ACTIVE',kycStatus:'VERIFIED'};
  const baseLead={partnerId:partner.partnerId,campaignId:'broker',campaignName:'Broker',clientName:'Test Customer',clientMobile:'9876543210',accountId:'TEST',createdAt:now,updatedAt:now,currency:'INR'};
  let leads:any[]=[
    {...baseLead,_id:'507f1f77bcf86cd799439001',leadId:'APPROVAL-A',status:'APPROVED',payoutSnapshot:250,approvedAt:now},
    {...baseLead,_id:'507f1f77bcf86cd799439002',leadId:'APPROVAL-B',status:'APPROVED',payoutSnapshot:300,approvedAt:now},
    {...baseLead,_id:'507f1f77bcf86cd799439003',leadId:'PAID-C',status:'PAID',payoutSnapshot:200,paidAt:now},
    {...baseLead,_id:'507f1f77bcf86cd799439004',leadId:'OLD-REJECTED',status:'REJECTED',payoutSnapshot:0,rejectedAt:new Date(now.getTime()-8*86400000)},
    {...baseLead,_id:'507f1f77bcf86cd799439005',leadId:'RECENT-REJECTED',status:'REJECTED',payoutSnapshot:0,rejectedAt:new Date(now.getTime()-86400000)},
    {...baseLead,_id:'507f1f77bcf86cd799439006',leadId:'LEGACY-REJECTED',status:'REJECTED',payoutSnapshot:0},
    {...baseLead,_id:'507f1f77bcf86cd799439007',leadId:'SEVEN-DAY-BOUNDARY',status:'REJECTED',payoutSnapshot:0,rejectedAt:new Date(now.getTime()-7*86400000)},
    ...[8,9,10].map(id=>({...baseLead,_id:`507f1f77bcf86cd7994390${String(id).padStart(2,'0')}`,leadId:`PENDING-${id}`,status:'PENDING',payoutSnapshot:100})),
  ];
  let transactions:any[]=leads.slice(0,3).map((lead,i)=>({transactionId:`ORIGINAL-${i}`,partnerId:partner.partnerId,type:'LEAD_EARNING',amount:lead.payoutSnapshot,status:i===2?'PROCESSED':'AVAILABLE',referenceType:'LEAD',referenceId:lead._id,idempotencyKey:`LEAD_EARNING:${lead._id}`,description:'Original commission',createdAt:now}));
  transactions.push({transactionId:'REFERRAL',partnerId:partner.partnerId,type:'REFERRAL_REWARD',amount:50,status:'AVAILABLE',referenceType:'REFERRAL',referenceId:'referred',description:'Original referral reward',createdAt:now},{transactionId:'RESERVED',partnerId:partner.partnerId,type:'WITHDRAWAL',amount:100,status:'PENDING',referenceType:'WITHDRAWAL_REQUEST',referenceId:'RESERVED',description:'Reserved request',createdAt:now});
  const originalEarning=JSON.stringify(transactions[0]),originalReferral=JSON.stringify(transactions[3]);
  const audits:any[]=[],notices:any[]=[];let failSave=false,revision=0,queue=Promise.resolve();
  const leadDoc=(row:any)=>row?{...clone(row),async save(){if(failSave)throw new Error('Simulated atomic failure');const {save,toJSON,...record}=this;leads[leads.findIndex(item=>item._id===record._id)]=clone(record);return this;},toJSON(){const {save,toJSON,...record}=this;return clone(record);}}:null;
  t.mock.method(mongoose,'startSession',async()=>({withTransaction:async(fn:()=>Promise<void>)=>{
    const preceding=queue;let release:()=>void;queue=new Promise<void>(resolve=>{release=resolve;});await preceding;
    const before=[clone(leads),clone(transactions),audits.length,notices.length,revision];
    try{await fn();}catch(error){leads=before[0] as any[];transactions=before[1] as any[];audits.length=before[2] as number;notices.length=before[3] as number;revision=before[4] as number;throw error;}finally{release!();}
  },endSession:async()=>{}}) as any);
  t.mock.method(AdminUser,'findById',()=>chain({_id:'admin',status:'ACTIVE',toJSON:()=>({email:'admin@test.example'})}));
  t.mock.method(Partner,'findById',()=>chain(partner));t.mock.method(Partner,'findOne',()=>chain(partner));t.mock.method(Partner,'find',()=>chain([partner]));
  t.mock.method(Partner,'updateOne',(_query:any,_update:any,options:any)=>{assert.ok(options?.session);revision++;return chain({matchedCount:1});});
  t.mock.method(Lead,'findById',(id:string)=>chain(()=>leadDoc(leads.find(row=>row._id===id))));
  t.mock.method(Lead,'find',(query:any)=>chain(()=>leads.filter(row=>matches(row,query)).map(leadDoc)));
  t.mock.method(Lead,'countDocuments',(query:any)=>chain(()=>leads.filter(row=>matches(row,query)).length));
  t.mock.method(WalletTransaction,'findOne',(query:any)=>chain(()=>{const row=transactions.find(item=>matches(item,query));return row?new WalletTransaction(row):null;}));
  t.mock.method(WalletTransaction,'find',(query:any)=>chain(()=>transactions.filter(row=>matches(row,query)).map(row=>new WalletTransaction(row))));
  t.mock.method(WalletTransaction,'create',async(rows:any[],options:any)=>{assert.ok(options.session);return Promise.all(rows.map(async row=>{if(transactions.some(tx=>tx.idempotencyKey===row.idempotencyKey))throw Object.assign(new Error('Duplicate'),{code:11000});const doc=new WalletTransaction({...row,createdAt:now,updatedAt:now});await doc.validate();transactions.push(doc.toObject());return doc;}));});
  t.mock.method(AuditLog,'create',async(rows:any)=>{audits.push(...(Array.isArray(rows)?rows:[rows]));return rows;});
  t.mock.method(AuditLog,'find',(query:any)=>chain(()=>audits.filter(row=>matches(row,query))));
  t.mock.method(Notification,'create',async(rows:any[])=>{notices.push(...rows);return rows;});
  t.mock.method(AppSetting,'findOne',()=>chain({minimumWithdrawalAmount:200}));
  const app=createApp().listen(0,'127.0.0.1');await once(app,'listening');const base=`http://127.0.0.1:${(app.address() as any).port}/api`;
  const admin=signToken({id:'admin',email:'admin@test.example',role:'ADMIN'}),owner=signToken({id:partner._id,partnerId:partner.partnerId,role:'PARTNER'});
  const request=(path:string,body?:any,token=admin)=>fetch(base+path,{method:body?'PATCH':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const reverse=`/admin/leads/${leads[0]._id}/reverse-approval`;
  try{
    assert.equal((await fetch(base+reverse,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'Wrong approval'})})).status,401);
    assert.equal((await request(reverse,{reason:'Wrong approval'},owner)).status,403);
    const beforeArchive=JSON.stringify(leads);
    const main=(await(await request('/admin/leads')).json()).data.map((row:any)=>row.leadId);assert.ok(!main.includes('OLD-REJECTED')&&!main.includes('SEVEN-DAY-BOUNDARY'));assert.ok(main.includes('RECENT-REJECTED')&&main.includes('LEGACY-REJECTED'));
    const archived=(await(await request('/admin/leads?status=ARCHIVED')).json()).data.map((row:any)=>row.leadId);assert.deepEqual(archived.sort(),['OLD-REJECTED','SEVEN-DAY-BOUNDARY']);
    assert.equal((await(await request('/admin/leads?status=REJECTED')).json()).total,4);assert.equal(JSON.stringify(leads),beforeArchive);
    assert.equal((await request(reverse,{reason:''})).status,400);
    failSave=true;assert.equal((await request(reverse,{reason:'Wrong approval'})).status,500);failSave=false;
    assert.equal(transactions.length,5);assert.equal(leads[0].status,'APPROVED');assert.equal(audits.length,0);assert.equal(notices.length,0);
    const attempts=await Promise.all([request(reverse,{reason:'Wrong approval',amount:999999}),request(reverse,{reason:'Duplicate retry'})]);assert.deepEqual(attempts.map(row=>row.status).sort(),[200,409]);
    const success=await attempts.find(row=>row.status===200)!.json();assert.equal(success.data.previousBalance,500);assert.equal(success.data.availableBalance,250);assert.equal(success.data.adjustment.amount,250);
    assert.equal(leads[0].status,'REJECTED');assert.equal(leads[0].payoutSnapshot,250);assert.ok(leads[0].approvedAt);assert.equal(transactions.length,6);assert.equal(JSON.stringify(transactions[0]),originalEarning);assert.equal(JSON.stringify(transactions[3]),originalReferral);assert.equal(transactions[5].direction,'DEBIT');assert.equal(transactions[5].balanceBefore,500);assert.equal(transactions[5].balanceAfter,250);
    assert.equal((await request(reverse,{reason:'Repeat reversal'})).status,409);assert.equal((await request(`/admin/leads/${leads[1]._id}/reverse-approval`,{reason:'Reserved funds'})).status,409);assert.equal((await request(`/admin/leads/${leads[2]._id}/reverse-approval`,{reason:'Paid already'})).status,409);
    assert.equal((await request(`/admin/leads/${leads[0]._id}/paid`,{paymentReference:'Cannot pay reversed lead'})).status,409);
    const historyAudit=audits.find(row=>row.action==='LEAD_APPROVAL_REVERSED');assert.equal(historyAudit.adminEmail,'admin@test.example');assert.equal(historyAudit.before.availableBalance,500);assert.equal(historyAudit.after.adjustmentAmount,-250);
    const wallet=(await(await request('/partner/wallet',undefined,owner)).json()).data;assert.equal(wallet.availableBalance,250);assert.equal(wallet.totalEarned,550);assert.equal(wallet.transactions.find((tx:any)=>tx.transactionId==='ORIGINAL-0').reversedBy,transactions[5].transactionId);assert.ok(!JSON.stringify(wallet).includes('admin@test.example'));
    const adjustmentPath=`/admin/partners/${partner._id}/balance-adjustments`;assert.equal((await request(adjustmentPath,undefined,owner)).status,403);const history=await(await request(adjustmentPath)).json();assert.equal(history.availableBalance,250);assert.equal(history.data.length,1);assert.equal(history.data[0].amount,250);assert.equal(history.data[0].adjustmentAdminEmail,'admin@test.example');
    const earningsReport=await(await request('/admin/reports/earnings.csv')).text();assert.ok(earningsReport.includes('signedAmount')&&earningsReport.includes('DEBIT')&&earningsReport.includes('"-250"'));assert.ok(!earningsReport.includes("'-250"));
    for(const [index,code]of [[7,'NO_LEAD_FOUND'],[8,'DUPLICATE_LEAD'],[9,'OTHER']]as const){const path=`/admin/leads/${leads[index]._id}/review`;if(code==='OTHER'){assert.equal((await request(path,{status:'REJECTED',rejectionReasonCode:code})).status,400);assert.equal((await request(path,{status:'REJECTED',rejectionReasonCode:'INVALID'})).status,400);}const body:any={status:'REJECTED',rejectionReasonCode:code,...(code==='OTHER'?{rejectionReason:'Incomplete information'}:{})};assert.equal((await request(path,body)).status,200);assert.equal(leads[index].rejectionReasonCode,code);assert.ok(leads[index].rejectionReason);}
    assert.ok(audits.some(row=>row.after?.rejectionReasonCode==='NO_LEAD_FOUND'));assert.equal(transactions.length,6);assert.ok(revision>=1);
  }finally{app.closeAllConnections();await new Promise<void>(resolve=>app.close(()=>resolve()));mongoose.connection.readyState=0;t.mock.timers.reset();}
});

test('admin rejection selector and reversal confirmation expose only status-appropriate actions',()=>{
  const props={leadId:'TEST-LEAD',amount:250,busy:false,onCancel:()=>{},onConfirm:()=>{}};
  const reject=renderToStaticMarkup(React.createElement(AdminLeadDecisionDialog,{...props,kind:'reject'}));
  for(const label of ['Choose a reason','No Lead Found','Duplicate Lead','Other','Confirm rejection'])assert.ok(reject.includes(label));
  assert.ok(reject.includes('required=""')&&reject.includes('disabled=""'));
  const reversal=renderToStaticMarkup(React.createElement(AdminLeadDecisionDialog,{...props,kind:'reverse'}));
  for(const label of ['Reverse Approval','₹250','Reason for reversal','separate debit adjustment'])assert.ok(reversal.includes(label));
  assert.ok(reversal.includes('minLength="3"')&&reversal.includes('maxLength="1000"'));
  const item:any={_id:'test',leadId:'TEST-LEAD',clientName:'Test',partnerId:'TEST-PARTNER',campaignName:'Campaign',accountId:'ACCOUNT',payoutSnapshot:250,status:'APPROVED'};
  assert.ok(renderToStaticMarkup(React.createElement(AdminLeadCard,{item,busy:false,onAction:()=>{}})).includes('Reverse Approval'));
  assert.ok(!renderToStaticMarkup(React.createElement(AdminLeadCard,{item:{...item,status:'PAID'},busy:false,onAction:()=>{}})).includes('Reverse Approval'));
});
