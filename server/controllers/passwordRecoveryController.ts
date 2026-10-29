import { Request, Response } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Partner } from '../models/Partner.ts';
import { AdminUser } from '../models/AdminUser.ts';
import { getDbStatus } from '../config/db.ts';
import { recoveryEmailConfig, sendPasswordResetEmail } from '../services/brevoEmail.ts';

export const RECOVERY_MESSAGE = 'If an eligible account with that email address is registered, password reset instructions will be sent. Please check your inbox and spam folder.';
export const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export const validRecoveryPassword = (value: unknown): value is string => typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);

// One outstanding token per account; atomic cooldown limits distributed email flooding.
export async function issuePasswordReset(email: string, accountType: 'partner' | 'admin') {
  const model = accountType === 'admin' ? AdminUser : Partner;
  const eligibility = accountType === 'admin' ? { status: 'ACTIVE' } : { accountStatus: 'ACTIVE' };
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const now = new Date();
  const account: any = await model.findOneAndUpdate({ email, ...eligibility,
    $or: [{ resetPasswordRequestedAt: { $exists: false } }, { resetPasswordRequestedAt: { $lte: new Date(now.getTime() - 60000) } }],
  }, { $set: { resetPasswordToken: tokenHash, resetPasswordExpires: new Date(now.getTime() + 15 * 60000), resetPasswordRequestedAt: now } }, { new: true }).select('_id email').lean().exec();
  if (!account) return;
  try { await sendPasswordResetEmail(account.email, rawToken); }
  catch {
    await model.updateOne({ _id: account._id, resetPasswordToken: tokenHash }, { $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } }).exec();
    throw new Error('Recovery email submission failed.');
  }
}

export const forgotPassword = (req: Request, res: Response): void => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const accountType = req.body.accountType === 'admin' ? 'admin' : 'partner';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ success: false, message: 'Enter a valid email address.' }); return;
  }
  try { recoveryEmailConfig(); if (!getDbStatus().isConnected) throw new Error(); }
  catch { res.status(503).json({ success: false, message: 'Password recovery is temporarily unavailable. Please try again later.' }); return; }
  // Return identical responses/timing before account lookup and provider I/O.
  // Best-effort background delivery; no token or recipient is logged on failure.
  res.on('finish', () => { void issuePasswordReset(email, accountType).catch(() => console.error('[VED RECOVERY] Email request could not be completed.')); });
  res.status(200).json({ success: true, message: RECOVERY_MESSAGE });
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  const { token, password, confirmPassword } = req.body;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    res.status(400).json({ success: false, message: 'Invalid or expired reset link. Please request a new one.' }); return;
  }
  if (!validRecoveryPassword(password)) {
    res.status(400).json({ success: false, message: 'Use at least 8 characters with letters and numbers, and no more than 72 UTF-8 bytes.' }); return;
  }
  if (password !== confirmPassword) { res.status(400).json({ success: false, message: 'Passwords do not match.' }); return; }
  if (!getDbStatus().isConnected) { res.status(503).json({ success: false, message: 'Password recovery is temporarily unavailable.' }); return; }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const filter = { resetPasswordToken: hashResetToken(token), resetPasswordExpires: { $gt: now }, resetPasswordRequestedAt: { $gt: new Date(now.getTime() - 15 * 60000) } };
    const update = { $set: { passwordHash, sessionsInvalidatedAt: now }, $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } };
    // Compare-and-consume in the same account update: no replica-set transaction required.
    const partner = await Partner.findOneAndUpdate({ ...filter, accountStatus: 'ACTIVE' }, update, { new: true }).select('_id').lean().exec();
    const admin = partner ? null : await AdminUser.findOneAndUpdate({ ...filter, status: 'ACTIVE' }, update, { new: true }).select('_id').lean().exec();
    if (!partner && !admin) { res.status(400).json({ success: false, message: 'Invalid or expired reset link. Please request a new one.' }); return; }
    res.status(200).json({ success: true, message: 'Your password has been updated. Sign in again with your new password.', loginPath: admin ? 'admin/login' : 'login' });
  } catch { res.status(503).json({ success: false, message: 'Password recovery is temporarily unavailable. Please try again later.' }); }
};
