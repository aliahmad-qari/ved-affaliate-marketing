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
});

test('welcome-back links only to VED homepage and contains no submitted details or token', () => {
  const html = registrationDocument({ registered: true, name: 'PRIVATE CUSTOMER', mobile: '9876543210', token: 'private-token' });
  for (const value of ['NUMBER ALREADY REGISTERED', 'WELCOME BACK! YOUR APPLICATION IS ALREADY REGISTERED.', 'CONTINUE TO MAIN PAGE']) assert.ok(html.includes(value));
  for (const value of ['PRIVATE CUSTOMER', '9876543210', 'private-token', 'name="consent"']) assert.ok(!html.includes(value));
  assert.match(html, /class="registration-button registration-home-button" href="\/"/);
  assert.equal((html.match(/disabled=""/g) || []).length, 2);
  assert.ok(html.includes('registration-confirmation-icon'));
  assert.ok(html.indexOf('</section><a class="registration-button registration-home-button"') > 0);
});
