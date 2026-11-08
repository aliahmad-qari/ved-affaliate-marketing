import assert from 'node:assert/strict';
import test from 'node:test';
import { maskPublicPartnerId, maskPublicPartnerName } from '../server/utils/publicPartnerMasking.ts';

test('public partner identifiers retain only masked presentation values', () => {
  assert.equal(maskPublicPartnerName('Priyam Kumar'), 'P**m Kum**');
  assert.equal(maskPublicPartnerName(''), 'VED Partner');
  assert.equal(maskPublicPartnerId('VED123456'), 'VED1234**');
  assert.equal(maskPublicPartnerId(''), 'VED**');
});
