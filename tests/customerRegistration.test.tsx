import assert from 'node:assert/strict';
import test from 'node:test';
import { registrationDocument } from '../server/utils/registrationView.ts';

test('new registration has accessible native controls and consent; no database dependency', () => {
  const html = registrationDocument({ token: 'test-opaque-token', action: '/api/public/campaigns/test/go', error: '<unsafe>' });
  for (const value of ['Unlock', 'Success', 'CONTINUE SECURELY', 'name="consent"', 'htmlFor']) {
    if (value !== 'htmlFor') assert.ok(html.includes(value));
  }
  assert.ok(html.includes('Enter your details below to continue'));
  assert.ok(!html.includes('we will redirect to your'));
  assert.ok(html.includes('I agree to the use of my contact details for application updates.'));
  assert.ok(html.includes('for="customer-name"'));
  assert.ok(html.includes('for="customer-mobile"'));
  assert.ok(html.includes('&lt;unsafe&gt;'));
  assert.ok(html.includes("form.dataset.submitting"));
  assert.ok(html.includes("button.querySelector('span').textContent='SUBMITTING...'"));
  assert.ok(!html.includes('â€¦'));
});

test('already registered view shows the popup and honors only its server-provided destination', () => {
  const html = registrationDocument({ registered: true, registeredRedirectUrl: 'https://vendor.example/campaign?clickid=synthetic' });
  for (const value of ['Already Registered', 'This mobile number is already registered for this campaign.', 'data-duplicate-countdown="true">3</strong>', 'window.location.replace("https://vendor.example/campaign?clickid=synthetic")', 'href="/"']) assert.ok(html.includes(value));
  assert.ok(!html.includes('PRIVATE CUSTOMER') && !html.includes('9876543210'));
  for (const value of ['PRIVATE CUSTOMER', '9876543210', 'name="consent"', 'name="captureToken"', 'data-registration-form']) assert.ok(!html.includes(value));
  assert.ok(html.includes('class="registration-button registration-home-button" href="/"'));
  assert.equal((html.match(/disabled=""/g) || []).length, 0);
  assert.ok(html.includes('registration-confirmation-icon'));
  assert.ok(html.includes('name="referrer" content="strict-origin-when-cross-origin"'));
});

test('registration styling stays responsive at mobile widths and uses readable input sizing', () => {
  const html = registrationDocument({ token: 'test-opaque-token', action: '/api/public/campaigns/test/go' });
  assert.ok(html.includes('@media (max-width: 620px)'));
  assert.ok(html.includes('@media (max-width: 360px)'));
  assert.ok(html.includes('width: calc(100vw - 28px)'));
  assert.ok(html.includes('grid-template-columns: 22px minmax(0, 1fr)'));
  assert.ok(html.includes('height: 49px; padding: 10px 35px 10px 11px'));
  assert.ok(html.includes('min-height: 250px'));
  assert.ok(html.includes('grid-template-columns: 38px minmax(0, 1fr)'));
  assert.ok(html.includes('font-size: clamp(16px, 2.15vw, 23px)'));
});
