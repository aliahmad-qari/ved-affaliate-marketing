import crypto from 'crypto';
import { registrationDocument } from '../utils/registrationView.ts';
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
import { preserveVendorTrackingUrl } from '../utils/vendorTracking.ts';
import { resolvePartnerPayout } from '../services/partnerPayout.ts';

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
    .select('partnerId referralCode payoutSettings').lean().exec();
  if (!partner) throw Object.assign(new Error('Partner attribution is invalid or inactive.'), { status: 400 });
  return { campaign, partner, target };
}

function destination(target: URL, campaign: any, partner: any, clickId: string) {
  if (preserveVendorTrackingUrl(target)) return campaign.baseTrackingUrl;
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
  res.set('Referrer-Policy', 'same-origin');
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http:; base-uri 'none'; frame-ancestors 'none'");
  res.status(status).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Complete Your Application | VED Affiliate</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100svh;display:grid;place-items:center;background:radial-gradient(ellipse at 10% 15%,#132e49 0,transparent 50%),radial-gradient(ellipse at 95% 90%,#202014 0,transparent 40%),#070d18;color:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;padding:40px 24px;line-height:1.5;font-weight:500}
.shell{width:100%;max-width:600px;min-width:0}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:32px}
.brand{display:flex;align-items:center;gap:12px;font-size:12px;letter-spacing:1.8px;font-weight:700}
.brandmark{display:grid;place-items:center;width:43px;height:43px;border:1.5px solid #d4af37;border-radius:50%;color:#d4af37;font-size:12px;letter-spacing:0;background:linear-gradient(135deg,#d4af370a,#d4af37080);box-shadow:0 0 12px #d4af370a}
.brand small{display:block;margin-top:4px;font-size:9px;font-weight:400;color:#8f9db2;letter-spacing:2px}
main{padding:42px 38px;border:1px solid #26364d;border-radius:22px;background:#101c2e;box-shadow:0 28px 80px #0005}
h1{font-size:28px;line-height:1.2;letter-spacing:-.6px;margin:12px 0 8px;font-weight:700;color:#e9eef6}
p{color:#9facbf;font-size:12px;line-height:1.75;margin:10px 0}
.form-header{margin-bottom:28px}
.security-footer{margin-top:28px;padding-top:20px;border-top:1px solid #1e2e45}
.page-footer{display:flex;justify-content:space-between;gap:10px;margin-top:20px;font-size:9px;color:#647b96;font-weight:500}
@media(max-width:480px){body{padding:24px 16px}.topbar{margin-bottom:20px}main{padding:27px 25px;border-radius:16px}h1{font-size:24px;margin:8px 0 6px}.form-header{margin-bottom:20px}.page-footer{font-size:8px}}
</style></head><body><div class="shell"><header class="topbar"><div class="brand"><span class="brandmark">VED</span><div>VED <span style="color:#d4af37">AFFILIATE</span><small>PVT. LIMITED</small></div></div></header><main>${content}</main><footer class="page-footer"><span>VED AFFILIATE PVT. LIMITED</span></footer></div></body></html>`);
}

function captureLink(slug: string, ref: string, pid: string) {
  return `/api/public/campaigns/${encodeURIComponent(slug)}/go?${new URLSearchParams({ ref, pid })}`;
}

function renderMessage(res: Response, message: string, retryLink = '', status = 400) {
  renderPage(res, `<h1>Application form</h1><p class="error" role="alert">${escapeHtml(message)}</p>
${retryLink ? `<a href="${escapeHtml(retryLink)}">Reopen the form</a>` : '<p>Please reopen the original campaign link to continue.</p>'}`, status);
}

function renderForm(res: Response, campaign: any, token: string, error = '', name = '', mobile = '', status = 200, consent = false) {
  registrationResponse(res, { token, action: '/api/public/campaigns/' + encodeURIComponent(campaign.slug) + '/go', error, name, mobile, consent }, status);
}

function registrationResponse(res: Response, props: Parameters<typeof registrationDocument>[0], status = 200) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'same-origin');
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.status(status).type('html').send(registrationDocument(props));
}

const receiptName = 'ved_customer_capture';
function rememberCapture(req: Request, res: Response, token: CaptureToken) {
  const receipt = jwt.sign({ slug: token.slug, ref: token.ref, pid: token.pid, clickId: token.clickId }, secret(), {
    expiresIn: '7d', audience: 'ved-customer-receipt', issuer: 'ved-api', algorithm: 'HS256',
  });
  res.cookie(receiptName, receipt, { httpOnly: true, secure: req.secure || process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 86400000, path: '/api/public/campaigns/' + encodeURIComponent(token.slug) + '/go' });
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
    const { campaign, partner } = await resolveTracking(req.params.slug, ref, pid);
    let receipt: CaptureToken | undefined;
    try {
      receipt = jwt.verify(req.cookies?.[receiptName], secret(), { algorithms: ['HS256'], audience: 'ved-customer-receipt', issuer: 'ved-api' }) as CaptureToken;
    } catch { /* An absent, expired or forged receipt never identifies an existing application. */ }
    if (receipt && receipt.slug === campaign.slug && receipt.ref === ref && receipt.pid === pid && typeof receipt.clickId === 'string') {
      const existing = await Lead.findOne({ partnerId: partner.partnerId, campaignId: String(campaign._id), accountId: 'ENQUIRY:' + receipt.clickId }).lean().exec();
      if (existing) { registrationResponse(res, { registered: true }); return; }
    }
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
    const ownEnquiry = { partnerId: partner.partnerId, campaignId: String(campaign._id), accountId: 'ENQUIRY:' + token.clickId };
    if (await Lead.findOne(ownEnquiry).lean().exec()) {
      rememberCapture(req, res, token);
      registrationResponse(res, { registered: true });
      return;
    }
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
    let alreadyRegistered = false;
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const existing = await Lead.findOne({ partnerId: partner.partnerId, campaignId: String(campaign._id), accountId }).session(session!).exec();
      if (existing) { alreadyRegistered = true; return; } // Same signed flow only; never a phone lookup.
      await TrackingClick.create([{
        clickId: token.clickId, partnerId: partner.partnerId, campaignId: String(campaign._id), campaignSlug: campaign.slug,
        payoutSnapshot: resolvePartnerPayout(campaign, partner.payoutSettings), currency: campaign.currency || 'INR',
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      }], { session });
      const [lead] = await Lead.create([{
        leadId: generateLeadId(), partnerId: partner.partnerId, campaignId: String(campaign._id),
        campaignName: campaign.name, campaignType: campaign.campaignType, clientName: name, clientMobile: mobile,
        accountId, action: campaign.requiredAction, vendorClickId: token.clickId, status: 'PENDING',
        payoutSnapshot: resolvePartnerPayout(campaign, partner.payoutSettings), currency: campaign.currency || 'INR',
        submittedData: { source: 'CUSTOMER_FORM', processStatus: 'IN_PROCESS', consentAt: new Date().toISOString(), consentVersion: 'lead-capture-v1' },
      }], { session });
      await Notification.create([{
        partnerId: partner.partnerId, type: 'LEAD_UPDATE', title: 'Customer started an application',
        message: `A customer submitted their contact details for ${campaign.name}. Lead ${lead.leadId} is in process.`,
        referenceType: 'LEAD', referenceId: String(lead._id), dedupeKey: `CUSTOMER_ENQUIRY:${token.clickId}`,
      }], { session });
    });
    rememberCapture(req, res, token);
    if (alreadyRegistered) registrationResponse(res, { registered: true });
    else res.redirect(303, destination(target, campaign, partner, token.clickId));
  } catch (error: any) {
    // Concurrent submissions may race on the unique enquiry/click indexes.
    if (error?.code === 11000) {
      try {
        const { campaign, partner, target } = await resolveTracking(token.slug, token.ref, token.pid);
        const existing = await Lead.findOne({ partnerId: partner.partnerId, campaignId: String(campaign._id), accountId: `ENQUIRY:${token.clickId}` }).lean().exec();
        if (existing) { rememberCapture(req, res, token); registrationResponse(res, { registered: true }); return; }
      } catch { /* Preserve the original failure if the enquiry cannot be confirmed. */ }
    }
    const status = error?.status || 503;
    const message = status < 500 ? error.message : 'We could not save your enquiry. Please submit the form again to continue.';
    if (tracking) renderForm(res, tracking.campaign, req.body.captureToken, message, name.slice(0, 120), rawMobile.slice(0, 20), status, consent);
    else renderMessage(res, message, captureLink(token.slug, token.ref, token.pid), status);
  } finally { await session?.endSession(); }
};
