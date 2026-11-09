import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { registrationDocument } from '../server/utils/registrationView.ts';

const execFileAsync = promisify(execFile);
const chrome = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

test('real Chrome shows no-referrer yields opaque Origin while strict-origin-when-cross-origin preserves page Origin', { skip: !existsSync(chrome) }, async t => {
  const observed: Array<Record<string, string | undefined>> = [];
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/capture') {
      observed.push({
        origin: req.headers.origin,
        fetchSite: req.headers['sec-fetch-site'],
        fetchMode: req.headers['sec-fetch-mode'],
        fetchDest: req.headers['sec-fetch-dest'],
        contentType: req.headers['content-type'],
      });
      res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Captured</title>');
      return;
    }

    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const submission = `<script>(()=>{const f=document.querySelector('form');f.elements.clientName.value='Browser Test';f.elements.clientMobile.value='9876543210';f.elements.consent.checked=true;parent.postMessage({origin:window.origin,hasForm:!!f},'*');f.requestSubmit()})()</script>`;
    const document = registrationDocument({ token: 'synthetic-browser-test-token', action: `${base}/capture` })
      .replace('</body>', `${submission}</body>`);
    if (req.url === '/no-referrer' || req.url === '/strict-origin') {
      const policy = req.url === '/no-referrer' ? 'no-referrer' : 'strict-origin-when-cross-origin';
      const policyDocument = document.replace('<meta name="referrer" content="strict-origin-when-cross-origin">', `<meta name="referrer" content="${policy}">`);
      res.writeHead(200, {
        'content-type': 'text/html',
        'referrer-policy': policy,
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      }).end(policyDocument);
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const profile = mkdtempSync(join(tmpdir(), 'ved-origin-browser-'));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(profile, { recursive: true, force: true });
  });

  const open = async (path: string) => execFileAsync(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}-${path.slice(1)}`, '--dump-dom', `${base}${path}`,
  ], { timeout: 20_000, maxBuffer: 2 * 1024 * 1024 });

  await open('/no-referrer');
  await open('/strict-origin');
  assert.equal(observed.length, 2, 'both native form submissions reached the local receiver');
  assert.deepEqual(observed.map(request => request.origin), ['null', base]);
  assert.deepEqual(observed.map(request => request.fetchMode), ['navigate', 'navigate']);
  assert.deepEqual(observed.map(request => request.contentType), ['application/x-www-form-urlencoded', 'application/x-www-form-urlencoded']);
});
