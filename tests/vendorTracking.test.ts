import assert from 'node:assert/strict';
import test from 'node:test';
import { preserveVendorTrackingUrl } from '../server/utils/vendorTracking.ts';

test('mStock referral preservation is limited to its own domains', () => {
  for (const host of ['mstock.com', 'ekyc.mstock.com', 'referralapi.mstock.com']) {
    assert.equal(preserveVendorTrackingUrl(new URL(`https://${host}/`)), true);
  }
  for (const host of ['mstock.com.example.org', 'fake-mstock.com', 'vendor.example', 'wa.me']) {
    assert.equal(preserveVendorTrackingUrl(new URL(`https://${host}/`)), false);
  }
});
