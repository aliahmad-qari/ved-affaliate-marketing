import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('registration and KYC/ledger UI render without requiring signup KYC or exposing raw identifiers', async () => {
  // Explicitly disable repository Vite config: no dotenv, database connection or seed plugin.
  const vite = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, appType: 'custom' });
  try {
    const [{ AuthProvider }, { RegisterPage }, { PartnerKycForm }, { AdminPartnerLeadLedger }] = await Promise.all([
      vite.ssrLoadModule('/src/context/AuthContext.tsx'), vite.ssrLoadModule('/src/pages/RegisterPage.tsx'),
      vite.ssrLoadModule('/src/components/profile/PartnerKycForm.tsx'), vite.ssrLoadModule('/src/components/admin/AdminPartnerLeadLedger.tsx'),
    ]);
    const signup = renderToStaticMarkup(React.createElement(AuthProvider, {}, React.createElement(RegisterPage, { onNavigate: () => {} })));
    for (const label of ['Full Name', 'Mobile', 'Email', 'City', 'State', 'Password']) assert.ok(signup.includes(label));
    assert.ok(signup.includes('Complete PAN, bank and payout KYC from your Profile'));
    assert.ok(!signup.includes('Permanent Account Number (PAN)') && !signup.includes('Primary UPI ID') && !signup.includes('Bank Account (for Direct Wire)'));
    const partner = { partnerId: 'VED-PTR-TEST', fullName: 'Test Partner', kycStatus: 'REJECTED', kycRejectionReason: 'Correct <bank> details', maskedPan: 'ABCDE****F', bankDetails: { maskedAccountNumber: '********9012' } };
    const rejected = renderToStaticMarkup(React.createElement(PartnerKycForm, { partner, onSaved: async () => {} }));
    for (const field of ['PAN','Payout UPI ID','Account holder name','Bank account number','IFSC code','Bank name','Resubmit KYC']) assert.ok(rejected.includes(field));
    assert.ok(rejected.includes('Correct &lt;bank&gt; details')); assert.ok(rejected.includes('ABCDE****F') && rejected.includes('********9012'));
    assert.ok(!rejected.includes('ABCDE1234F') || rejected.includes('placeholder="ABCDE1234F"'));
    const verified = renderToStaticMarkup(React.createElement(PartnerKycForm, { partner: { ...partner, kycStatus: 'VERIFIED' }, onSaved: async () => {} }));
    assert.ok(verified.includes('KYC verified')); assert.ok(!verified.includes('<input'));
    const ledger = renderToStaticMarkup(React.createElement(AdminPartnerLeadLedger, { partner, campaigns: [{ _id: 'campaign-id', name: 'Historical campaign', status: 'PAUSED' }], onBack: () => {} }));
    for (const label of ['Partner Lead Ledger','VED-PTR-TEST','All Campaigns','Historical campaign','PAUSED','PENDING','VERIFIED','APPROVED','REJECTED','PAID','From (local date)','To (local date)','Reset']) assert.ok(ledger.includes(label));
    assert.ok(ledger.includes('sm:grid-cols-2') && ledger.includes('lg:grid-cols-3'));
  } finally { await vite.close(); }
});
