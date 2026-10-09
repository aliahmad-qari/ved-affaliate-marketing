import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminLeadCard } from '../src/components/admin/AdminLeadCard.tsx';
import { campaignCaptureUrl, campaignSlugFromPath } from '../src/lib/campaignTracking.ts';
import { LeadItem } from '../src/types/partner.ts';

test('shared links open capture independently of the campaign list and preserve attribution', () => {
  assert.equal(campaignCaptureUrl('/campaigns/new-campaign', '?ref=REF-123&pid=VED-PTR-123'), '/api/public/campaigns/new-campaign/go?ref=REF-123&pid=VED-PTR-123');
  assert.equal(campaignCaptureUrl('/CAMPAIGNS/New-Campaign/', '?ref=REF-123&pid=VED-PTR-123', 'https://api.example/'), 'https://api.example/api/public/campaigns/new-campaign/go?ref=REF-123&pid=VED-PTR-123');
  assert.equal(campaignCaptureUrl('/campaigns/sample', '?ref=REF-123'), '/api/public/campaigns/sample/go?ref=REF-123');
  assert.equal(campaignCaptureUrl('/campaigns/sample', '?pid=VED-PTR-123&destination=https://evil.example'), '/api/public/campaigns/sample/go?pid=VED-PTR-123');
  assert.equal(campaignCaptureUrl('/campaigns/sample', ''), null);
  assert.equal(campaignCaptureUrl('/register', '?ref=REF-123'), null);
  assert.equal(campaignCaptureUrl('/campaigns', '?ref=REF-123'), null);
  assert.equal(campaignSlugFromPath('/campaigns/%ZZ'), null, 'Malformed URL encoding must not crash the app');
});

const baseLead: LeadItem = {
  _id: 'lead-1', leadId: 'VED-LD-TEST', partnerId: 'VED-PTR-123', campaignId: 'campaign-1',
  campaignName: 'Sample <Campaign>', clientName: 'Customer <Name>', clientMobile: '9876543210',
  accountId: 'ENQUIRY:12345678-1234-1234-1234-123456789012', action: 'Open account',
  status: 'PENDING', payoutSnapshot: 250, currency: 'INR',
  submittedData: { source: 'CUSTOMER_FORM', processStatus: 'IN_PROCESS' },
};
const render = (changes: Partial<LeadItem> = {}, busy = false) => renderToStaticMarkup(
  <AdminLeadCard item={{ ...baseLead, ...changes }} busy={busy} onAction={() => {}} />,
);

test('admin enquiry card renders the right progress and review controls', () => {
  const inProcess = render();
  assert.ok(inProcess.includes('Customer Enquiry') && inProcess.includes('In Process'));
  assert.ok(inProcess.includes('>Verify</button>') && inProcess.includes('>Approve</button>') && inProcess.includes('>Reject</button>'));
  assert.ok(inProcess.includes('Customer &lt;Name&gt;') && inProcess.includes('Sample &lt;Campaign&gt;'));
  assert.ok(inProcess.includes('Account ID:') && inProcess.includes(baseLead.accountId), 'Generated reference IDs remain visible in the approved card layout');
  assert.ok(inProcess.includes('min-w-0'));
  const notSubmitted = render({ submittedData: { source: 'CUSTOMER_FORM', processStatus: 'NOT_SUBMITTED' } });
  assert.ok(notSubmitted.includes('value="NOT_SUBMITTED" selected=""'));
  assert.ok(!notSubmitted.includes('>Verify</button>') && !notSubmitted.includes('>Approve</button>'));
  assert.ok(notSubmitted.includes('>Reject</button>'));
  const rejected = render({ status: 'REJECTED', rejectionReason: 'Not eligible' });
  assert.ok(rejected.includes('REJECTED') && rejected.includes('Not eligible'));
  assert.ok(!rejected.includes('<select') && !rejected.includes('>Approve</button>'));
  const approved = render({ status: 'APPROVED' });
  assert.ok(approved.includes('>Mark Paid</button>') && !approved.includes('<select'));
  const paid = render({ status: 'PAID' });
  assert.ok(!paid.includes('>Mark Paid</button>'));
  const busy = render({}, true);
  assert.equal((busy.match(/disabled=""/g) || []).length, 5, 'Disable progress and review actions while saving');
});

test('manual lead cards retain their existing controls without enquiry progress fields', () => {
  const manual = render({ submittedData: { notes: 'Manual submission' }, accountId: 'ACCOUNT-123' });
  assert.ok(!manual.includes('Application progress') && !manual.includes('Customer Enquiry'));
  assert.ok(manual.includes('>Verify</button>') && manual.includes('>Approve</button>') && manual.includes('>Reject</button>') && manual.includes('>Adjust Payout</button>'));
});
