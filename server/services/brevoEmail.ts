const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function recoveryEmailConfig() {
  const key = process.env.BREVO_API_KEY?.trim();
  const sender = process.env.EMAIL_FROM_ADDRESS?.trim();
  const name = process.env.EMAIL_FROM_NAME?.trim() || 'VED Affiliate';
  let app: URL;
  try { app = new URL(process.env.PUBLIC_APP_URL || ''); } catch { throw new Error('Recovery email configuration is incomplete.'); }
  if (!key || !sender || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sender) || /[\r\n]/.test(name)
    || app.protocol !== 'https:' || app.username || app.password || app.pathname !== '/' || app.search || app.hash
    || (process.env.NODE_ENV === 'production' && app.origin !== 'https://vedaffiliatepvtltd.com')) {
    throw new Error('Recovery email configuration is invalid.');
  }
  return { key, sender, name, origin: app.origin };
}

export function passwordResetEmail(resetUrl: string) {
  const textContent = `VED AFFILIATE PVT. LIMITED\n\nWe received a request to reset your password.\n\nReset your password: ${resetUrl}\n\nThis link expires in 15 minutes and can be used once. If you did not request this reset, ignore this email. Your password will remain unchanged.\n\nVED Affiliate`;
  const htmlContent = `<!doctype html><html><body style="margin:0;background:#070b14;font-family:Arial,sans-serif;color:#e2e8f0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:560px;background:#0b1325;border:1px solid #263650;border-radius:16px"><tr><td style="padding:32px"><p style="color:#e5c35a;font-weight:bold;letter-spacing:2px">VED AFFILIATE</p><p style="font-size:11px;color:#aab3c2">PVT. LIMITED</p><h1 style="font-size:24px;color:#ffffff">Reset your password</h1><p style="line-height:1.7">We received a request to reset your password. Use the button below to choose a new password.</p><p style="padding:20px 0"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#d4af37;color:#070b14;padding:16px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Reset Password</a></p><p style="line-height:1.7">This link expires in <strong>15 minutes</strong> and can be used once.</p><p style="color:#aab3c2;line-height:1.7">If you did not request this reset, ignore this email. Your password will remain unchanged.</p><p style="font-size:12px;color:#aab3c2">If the button does not work, copy this full link:</p><p style="word-break:break-all;font-size:12px">${escapeHtml(resetUrl)}</p></td></tr></table></td></tr></table></body></html>`;
  return { subject: 'Reset Your Password — VED Affiliate', htmlContent, textContent };
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const config = recoveryEmailConfig();
  const url = new URL('/reset-password', config.origin);
  // Fragment tokens never reach Nginx access logs or HTTP Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'api-key': config.key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { email: config.sender, name: config.name }, to: [{ email }], ...passwordResetEmail(url.toString()) }),
    });
    // Never log provider bodies: they may contain recipients, links or credentials.
    if (response.status !== 201) { await response.body?.cancel(); throw new Error('Provider rejected email.'); }
    await response.body?.cancel();
  } catch { throw new Error('Password reset email could not be submitted.'); }
}
