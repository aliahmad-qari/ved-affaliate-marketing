import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import test from 'node:test';
import { createApp } from '../server/app.ts';

test('native capture POST origin checks behind production proxies', async () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, FRONTEND_URL: process.env.FRONTEND_URL, PUBLIC_APP_URL: process.env.PUBLIC_APP_URL, RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL, JWT_SECRET: process.env.JWT_SECRET };
  process.env.NODE_ENV = 'production';
  process.env.FRONTEND_URL = 'https://frontend.example';
  process.env.PUBLIC_APP_URL = 'https://public-app.example';
  process.env.RENDER_EXTERNAL_URL = 'https://ved-affaliate-marketing.onrender.com';
  process.env.JWT_SECRET = 'production-origin-test-secret-at-least-32-characters';
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  // Use raw HTTP so proxy Host headers are actually transmitted (fetch can replace them).
  const post = (origin: string, extraHeaders: Record<string, string> = {}, path = '/api/public/campaigns/sample/go') => new Promise<{
    status: number; headers: { get: (name: string) => string | undefined }; text: () => Promise<string>;
  }>((resolve, reject) => {
    // No valid token or customer details: these checks never reach storage.
    const body = new URLSearchParams({ captureToken: 'invalid-test-token' }).toString();
    const req = request(`${base}${path}`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), ...extraHeaders },
    }, (res) => {
      let content = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { content += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, headers: { get: (name) => {
        const value = res.headers[name.toLowerCase()];
        return Array.isArray(value) ? value.join(', ') : value;
      } }, text: async () => content }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Test request timed out')));
    req.end(body);
  });
  try {
    const scenarios = [
      { label: 'native local same-origin form', origin: base, headers: {}, expected: 400 },
      { label: 'VED apex production origin', origin: 'https://vedaffiliatepvtltd.com', headers: {}, expected: 400 },
      { label: 'VED www production origin', origin: 'https://www.vedaffiliatepvtltd.com', headers: {}, expected: 400 },
      { label: 'Render HTTPS origin with internal HTTP host', origin: process.env.RENDER_EXTERNAL_URL, headers: { Host: 'internal-service:10000', 'X-Forwarded-Proto': 'https' }, expected: 400 },
      { label: 'custom domain with TLS termination', origin: 'https://apply.example.test', headers: { Host: 'apply.example.test', 'X-Forwarded-Proto': 'https' }, expected: 400 },
      { label: 'configured frontend', origin: 'https://frontend.example', headers: {}, expected: 400 },
      { label: 'configured public application origin', origin: 'https://public-app.example', headers: {}, expected: 400 },
      { label: 'another Render service', origin: 'https://another-service.onrender.com', headers: { 'X-Forwarded-Proto': 'https' }, expected: 403 },
      { label: 'opaque origin', origin: 'null', headers: {}, expected: 403 },
      { label: 'untrusted forwarded host', origin: 'https://attacker.example', headers: { 'X-Forwarded-Host': 'attacker.example', 'X-Forwarded-Proto': 'https' }, expected: 403 },
    ];
    for (const scenario of scenarios) {
      const response = await post(scenario.origin, scenario.headers);
      assert.equal(response.status, scenario.expected, scenario.label);
      if (scenario.origin.startsWith('https://vedaffiliatepvtltd.com') || scenario.origin.startsWith('https://www.vedaffiliatepvtltd.com')) {
        assert.equal(response.headers.get('access-control-allow-origin'), scenario.origin, `${scenario.label}: production origin is explicitly allowed by CORS`);
      }
      if (scenario.origin === 'https://public-app.example') {
        assert.equal(response.headers.get('access-control-allow-origin'), scenario.origin, 'The explicitly configured public app origin is allowed');
      }
      if (scenario.expected === 400) {
        assert.equal(response.headers.get('referrer-policy'), 'same-origin', `${scenario.label}: recovered forms must preserve their native POST origin`);
        assert.ok((await response.text()).includes('This form has expired or is invalid'));
      }
    }
    assert.equal((await post(process.env.RENDER_EXTERNAL_URL, {}, '/api/admin/leads/test/process')).status, 403, 'Public form exception must not permit admin mutations');
    const productionOriginAdminMutation = await post('https://vedaffiliatepvtltd.com', {}, '/api/admin/leads/test/process');
    assert.notEqual(productionOriginAdminMutation.status, 403, 'A trusted production origin passes origin validation; authentication still protects admin routes');
    assert.equal(productionOriginAdminMutation.headers.get('access-control-allow-origin'), 'https://vedaffiliatepvtltd.com');
    delete process.env.RENDER_EXTERNAL_URL;
    assert.equal((await post(base)).status, 400, 'Same-origin forms still work on hosts without Render environment variables');
    process.env.RENDER_EXTERNAL_URL = 'not-a-url';
    assert.equal((await post('https://untrusted.example')).status, 403, 'Malformed Render configuration must not allow untrusted origins');
    const rejectedOrigin = await post('https://vedaffiliatepvtltd.com.evil.example');
    assert.equal(rejectedOrigin.status, 403, 'A lookalike hostname is not trusted');
    assert.ok((await rejectedOrigin.text()).includes('reopen the original campaign link'), 'Origin failures provide a safe next step');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
