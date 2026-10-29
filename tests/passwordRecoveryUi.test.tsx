import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('reset bootstrap scrubs fragment/query tokens before third-party resources', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  assert.ok(html.indexOf(script) < html.indexOf('fonts.googleapis.com'));
  for (const mode of ['hash', 'search']) {
    let replaced = ''; const metas: any[] = [];
    const window: any = { location: { pathname: '/reset-password', hash: mode === 'hash' ? '#token=opaque' : '', search: mode === 'search' ? '?token=opaque' : '' }, history: { state: null, replaceState(_a: any, _b: any, path: string) { replaced = path; } } };
    runInNewContext(script, { window, URLSearchParams, document: { createElement: () => ({}), head: { appendChild(meta: any) { metas.push(meta); } } } });
    assert.equal(window.__vedResetToken, 'opaque'); assert.equal(replaced, '/reset-password'); assert.equal(metas[0].content, 'no-referrer');
  }
});

test('recovery screens preserve branding, email input, confirmation, visibility controls and invalid-link feedback', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const browser = { location: { search: '?account=admin', hash: '' }, __vedResetToken: '' };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete (globalThis as any).window; });
  const vite = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, appType: 'custom' });
  try {
    const { PasswordRecoveryPage } = await vite.ssrLoadModule('/src/pages/PasswordRecoveryPage.tsx');
    const forgot = renderToStaticMarkup(<PasswordRecoveryPage onNavigate={() => {}} />);
    assert.ok(forgot.includes('Registered email') && forgot.includes('type="email"') && forgot.includes('Send Reset Link'));
    const invalid = renderToStaticMarkup(<PasswordRecoveryPage reset onNavigate={() => {}} />);
    assert.ok(invalid.includes('invalid or missing') && invalid.includes('disabled=""'));
    browser.__vedResetToken = 'a'.repeat(64);
    const reset = renderToStaticMarkup(<PasswordRecoveryPage reset onNavigate={() => {}} />);
    for (const label of ['New password', 'Confirm password', 'Show passwords', 'Update Password', '15 minutes', 'Back to sign in']) assert.ok(reset.includes(label));
    assert.ok(!reset.includes(browser.__vedResetToken), 'Token never rendered in page text or fields');
    assert.ok(!reset.includes('disabled=""'));
  } finally { await vite.close(); }
});
