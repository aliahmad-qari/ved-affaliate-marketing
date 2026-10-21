import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { copyText } from '../src/lib/clipboard.ts';
import { ManualCopyField } from '../src/components/ui/ManualCopyField.tsx';

test('clipboard success, blocked permissions, HTTP fallback and manual copying preserve exact text', async () => {
  const originals = new Map(['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let secure = true, rejectClipboard = false, legacyResult = true, throwLegacy = false;
  let modern = 0, legacy = 0, removed = 0, restored = 0;
  let copied = '', selected = '';
  const document = {
    activeElement: { focus() { restored++; } },
    body: { appendChild() {} },
    createElement() { return { value: '', readOnly: false, style: { cssText: '' }, setAttribute() {}, focus() {}, select() { selected = this.value; }, setSelectionRange(start: number, end: number) { assert.equal(start, 0); assert.equal(end, this.value.length); }, remove() { removed++; } }; },
    execCommand(command: string) { legacy++; assert.equal(command, 'copy'); if (throwLegacy) throw Error('blocked'); if (legacyResult) copied = selected; return legacyResult; },
  };
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { get isSecureContext() { return secure; } } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { async writeText(text: string) { modern++; if (rejectClipboard) throw Error('denied'); copied = text; } } } });
    const links = ['http://46.250.242.208:8084/campaigns/angel-one-subscription?ref=VED-TEST&pid=VED-PTR-TEST', 'http://46.250.242.208:8084/campaigns/other-campaign?ref=VED-OTHER&pid=VED-PTR-OTHER', 'http://46.250.242.208:8084/register?ref=VED-TEST'];
    for (const link of links) { assert.equal(await copyText(link), true); assert.equal(copied, link); }
    assert.equal(legacy, 0);
    rejectClipboard = true;
    assert.equal(await copyText(links[0]), true); assert.equal(copied, links[0]);
    secure = false; const previousModern = modern;
    assert.equal(await copyText(links[1]), true); assert.equal(modern, previousModern); assert.equal(copied, links[1]);
    (globalThis.navigator as any).clipboard = undefined;
    secure = true;
    assert.equal(await copyText('VED-PTR-TEST'), true); assert.equal(copied, 'VED-PTR-TEST');
    legacyResult = false;
    assert.equal(await copyText(links[0]), false);
    throwLegacy = true;
    assert.equal(await copyText(links[0]), false);
    assert.equal(removed, legacy); assert.equal(restored, legacy);
    (document as any).execCommand = undefined;
    assert.equal(await copyText(links[0]), false);
    const markup = renderToStaticMarkup(<ManualCopyField text={links[0]} onClose={() => {}} />);
    assert.ok(markup.includes('readOnly=""')); assert.ok(markup.includes(links[0].replaceAll('&', '&amp;')));
    assert.ok(markup.includes('copy it manually')); assert.ok(!markup.includes('Copied'));
  } finally {
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key]; }
  }
});
