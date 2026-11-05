import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Partner } from '../models/Partner.ts';
import { PartnerSignupChallenge } from '../models/PartnerSignupChallenge.ts';
import { PartnerStore } from './partnerStore.ts';
import { recoveryEmailConfig, sendPartnerSignupOtpEmail } from './brevoEmail.ts';
import { generatePartnerId, generateReferralCode } from '../utils/partnerIdGenerator.ts';
import { normalizeKyc, validateKyc } from '../utils/kyc.ts';
import { signToken } from '../utils/jwt.ts';

export const SIGNUP_OTP_TTL_MS = 10 * 60 * 1000;
export const SIGNUP_OTP_COOLDOWN_MS = 60 * 1000;
export const SIGNUP_OTP_WINDOW_MS = 60 * 60 * 1000;
export const SIGNUP_OTP_RECOVERY_COOLDOWN_MS = 5 * 60 * 1000;
export const SIGNUP_OTP_MAX_SENDS = 5;
export const SIGNUP_OTP_MAX_ATTEMPTS = 5;
export const SIGNUP_OTP_GENERIC_MESSAGE = 'If these details can be registered, a verification code has been sent. Check your inbox and spam folder. If you already have an account, sign in.';
type SignupInput = {
  fullName: string; mobile: string; email: string; city: string; state: string;
  password: string; confirmPassword: string; referralCodeInput?: string;
  pan?: string; bankDetails?: { accountHolderName: string; accountNumber: string; ifscCode: string; bankName: string }; upiId?: string;
};

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('Signup verification is temporarily unavailable.');
  return value;
}

function emailKey(email: string): string {
  return crypto.createHmac('sha256', secret()).update(`partner-signup-email:${email}`).digest('hex');
}

function otpHash(email: string, otp: string): string {
  return crypto.createHmac('sha256', secret()).update(`partner-signup-otp:${email}:${otp}`).digest('hex');
}

function encryptPendingKyc(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(secret()).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptPendingKyc(value: string): Record<string, unknown> {
  const [ivText, tagText, ciphertextText] = value.split('.');
  if (!ivText || !tagText || !ciphertextText) throw new Error('Signup verification data is unavailable.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(secret()).digest(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8'));
}

function equalHash(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex'); const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function newOtp(): string { return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0'); }
const isDuplicateKey = (error: any) => error?.code === 11000;
const silent = async (promise: Promise<unknown>) => { try { await promise; } catch { /* Do not emit PII or provider details. */ } };
async function assertOtpStorageReady(): Promise<void> {
  const indexes = await PartnerSignupChallenge.collection.indexes();
  const purgeIndex = indexes.find(index => index.name === 'partner_signup_challenge_purge'
    && index.key?.purgeAt === 1 && index.expireAfterSeconds === 0);
  const partnerIndexes = await Partner.collection.indexes();
  const uniqueEmail = partnerIndexes.some(index => index.key?.email === 1 && index.unique === true);
  const uniqueMobile = partnerIndexes.some(index => index.key?.mobile === 1 && index.unique === true);
  if (!purgeIndex || !uniqueEmail || !uniqueMobile) throw new Error('Signup verification storage is not prepared.');
}

function validateInput(input: SignupInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.fullName || typeof input.fullName !== 'string' || input.fullName.trim().length < 3) errors.fullName = 'Full Name must be at least 3 characters.';
  if (!input.mobile || !/^[6-9]\d{9}$/.test(String(input.mobile).trim())) errors.mobile = 'Enter a valid 10-digit Indian mobile number.';
  if (!input.email || typeof input.email !== 'string' || input.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = 'Please provide a valid email address.';
  if (!input.city || typeof input.city !== 'string' || input.city.trim().length < 2) errors.city = 'City is required.';
  if (!input.state || typeof input.state !== 'string' || input.state.trim().length < 2) errors.state = 'State is required.';
  if (typeof input.password !== 'string' || input.password.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(input.password)) errors.password = 'Password must be at least 8 characters long and contain a letter and a number.';
  if (input.password !== input.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  if (input.pan !== undefined || input.bankDetails !== undefined || input.upiId !== undefined) {
    Object.assign(errors, validateKyc({ pan: input.pan, bankDetails: input.bankDetails, upiId: input.upiId }));
  }
  return errors;
}

function challengeData(input: SignupInput, hashedPassword: string, otp: string, now: Date) {
  const email = input.email.trim().toLowerCase();
  const includesKyc = input.pan !== undefined || input.bankDetails !== undefined || input.upiId !== undefined;
  const kyc = includesKyc ? normalizeKyc({ pan: input.pan, bankDetails: input.bankDetails, upiId: input.upiId }) : {};
  return {
    _id: emailKey(email), email, fullName: input.fullName.trim(), mobile: input.mobile.trim(), city: input.city.trim(), state: input.state.trim(),
    passwordHash: hashedPassword, referralCodeInput: typeof input.referralCodeInput === 'string' ? input.referralCodeInput.trim().toUpperCase() : '',
    ...(includesKyc ? { encryptedKyc: encryptPendingKyc(kyc) } : {}),
    otpHash: otpHash(email, otp), expiresAt: new Date(now.getTime() + SIGNUP_OTP_TTL_MS),
    purgeAt: new Date(now.getTime() + 24 * SIGNUP_OTP_WINDOW_MS), lastSentAt: now, sendWindowStartedAt: now,
    sendsInWindow: 1, attempts: 0, verifiedAt: undefined, completedAt: undefined,
  };
}

async function loadChallenge(id: string): Promise<any | null> {
  return PartnerSignupChallenge.findById(id).select('+passwordHash +otpHash +encryptedKyc').exec();
}

async function deliverSignupOtp(email: string, otp: string, id: string, hash: string, keepPendingOnFailure = false): Promise<boolean> {
  try { await sendPartnerSignupOtpEmail(email, otp); }
  catch {
    // Revoke only this message's code. A resend failure keeps the form data so the user can retry.
    if (keepPendingOnFailure) {
      await silent(PartnerSignupChallenge.updateOne({ _id: id, otpHash: hash }, { $set: {
        otpHash: otpHash(email, crypto.randomBytes(32).toString('hex')),
        expiresAt: new Date(0), lastSentAt: new Date(Date.now() - SIGNUP_OTP_COOLDOWN_MS),
      } }).exec());
    } else {
      await silent(PartnerSignupChallenge.deleteOne({ _id: id, otpHash: hash }).exec());
    }
    return false;
  }
  return true;
}

export async function beginPartnerSignup(input: SignupInput): Promise<{ errors?: Record<string, string>; deliveryFailed?: boolean }> {
  const errors = validateInput(input);
  if (Object.keys(errors).length) return { errors };
  await assertOtpStorageReady();
  recoveryEmailConfig();
  const email = input.email.trim().toLowerCase();
  // Never create a partner before email proof.
  const passwordHash = await bcrypt.hash(input.password, 12);
  const otp = newOtp();
  const now = new Date();
  const data = challengeData(input, passwordHash, otp, now);
  const id = data._id;
  let shouldSend = false;

  const old = await loadChallenge(id);
  if (!old) {
    try {
      await PartnerSignupChallenge.create(data);
      shouldSend = true;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // Concurrent first request owns the challenge; the response remains generic.
    }
  } else if (!old.verifiedAt && !old.completedAt && (now.getTime() - new Date(old.lastSentAt).getTime() >= SIGNUP_OTP_COOLDOWN_MS)) {
    const windowExpired = now.getTime() - new Date(old.sendWindowStartedAt).getTime() >= SIGNUP_OTP_WINDOW_MS;
    const rotated: Record<string, any> = { ...data };
    delete rotated._id; delete rotated.sendsInWindow; delete rotated.sendWindowStartedAt;
    const filter: any = { _id: id, lastSentAt: old.lastSentAt, verifiedAt: { $exists: false }, completedAt: { $exists: false } };
    const update: any = { $set: { ...rotated, ...(windowExpired ? { sendWindowStartedAt: now, sendsInWindow: 1 } : {}) } };
    if (!windowExpired) { filter.sendsInWindow = { $lt: SIGNUP_OTP_MAX_SENDS }; update.$inc = { sendsInWindow: 1 }; }
    const changed = await PartnerSignupChallenge.findOneAndUpdate(filter, update, { new: true }).exec();
    shouldSend = !!changed;
  }

  if (shouldSend && !(await deliverSignupOtp(email, otp, id, data.otpHash))) return { deliveryFailed: true };
  return {};
}

export async function resendPartnerSignupOtp(emailInput: unknown): Promise<boolean> {
  if (typeof emailInput !== 'string' || emailInput.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) return false;
  await assertOtpStorageReady();
  recoveryEmailConfig();
  const email = emailInput.trim().toLowerCase(); const id = emailKey(email); const now = new Date();
  const old = await loadChallenge(id);
  if (!old || old.completedAt || now.getTime() - new Date(old.lastSentAt).getTime() < SIGNUP_OTP_COOLDOWN_MS) return false;
  const recoveryOfConsumedCode = !!old.verifiedAt;
  if (recoveryOfConsumedCode) {
    if (now.getTime() - new Date(old.verifiedAt).getTime() < SIGNUP_OTP_RECOVERY_COOLDOWN_MS) return false;
    // If the previous verification created the account but its response was lost, require sign-in.
    if (await Partner.findOne({ email }).select('_id').exec()) return false;
  }
  const windowExpired = now.getTime() - new Date(old.sendWindowStartedAt).getTime() >= SIGNUP_OTP_WINDOW_MS;
  const otp = newOtp(); const hash = otpHash(email, otp);
  const filter: any = { _id: id, lastSentAt: old.lastSentAt, completedAt: { $exists: false } };
  if (recoveryOfConsumedCode) filter.verifiedAt = old.verifiedAt;
  else filter.verifiedAt = { $exists: false };
  const set: any = { otpHash: hash, expiresAt: new Date(now.getTime() + SIGNUP_OTP_TTL_MS), purgeAt: new Date(now.getTime() + 24 * SIGNUP_OTP_WINDOW_MS), lastSentAt: now, attempts: 0 };
  if (windowExpired) Object.assign(set, { sendWindowStartedAt: now, sendsInWindow: 1 });
  else { filter.sendsInWindow = { $lt: SIGNUP_OTP_MAX_SENDS }; set.sendsInWindow = old.sendsInWindow + 1; }
  const update: any = { $set: set };
  if (recoveryOfConsumedCode) update.$unset = { verifiedAt: 1 };
  const changed = await PartnerSignupChallenge.findOneAndUpdate(filter, update, { new: true }).exec();
  if (changed && !(await deliverSignupOtp(email, otp, id, hash, true))) return true;
  return false;
}

export async function verifyPartnerSignupOtp(emailInput: unknown, otpInput: unknown): Promise<{ partner: any; token: string } | null> {
  if (typeof emailInput !== 'string' || typeof otpInput !== 'string' || !/^\d{6}$/.test(otpInput)) return null;
  const email = emailInput.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  await assertOtpStorageReady();
  const id = emailKey(email); const now = new Date();
  let challenge = await loadChallenge(id);
  if (!challenge || challenge.email !== email || challenge.verifiedAt || challenge.completedAt || new Date(challenge.expiresAt) <= now) return null;
  const candidate = otpHash(email, otpInput);
  if (!equalHash(String(challenge.otpHash || ''), candidate)) {
    if (!challenge.verifiedAt && challenge.attempts < SIGNUP_OTP_MAX_ATTEMPTS) {
      await PartnerSignupChallenge.updateOne({ _id: id, otpHash: challenge.otpHash, verifiedAt: { $exists: false }, attempts: { $lt: SIGNUP_OTP_MAX_ATTEMPTS }, expiresAt: { $gt: now } }, { $inc: { attempts: 1 } }).exec();
    }
    return null;
  }
  if (challenge.attempts >= SIGNUP_OTP_MAX_ATTEMPTS && !challenge.verifiedAt) return null;

  // Compare-and-set consumes the code exactly once; concurrent or replayed requests fail here.
  challenge = await PartnerSignupChallenge.findOneAndUpdate({ _id: id, otpHash: candidate, expiresAt: { $gt: now }, attempts: { $lt: SIGNUP_OTP_MAX_ATTEMPTS }, verifiedAt: { $exists: false }, completedAt: { $exists: false } }, { $set: { verifiedAt: now } }, { new: true }).select('+passwordHash +otpHash +encryptedKyc').exec();
  if (!challenge) return null;

  // Recover safely if account creation succeeded but challenge completion was interrupted.
  let existing = await Partner.findOne({ email }).select('+passwordHash +emailVerifiedAt').exec();
  let partner: any;
  if (existing) {
    if (!existing.emailVerifiedAt || new Date(existing.emailVerifiedAt).getTime() !== new Date(challenge.verifiedAt).getTime()) {
      await silent(PartnerSignupChallenge.deleteOne({ _id: id }).exec());
      return null;
    }
    partner = existing;
  } else {
    const duplicate = await PartnerStore.checkDuplicates(email, challenge.mobile);
    if (duplicate.duplicateEmail || duplicate.duplicateMobile) {
      await silent(PartnerSignupChallenge.deleteOne({ _id: id }).exec());
      return null;
    }

    let referralCode = generateReferralCode();
    while (await PartnerStore.findByReferralCode(referralCode)) referralCode = generateReferralCode();
    const referred = challenge.referralCodeInput ? await PartnerStore.findByReferralCode(challenge.referralCodeInput) : null;
    const partnerId = generatePartnerId();
    const verifiedKyc = challenge.encryptedKyc ? decryptPendingKyc(challenge.encryptedKyc) : {};
    try {
      partner = await PartnerStore.create({
        partnerId, fullName: challenge.fullName, mobile: challenge.mobile, email,
        city: challenge.city, state: challenge.state, passwordHash: challenge.passwordHash,
        ...verifiedKyc,
        role: 'PARTNER', accountStatus: 'ACTIVE', emailVerifiedAt: challenge.verifiedAt,
        kycStatus: 'PENDING', kycRejectionReason: '', referralCode,
        referredBy: referred?.partnerId || '',
      } as any);
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      existing = await Partner.findOne({ email }).select('+passwordHash +emailVerifiedAt').exec();
      if (!existing?.emailVerifiedAt || new Date(existing.emailVerifiedAt).getTime() !== new Date(challenge.verifiedAt).getTime()) {
        await silent(PartnerSignupChallenge.deleteOne({ _id: id }).exec());
        return null;
      }
      partner = existing;
    }
  }

  await PartnerSignupChallenge.updateOne({ _id: id, verifiedAt: challenge.verifiedAt, completedAt: { $exists: false } }, { $set: { completedAt: new Date() }, $unset: { passwordHash: 1, otpHash: 1, encryptedKyc: 1 } }).exec();
  const token = signToken({ id: partner._id || partner.id, partnerId: partner.partnerId, email: partner.email, role: partner.role });
  const safePartner = typeof partner.toJSON === 'function' ? partner.toJSON() : { ...partner };
  delete safePartner.passwordHash;
  return { partner: safePartner, token };
}
