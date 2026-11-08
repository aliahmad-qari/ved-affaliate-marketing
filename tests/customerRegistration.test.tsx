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

test('already registered view uses a signed same-origin campaign continuation without customer details', () => {
  const html = registrationDocument({ registered: true, name: 'PRIVATE CUSTOMER', mobile: '9876543210', token: 'opaque-signed-continuation', continuationAction: '/api/public/campaigns/test/continue' });
  for (const value of ['NUMBER ALREADY REGISTERED', 'Your application has already been registered for this campaign.', 'Continue to Campaign Page']) assert.ok(html.includes(value));
  for (const value of ['PRIVATE CUSTOMER', '9876543210', 'name="consent"', 'registration-button registration-home-button" href="/']) assert.ok(!html.includes(value));
  assert.ok(html.includes('action="/api/public/campaigns/test/continue"'));
  assert.ok(html.includes('name="captureToken" value="opaque-signed-continuation"'));
  assert.equal((html.match(/disabled=""/g) || []).length, 0);
  assert.ok(html.includes('registration-confirmation-icon'));
  assert.ok(html.includes('name="referrer" content="no-referrer"'));
});
