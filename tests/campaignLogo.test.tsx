import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createApp } from '../server/app.ts';
import { Campaign } from '../server/models/Campaign.ts';
import { AdminUser } from '../server/models/AdminUser.ts';
import { AuditLog } from '../server/models/AuditLog.ts';
import { signToken } from '../server/utils/jwt.ts';
import { CampaignLogo } from '../src/components/ui/CampaignLogo.tsx';

test('campaign logo upload persists without Cloudinary, serves public bytes and retains existing Cloudinary uploads', async (t) => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-logo-upload-secret-at-least-32-characters';
  delete process.env.RENDER_EXTERNAL_URL;
  for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) delete process.env[key];
  mongoose.connection.readyState = 1;
  const id = new mongoose.Types.ObjectId().toString();
  let stored: any = { _id: id, name: 'Sample campaign', slug: 'sample', companyName: 'Sample brand', campaignType: 'Demat & Trading', description: 'Sample campaign description', requiredAction: 'Open account', payout: 250, status: 'LIVE', logoUrl: '' };
  let failSave = false;
  const audits: any[] = [];
  const chain = (value: any): any => {
    const query: any = { exec: async () => typeof value === 'function' ? value() : value };
    query.then = (resolve: any, reject: any) => query.exec().then(resolve, reject);
    for (const method of ['select', 'lean', 'sort']) query[method] = () => query;
    return query;
  };
  t.mock.method(Campaign, 'findById', (requested: string) => chain(() => requested === id ? new Campaign(stored) : null));
  t.mock.method(Campaign, 'findOne', (query: any) => chain(() => String(query._id) === id && query['logoImage.version'] === stored.logoImage?.version ? new Campaign(stored) : null));
  t.mock.method(Campaign, 'find', () => chain(() => [new Campaign(stored)]));
  t.mock.method(Campaign.prototype, 'save', async function () {
    await this.validate();
    if (failSave) throw new Error('Simulated failed save');
    stored = this.toObject({ transform: false });
    return this;
  });
  t.mock.method(AdminUser, 'findById', () => chain({ _id: 'admin-1', status: 'ACTIVE', toJSON: () => ({ email: 'admin@example.test' }) }));
  t.mock.method(AuditLog, 'create', async (entry: any) => { audits.push(entry); return entry; });
  t.mock.method(cloudinary, 'config', () => ({}));
  let cloudUploads = 0;
  t.mock.method(cloudinary.uploader, 'upload_stream', (_options: any, callback: any) => ({ end: () => {
    cloudUploads++;
    callback(null, { secure_url: 'https://res.cloudinary.com/test/image/upload/logo.png' });
  } }) as any);
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const token = signToken({ id: 'admin-1', email: 'admin@example.test', role: 'ADMIN' });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/RsAAAAASUVORK5CYII=', 'base64');
  const upload = (bytes = png, authenticated = true, campaignId = id) => {
    const form = new FormData();
    form.append('logo', new Blob([bytes], { type: 'image/png' }), 'logo.png');
    return fetch(`${base}/api/admin/campaigns/${campaignId}/logo`, { method: 'POST', headers: authenticated ? { Authorization: `Bearer ${token}` } : {}, body: form });
  };
  try {
    assert.equal((await upload(png, false)).status, 401);
    assert.equal((await upload(Buffer.from('not an image'))).status, 400);
    assert.equal((await upload(Buffer.alloc(3 * 1024 * 1024 + 1))).status, 400);
    assert.equal((await upload(png, true, new mongoose.Types.ObjectId().toString())).status, 404);
    const response = await upload();
    assert.equal(response.status, 200);
    const result = (await response.json()).data;
    assert.equal(result.logoImage, undefined, 'Upload JSON must never contain binary image data');
    assert.equal(cloudUploads, 0);
    assert.equal(audits.length, 1);
    const url = new URL(result.logoUrl);
    assert.equal(url.origin, base);
    const image = await fetch(url);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.equal(image.headers.get('cross-origin-resource-policy'), 'cross-origin', 'Allow images on a separately hosted frontend');
    assert.ok(image.headers.get('cache-control')!.includes('immutable'));
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
    const publicResult = await fetch(`${base}/api/public/campaigns`);
    const publicCampaign = (await publicResult.json()).data[0];
    assert.equal(publicCampaign.logoUrl, result.logoUrl);
    assert.equal(publicCampaign.logoImage, undefined);
    assert.equal(Campaign.schema.path('logoImage').options.select, false);
    const oldUrl = result.logoUrl;
    failSave = true;
    assert.equal((await upload()).status, 500);
    assert.equal(stored.logoUrl, oldUrl, 'Failed replacement must retain the previous logo');
    assert.equal((await fetch(oldUrl)).status, 200);
    failSave = false;
    process.env.RENDER_EXTERNAL_URL = 'https://sample-service.onrender.com';
    const replaced = await upload();
    const replacement = (await replaced.json()).data;
    assert.equal(new URL(replacement.logoUrl).origin, process.env.RENDER_EXTERNAL_URL);
    assert.notEqual(replacement.logoUrl, oldUrl, 'A new upload must bypass cached old images');
    assert.equal((await fetch(`${base}/api/public/campaigns/logos/not-an-id/not-a-version`)).status, 404);
    assert.equal((await fetch(oldUrl)).status, 404, 'Replaced image bytes are not retained in the campaign document');
    for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) process.env[key] = 'test';
    const cloudResponse = await upload();
    assert.equal(cloudResponse.status, 200);
    assert.equal((await cloudResponse.json()).data.logoUrl, 'https://res.cloudinary.com/test/image/upload/logo.png');
    assert.equal(cloudUploads, 1);
    assert.equal(stored.logoImage, undefined);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    mongoose.connection.readyState = 0;
  }
});

test('campaign logo UI renders uploaded images and initials when no image is configured', () => {
  const image = renderToStaticMarkup(<CampaignLogo name="Sample" logoUrl="https://image.example/logo.png" />);
  assert.ok(image.includes('<img') && image.includes('src="https://image.example/logo.png"') && image.includes('alt="Sample logo"'));
  assert.equal(renderToStaticMarkup(<CampaignLogo name="Sample" />), 'SA');
});
