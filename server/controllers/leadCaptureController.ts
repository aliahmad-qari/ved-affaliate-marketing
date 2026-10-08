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
  // Native form POSTs can send Origin: null under no-referrer; keep the origin for this same-origin submission.
  // The policy still suppresses the Referer when redirecting to an external vendor.
  res.set('Referrer-Policy', 'same-origin');
  // Browsers also check form-action on the vendor's redirect chain after a POST.
  // This page executes no scripts and the server alone chooses the HTTP(S) destination.
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http:; base-uri 'none'; frame-ancestors 'none'");
  res.status(status).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Start your application | VED Affiliate</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100svh;display:grid;place-items:center;background:radial-gradient(ellipse at 10% 15%,#132e49 0,transparent 50%),radial-gradient(ellipse at 95% 90%,#202014 0,transparent 40%),#070d18;color:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;padding:40px 24px;line-height:1.5;font-weight:500}
.shell{width:100%;max-width:950px;min-width:0}.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:26px}.brand{display:flex;align-items:center;gap:12px;font-size:12px;letter-spacing:1.8px;font-weight:700}.brandmark{display:grid;place-items:center;width:43px;height:43px;border:1.5px solid #d4af37;border-radius:50%;color:#d4af37;font-size:12px;letter-spacing:0;background:linear-gradient(135deg,#d4af370a,#d4af37080);box-shadow:0 0 12px #d4af370a}.brand small{display:block;margin-top:4px;font-size:9px;font-weight:400;color:#8f9db2;letter-spacing:2px}.toplabel{font-size:10px;letter-spacing:1.2px;color:#99abc2}
main{display:grid;grid-template-columns:.85fr 1.15fr;border:1px solid #26364d;border-radius:22px;overflow:hidden;background:#101c2e;box-shadow:0 28px 80px #0005;overflow-wrap:anywhere}.intro{padding:42px 32px;background:linear-gradient(155deg,#193951,#102236 65%,#0c1a2b);border-right:1px solid #26364d;display:flex;flex-direction:column}.intro .eyebrow{color:#6ce0da}.intro h2{font-size:30px;line-height:1.25;font-weight:700;letter-spacing:-.7px;margin:16px 0}.intro p{font-size:13px;color:#9fb1c8;line-height:1.8}.steps{list-style:none;padding:0;margin:28px 0}.steps li{display:flex;gap:12px;margin-bottom:23px;align-items:flex-start}.steps .number{display:grid;place-items:center;flex-shrink:0;width:29px;height:29px;border:1px solid #3a516b;border-radius:50%;font-size:11px;color:#87a2c1;background:linear-gradient(135deg,transparent,#1a3a5008)}.steps li:first-child .number{color:#07101c;background:linear-gradient(135deg,#d4af37,#e9c85a);border-color:#d4af37}.steps strong{display:block;font-size:12px;color:#e3ecf5}.steps small{display:block;margin-top:3px;font-size:10px;color:#8ea4bf}.intro-note{margin-top:auto;padding-top:20px;border-top:1px solid #304259;font-size:10px;color:#8fa6bd;line-height:1.8}
.content{padding:40px 38px}.eyebrow{font-size:9px;letter-spacing:2px;font-weight:700;color:#d4af37;display:inline-block;padding:6px 12px;background:#d4af370d;border-radius:6px}
.form-header{margin-bottom:28px}h1{font-size:28px;line-height:1.2;letter-spacing:-.6px;margin:12px 0 8px;font-weight:700;color:#e9eef6}p{color:#9facbf;font-size:12px;line-height:1.75;margin:10px 0}.campaign-card{display:flex;align-items:center;justify-content:space-between;margin:28px 0;padding:16px;border:1px solid #2b3d54;border-radius:12px;background:linear-gradient(135deg,#0f1f35,#0a1525);box-shadow:0 4px 12px #0005}.campaign-header{display:flex;align-items:center;gap:14px}.campaign-header .initial{display:grid;place-items:center;flex-shrink:0;width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#d4af3720,#d4af3715);color:#d4af37;font-size:15px;font-weight:700;border:1px solid #d4af37;box-shadow:0 0 8px #d4af370a}.campaign-info strong{display:block;font-size:13px;color:#e9edf4;font-weight:600}.campaign-info small{display:block;margin-top:2px;font-size:11px;color:#91a1b8;font-weight:400}.campaign-badge{font-size:10px;font-weight:600;color:#d4af37;background:#d4af370a;border:1px solid #d4af3720;padding:6px 12px;border-radius:8px}
.error-container{display:flex;gap:12px;margin:20px 0;padding:14px;border:1px solid #c84b4b;border-radius:10px;background:linear-gradient(135deg,#5a1a1a,#3d0f0f);box-shadow:0 2px 8px #0005}.error-icon{font-size:18px;flex-shrink:0}.error-content strong{display:block;font-size:12px;color:#ffa0a0;margin-bottom:4px}.error-content p{color:#ff9999;font-size:11px;margin:0}
.form-container{margin:28px 0}.form-section{margin-bottom:24px}.form-label{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#c3cede;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}.label-required{color:#fca5a5;font-weight:700}.form-field-group{position:relative;display:flex;align-items:center}.form-input{flex:1;padding:13px 14px 13px 38px;background:#091424;border:1.5px solid #2b3c52;border-radius:10px;color:#fff;font-size:16px;transition:all .2s;font-weight:500}
.input-icon{position:absolute;left:12px;font-size:16px;pointer-events:none;opacity:.6}
.form-input::placeholder{color:#52647c;font-size:14px}
.form-input:focus-visible{border-color:#d4af37;box-shadow:0 0 0 2px #d4af370a;outline:none}
.help-text{display:block;margin-top:8px;font-size:10px;color:#7f90a8;font-weight:400}
.consent-section{margin:26px 0 24px}.consent-checkbox{display:flex;gap:12px;align-items:flex-start;line-height:1.6;color:#97a8be;font-size:11px;font-weight:400;padding:14px;background:linear-gradient(135deg,#0f1f35,#0a1525);border:1.5px solid #223249;border-radius:10px;cursor:pointer;transition:all .2s}.consent-checkbox:hover{border-color:#3a5070;background:linear-gradient(135deg,#141f35,#0f1529)}.consent-checkbox input{display:none}.checkbox-custom{flex-shrink:0;width:18px;height:18px;border:1.5px solid #3a5070;border-radius:6px;background:#091424;transition:all .2s;display:grid;place-items:center}.consent-checkbox input:checked+.checkbox-custom{background:linear-gradient(135deg,#d4af37,#e9c85a);border-color:#d4af37}.consent-checkbox input:checked+.checkbox-custom::after{content:'✓';color:#07101c;font-size:11px;font-weight:700}.consent-text{flex:1}
.submit-button{width:100%;border:1px solid #d4af37;border-radius:10px;background:linear-gradient(110deg,#d4af37,#e9c85a);color:#07101c;font-size:13px;font-weight:700;padding:15px;margin-top:8px;cursor:pointer;box-shadow:0 8px 24px #d4af371c;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}
.submit-button:hover{filter:brightness(1.08);box-shadow:0 12px 32px #d4af372c}
.submit-button:active{transform:scale(.98)}
.button-text{flex:1}
.button-arrow{font-weight:700;font-size:14px}
.security-footer{margin-top:28px;padding-top:20px;border-top:1px solid #1e2e45}.security-note{display:flex;align-items:center;gap:8px;font-size:11px;color:#6ce0da;margin-bottom:10px;font-weight:600}.security-icon{font-size:14px}.footer-note{font-size:10px;text-align:center;color:#7e90a9;margin:12px 0 0;line-height:1.6}
a{color:#d4af37;display:inline-block;padding:12px 0}.page-footer{display:flex;justify-content:space-between;gap:10px;margin-top:20px;font-size:9px;color:#647b96;font-weight:500}
@media(max-width:680px){body{padding:24px 16px;place-items:start center}.topbar{margin-bottom:20px}.toplabel{display:none}main{grid-template-columns:1fr;border-radius:16px}.intro{padding:23px 25px;border-right:0;border-bottom:1px solid #26364d}.intro h2{font-size:23px;margin:9px 0}.intro p{margin:6px 0;font-size:11px}.steps{display:flex;justify-content:space-between;gap:8px;margin:16px 0 0}.steps li{margin:0;display:block;flex:1}.steps .number{margin-bottom:7px;width:24px;height:24px;font-size:9px}.steps strong{font-size:9px}.steps small,.intro-note{display:none}.content{padding:27px 25px}h1{font-size:24px;margin:8px 0 6px}.form-header{margin-bottom:20px}.campaign-card{margin:20px 0;padding:12px}.campaign-header{gap:10px}.campaign-header .initial{width:36px;height:36px;font-size:13px}.campaign-info strong{font-size:12px}.campaign-info small{font-size:10px}.campaign-badge{font-size:9px;padding:5px 10px}.form-section{margin-bottom:18px}.submit-button{padding:13px;font-size:12px}.security-footer{margin-top:20px;padding-top:15px}.page-footer{font-size:8px}}@media(max-width:360px){.content,.intro{padding:22px 18px}.brand{font-size:10px}.brandmark{width:36px;height:36px;font-size:10px}}
</style></head><body><div class="shell"><header class="topbar"><div class="brand"><span class="brandmark">VED</span><div>VED <span style="color:#d4af37">AFFILIATE</span><small>PVT. LIMITED</small></div></div><span class="toplabel">YOUR NEXT OPPORTUNITY STARTS HERE</span></header><main><aside class="intro"><span class="eyebrow">A SIMPLE FIRST STEP</span><h2>Your opportunity.<br>Your next move.</h2><p>Start your enquiry with VED Affiliate and continue to the campaign provider when you are ready.</p><ol class="steps"><li><span class="number">1</span><div><strong>Share your details</strong><small>Your name and contact number</small></div></li><li><span class="number">2</span><div><strong>Continue to provider</strong><small>Follow the campaign application link</small></div></li><li><span class="number">3</span><div><strong>Complete application</strong><small>Follow the provider's instructions</small></div></li></ol><div class="intro-note">Your enquiry is recorded when you submit this form. Application progress is reviewed separately by the VED admin team.</div></aside><section class="content">
${content}</section></main><footer class="page-footer"><span>VED AFFILIATE PVT. LIMITED</span><span>Campaign enquiries &amp; partner opportunities</span></footer></div></body></html>`);
}

function captureLink(slug: string, ref: string, pid: string) {
  return `/api/public/campaigns/${encodeURIComponent(slug)}/go?${new URLSearchParams({ ref, pid })}`;
}

function renderMessage(res: Response, message: string, retryLink = '', status = 400) {
  renderPage(res, `<h1>Application form</h1><p class="error" role="alert">${escapeHtml(message)}</p>
${retryLink ? `<a href="${escapeHtml(retryLink)}">Reopen the form</a>` : '<p>Please reopen the original campaign link to continue.</p>'}`, status);
}

function renderForm(res: Response, campaign: any, token: string, error = '', name = '', mobile = '', status = 200, consent = false) {
  renderPage(res, `
<div class="form-header">
  <span class="eyebrow">📋 APPLICATION ENQUIRY</span>
  <h1>Complete Your Profile</h1>
  <p>Just two quick details to get started with ${escapeHtml(campaign.companyName)}</p>
</div>

<div class="campaign-card">
  <div class="campaign-header">
    <span class="initial">${escapeHtml(campaign.name.substring(0, 2).toUpperCase())}</span>
    <div class="campaign-info">
      <strong>${escapeHtml(campaign.name)}</strong>
      <small>${escapeHtml(campaign.companyName)}</small>
    </div>
  </div>
  <div class="campaign-badge">Verified Partner Opportunity</div>
</div>

${error ? `
<div class="error-container" role="alert">
  <span class="error-icon">⚠️</span>
  <div class="error-content">
    <strong>Please fix this:</strong>
    <p>${escapeHtml(error)}</p>
  </div>
</div>
` : ''}

<form method="post" action="/api/public/campaigns/${encodeURIComponent(campaign.slug)}/go" class="form-container">
  <input type="hidden" name="captureToken" value="${escapeHtml(token)}">
  
  <div class="form-section">
    <label for="customer-name" class="form-label">
      <span class="label-text">Full Name</span>
      <span class="label-required">*</span>
    </label>
    <div class="form-field-group">
      <input 
        id="customer-name" 
        name="clientName" 
        type="text" 
        autocomplete="name" 
        minlength="2" 
        maxlength="120" 
        placeholder="Enter your full name" 
        value="${escapeHtml(name)}" 
        class="form-input"
        required>
      <span class="input-icon">👤</span>
    </div>
  </div>

  <div class="form-section">
    <label for="customer-mobile" class="form-label">
      <span class="label-text">Contact Number</span>
      <span class="label-required">*</span>
    </label>
    <div class="form-field-group">
      <input 
        id="customer-mobile" 
        name="clientMobile" 
        type="tel" 
        inputmode="tel" 
        autocomplete="tel" 
        aria-describedby="mobile-help" 
        maxlength="20" 
        placeholder="10-digit mobile number" 
        value="${escapeHtml(mobile)}" 
        class="form-input"
        required>
      <span class="input-icon">📱</span>
    </div>
    <span id="mobile-help" class="help-text">Enter your Indian mobile number. +91 is also accepted.</span>
  </div>

  <div class="consent-section">
    <label class="consent-checkbox">
      <input 
        type="checkbox" 
        name="consent" 
        value="yes" 
        ${consent ? 'checked' : ''} 
        required
        class="checkbox-input">
      <span class="checkbox-custom"></span>
      <span class="consent-text">I agree that VED Affiliate may save my name and contact number and contact me about this application.</span>
    </label>
  </div>

  <button type="submit" class="submit-button">
    <span class="button-text">Submit &amp; Continue</span>
    <span class="button-arrow">→</span>
  </button>
</form>

<div class="security-footer">
  <div class="security-note">
    <span class="security-icon">🔒</span>
    <span>Your data is encrypted and secure</span>
  </div>
  <p class="footer-note">Your enquiry is recorded before you continue. Application completion will be verified separately.</p>
</div>
`, status);
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
