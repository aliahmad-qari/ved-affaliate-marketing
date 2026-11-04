import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import mongoose from 'mongoose';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { v2 as cloudinary } from 'cloudinary';
import { createApp } from '../server/app.ts';
import { Partner } from '../server/models/Partner.ts';
import { signToken } from '../server/utils/jwt.ts';
import { PartnerAvatar } from '../src/components/profile/PartnerAvatar.tsx';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);

function photoForm(bytes: Buffer, mime = 'image/png') {
  const form = new FormData();
  form.append('photo', new Blob([bytes], { type: mime }), 'profile.png');
  return form;
}

test('partner profile photo upload, replacement, removal and authorization stay scoped to the authenticated partner', async t => {
  const previous = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET, CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET };
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'isolated-profile-photo-test-secret-32';
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  mongoose.connection.readyState = 1;
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value;
    mongoose.connection.readyState = 0;
  });

  const partners = new Map<string, any>([
    ['partner-1', { _id: 'partner-1', partnerId: 'VED-PTR-ONE', fullName: 'Partner One', accountStatus: 'ACTIVE', profilePhotoUrl: 'https://res.cloudinary.com/test/old.webp', profilePhotoPublicId: 'old-photo-one' }],
    ['partner-2', { _id: 'partner-2', partnerId: 'VED-PTR-TWO', fullName: 'Partner Two', accountStatus: 'ACTIVE', profilePhotoUrl: '', profilePhotoPublicId: '' }],
  ]);
  const responsePartner = (partner: any) => ({ ...partner, toJSON: () => {
    const { profilePhotoPublicId: _privateId, ...safe } = partner;
    return safe;
  } });
  const chain = (execute: () => unknown) => {
    const q: any = { select: () => q, exec: async () => execute(), then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject) };
    return q;
  };
  const updates: Array<{ id: string; update: any }> = [];
  const uploadedOptions: any[] = [];
  const deletedIds: string[] = [];
  let uploadCount = 0;
  t.mock.method(Partner, 'findById', (id: string) => chain(() => {
    const record = partners.get(id);
    return record ? responsePartner(record) : null;
  }));
  t.mock.method(Partner, 'findByIdAndUpdate', (id: string, update: any) => chain(() => {
    updates.push({ id, update });
    const record = partners.get(id);
    if (!record) return null;
    Object.assign(record, update.$set || {});
    for (const key of Object.keys(update.$unset || {})) delete record[key];
    return responsePartner(record);
  }));
  t.mock.method(cloudinary.uploader, 'upload_stream', (options: any, callback: (error: Error | null, result?: any) => void) => {
    uploadedOptions.push(options);
    const publicId = `${options.folder}/${options.public_id}`;
    return { end: (_buffer: Buffer) => { uploadCount++; callback(null, { public_id: publicId, width: 128, height: 128, secure_url: `https://res.cloudinary.com/test/${publicId}` }); } } as any;
  });
  t.mock.method(cloudinary.uploader, 'destroy', async (publicId: string) => { deletedIds.push(publicId); return { result: 'ok' } as any; });

  const app = createApp().listen(0, '127.0.0.1');
  await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as any).port}/api/partner/profile/photo`;
  const oneToken = signToken({ id: 'partner-1', partnerId: 'VED-PTR-ONE', role: 'PARTNER' });
  const twoToken = signToken({ id: 'partner-2', partnerId: 'VED-PTR-TWO', role: 'PARTNER' });
  const request = (url: string, token?: string, method = 'POST', body?: BodyInit) => fetch(url, { method, headers: token ? { Authorization: `Bearer ${token}` } : {}, ...(body ? { body } : {}), signal: AbortSignal.timeout(8000) });
  try {
    assert.equal((await request(base, undefined, 'POST', photoForm(png))).status, 401);
    const first = await request(`${base}?partnerId=partner-2`, oneToken, 'POST', photoForm(png));
    assert.equal(first.status, 200);
    const firstBody = await first.json() as any;
    assert.match(firstBody.data.profilePhotoUrl, /^https:\/\//);
    assert.equal('profilePhotoPublicId' in firstBody.data, false);
    assert.equal(updates[0].id, 'partner-1', 'query parameters cannot select another partner');
    assert.equal(updates[0].update.$set.profilePhotoPublicId, uploadedOptions[0].folder + '/' + uploadedOptions[0].public_id);
    assert.ok(deletedIds.includes('old-photo-one'), 'replacement removes the prior remote photo after saving the new one');

    const afterValidUpload = uploadCount;
    const invalidType = await request(base, oneToken, 'POST', photoForm(Buffer.from('not an image'), 'image/png'));
    assert.equal(invalidType.status, 400);
    assert.equal(uploadCount, afterValidUpload);
    const tooLarge = await request(base, oneToken, 'POST', photoForm(Buffer.alloc(3 * 1024 * 1024 + 1), 'image/png'));
    assert.equal(tooLarge.status, 400);
    assert.equal(uploadCount, afterValidUpload);

    const otherUpload = await request(`${base}?partnerId=partner-1`, twoToken, 'POST', photoForm(png));
    assert.equal(otherUpload.status, 200);
    assert.equal(updates.at(-1)?.id, 'partner-2', 'partner two can write only its authenticated profile');
    assert.notEqual(partners.get('partner-1')?.profilePhotoPublicId, partners.get('partner-2')?.profilePhotoPublicId);

    const removed = await request(`${base}?partnerId=partner-1`, twoToken, 'DELETE');
    assert.equal(removed.status, 200);
    assert.equal(updates.at(-1)?.id, 'partner-2', 'remove ignores identifiers supplied by the caller');
    assert.equal(partners.get('partner-2')?.profilePhotoUrl, '');
    assert.equal('profilePhotoPublicId' in partners.get('partner-2'), false);
    assert.ok(deletedIds.includes(uploadedOptions[1].folder + '/' + uploadedOptions[1].public_id));
    assert.equal((await request(`${base}/partner-1`, twoToken, 'DELETE')).status, 404, 'there is no route for targeting another partner profile');
  } finally {
    app.closeAllConnections();
    await new Promise<void>(resolve => app.close(() => resolve()));
  }
});

test('partner avatar renders an initials fallback when no profile photo is available', () => {
  const html = renderToStaticMarkup(React.createElement(PartnerAvatar, { name: 'Aisha Khan' }));
  assert.match(html, />AK/);
  assert.doesNotMatch(html, /<img/);
});
