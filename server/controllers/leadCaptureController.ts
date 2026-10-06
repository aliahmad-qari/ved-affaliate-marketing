import crypto from 'crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Campaign } from '../models/Campaign.ts';
import { Partner } from '../models/Partner.ts';
import { Lead } from '../models/Lead.ts';
import { TrackingClick } from '../models/TrackingClick.ts';
import { Notification } from '../models/Notification.ts';
import { getDbStatus } from '../config/db.ts';
import { generateLeadId } from '../utils/idGenerator.ts';
import { redirectToCampaignTracking } from './campaignController.ts';

interface CaptureToken extends jwt.JwtPayload {
  slug: string;
  ref: string;
  pid: string;
  clickId: string;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required to capture enquiries.');
  return process.env.JWT_SECRET;
};

async function resolveTracking(slug: string, ref: string, pid: string) {
  if (!getDbStatus().isConnected) throw Object.assign(new Error('This service is temporarily unavailable. Please try again.'), { status: 503 });
  if (!/^[A-Za-z0-9-]{3,40}$/.test(ref) || !/^[A-Za-z0-9-]{3,40}$/.test(pid)) {
    throw Object.assign(new Error('Partner attribution is invalid or inactive.'), { status: 400 });
  }
  const campaign: any = await Campaign.findOne({ slug, status: 'LIVE' }).select('+baseTrackingUrl').lean().exec();
  let target: URL | undefined;
  try { target = new URL(campaign?.baseTrackingUrl); } catch { /* Reject missing or invalid vendor links. */ }
  if (!target || !['http:', 'https:'].includes(target.protocol)) {
    throw Object.assign(new Error('This campaign link is not active yet.'), { status: 404 });
  }
  const partner: any = await Partner.findOne({ referralCode: ref.toUpperCase(), partnerId: pid.toUpperCase(), accountStatus: 'ACTIVE' })
    .select('partnerId referralCode').lean().exec();
  if (!partner) throw Object.assign(new Error('Partner attribution is invalid or inactive.'), { status: 400 });
  return { campaign, partner, target };
}

function destination(target: URL, campaign: any, partner: any, clickId: string) {
  if (['wa.me', 'www.whatsapp.com', 'api.whatsapp.com'].includes(target.hostname.toLowerCase())) {
    const message = target.searchParams.get('text') || '';
    target.searchParams.set('text', `${message}${message ? '\n\n' : ''}VED reference: ${clickId}`);
    for (const key of [...target.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) target.searchParams.delete(key);
    }
  } else {
    for (const [key, value] of Object.entries({
      ref: partner.referralCode, pid: partner.partnerId, partner_id: partner.partnerId,
      campaign_id: String(campaign._id), clickid: clickId, click_id: clickId, subid: clickId,
    })) target.searchParams.set(key, String(value));
  }
  return target.toString();
}

function renderPage(res: Response, content: string, status = 200) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  // Browsers also check form-action on the vendor's redirect chain after a POST.
  // This page executes no scripts and the server alone chooses the HTTP(S) destination.
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http:; base-uri 'none'; frame-ancestors 'none'");
  res.status(status).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Start your application | VED Affiliate</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100svh;display:grid;place-items:center;background:#070B14;color:#F8FAFC;font-family:Arial,sans-serif;padding:24px}
main{width:100%;min-width:0;max-width:440px;background:#101A31;border:1px solid #1E2C48;border-radius:16px;padding:28px;overflow-wrap:anywhere}
.brand{color:#D4AF37;font-weight:700;letter-spacing:2px;font-size:13px}h1{font-size:25px;line-height:1.3}p{color:#AAB3C2;font-size:14px;line-height:1.6}
label{display:block;margin:18px 0 8px;font-size:14px}input[type=text],input[type=tel]{display:block;width:100%;padding:12px;background:#080D17;border:1px solid #263650;border-radius:8px;color:#fff;font-size:16px}
input:focus-visible,button:focus-visible{outline:2px solid #D4AF37;outline-offset:3px}.consent{display:flex;gap:10px;align-items:flex-start;line-height:1.5;color:#AAB3C2;font-size:13px}.consent input{margin-top:4px;flex-shrink:0}
button{width:100%;border:0;border-radius:8px;background:#D4AF37;color:#070B14;font-size:15px;font-weight:700;padding:14px;margin-top:18px;cursor:pointer}.error{color:#fecaca;background:#451a1a;padding:12px;border-radius:8px}a{color:#D4AF37;display:inline-block;padding:12px 0}input[type=checkbox]{accent-color:#D4AF37}@media(max-width:360px){body{padding:16px}main{padding:20px}}
</style></head><body><main><div class="brand">VED AFFILIATE</div>
${content}</main></body></html>`);
}

function captureLink(slug: string, ref: string, pid: string) {
  return `/api/public/campaigns/${encodeURIComponent(slug)}/go?${new URLSearchParams({ ref, pid })}`;
}

function renderMessage(res: Response, message: string, retryLink = '', status = 400) {
  renderPage(res, `<h1>Application form</h1><p class="error" role="alert">${escapeHtml(message)}</p>
${retryLink ? `<a href="${escapeHtml(retryLink)}">Reopen the form</a>` : '<p>Please reopen the original campaign link to continue.</p>'}`, status);
}

function renderForm(res: Response, campaign: any, token: string, error = '', name = '', mobile = '', status = 200, consent = false) {
  renderPage(res, `<h1>Start your application</h1><p>${escapeHtml(campaign.name)}</p>
<p>Enter your details to continue to ${escapeHtml(campaign.companyName)}. Our team will record your enquiry and track its progress.</p>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
<form method="post" action="/api/public/campaigns/${encodeURIComponent(campaign.slug)}/go">
<input type="hidden" name="captureToken" value="${escapeHtml(token)}">
<label for="customer-name">Full name</label><input id="customer-name" name="clientName" type="text" autocomplete="name" minlength="2" maxlength="120" value="${escapeHtml(name)}" required>
<label for="customer-mobile">Contact number</label><input id="customer-mobile" name="clientMobile" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="10-digit mobile number" value="${escapeHtml(mobile)}" required>
<label class="consent"><input type="checkbox" name="consent" value="yes" ${consent ? 'checked' : ''} required><span>I agree that VED Affiliate may save my name and contact number and contact me about this application.</span></label>
<button type="submit">Submit &amp; continue</button>
</form><p>Your enquiry will be recorded before you continue. Application completion will be verified separately.</p>`, status);
}

export const showLeadCaptureForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Keep the existing unattributed campaign route intact.
  if (req.query.ref === undefined && req.query.pid === undefined) {
    await redirectToCampaignTracking(req, res, next);
    return;
  }
  try {
    const ref = typeof req.query.ref === 'string' ? req.query.ref.trim() : '';
    const pid = typeof req.query.pid === 'string' ? req.query.pid.trim() : '';
    const { campaign } = await resolveTracking(req.params.slug, ref, pid);
    const token = jwt.sign({ slug: campaign.slug, ref, pid, clickId: crypto.randomUUID() }, secret(), {
      expiresIn: '30m', audience: 'ved-lead-capture', issuer: 'ved-api',
    });
    renderForm(res, campaign, token);
  } catch (error: any) {
    const status = error?.status || 503;
    renderMessage(res, status < 500 ? error.message : 'This service is temporarily unavailable. Please try the campaign link again shortly.', '', status);
  }
};

export const submitCapturedLead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  let token: CaptureToken;
  try {
    token = jwt.verify(req.body?.captureToken, secret(), {
      algorithms: ['HS256'], audience: 'ved-lead-capture', issuer: 'ved-api',
    }) as CaptureToken;
    if (token.slug !== req.params.slug || typeof token.clickId !== 'string' || typeof token.ref !== 'string' || typeof token.pid !== 'string') throw new Error('Invalid token.');
  } catch {
    let retryLink = '';
    try {
      const expired = jwt.verify(req.body?.captureToken, secret(), {
        algorithms: ['HS256'], audience: 'ved-lead-capture', issuer: 'ved-api', ignoreExpiration: true,
      }) as CaptureToken;
      if (expired.slug === req.params.slug && typeof expired.ref === 'string' && typeof expired.pid === 'string') {
        retryLink = captureLink(expired.slug, expired.ref, expired.pid);
      }
    } catch { /* Only recover attribution from a correctly signed token. */ }
    renderMessage(res, 'This form has expired or is invalid. Please reopen it and try again.', retryLink);
    return;
  }

  let session: mongoose.ClientSession | undefined;
  let tracking: Awaited<ReturnType<typeof resolveTracking>> | undefined;
  const name = typeof req.body.clientName === 'string' ? req.body.clientName.trim().replace(/\s+/g, ' ') : '';
  const rawMobile = typeof req.body.clientMobile === 'string' ? req.body.clientMobile.trim() : '';
  const consent = req.body.consent === 'yes';
  try {
    const { campaign, partner, target } = tracking = await resolveTracking(token.slug, token.ref, token.pid);
    const mobile = rawMobile.replace(/[\s()-]/g, '').replace(/^(?:\+91|91)(?=\d{10}$)/, '');
    let error = '';
    if (name.length < 2 || name.length > 120 || /[\u0000-\u001f<>]/.test(name)) error = 'Please enter a valid full name (2–120 characters).';
    else if (rawMobile.length > 20 || !/^[6-9]\d{9}$/.test(mobile)) error = 'Please enter a valid 10-digit Indian mobile number.';
    else if (req.body.consent !== 'yes') error = 'Please consent to saving your details before continuing.';
    if (error) {
      renderForm(res, campaign, req.body.captureToken, error, name.slice(0, 120), rawMobile.slice(0, 20), 400, consent);
      return;
    }

    const accountId = `ENQUIRY:${token.clickId}`;
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const existing = await Lead.findOne({ partnerId: partner.partnerId, campaignId: String(campaign._id), accountId }).session(session!).exec();
      if (existing) return; // A repeated submit of this form resumes the same enquiry.
      await TrackingClick.create([{
        clickId: token.clickId, partnerId: partner.partnerId, campaignId: String(campaign._id), campaignSlug: campaign.slug,
        payoutSnapshot: Number(campaign.payout || 0), currency: campaign.currency || 'INR',
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      }], { session });
      const [lead] = await Lead.create([{
        leadId: generateLeadId(), partnerId: partner.partnerId, campaignId: String(campaign._id),
        campaignName: campaign.name, campaignType: campaign.campaignType, clientName: name, clientMobile: mobile,
        accountId, action: campaign.requiredAction, vendorClickId: token.clickId, status: 'PENDING',
        payoutSnapshot: Number(campaign.payout || 0), currency: campaign.currency || 'INR',
        submittedData: { source: 'CUSTOMER_FORM', processStatus: 'IN_PROCESS', consentAt: new Date().toISOString(), consentVersion: 'lead-capture-v1' },
      }], { session });
      await Notification.create([{
        partnerId: partner.partnerId, type: 'LEAD_UPDATE', title: 'Customer started an application',
        message: `A customer submitted their contact details for ${campaign.name}. Lead ${lead.leadId} is in process.`,
        referenceType: 'LEAD', referenceId: String(lead._id), dedupeKey: `CUSTOMER_ENQUIRY:${token.clickId}`,
      }], { session });
    });
    res.redirect(303, destination(target, campaign, partner, token.clickId));
  } catch (error: any) {
    // Concurrent submissions may race on the unique enquiry/click indexes.
    if (error?.code === 11000) {
      try {
        const { campaign, partner, target } = await resolveTracking(token.slug, token.ref, token.pid);
        const existing = await Lead.findOne({ partnerId: partner.partnerId, campaignId: String(campaign._id), accountId: `ENQUIRY:${token.clickId}` }).lean().exec();
        if (existing) { res.redirect(303, destination(target, campaign, partner, token.clickId)); return; }
      } catch { /* Preserve the original failure if the enquiry cannot be confirmed. */ }
    }
    const status = error?.status || 503;
    const message = status < 500 ? error.message : 'We could not save your enquiry. Please submit the form again to continue.';
    if (tracking) renderForm(res, tracking.campaign, req.body.captureToken, message, name.slice(0, 120), rawMobile.slice(0, 20), status, consent);
    else renderMessage(res, message, captureLink(token.slug, token.ref, token.pid), status);
  } finally { await session?.endSession(); }
};
