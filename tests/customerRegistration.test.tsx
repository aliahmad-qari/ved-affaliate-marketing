import assert from 'node:assert/strict';
import test from 'node:test';
import { registrationDocument } from '../server/utils/registrationView.ts';

test('new registration has accessible native controls and consent; no database dependency', () => {
  const html = registrationDocument({ token: 'test-opaque-token', action: '/api/public/campaigns/test/go', error: '<unsafe>' });
  for (const value of ['Unlock', 'Success', 'CONTINUE SECURELY', 'name="consent"', 'htmlFor']) {
    if (value !== 'htmlFor') assert.ok(html.includes(value));
  }
  assert.ok(html.includes('for="customer-name"'));
  assert.ok(html.includes('for="customer-mobile"'));
  assert.ok(html.includes('&lt;unsafe&gt;'));
  assert.ok(html.includes("form.dataset.submitting"));
  assert.ok(html.includes("button.querySelector('span').textContent='SUBMITTING...'"));
  assert.ok(!html.includes('â€¦'));
});

test('already registered view shows a private-safe message and returns to the VED homepage', () => {
  const html = registrationDocument({ registered: true });
  for (const value of ['Already Registered', 'This mobile number is already registered for this campaign.', 'data-duplicate-countdown="true">3</strong>', 'window.location.replace(\'/\')', 'href="/"']) assert.ok(html.includes(value));
  assert.ok(!html.includes('PRIVATE CUSTOMER') && !html.includes('9876543210'));
  for (const value of ['PRIVATE CUSTOMER', '9876543210', 'name="consent"', 'name="captureToken"', 'data-registration-form']) assert.ok(!html.includes(value));
  assert.ok(html.includes('class="registration-button registration-home-button" href="/"'));
  assert.equal((html.match(/disabled=""/g) || []).length, 0);
  assert.ok(html.includes('registration-confirmation-icon'));
  assert.ok(html.includes('name="referrer" content="no-referrer"'));
});

test('registration styling keeps the campaign form compact and mobile placeholders readable', () => {
  const html = registrationDocument({ token: 'test-opaque-token', action: '/api/public/campaigns/test/go' });
  assert.ok(html.includes('@media(max-width:440px)'));
  assert.ok(html.includes('.registration-input input{height:43px;font-size:13px;padding-left:9px;padding-right:29px}'));
  assert.ok(html.includes('.registration-hero{min-height:184px'));
  assert.ok(html.includes('registration-card{margin-right:5%;margin-left:5%;padding:36px 14px 16px;border-radius:18px}'));
  assert.ok(html.includes('.registration-hero h1{font-size:clamp(58px,8vw,82px)'));
  assert.ok(html.includes('.registration-field label{font-size:clamp(21px,2.4vw,26px)}'));
});
